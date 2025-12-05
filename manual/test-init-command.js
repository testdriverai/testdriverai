#!/usr/bin/env node

/**
 * Test Init Command
 * 
 * This script tests the `testdriverai init` command by:
 * 1. Creating a temporary test project
 * 2. Running the init command
 * 3. Verifying all files were created correctly
 * 4. Running the generated test
 * 5. Cleaning up
 * 
 * Usage:
 *   node manual/test-init-command.js
 * 
 * Requirements:
 *   - TD_API_KEY environment variable must be set
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function info(message) {
  log(message, 'cyan');
}

function step(message) {
  log(`\n${message}`, 'cyan');
}

// Main test function
async function testInitCommand() {
  // Check for API key
  if (!process.env.TD_API_KEY) {
    error('TD_API_KEY environment variable is required');
    process.exit(1);
  }

  const testDir = path.join(os.tmpdir(), `test-init-${Date.now()}`);
  const cliPath = path.join(__dirname, '..');
  
  try {
    step('📦 Creating test directory...');
    fs.mkdirSync(testDir, { recursive: true });
    success(`Created: ${testDir}`);

    step('🔧 Setting up .env file...');
    const envContent = `TD_API_KEY=${process.env.TD_API_KEY}\n`;
    fs.writeFileSync(path.join(testDir, '.env'), envContent);
    success('Created .env with API key');

    step('🚀 Running init command...');
    try {
      execSync(`node ${path.join(cliPath, 'bin/testdriverai.js')} init`, {
        cwd: testDir,
        stdio: 'inherit',
        env: { ...process.env, TD_API_KEY: process.env.TD_API_KEY }
      });
      success('Init command completed');
    } catch (err) {
      error('Init command failed');
      throw err;
    }

    step('🔍 Verifying project structure...');
    
    const expectedFiles = [
      'package.json',
      'vitest.config.js',
      'tests/example.test.js',
      'tests/login.js',
      '.env',
      '.gitignore',
      '.github/workflows/testdriver.yml'
    ];

    for (const file of expectedFiles) {
      const filePath = path.join(testDir, file);
      if (!fs.existsSync(filePath)) {
        error(`Missing file: ${file}`);
        throw new Error(`Expected file not found: ${file}`);
      }
      success(`Found: ${file}`);
    }

    step('📝 Verifying vitest.config.js contents...');
    const vitestConfig = fs.readFileSync(path.join(testDir, 'vitest.config.js'), 'utf8');
    
    if (!vitestConfig.includes('TestDriver()')) {
      error('TestDriver reporter not found in vitest.config.js');
      console.log(vitestConfig);
      throw new Error('TestDriver reporter not configured');
    }
    success('TestDriver reporter is configured');

    if (!vitestConfig.includes('setupFiles') || !vitestConfig.includes('testdriverai/vitest/setup')) {
      error('setupFiles not configured correctly');
      console.log(vitestConfig);
      throw new Error('setupFiles not configured');
    }
    success('setupFiles is configured correctly');

    if (!vitestConfig.includes('reporters')) {
      error('reporters array not found');
      console.log(vitestConfig);
      throw new Error('reporters not configured');
    }
    success('reporters array includes TestDriver');

    step('📝 Verifying example test contents...');
    const testFile = fs.readFileSync(path.join(testDir, 'tests/example.test.js'), 'utf8');
    
    if (!testFile.includes('.provision.chrome')) {
      error('Test does not use .provision.chrome');
      console.log(testFile);
      throw new Error('Test does not use .provision pattern');
    }
    success('Test uses .provision.chrome');

    if (!testFile.includes("from 'testdriverai/vitest/hooks'")) {
      error('Test does not import from testdriverai/vitest/hooks');
      console.log(testFile);
      throw new Error('Test does not import TestDriver from vitest/hooks');
    }
    success('Test imports TestDriver from vitest/hooks');

    if (!testFile.includes("from './login.js'")) {
      error('Test does not import login from ./login.js');
      console.log(testFile);
      throw new Error('Test does not import login snippet');
    }
    success('Test imports login snippet');

    step('📝 Verifying login snippet contents...');
    const loginFile = fs.readFileSync(path.join(testDir, 'tests/login.js'), 'utf8');

    if (!loginFile.includes('.extract(')) {
      error('Login snippet does not use .extract()');
      console.log(loginFile);
      throw new Error('Login snippet does not demonstrate .extract()');
    }
    success('Login snippet demonstrates .extract()');

    if (!loginFile.includes('secret: true')) {
      error('Login snippet does not use secret option');
      console.log(loginFile);
      throw new Error('Login snippet does not demonstrate secret typing');
    }
    success('Login snippet demonstrates secret typing');

    step('🧪 Running generated test...');
    try {
      execSync('npm test', {
        cwd: testDir,
        stdio: 'inherit',
        env: { ...process.env, TD_API_KEY: process.env.TD_API_KEY }
      });
      success('Test execution completed successfully');
    } catch (err) {
      error('Test execution failed');
      throw err;
    }

    step('✅ All checks passed!');
    log('\nTest summary:', 'green');
    log('  • Init command executed successfully', 'green');
    log('  • All expected files created', 'green');
    log('  • Configuration files are correct', 'green');
    log('  • Example test has proper patterns', 'green');
    log('  • Generated test runs successfully', 'green');

  } catch (err) {
    step('❌ Test failed!');
    error(err.message);
    if (err.stack) {
      log(err.stack, 'gray');
    }
    process.exit(1);
  } finally {
    // Optional: Clean up test directory
    // Commented out so you can inspect the generated files
    // step('🧹 Cleaning up...');
    // if (fs.existsSync(testDir)) {
    //   fs.rmSync(testDir, { recursive: true, force: true });
    //   success('Cleaned up test directory');
    // }
    
    info(`\nTest project preserved at: ${testDir}`);
    info('To clean up manually, run:');
    log(`  rm -rf ${testDir}`, 'gray');
  }
}

// Run the test
testInitCommand().catch(err => {
  error('Unexpected error:');
  console.error(err);
  process.exit(1);
});
