/**
 * POC: Using 2captcha browser extension to auto-solve reCAPTCHA v3
 * The extension handles detection, solving, and injection automatically
 */
import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

const TWOCAPTCHA_API_KEY = '43381d9af41dd532950dc7abeda5dbd1';
const TWOCAPTCHA_EXTENSION_ID = 'ifibfemgeogfhoebkmokieepdoobkbpo';
const DEMO_URL = 'https://2captcha.com/demo/recaptcha-v3';

describe("2captcha Extension POC", () => {

  it("should auto-solve reCAPTCHA v3 using 2captcha extension", async (context) => {
    const testdriver = TestDriver(context);

    // Install chrome-remote-interface for CDP access
    console.log('Installing chrome-remote-interface...');
    await testdriver.exec(
      'sh',
      'sudo npm install -g chrome-remote-interface',
      60000
    );

    // Download and extract the 2captcha extension
    console.log('Downloading 2captcha extension...');
    const extensionDir = '/tmp/2captcha-extension';

    // Download CRX from Chrome Web Store
    await testdriver.exec('sh', `mkdir -p ${extensionDir}`, 5000);

    const crxUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=131.0.0.0&acceptformat=crx2,crx3&x=id%3D${TWOCAPTCHA_EXTENSION_ID}%26installsource%3Dondemand%26uc`;

    await testdriver.exec(
      'sh',
      `curl -L -o ${extensionDir}/extension.crx "${crxUrl}"`,
      60000
    );

    // Extract CRX (it's a ZIP with a header)
    // CRX3 format: 4 bytes magic + 4 bytes version + 4 bytes header length + header + ZIP
    await testdriver.exec(
      'sh',
      `cd ${extensionDir} && unzip -o extension.crx -d unpacked 2>/dev/null || python3 -c "
import zipfile
import struct

with open('extension.crx', 'rb') as f:
    # Read CRX3 header
    magic = f.read(4)
    version = struct.unpack('<I', f.read(4))[0]
    header_size = struct.unpack('<I', f.read(4))[0]
    f.seek(12 + header_size)  # Skip to ZIP content

    # Write ZIP content
    with open('extension.zip', 'wb') as zf:
        zf.write(f.read())

import zipfile
with zipfile.ZipFile('extension.zip', 'r') as z:
    z.extractall('unpacked')
"`,
      30000
    );

    // Configure the extension with API key
    // The 2captcha extension stores config in localStorage, but we can inject it via a config.js
    console.log('Configuring extension with API key...');

    // Create a config injection script that runs when the extension loads
    const configScript = `
// Pre-configure 2captcha extension
(function() {
  const config = {
    apiKey: '${TWOCAPTCHA_API_KEY}',
    autoSubmit: true,
    autoSolve: true,
    enabledForRecaptcha: true,
    enabledForRecaptcha3: true
  };

  // Store in chrome.storage.local (extension storage)
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set(config);
  }

  // Also try localStorage
  try {
    localStorage.setItem('apiKey', '${TWOCAPTCHA_API_KEY}');
    localStorage.setItem('autoSubmit', 'true');
    localStorage.setItem('autoSolve', 'true');
  } catch (e) {}
})();
`;

    // Inject config into the extension's background script
    await testdriver.exec(
      'sh',
      `cat >> ${extensionDir}/unpacked/background/background.js << 'CONFIG'
// Injected configuration
chrome.storage.local.set({
  apiKey: '${TWOCAPTCHA_API_KEY}',
  autoSubmit: true,
  autoSolve: true,
  enabledForRecaptcha: true,
  enabledForRecaptcha3: true,
  enabledForRecaptchaV3: true
});
CONFIG`,
      5000
    );

    // Also update the common/config.js if it exists
    await testdriver.exec(
      'sh',
      `cat > ${extensionDir}/unpacked/common/config_override.js << 'CONFIG'
window.TWOCAPTCHA_CONFIG = {
  apiKey: '${TWOCAPTCHA_API_KEY}',
  autoSubmit: true,
  autoSolve: true
};
CONFIG`,
      5000
    );

    // Launch Chrome with the extension
    console.log('Launching Chrome with 2captcha extension...');

    const userDataDir = '/tmp/testdriver-chrome-profile';
    const chromeArgs = [
      '--start-maximized',
      '--disable-fre',
      '--no-default-browser-check',
      '--no-first-run',
      '--no-experiments',
      '--disable-infobars',
      `--user-data-dir=${userDataDir}`,
      '--remote-debugging-port=9222',
      `--load-extension=${extensionDir}/unpacked`
    ].join(' ');

    await testdriver.exec(
      'sh',
      `chrome-for-testing ${chromeArgs} "${DEMO_URL}" >/dev/null 2>&1 &`,
      5000
    );

    // Wait for Chrome to start and page to load
    await testdriver.focusApplication('Google Chrome');

    // Take screenshot to see initial state
    await testdriver.screenshot();

    // Use CDP to configure the extension's storage directly
    console.log('Configuring extension via CDP...');
    const cdpConfigScript = `
const CDP = require('chrome-remote-interface');

(async () => {
  try {
    // Get list of targets to find extension background page
    const targets = await CDP.List();
    console.log('TARGETS:', JSON.stringify(targets.map(t => ({ type: t.type, url: t.url })), null, 2));

    // Find the extension background page
    const extTarget = targets.find(t =>
      t.url.includes('${TWOCAPTCHA_EXTENSION_ID}') ||
      t.type === 'background_page' ||
      t.url.includes('chrome-extension://')
    );

    if (extTarget) {
      console.log('EXTENSION_TARGET:', extTarget.url);
      const client = await CDP({ target: extTarget });
      const { Runtime } = client;

      // Set the API key in extension storage
      const result = await Runtime.evaluate({
        expression: \`
          chrome.storage.local.set({
            apiKey: '${TWOCAPTCHA_API_KEY}',
            autoSubmit: true,
            autoSolve: true,
            enabledForRecaptcha: true,
            enabledForRecaptcha3: true
          }, () => 'Config set');
        \`
      });
      console.log('CONFIG_RESULT:', result);
      await client.close();
    } else {
      console.log('NO_EXTENSION_TARGET_FOUND');
    }

    // Now connect to the main page
    const pageTarget = targets.find(t => t.url.includes('2captcha.com'));
    if (pageTarget) {
      const client = await CDP({ target: pageTarget });
      const { Runtime, Page } = client;

      // Wait and check for captcha solving
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));

        const result = await Runtime.evaluate({
          expression: \`
            (function() {
              // Check if captcha was solved
              const successElem = document.querySelector('.alert-success, [class*="success"]');
              if (successElem && successElem.textContent.includes('success')) {
                return 'SUCCESS: ' + successElem.textContent;
              }

              // Check page content
              const body = document.body.innerText;
              if (body.includes('Captcha is passed successfully')) {
                return 'SUCCESS: Captcha solved!';
              }

              // Check for 2captcha widget status
              const widget = document.querySelector('.captcha-solver');
              if (widget) {
                return 'WIDGET: ' + widget.textContent;
              }

              return 'WAITING: ' + (i+1);
            })()
          \`
        });

        console.log('CHECK_' + i + ':', result.result.value);

        if (result.result.value.startsWith('SUCCESS')) {
          console.log('CAPTCHA_SOLVED:', result.result.value);
          break;
        }
      }

      await client.close();
    }

    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
})();
`;

    await testdriver.exec('sh', `cat > /tmp/cdp-extension-config.js << 'SCRIPT'
${cdpConfigScript}
SCRIPT`, 10000);

    // Wait for extension to initialize, then configure and monitor
    await new Promise(r => setTimeout(r, 5000));

    const result = await testdriver.exec(
      'sh',
      'NODE_PATH=/usr/lib/node_modules node /tmp/cdp-extension-config.js 2>&1',
      180000
    );
    console.log('CDP Result:', result);

    // Take final screenshot
    await testdriver.screenshot();

    // Check result
    expect(result).toContain('SUCCESS');
  }, 300000);
});
