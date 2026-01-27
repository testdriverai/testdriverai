/**
 * Captcha Solver Script
 * This script runs in the sandbox to solve captchas via 2captcha API
 * It connects to Chrome via CDP (remote debugging port 9222)
 */
const https = require("https");
const CDP = require("chrome-remote-interface");
const fs = require("fs");

// Support both Linux and Windows paths via environment variable
const configPath =
  process.env.TD_CAPTCHA_CONFIG_PATH ||
  (process.platform === "win32"
    ? "C:\\Users\\testdriver\\AppData\\Local\\Temp\\td-captcha-config.json"
    : "/tmp/td-captcha-config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

// Auto-detection script that runs in the browser context
const detectCaptchaScript = `
(function() {
  var result = { sitekey: null, type: null, action: null };

  // 1. Check for reCAPTCHA v2 with data-sitekey
  var recaptchaV2 = document.querySelector(".g-recaptcha[data-sitekey]");
  if (recaptchaV2) {
    result.sitekey = recaptchaV2.getAttribute("data-sitekey");
    result.type = recaptchaV2.getAttribute("data-size") === "invisible" ? "recaptcha_v2_invisible" : "recaptcha_v2";
    return result;
  }

  // 2. Check for hCaptcha
  var hcaptcha = document.querySelector(".h-captcha[data-sitekey]");
  if (hcaptcha) {
    result.sitekey = hcaptcha.getAttribute("data-sitekey");
    result.type = "hcaptcha";
    return result;
  }

  // 3. Check for Turnstile
  var turnstile = document.querySelector(".cf-turnstile[data-sitekey]");
  if (turnstile) {
    result.sitekey = turnstile.getAttribute("data-sitekey");
    result.type = "turnstile";
    return result;
  }

  // 4. Check for any data-sitekey
  var anySitekey = document.querySelector("[data-sitekey]");
  if (anySitekey) {
    result.sitekey = anySitekey.getAttribute("data-sitekey");
    result.type = "recaptcha_v2";
    return result;
  }

  // 5. Scan scripts for reCAPTCHA v3 (grecaptcha.execute)
  var scripts = document.querySelectorAll("script");
  for (var i = 0; i < scripts.length; i++) {
    var content = scripts[i].textContent || "";

    // Match grecaptcha.execute("SITEKEY", {action: "ACTION"})
    var v3Match = content.match(/grecaptcha\\.execute\\s*\\(\\s*["']([0-9A-Za-z_-]{40})["']\\s*,\\s*\\{\\s*action\\s*:\\s*["']([^"']+)["']/);
    if (v3Match) {
      result.sitekey = v3Match[1];
      result.action = v3Match[2];
      result.type = "recaptcha_v3";
      return result;
    }

    // Match render with sitekey
    var renderMatch = content.match(/grecaptcha\\.render\\s*\\([^,]*,\\s*\\{[^}]*sitekey\\s*:\\s*["']([0-9A-Za-z_-]{40})["']/);
    if (renderMatch) {
      result.sitekey = renderMatch[1];
      result.type = "recaptcha_v2";
      return result;
    }
  }

  // 6. Check script src for render= param (v3)
  var scriptSrc = document.querySelector('script[src*="recaptcha"][src*="render="]');
  if (scriptSrc) {
    var srcMatch = scriptSrc.src.match(/render=([0-9A-Za-z_-]{40})/);
    if (srcMatch) {
      result.sitekey = srcMatch[1];
      result.type = "recaptcha_v3";
      return result;
    }
  }

  return result;
})()`;

// Token injection script
function getInjectScript(token) {
  return `(function() {
    var t = '${token}';
    // Inject into reCAPTCHA response fields
    document.querySelectorAll('[name=g-recaptcha-response], textarea[id*=g-recaptcha-response]').forEach(function(e) {
      e.value = t;
      e.innerHTML = t;
    });
    // Inject into hCaptcha response fields
    document.querySelectorAll('[name=h-captcha-response]').forEach(function(e) {
      e.value = t;
    });
    // Inject into Turnstile response fields
    document.querySelectorAll('[name=cf-turnstile-response]').forEach(function(e) {
      e.value = t;
    });
    // Trigger reCAPTCHA callbacks
    if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {
      Object.values(window.___grecaptcha_cfg.clients).forEach(function(c) {
        if (c && typeof c === 'object') {
          Object.values(c).forEach(function(v) {
            if (v && typeof v.callback === 'function') v.callback(t);
          });
        }
      });
    }
  })()`;
}

// Auto-submit script
const autoSubmitScript = `(function() {
  var b = document.querySelector('button[type=submit]') ||
          document.querySelector('input[type=submit]') ||
          Array.from(document.querySelectorAll('button')).find(function(x) {
            return x.textContent.toLowerCase().includes('submit') ||
                   x.textContent.toLowerCase().includes('verify') ||
                   x.textContent.toLowerCase().includes('check');
          });
  if (b) b.click();
})()`;

// Success detection script
const checkSuccessScript = `(function() {
  var b = document.body.innerText.toLowerCase();
  if (b.includes('captcha is passed successfully') || b.includes('success')) {
    return { success: true };
  }
  var e = document.querySelector('.alert-success, [class*=success]');
  if (e) {
    return { success: true, message: e.textContent };
  }
  return { success: null };
})()`;

(async () => {
  try {
    const targets = await CDP.List({ port: 9222 });
    const pageTarget = targets.find(
      (t) =>
        t.type === "page" &&
        !t.url.startsWith("chrome://") &&
        !t.url.startsWith("chrome-extension://"),
    );
    if (!pageTarget) throw new Error("No page target found");

    const client = await CDP({ port: 9222, target: pageTarget });
    const { Runtime } = client;
    await Runtime.enable();
    const pageUrl = pageTarget.url;

    // Auto-detect captcha parameters from page
    let sitekey = config.sitekey;
    let captchaType = config.type;
    let action = config.action;

    if (!sitekey) {
      console.log("AUTO_DETECT: Scanning page for captcha...");
      const detectResult = await Runtime.evaluate({
        expression: detectCaptchaScript,
        returnByValue: true,
      });
      const detected = detectResult.result.value;

      if (detected && detected.sitekey) {
        sitekey = detected.sitekey;
        if (detected.type) captchaType = detected.type;
        if (detected.action) action = detected.action;
        console.log("AUTO_DETECT: Found " + captchaType);
      }
    }

    if (!sitekey) {
      throw new Error(
        "Could not auto-detect captcha. Please provide sitekey manually.",
      );
    }

    console.log("SITEKEY:", sitekey);
    console.log("TYPE:", captchaType);
    if (action) console.log("ACTION:", action);

    // Build submit URL based on captcha type
    let submitUrl =
      "https://2captcha.com/in.php?key=" + config.apiKey + "&json=1";
    if (captchaType.startsWith("recaptcha")) {
      submitUrl +=
        "&method=userrecaptcha&googlekey=" +
        sitekey +
        "&pageurl=" +
        encodeURIComponent(pageUrl);
      if (captchaType === "recaptcha_v3") {
        submitUrl += "&version=v3&min_score=0.3&action=" + (action || "verify");
      }
    } else if (captchaType === "hcaptcha") {
      submitUrl +=
        "&method=hcaptcha&sitekey=" +
        sitekey +
        "&pageurl=" +
        encodeURIComponent(pageUrl);
    } else if (captchaType === "turnstile") {
      submitUrl +=
        "&method=turnstile&sitekey=" +
        sitekey +
        "&pageurl=" +
        encodeURIComponent(pageUrl);
    }

    // Submit to 2captcha
    console.log("SUBMITTING...");
    const submitResp = JSON.parse(await httpsGet(submitUrl));
    if (submitResp.status !== 1) {
      throw new Error("Submit failed: " + JSON.stringify(submitResp));
    }
    const requestId = submitResp.request;
    console.log("REQUEST_ID:", requestId);

    // Poll for result
    let token = null;
    const maxAttempts = Math.ceil(config.timeout / config.pollInterval);
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(config.pollInterval);
      const resultResp = JSON.parse(
        await httpsGet(
          "https://2captcha.com/res.php?key=" +
            config.apiKey +
            "&action=get&id=" +
            requestId +
            "&json=1",
        ),
      );
      if (resultResp.status === 1) {
        token = resultResp.request;
        break;
      }
      if (resultResp.request !== "CAPCHA_NOT_READY") {
        throw new Error("Error: " + JSON.stringify(resultResp));
      }
      console.log("POLLING...", i + 1);
    }

    if (!token) throw new Error("Timeout");
    console.log("TOKEN:", token.substring(0, 50) + "...");

    // Inject token
    await Runtime.evaluate({ expression: getInjectScript(token) });
    console.log("INJECTED");

    // Auto-submit if enabled
    if (config.autoSubmit) {
      await sleep(1000);
      await Runtime.evaluate({ expression: autoSubmitScript });
      console.log("SUBMITTED");
    }

    // Check for success
    await sleep(3000);
    const successRes = await Runtime.evaluate({
      expression: checkSuccessScript,
      returnByValue: true,
    });

    await client.close();
    console.log("RESULT:", JSON.stringify(successRes.result.value));
    process.exit(
      successRes.result.value && successRes.result.value.success ? 0 : 1,
    );
  } catch (err) {
    console.error("ERROR:", err.message);
    process.exit(1);
  }
})();
