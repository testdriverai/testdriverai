/**
 * TestDriver Captcha Solver
 *
 * A library for solving captchas using 2captcha service via CDP.
 * Uses Chrome DevTools Protocol to detect, extract, and inject captcha solutions.
 *
 * @example
 * import { CaptchaSolver } from 'testdriverai/lib/captcha/solver.mjs';
 *
 * const solver = new CaptchaSolver({
 *   apiKey: 'your-2captcha-api-key',
 *   debugPort: 9222  // Chrome remote debugging port
 * });
 *
 * // Detect and solve captchas on current page
 * const result = await solver.solve();
 */

/**
 * Helper to make HTTPS requests
 */
function httpsRequest(url) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Sleep helper
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * CaptchaSolver class
 * Detects and solves captchas on web pages using CDP and 2captcha
 */
export class CaptchaSolver {
  constructor(options = {}) {
    this.apiKey = options.apiKey;
    this.debugPort = options.debugPort || 9222;
    this.debugHost = options.debugHost || 'localhost';
    this.pollInterval = options.pollInterval || 5000;
    this.maxPollAttempts = options.maxPollAttempts || 60;
    this.debug = options.debug || false;
  }

  log(...args) {
    if (this.debug) {
      console.log('[CaptchaSolver]', ...args);
    }
  }

  /**
   * Connect to Chrome via CDP
   */
  async connect() {
    const CDP = require('chrome-remote-interface');

    // Get list of targets
    const targets = await CDP.List({ host: this.debugHost, port: this.debugPort });
    this.log('Available targets:', targets.map(t => ({ type: t.type, url: t.url })));

    // Find the main page target
    const pageTarget = targets.find(t =>
      t.type === 'page' &&
      !t.url.startsWith('chrome://') &&
      !t.url.startsWith('chrome-extension://')
    );

    if (!pageTarget) {
      throw new Error('No page target found');
    }

    this.log('Connecting to:', pageTarget.url);
    this.client = await CDP({ host: this.debugHost, port: this.debugPort, target: pageTarget });
    this.pageUrl = pageTarget.url;

    const { Runtime, Page } = this.client;
    await Runtime.enable();
    await Page.enable();

    this.Runtime = Runtime;
    this.Page = Page;

    return this;
  }

  /**
   * Detect captchas on the current page
   * Returns array of detected captchas with their parameters
   */
  async detect() {
    const result = await this.Runtime.evaluate({
      expression: `
        (function() {
          const captchas = [];

          // Detect reCAPTCHA v2 (checkbox)
          const recaptchaV2 = document.querySelector('.g-recaptcha');
          if (recaptchaV2) {
            captchas.push({
              type: 'recaptcha_v2',
              sitekey: recaptchaV2.getAttribute('data-sitekey'),
              element: '.g-recaptcha'
            });
          }

          // Detect reCAPTCHA v2 invisible
          const invisibleRecaptcha = document.querySelector('.g-recaptcha[data-size="invisible"]');
          if (invisibleRecaptcha) {
            captchas.push({
              type: 'recaptcha_v2_invisible',
              sitekey: invisibleRecaptcha.getAttribute('data-sitekey'),
              element: '.g-recaptcha[data-size="invisible"]'
            });
          }

          // Detect reCAPTCHA v3 (usually no visible element)
          // Look for grecaptcha.execute calls in scripts
          const scripts = document.querySelectorAll('script');
          for (const script of scripts) {
            const content = script.textContent || '';

            // Match grecaptcha.execute('SITEKEY', {action: 'ACTION'})
            const v3Match = content.match(/grecaptcha\\.execute\\s*\\(\\s*['\"]([0-9A-Za-z_-]{40})['\"]\\s*,\\s*\\{\\s*action\\s*:\\s*['\"]([^'\"]+)['\"]/);
            if (v3Match) {
              captchas.push({
                type: 'recaptcha_v3',
                sitekey: v3Match[1],
                action: v3Match[2]
              });
            }

            // Match render calls for v3
            const renderMatch = content.match(/grecaptcha\\.(?:enterprise\\.)?render\\s*\\(\\s*[^,]*,\\s*\\{[^}]*sitekey\\s*:\\s*['\"]([0-9A-Za-z_-]{40})['\"]/);
            if (renderMatch && !captchas.find(c => c.sitekey === renderMatch[1])) {
              captchas.push({
                type: 'recaptcha_v2',
                sitekey: renderMatch[1]
              });
            }
          }

          // Detect hCaptcha
          const hcaptcha = document.querySelector('.h-captcha');
          if (hcaptcha) {
            captchas.push({
              type: 'hcaptcha',
              sitekey: hcaptcha.getAttribute('data-sitekey'),
              element: '.h-captcha'
            });
          }

          // Detect Cloudflare Turnstile
          const turnstile = document.querySelector('.cf-turnstile');
          if (turnstile) {
            captchas.push({
              type: 'turnstile',
              sitekey: turnstile.getAttribute('data-sitekey'),
              element: '.cf-turnstile'
            });
          }

          return captchas;
        })()
      `,
      returnByValue: true
    });

    this.log('Detected captchas:', result.result.value);
    return result.result.value || [];
  }

