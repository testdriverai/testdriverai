/**
 * POC: Using 2captcha to solve reCAPTCHA v3
 * Uses Chrome remote debugging (CDP) to interact with the page
 */
import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

const TWOCAPTCHA_API_KEY = '43381d9af41dd532950dc7abeda5dbd1';
const DEMO_URL = 'https://2captcha.com/demo/recaptcha-v3';

describe("2captcha reCAPTCHA v3 POC", () => {

  it("should solve reCAPTCHA v3 using 2captcha service", async (context) => {
    const testdriver = TestDriver(context);

    // Launch Chrome and navigate to the demo page
    await testdriver.provision.chrome({
      url: DEMO_URL,
    });

    // Take initial screenshot
    await testdriver.screenshot();

    // Install chrome-remote-interface
    console.log('Installing chrome-remote-interface...');
    await testdriver.exec(
      'sh',
      'sudo npm install -g chrome-remote-interface',
      60000
    );

    // Write the CDP solver script
    const solverScript = `
const CDP = require('chrome-remote-interface');

const TWOCAPTCHA_API_KEY = '${TWOCAPTCHA_API_KEY}';
const PAGE_URL = '${DEMO_URL}';

// Helper to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to make HTTP requests
const httpRequest = (url) => {
  return new Promise((resolve, reject) => {
    const https = require('https');
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
};

(async () => {
  try {
    console.log('STEP: Connecting to Chrome via CDP...');
    const client = await CDP();
    const { Runtime, Page } = client;

    // Enable Runtime for script execution
    await Runtime.enable();
    await Page.enable();

    // Wait for page to fully load
    await sleep(3000);

    // Extract the sitekey from the page
    console.log('STEP: Extracting sitekey from page...');
    const sitekeyResult = await Runtime.evaluate({
      expression: \`
        // Look for the sitekey in the grecaptcha render/execute call or data attribute
        (function() {
          // Try to find it in script tags
          const scripts = document.querySelectorAll('script');
          for (const script of scripts) {
            // Match grecaptcha.execute('SITEKEY', ...) or grecaptcha.render('SITEKEY', ...)
            const executeMatch = script.textContent.match(/grecaptcha\\.(?:execute|render)\\s*\\(\\s*['"]([0-9A-Za-z_-]{40})['"]/);
            if (executeMatch) return executeMatch[1];
            // Match sitekey: 'KEY' or sitekey = 'KEY'
            const sitekeyMatch = script.textContent.match(/sitekey['"\\s:=]+['"]([0-9A-Za-z_-]{40})['"]/) ||
                          script.textContent.match(/render['"\\s:]+['"]([0-9A-Za-z_-]{40})['"]/);
            if (sitekeyMatch) return sitekeyMatch[1];
          }
          // Try data-sitekey attribute
          const elem = document.querySelector('[data-sitekey]');
          if (elem) return elem.getAttribute('data-sitekey');
          return null;
        })()
      \`
    });

    let sitekey = sitekeyResult.result.value;
    console.log('SITEKEY_FOUND:', sitekey);

    if (!sitekey) {
      // Fallback: the 2captcha demo page uses this known sitekey for v3
      sitekey = '6LfB5_IbAAAAAMCtsjEHEHKqcB9iQocwwxTiihJu';
      console.log('SITEKEY_FALLBACK:', sitekey);
    }

    // Step 1: Submit captcha to 2captcha
    console.log('STEP: Submitting to 2captcha...');
    const submitUrl = \`https://2captcha.com/in.php?key=\${TWOCAPTCHA_API_KEY}&method=userrecaptcha&googlekey=\${sitekey}&pageurl=\${encodeURIComponent(PAGE_URL)}&version=v3&action=verify&min_score=0.3&json=1\`;

    const submitResponse = await httpRequest(submitUrl);
    console.log('2CAPTCHA_SUBMIT:', submitResponse);

    const submitData = JSON.parse(submitResponse);
    if (submitData.status !== 1) {
      throw new Error('2captcha submit failed: ' + submitResponse);
    }

    const requestId = submitData.request;
    console.log('2CAPTCHA_REQUEST_ID:', requestId);

    // Step 2: Poll for the result
    console.log('STEP: Polling for solution...');
    let token = null;
    for (let i = 0; i < 30; i++) {
      await sleep(5000);

      const resultUrl = \`https://2captcha.com/res.php?key=\${TWOCAPTCHA_API_KEY}&action=get&id=\${requestId}&json=1\`;
      const resultResponse = await httpRequest(resultUrl);
      console.log('2CAPTCHA_POLL_' + i + ':', resultResponse);

      const resultData = JSON.parse(resultResponse);
      if (resultData.status === 1) {
        token = resultData.request;
        break;
      } else if (resultData.request !== 'CAPCHA_NOT_READY') {
        throw new Error('2captcha error: ' + resultResponse);
      }
    }

    if (!token) {
      throw new Error('Timeout waiting for 2captcha solution');
    }

    console.log('2CAPTCHA_TOKEN:', token.substring(0, 50) + '...');

    // Step 3: Inject the token into the page
    console.log('STEP: Injecting token into page...');
    const injectResult = await Runtime.evaluate({
      expression: \`
        (function() {
          // Find the token input field and set the value
          const tokenInput = document.querySelector('[name="g-recaptcha-response"]') ||
                            document.getElementById('g-recaptcha-response');
          if (tokenInput) {
            tokenInput.value = '\${token}';
          }

          // Also try to find a hidden textarea that grecaptcha uses
          const textareas = document.querySelectorAll('textarea');
          for (const ta of textareas) {
            if (ta.id && ta.id.includes('g-recaptcha-response')) {
              ta.value = '\${token}';
            }
          }

          // For v3, we might need to set it in a callback or form field
          // Try to find the demo form's token field
          const demoToken = document.querySelector('input[name="g-recaptcha-response"]') ||
                           document.querySelector('#g-recaptcha-response-100000');
          if (demoToken) {
            demoToken.value = '\${token}';
          }

          return 'Token injected';
        })()
      \`
    });
    console.log('INJECT_RESULT:', injectResult.result.value);

    // Step 4: Click the verify/submit button
    console.log('STEP: Clicking verify button...');
    const clickResult = await Runtime.evaluate({
      expression: \`
        (function() {
          // Find and click the verify button
          const btn = document.querySelector('button[type="submit"]') ||
                     document.querySelector('.btn-primary') ||
                     document.querySelector('button:contains("Check")') ||
                     Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Check') || b.textContent.includes('Verify'));
          if (btn) {
            btn.click();
            return 'Button clicked: ' + btn.textContent;
          }
          return 'No button found';
        })()
      \`
    });
    console.log('CLICK_RESULT:', clickResult.result.value);

    // Wait and check for success
    await sleep(3000);

    const successResult = await Runtime.evaluate({
      expression: \`
        (function() {
          // Check for success message on the 2captcha demo page
          const successElem = document.querySelector('.success-message') ||
                            document.querySelector('[class*="success"]') ||
                            document.querySelector('.alert-success');
          if (successElem) {
            return 'SUCCESS: ' + successElem.textContent;
          }

          // Check page content for success indicators
          const body = document.body.innerText;
          if (body.includes('Captcha is passed successfully') ||
              body.includes('success') ||
              body.includes('passed')) {
            return 'SUCCESS_DETECTED: ' + body.substring(0, 200);
          }

          return 'NO_SUCCESS_FOUND: ' + body.substring(0, 500);
        })()
      \`
    });
    console.log('FINAL_RESULT:', successResult.result.value);

    await client.close();
    process.exit(0);

  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
`;

    // Write script to file
    await testdriver.exec('sh', `cat > /tmp/captcha-solver.js << 'SCRIPT'
${solverScript}
SCRIPT`, 10000);

    // Run the solver script
    console.log('Running captcha solver...');
    const result = await testdriver.exec(
      'sh',
      'NODE_PATH=/usr/lib/node_modules node /tmp/captcha-solver.js 2>&1',
      180000  // 3 minute timeout for captcha solving
    );
    console.log('Solver output:', result);

    // Take final screenshot
    await testdriver.screenshot();

    // Verify we got a success
    expect(result).toContain('2CAPTCHA_TOKEN:');
  }, 300000);  // 5 minute test timeout
});
