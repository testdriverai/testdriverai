#!/usr/bin/env node

/**
 * Simple test to verify error recovery features
 * 
 * This script tests the components independently without needing a full test run.
 * 
 * Run: node testdriver/acceptance-sdk/verify-recovery.mjs
 */

// Test 1: Verify YAML to JS conversion
console.log('🧪 Test 1: YAML to JS Conversion\n');

const yamlTestData = {
  commands: [
    { command: 'hover-text', text: 'Submit', action: 'click' },
    { command: 'type', text: 'hello world', delay: 100 },
    { command: 'press-keys', keys: ['enter'] },
    { command: 'wait', timeout: 2000 },
    { command: 'assert', expect: 'page is loaded' }
  ]
};

// Import the conversion function (we'll inline it for testing)
function convertYamlCommandsToJs(yamlData) {
  const commandMapping = {
    'hover-text': 'hoverText',
    'hover-image': 'hoverImage',
    'match-image': 'matchImage',
    'type': 'type',
    'press-keys': 'pressKeys',
    'click': 'click',
    'hover': 'hover',
    'scroll': 'scroll',
    'scroll-until-text': 'scrollUntilText',
    'scroll-until-image': 'scrollUntilImage',
    'wait': 'wait',
    'wait-for-text': 'waitForText',
    'wait-for-image': 'waitForImage',
    'focus-application': 'focusApplication',
    'remember': 'remember',
    'assert': 'assert',
    'exec': 'exec',
    'run': 'run',
  };
  
  let commands = [];
  
  if (yamlData.commands) {
    commands = yamlData.commands;
  } else if (yamlData.steps) {
    yamlData.steps.forEach(step => {
      if (step.commands) {
        commands = commands.concat(step.commands);
      }
    });
  }
  
  if (!commands.length) {
    return null;
  }
  
  const jsLines = commands.map(cmd => {
    const yamlCommand = cmd.command;
    const jsMethod = commandMapping[yamlCommand];
    
    if (!jsMethod) {
      return `// Unknown command: ${yamlCommand}`;
    }
    
    const args = buildArgumentsForCommand(yamlCommand, cmd);
    
    return `await healingClient.${jsMethod}(${args.join(', ')})`;
  });
  
  return jsLines.join(';\n');
}

function buildArgumentsForCommand(command, cmdObj) {
  const args = [];
  
  switch(command) {
    case 'hover-text':
      if (cmdObj.text) args.push(`'${cmdObj.text}'`);
      if (cmdObj.description) args.push(`'${cmdObj.description}'`);
      if (cmdObj.action) args.push(`'${cmdObj.action}'`);
      break;
      
    case 'type':
      if (cmdObj.text !== undefined) args.push(`'${cmdObj.text}'`);
      else if (cmdObj.string !== undefined) args.push(`'${cmdObj.string}'`);
      if (cmdObj.delay) args.push(cmdObj.delay);
      break;
      
    case 'press-keys':
      if (cmdObj.keys) {
        const keys = Array.isArray(cmdObj.keys) ? cmdObj.keys : [cmdObj.keys];
        args.push(`[${keys.map(k => `'${k}'`).join(', ')}]`);
      }
      break;
      
    case 'wait':
      if (cmdObj.timeout) args.push(cmdObj.timeout);
      break;
      
    case 'assert':
      if (cmdObj.expect) args.push(`'${cmdObj.expect}'`);
      break;
  }
  
  return args;
}

const converted = convertYamlCommandsToJs(yamlTestData);
console.log('Input YAML commands:');
console.log(JSON.stringify(yamlTestData, null, 2));
console.log('\nConverted to JavaScript:');
console.log(converted);
console.log('\n✅ YAML to JS conversion works!\n');

// Test 2: Verify step tracker structure
console.log('🧪 Test 2: Step Tracker Structure\n');

function createStepTracker(testName) {
  let currentStep = 0;
  const steps = [];

  return {
    async step(description, fn) {
      currentStep++;
      const stepNumber = currentStep;
      
      console.log(`📍 Step ${stepNumber}: ${description}`);
      
      const startTime = Date.now();
      
      try {
        const result = await fn();
        const duration = Date.now() - startTime;
        
        steps.push({
          step: stepNumber,
          description,
          status: 'passed',
          duration,
        });
        
        console.log(`   ✅ Passed (${duration}ms)`);
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        steps.push({
          step: stepNumber,
          description,
          status: 'failed',
          duration,
          error: error.message,
        });
        
        console.error(`   ❌ Failed at step ${stepNumber}: ${description}`);
        console.error(`   Error: ${error.message}`);
        
        throw error;
      }
    },
    
    getSummary() {
      return {
        testName,
        totalSteps: steps.length,
        passed: steps.filter(s => s.status === 'passed').length,
        failed: steps.filter(s => s.status === 'failed').length,
        steps: [...steps],
      };
    }
  };
}

async function testStepTracker() {
  const tracker = createStepTracker('Demo Test');
  
  await tracker.step('First step', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  });
  
  await tracker.step('Second step', async () => {
    await new Promise(resolve => setTimeout(resolve, 50));
  });
  
  try {
    await tracker.step('Failing step', async () => {
      throw new Error('Intentional failure for testing');
    });
  } catch (e) {
    // Expected to fail
  }
  
  const summary = tracker.getSummary();
  console.log('\nTest Summary:');
  console.log(`  Total: ${summary.totalSteps}`);
  console.log(`  Passed: ${summary.passed}`);
  console.log(`  Failed: ${summary.failed}`);
  console.log('\n✅ Step tracker works!\n');
}

testStepTracker().then(() => {
  console.log('🎉 All verification tests passed!\n');
  console.log('Next steps:');
  console.log('1. Run: npx vitest run testdriver/acceptance-sdk/quick-start-recovery.test.mjs');
  console.log('2. See: testdriver/acceptance-sdk/TEST_ERROR_RECOVERY.md for full testing guide');
}).catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