  /**
   * Submit captcha to 2captcha and get solution
   */
  async solveCaptcha(captcha) {
    const { type, sitekey, action } = captcha;

    let submitUrl = `https://2captcha.com/in.php?key=${this.apiKey}&json=1`;

    switch (type) {
      case 'recaptcha_v2':
      case 'recaptcha_v2_invisible':
        submitUrl += `&method=userrecaptcha&googlekey=${sitekey}&pageurl=${encodeURIComponent(this.pageUrl)}`;
        if (type === 'recaptcha_v2_invisible') {
          submitUrl += '&invisible=1';
        }
        break;

      case 'recaptcha_v3':
        submitUrl += `&method=userrecaptcha&googlekey=${sitekey}&pageurl=${encodeURIComponent(this.pageUrl)}&version=v3&min_score=0.3`;
        if (action) {
          submitUrl += `&action=${encodeURIComponent(action)}`;
        }
        break;

      case 'hcaptcha':
        submitUrl += `&method=hcaptcha&sitekey=${sitekey}&pageurl=${encodeURIComponent(this.pageUrl)}`;
        break;

      case 'turnstile':
        submitUrl += `&method=turnstile&sitekey=${sitekey}&pageurl=${encodeURIComponent(this.pageUrl)}`;
        break;

      default:
        throw new Error(`Unsupported captcha type: ${type}`);
    }

    this.log('Submitting to 2captcha:', submitUrl);

    // Submit captcha
    const submitResponse = await httpsRequest(submitUrl);
    this.log('Submit response:', submitResponse);

    const submitData = JSON.parse(submitResponse);
    if (submitData.status !== 1) {
      throw new Error(`2captcha submit failed: ${submitResponse}`);
    }

    const requestId = submitData.request;
    this.log('Request ID:', requestId);

    // Poll for solution
    for (let i = 0; i < this.maxPollAttempts; i++) {
      await sleep(this.pollInterval);

      const resultUrl = `https://2captcha.com/res.php?key=${this.apiKey}&action=get&id=${requestId}&json=1`;
      const resultResponse = await httpsRequest(resultUrl);
      this.log(`Poll ${i + 1}:`, resultResponse);

      const resultData = JSON.parse(resultResponse);
      if (resultData.status === 1) {
        return {
          token: resultData.request,
          requestId
        };
      } else if (resultData.request !== 'CAPCHA_NOT_READY') {
        throw new Error(`2captcha error: ${resultResponse}`);
      }
    }

    throw new Error('Timeout waiting for captcha solution');
  }

