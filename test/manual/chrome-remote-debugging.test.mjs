/**
 * Test that validates Chrome remote debugging is working
 * Installs chrome-remote-interface and connects to the active tab
 */
import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

describe("Chrome Remote Debugging", () => {

  it("should connect to Chrome via CDP and get page title", async (context) => {
    const testdriver = TestDriver(context);

    // Launch Chrome with a known URL
    await testdriver.provision.chrome({
      url: 'https://example.com',
    });

    // Take a screenshot to verify Chrome launched
    await testdriver.screenshot();

    // Install chrome-remote-interface (needs sudo for global install)
    const installResult = await testdriver.exec(
      'sh',
      'sudo npm install -g chrome-remote-interface',
      60000
    );
    console.log('Install result:', installResult);

    // Write the CDP script to a file to avoid quoting issues
    const cdpScript = `
const CDP = require('chrome-remote-interface');
(async () => {
  try {
    const client = await CDP();
    const { Runtime } = client;
    const result = await Runtime.evaluate({
      expression: 'document.title'
    });
    console.log('PAGE_TITLE:' + result.result.value);
    await client.close();
    process.exit(0);
  } catch (err) {
    console.error('CDP_ERROR:' + err.message);
    process.exit(1);
  }
})();
`;

    // Write script to file
    await testdriver.exec('sh', `cat > /tmp/cdp-test.js << 'SCRIPT'
${cdpScript}
SCRIPT`, 5000);

    // Run the CDP script with NODE_PATH set to find globally installed modules
    const cdpResult = await testdriver.exec(
      'sh',
      'NODE_PATH=/usr/lib/node_modules node /tmp/cdp-test.js 2>&1 || echo "CDP_EXIT_CODE:$?"',
      30000
    );
    console.log('CDP result:', cdpResult);

    // Verify we got the page title
    expect(cdpResult).toContain('PAGE_TITLE:');
    expect(cdpResult).toContain('Example Domain');
  });
});
