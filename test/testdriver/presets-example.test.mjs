/**
 * Examples demonstrating TestDriver Presets
 * 
 * Presets provide pre-configured setups for common applications,
 * reducing boilerplate and making tests easier to write.
 */

import { test } from 'vitest';
import { chromePreset, createPreset, electronPreset, vscodePreset } from '../../lib/presets/index.mjs';

test('Chrome preset - simple navigation', async (context) => {
  const { browser } = await chromePreset(context, {
    url: 'http://testdriver-sandbox.vercel.app/',
  });

  // Browser is already open and focused on the URL
  const result = await browser.find('main heading text');
  console.log('Found heading:', result);
}, 60000);

test('Chrome preset - with custom options', async (context) => {
  const { browser, dashcam } = await chromePreset(context, {
    url: 'https://google.com',
    maximized: false,
    guest: false,
    dashcam: true, // Dashcam auto-starts and auto-stops
  });

  await browser.find('search box').type('testdriverai');
  console.log('Dashcam recording:', dashcam.isRecording());
}, 60000);

test.skip('VS Code preset - basic usage', async (context) => {
  const { vscode } = await vscodePreset(context, {
    workspace: '/tmp/test-project',
  });

  // VS Code is already open with the workspace loaded
  await vscode.find('File menu').click();
  await vscode.find('New File').click();
}, 60000);

test.skip('VS Code preset - with extensions', async (context) => {
  const { vscode } = await vscodePreset(context, {
    workspace: '/tmp/test-project',
    extensions: ['ms-python.python'],
    dashcam: true,
  });

  // Extensions are pre-installed, dashcam auto-recording
  await vscode.find('Python extension').click();
}, 120000);

test.skip('Custom preset - Electron app', async (context) => {
  const { app } = await electronPreset(context, {
    appPath: '/path/to/electron/app',
    args: ['--enable-logging'],
  });

  await app.find('main window').click();
}, 60000);

test.skip('Custom preset - create your own', async (context) => {
  // Create a custom preset for your application
  const firefoxPreset = createPreset({
    name: 'Firefox Browser',
    defaults: { os: 'linux', dashcam: true },
    async setup(context, client, dashcam, options) {
      const { url } = options;
      
      // Launch Firefox
      await client.exec('sh', `firefox "${url}" >/dev/null 2>&1 &`, 30000);
      await client.focusApplication('Firefox');
      
      return {
        browser: client,
      };
    },
  });

  // Use your custom preset
  const { browser } = await firefoxPreset(context, {
    url: 'https://example.com',
  });

  await browser.find('page content').click();
}, 60000);