  /**
   * Inject the captcha solution token into the page
   */
  async injectSolution(captcha, token) {
    const { type } = captcha;

    const result = await this.Runtime.evaluate({
      expression: `
        (function() {
          const token = '${token}';
          const results = [];

          // Inject into g-recaptcha-response textarea (reCAPTCHA v2/v3)
          const recaptchaTextareas = document.querySelectorAll('[name="g-recaptcha-response"], #g-recaptcha-response, textarea[id*="g-recaptcha-response"]');
          recaptchaTextareas.forEach(ta => {
            ta.value = token;
            ta.innerHTML = token;
            results.push('Set g-recaptcha-response: ' + ta.id);
          });

          // For reCAPTCHA v3, we might need to trigger a callback
          if (typeof window.grecaptchaCallback === 'function') {
            window.grecaptchaCallback(token);
            results.push('Called grecaptchaCallback');
          }

          // Try to find and call any registered callbacks
          if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {
            Object.values(window.___grecaptcha_cfg.clients).forEach(client => {
              if (client && typeof client === 'object') {
                Object.values(client).forEach(val => {
                  if (val && typeof val.callback === 'function') {
                    val.callback(token);
                    results.push('Called client callback');
                  }
                });
              }
            });
          }

          // For hCaptcha
          const hcaptchaTextareas = document.querySelectorAll('[name="h-captcha-response"], textarea[name*="hcaptcha"]');
          hcaptchaTextareas.forEach(ta => {
            ta.value = token;
            results.push('Set h-captcha-response');
          });

          // For Turnstile
          const turnstileInputs = document.querySelectorAll('[name="cf-turnstile-response"]');
          turnstileInputs.forEach(input => {
            input.value = token;
            results.push('Set cf-turnstile-response');
          });

          return results;
        })()
      `,
      returnByValue: true
    });

    this.log('Injection results:', result.result.value);
    return result.result.value;
  }

  /**
   * Click the submit button on the page
   */
  async submitForm() {
    const result = await this.Runtime.evaluate({
      expression: `
        (function() {
          // Find submit button
          const submitBtn =
            document.querySelector('button[type="submit"]') ||
            document.querySelector('input[type="submit"]') ||
            document.querySelector('.btn-primary') ||
            document.querySelector('button.submit') ||
            Array.from(document.querySelectorAll('button')).find(b =>
              b.textContent.toLowerCase().includes('submit') ||
              b.textContent.toLowerCase().includes('verify') ||
              b.textContent.toLowerCase().includes('check')
            );

          if (submitBtn) {
            submitBtn.click();
            return 'Clicked: ' + (submitBtn.textContent || submitBtn.value || 'button');
          }

          return 'No submit button found';
        })()
      `,
      returnByValue: true
    });

    this.log('Submit result:', result.result.value);
    return result.result.value;
  }

  /**
   * Check if captcha was solved successfully
   */
  async checkSuccess() {
    const result = await this.Runtime.evaluate({
      expression: `
        (function() {
          const body = document.body.innerText.toLowerCase();

          // Common success indicators
          if (body.includes('captcha is passed successfully') ||
              body.includes('verification successful') ||
              body.includes('captcha solved') ||
              body.includes('success')) {
            return { success: true, message: 'Success indicator found in page' };
          }

          // Check for success elements
          const successEl = document.querySelector('.alert-success, .success, [class*="success"]');
          if (successEl && successEl.offsetParent !== null) {
            return { success: true, message: successEl.textContent };
          }

          // Check for error indicators
          const errorEl = document.querySelector('.alert-danger, .error, [class*="error"]');
          if (errorEl && errorEl.offsetParent !== null) {
            return { success: false, message: errorEl.textContent };
          }

          return { success: null, message: 'Unknown state' };
        })()
      `,
      returnByValue: true
    });

    return result.result.value;
  }

  /**
   * Main solve method - detects, solves, and injects in one call
   */
  async solve(options = {}) {
    const { autoSubmit = true, waitForSuccess = true } = options;

    // Connect if not already connected
    if (!this.client) {
      await this.connect();
    }

    // Detect captchas
    const captchas = await this.detect();

    if (captchas.length === 0) {
      this.log('No captchas detected');
      return { success: false, message: 'No captchas found on page' };
    }

    // Solve each captcha
    const results = [];
    for (const captcha of captchas) {
      this.log('Solving captcha:', captcha);

      try {
        // Get solution from 2captcha
        const solution = await this.solveCaptcha(captcha);
        this.log('Got solution:', solution.token.substring(0, 50) + '...');

        // Inject the solution
        await this.injectSolution(captcha, solution.token);

        results.push({
          captcha,
          solution,
          injected: true
        });
      } catch (error) {
        results.push({
          captcha,
          error: error.message,
          injected: false
        });
      }
    }

    // Submit form if requested
    if (autoSubmit) {
      await sleep(1000);
      await this.submitForm();
    }

    // Wait for success if requested
    if (waitForSuccess) {
      await sleep(3000);
      const success = await this.checkSuccess();
      return { ...success, results };
    }

    return { success: true, results };
  }

  /**
   * Close the CDP connection
   */
  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}

export default CaptchaSolver;
