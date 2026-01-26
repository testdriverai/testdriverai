/**
 * Test for the CaptchaSolver library
 * Injects the library to the sandbox and uses it to solve captchas
 */
import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TWOCAPTCHA_API_KEY = '43381d9af41dd532950dc7abeda5dbd1';
const DEMO_URL = 'https://2captcha.com/demo/recaptcha-v3';

// Read the solver library source
const SOLVER_LIBRARY_PATH = join(__dirname, '../../lib/captcha/solver.cjs');

describe("CaptchaSolver Library", () => {

  it("should solve reCAPTCHA v3 using CaptchaSolver library", async (context) => {
    const testdriver = TestDriver(context);

    // Launch Chrome with remote debugging enabled
    await testdriver.provision.chrome({
      url: DEMO_URL,
    });

    await testdriver.screenshot();

    // Install chrome-remote-interface
    console.log('Installing chrome-remote-interface...');
    await testdriver.exec('sh', 'sudo npm install -g chrome-remote-interface', 60000);

    // Read the solver library source code
    const solverSource = readFileSync(SOLVER_LIBRARY_PATH, 'utf-8');

    // Write the solver library to the sandbox
    console.log('Injecting CaptchaSolver library...');
    await testdriver.exec('sh', `cat > /tmp/captcha-solver.cjs << 'SOLVER_EOF'
${solverSource}
SOLVER_EOF`, 10000);

    // Write a simple test script that uses the library
    const testScript = `
const { CaptchaSolver } = require('/tmp/captcha-solver.cjs');

(async () => {
  try {
    const solver = new CaptchaSolver({
      apiKey: '${TWOCAPTCHA_API_KEY}',
      debugPort: 9222,
      debug: true
    });

    const result = await solver.solve({
      sitekey: '6LfB5_IbAAAAAMCtsjEHEHKqcB9iQocwwxTiihJu',
      action: 'demo_action',
      autoSubmit: true
    });

    console.log('FINAL_RESULT:', JSON.stringify(result));
    await solver.close();
    process.exit(result.success ? 0 : 1);

  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
})();
`;

    await testdriver.exec('sh', `cat > /tmp/test-solver.js << 'TEST_EOF'
${testScript}
TEST_EOF`, 5000);

    // Run the test
    console.log('Running CaptchaSolver...');
    const result = await testdriver.exec(
      'sh',
      'NODE_PATH=/usr/lib/node_modules node /tmp/test-solver.js 2>&1',
      180000
    );
    console.log('Output:', result);

    await testdriver.screenshot();

    // Verify success
    expect(result).toContain('TOKEN:');
    expect(result).toContain('"success":true');
  }, 300000);
});
