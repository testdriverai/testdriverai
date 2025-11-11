#!/usr/bin/env node

/**
 * TestDriver MCP Server
 * 
 * This server exposes TestDriver SDK methods as Model Context Protocol (MCP) tools
 * that can be used by Claude and other AI assistants to generate and run tests.
 * 
 * Usage:
 *   1. Set TD_API_KEY environment variable
 *   2. Add this server to your MCP configuration
 *   3. Claude can now use TestDriver tools to interact with applications
 * 
 * Best Practices for AI Agents:
 *   - Always start with testdriver_connect before any other operations
 *   - Screenshots are automatically captured after most actions for verification
 *   - Use testdriver_getScreenshot when you need to check state before proceeding
 *   - Use assertions (testdriver_assert) to verify expected outcomes
 *   - Wait for elements to appear with testdriver_waitForText/waitForImage before interacting
 *   - The debugger URL shows a live view of the VM - share it with users for transparency
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { appendFile, mkdir, readFile, writeFile } from 'fs/promises';
import yaml from 'js-yaml';
import { dirname, extname, resolve } from 'path';
import TestDriver from '../sdk.js';

// Global TestDriver client instance
let tdClient = null;
let isConnected = false;
let actionHistory = []; // Track all actions for test generation

/**
 * Tool definitions for all TestDriver SDK methods
 */
const TOOLS = [
  {
    name: 'testdriver_connect',
    description: 'Connect to TestDriver sandbox environment. Must be called FIRST before using any other TestDriver tools. Can optionally start debugger UI. After connecting, you will receive a debugger URL where you can watch the VM screen in real-time.',
    inputSchema: {
      type: 'object',
      properties: {
        newSandbox: {
          type: 'boolean',
          description: 'Create a new sandbox instance',
          default: true
        },
        resolution: {
          type: 'string',
          description: 'Screen resolution (e.g., "1366x768")',
          default: '1366x768'
        },
        headless: {
          type: 'boolean',
          description: 'Run without debugger UI (default: false, debugger will start)',
          default: false
        },
        sandboxId: {
          type: 'string',
          description: 'Reconnect to existing sandbox by ID'
        },
        sandboxAmi: {
          type: 'string',
          description: 'Specific AMI to use for sandbox'
        },
        sandboxInstance: {
          type: 'string',
          description: 'AWS instance type for sandbox'
        }
      }
    }
  },
  {
    name: 'testdriver_disconnect',
    description: 'Disconnect from TestDriver sandbox and clean up resources.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'testdriver_getDebuggerUrl',
    description: 'Get the URL of the live debugger UI showing the VM screen.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'testdriver_getSandboxInfo',
    description: 'Get information about the connected sandbox (ID, IP, status).',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'testdriver_hoverText',
    description: 'Hover over or click text on screen using AI-powered text recognition.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to find and hover over'
        },
        description: {
          type: 'string',
          description: 'Additional context about the text element'
        },
        action: {
          type: 'string',
          enum: ['click', 'right-click', 'double-click', 'hover', 'drag-start', 'drag-end'],
          description: 'Action to perform after hovering',
          default: 'click'
        },
        method: {
          type: 'string',
          enum: ['ai', 'turbo'],
          description: 'Text matching method',
          default: 'ai'
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds',
          default: 30000
        }
      },
      required: ['text']
    }
  },
  {
    name: 'testdriver_hoverImage',
    description: 'Hover over or click an image element using AI-powered visual recognition.',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Description of the image to find'
        },
        action: {
          type: 'string',
          enum: ['click', 'right-click', 'double-click', 'hover', 'drag-start', 'drag-end'],
          description: 'Action to perform',
          default: 'click'
        }
      },
      required: ['description']
    }
  },
  {
    name: 'testdriver_type',
    description: 'Type text into the currently focused input field.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to type'
        },
        delay: {
          type: 'number',
          description: 'Delay between keystrokes in milliseconds',
          default: 0
        }
      },
      required: ['text']
    }
  },
  {
    name: 'testdriver_pressKeys',
    description: 'Press keyboard keys or key combinations.',
    inputSchema: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Array of keys to press (e.g., ["ctrl", "c"] for copy)'
        }
      },
      required: ['keys']
    }
  },
  {
    name: 'testdriver_scroll',
    description: 'Scroll the page in a specified direction.',
    inputSchema: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['up', 'down', 'left', 'right'],
          description: 'Scroll direction',
          default: 'down'
        },
        amount: {
          type: 'number',
          description: 'Amount to scroll',
          default: 3
        },
        method: {
          type: 'string',
          enum: ['keyboard', 'mouse'],
          description: 'Scroll method',
          default: 'keyboard'
        }
      }
    }
  },
  {
    name: 'testdriver_scrollUntilText',
    description: 'Scroll until specified text is visible on screen.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to scroll until visible'
        },
        direction: {
          type: 'string',
          enum: ['up', 'down', 'left', 'right'],
          description: 'Scroll direction',
          default: 'down'
        },
        amount: {
          type: 'number',
          description: 'Scroll amount per iteration',
          default: 3
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds',
          default: 30000
        }
      },
      required: ['text']
    }
  },
  {
    name: 'testdriver_scrollUntilImage',
    description: 'Scroll until an image matching description is visible.',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Description of image to scroll until visible'
        },
        direction: {
          type: 'string',
          enum: ['up', 'down', 'left', 'right'],
          description: 'Scroll direction',
          default: 'down'
        },
        amount: {
          type: 'number',
          description: 'Scroll amount per iteration',
          default: 3
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds',
          default: 30000
        }
      },
      required: ['description']
    }
  },
  {
    name: 'testdriver_wait',
    description: 'Wait for a specified duration.',
    inputSchema: {
      type: 'object',
      properties: {
        timeout: {
          type: 'number',
          description: 'Time to wait in milliseconds',
          default: 1000
        }
      }
    }
  },
  {
    name: 'testdriver_waitForText',
    description: 'Wait until specified text appears on screen.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to wait for'
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds',
          default: 30000
        }
      },
      required: ['text']
    }
  },
  {
    name: 'testdriver_waitForImage',
    description: 'Wait until an image matching description appears on screen.',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Description of image to wait for'
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds',
          default: 30000
        }
      },
      required: ['description']
    }
  },
  {
    name: 'testdriver_assert',
    description: 'Assert that a condition is true on screen (text or visual state). Use assertions after actions to verify expected outcomes. Be specific in your expectations, e.g., "the login button is visible" or "the error message says Invalid password".',
    inputSchema: {
      type: 'object',
      properties: {
        expect: {
          type: 'string',
          description: 'Description of what to expect on screen'
        },
        async: {
          type: 'boolean',
          description: 'Run assertion asynchronously',
          default: true
        },
        invert: {
          type: 'boolean',
          description: 'Invert the assertion (expect NOT to see)',
          default: false
        }
      },
      required: ['expect']
    }
  },
  {
    name: 'testdriver_remember',
    description: 'Extract and remember text from the screen using AI.',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Description of what text to extract (e.g., "the username", "the error message")'
        }
      },
      required: ['description']
    }
  },
  {
    name: 'testdriver_focusApplication',
    description: 'Focus a specific application window.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the application to focus'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'testdriver_exec',
    description: 'Execute code in the sandbox environment (JavaScript or PowerShell).',
    inputSchema: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          enum: ['js', 'pwsh'],
          description: 'Programming language',
          default: 'pwsh'
        },
        code: {
          type: 'string',
          description: 'Code to execute'
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds',
          default: 30000
        },
        silent: {
          type: 'boolean',
          description: 'Suppress output',
          default: false
        }
      },
      required: ['code']
    }
  },
  {
    name: 'testdriver_matchImage',
    description: 'Check if an image is present on screen using template matching.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to reference image file'
        },
        action: {
          type: 'string',
          enum: ['click', 'right-click', 'double-click', 'hover', 'drag-start', 'drag-end'],
          description: 'Action to perform if image is found'
        },
        invert: {
          type: 'boolean',
          description: 'Invert match (expect NOT to find)',
          default: false
        }
      },
      required: ['path']
    }
  },
  {
    name: 'testdriver_run',
    description: 'Run a TestDriver YAML file as a reusable snippet.',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: 'Path to YAML file to run'
        }
      },
      required: ['file']
    }
  },
  {
    name: 'testdriver_getScreenshot',
    description: 'Capture a screenshot of the current screen state.',
    inputSchema: {
      type: 'object',
      properties: {
        base64: {
          type: 'boolean',
          description: 'Return as base64 string',
          default: true
        }
      }
    }
  },
  {
    name: 'testdriver_writeTestFile',
    description: 'Create or append commands to a test file (YAML or JavaScript). Use this to build tests incrementally.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the test file (relative or absolute)'
        },
        content: {
          type: 'string',
          description: 'Test content to write or append'
        },
        format: {
          type: 'string',
          enum: ['yaml', 'javascript', 'js'],
          description: 'Test file format',
          default: 'yaml'
        },
        append: {
          type: 'boolean',
          description: 'Append to existing file instead of overwriting',
          default: false
        }
      },
      required: ['filePath', 'content']
    }
  },
  {
    name: 'testdriver_readTestFile',
    description: 'Read the contents of a test file.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the test file to read'
        }
      },
      required: ['filePath']
    }
  },
  {
    name: 'testdriver_runTestFile',
    description: 'Execute a test file (YAML or JavaScript) in the current sandbox.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the test file to execute'
        }
      },
      required: ['filePath']
    }
  },
  {
    name: 'testdriver_appendYamlCommand',
    description: 'Append a single YAML command to a test file. Useful for building tests step by step.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the YAML test file'
        },
        command: {
          type: 'string',
          description: 'Command name (e.g., "hover-text", "type", "assert")'
        },
        params: {
          type: 'object',
          description: 'Command parameters as key-value pairs'
        }
      },
      required: ['filePath', 'command', 'params']
    }
  },
  {
    name: 'testdriver_createTestFromActions',
    description: 'Create a complete test file from a series of actions performed. Pass the action history to generate a reusable test.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path where the test file should be created'
        },
        format: {
          type: 'string',
          enum: ['yaml', 'javascript'],
          description: 'Test file format',
          default: 'yaml'
        },
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              command: { type: 'string' },
              params: { type: 'object' }
            }
          },
          description: 'Array of actions to include in the test'
        },
        metadata: {
          type: 'object',
          description: 'Test metadata (name, description, tags)',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      required: ['filePath', 'actions']
    }
  }
];

/**
 * Initialize TestDriver client
 */
async function initializeClient() {
  if (!tdClient) {
    const apiKey = process.env.TD_API_KEY;
    if (!apiKey) {
      throw new Error('TD_API_KEY environment variable is required');
    }

    tdClient = new TestDriver(apiKey, {
      resolution: '1366x768',
      analytics: true,
      logging: false  // Disable SDK logging to avoid interference with MCP
    });

    await tdClient.auth();
  }
  return tdClient;
}

/**
 * Helper function to capture screenshot after an action
 */
async function captureScreenshot(client) {
  try {
    const screenshot = await client.system.captureScreenBase64();
    return {
      type: 'image',
      data: screenshot,
      mimeType: 'image/png'
    };
  } catch (error) {
    console.error('Failed to capture screenshot:', error);
    return null;
  }
}

/**
 * Execute a TestDriver tool
 */
async function executeTool(name, args) {
  const client = await initializeClient();

  try {
    switch (name) {
      case 'testdriver_connect':
        if (!isConnected) {
          await client.connect({
            newSandbox: args.newSandbox ?? true,
            resolution: args.resolution,
            headless: args.headless ?? false,
            sandboxId: args.sandboxId,
            sandboxAmi: args.sandboxAmi,
            sandboxInstance: args.sandboxInstance
          });
          isConnected = true;
          
          const responseText = [`Successfully connected to TestDriver sandbox`];
          if (client.debuggerUrl && client.instance) {
            // Construct the full debugger URL with base64-encoded data
            const url = `http://${client.instance.ip}:${client.instance.vncPort}/vnc_lite.html?token=V3b8wG9`;
            const data = {
              resolution: client.config.TD_RESOLUTION,
              url: url,
              token: "V3b8wG9",
            };
            const encodedData = encodeURIComponent(JSON.stringify(data));
            const fullDebuggerUrl = `${client.debuggerUrl}?data=${encodedData}`;
            
            responseText.push(`\nDebugger UI available at: ${fullDebuggerUrl}`);
            responseText.push(`\nYou can view the live VM screen in your browser.`);
          }
          if (client.instance?.instanceId) {
            responseText.push(`\nSandbox ID: ${client.instance.instanceId}`);
          }
          
          return {
            content: [{
              type: 'text',
              text: responseText.join('')
            }]
          };
        }
        return {
          content: [{
            type: 'text',
            text: 'Already connected to TestDriver sandbox'
          }]
        };

      case 'testdriver_disconnect':
        if (isConnected) {
          await client.disconnect();
          isConnected = false;
          actionHistory = []; // Clear action history
          return {
            content: [{
              type: 'text',
              text: 'Successfully disconnected from TestDriver sandbox'
            }]
          };
        }
        return {
          content: [{
            type: 'text',
            text: 'Not currently connected'
          }]
        };

      case 'testdriver_getDebuggerUrl':
        if (client.debuggerUrl && client.instance) {
          // Construct the full debugger URL with base64-encoded data
          const url = `http://${client.instance.ip}:${client.instance.vncPort}/vnc_lite.html?token=V3b8wG9`;
          const data = {
            resolution: client.config.TD_RESOLUTION,
            url: url,
            token: "V3b8wG9",
          };
          const encodedData = encodeURIComponent(JSON.stringify(data));
          const fullDebuggerUrl = `${client.debuggerUrl}?data=${encodedData}`;
          
          return {
            content: [{
              type: 'text',
              text: `Debugger UI: ${fullDebuggerUrl}\n\nOpen this URL in your browser to see the live VM screen.`
            }]
          };
        }
        if (!client.instance) {
          return {
            content: [{
              type: 'text',
              text: 'Not connected to a sandbox. Use testdriver_connect first.'
            }]
          };
        }
        return {
          content: [{
            type: 'text',
            text: 'Debugger is not running. Connect with headless: false to start the debugger.'
          }]
        };

      case 'testdriver_getSandboxInfo':
        if (!client.instance) {
          return {
            content: [{
              type: 'text',
              text: 'Not connected to a sandbox. Use testdriver_connect first.'
            }]
          };
        }
        
        let fullDebuggerUrl = 'Not available';
        if (client.debuggerUrl && client.instance) {
          // Construct the full debugger URL with base64-encoded data
          const url = `http://${client.instance.ip}:${client.instance.vncPort}/vnc_lite.html?token=V3b8wG9`;
          const data = {
            resolution: client.config.TD_RESOLUTION,
            url: url,
            token: "V3b8wG9",
          };
          const encodedData = encodeURIComponent(JSON.stringify(data));
          fullDebuggerUrl = `${client.debuggerUrl}?data=${encodedData}`;
        }
        
        const info = {
          instanceId: client.instance.instanceId,
          ip: client.instance.ip,
          status: client.instance.status,
          resolution: client.config.TD_RESOLUTION,
          debuggerUrl: fullDebuggerUrl
        };
        return {
          content: [{
            type: 'text',
            text: `Sandbox Information:\n${JSON.stringify(info, null, 2)}`
          }]
        };


      case 'testdriver_hoverText':
        await client.hoverText(
          args.text,
          args.description,
          args.action,
          args.method,
          args.timeout
        );
        // Track action
        actionHistory.push({
          command: 'hover-text',
          params: { text: args.text, description: args.description, action: args.action }
        });
        
        const hoverTextScreenshot = await captureScreenshot(client);
        const hoverTextContent = [{
          type: 'text',
          text: `Successfully performed ${args.action || 'click'} on text: "${args.text}"`
        }];
        if (hoverTextScreenshot) {
          hoverTextContent.push(hoverTextScreenshot);
        }
        return { content: hoverTextContent };

      case 'testdriver_hoverImage':
        await client.hoverImage(args.description, args.action);
        
        const hoverImageScreenshot = await captureScreenshot(client);
        const hoverImageContent = [{
          type: 'text',
          text: `Successfully performed ${args.action || 'click'} on image: "${args.description}"`
        }];
        if (hoverImageScreenshot) {
          hoverImageContent.push(hoverImageScreenshot);
        }
        return { content: hoverImageContent };

      case 'testdriver_type':
        await client.type(args.text, args.delay);
        
        const typeScreenshot = await captureScreenshot(client);
        const typeContent = [{
          type: 'text',
          text: `Successfully typed: "${args.text}"`
        }];
        if (typeScreenshot) {
          typeContent.push(typeScreenshot);
        }
        return { content: typeContent };

      case 'testdriver_pressKeys':
        await client.pressKeys(args.keys);
        
        const pressKeysScreenshot = await captureScreenshot(client);
        const pressKeysContent = [{
          type: 'text',
          text: `Successfully pressed keys: ${args.keys.join('+')}`
        }];
        if (pressKeysScreenshot) {
          pressKeysContent.push(pressKeysScreenshot);
        }
        return { content: pressKeysContent };

      case 'testdriver_scroll':
        await client.scroll(args.direction, args.amount, args.method);
        
        const scrollScreenshot = await captureScreenshot(client);
        const scrollContent = [{
          type: 'text',
          text: `Successfully scrolled ${args.direction || 'down'}`
        }];
        if (scrollScreenshot) {
          scrollContent.push(scrollScreenshot);
        }
        return { content: scrollContent };

      case 'testdriver_scrollUntilText':
        await client.scrollUntilText(args.text, args.direction, args.amount, args.timeout);
        
        const scrollTextScreenshot = await captureScreenshot(client);
        const scrollTextContent = [{
          type: 'text',
          text: `Successfully scrolled until text visible: "${args.text}"`
        }];
        if (scrollTextScreenshot) {
          scrollTextContent.push(scrollTextScreenshot);
        }
        return { content: scrollTextContent };

      case 'testdriver_scrollUntilImage':
        await client.scrollUntilImage(args.description, args.direction, args.amount, args.timeout);
        
        const scrollImageScreenshot = await captureScreenshot(client);
        const scrollImageContent = [{
          type: 'text',
          text: `Successfully scrolled until image visible: "${args.description}"`
        }];
        if (scrollImageScreenshot) {
          scrollImageContent.push(scrollImageScreenshot);
        }
        return { content: scrollImageContent };

      case 'testdriver_wait':
        await client.wait(args.timeout);
        return {
          content: [{
            type: 'text',
            text: `Successfully waited ${args.timeout || 1000}ms`
          }]
        };

      case 'testdriver_waitForText':
        await client.waitForText(args.text, args.timeout);
        
        const waitTextScreenshot = await captureScreenshot(client);
        const waitTextContent = [{
          type: 'text',
          text: `Successfully found text: "${args.text}"`
        }];
        if (waitTextScreenshot) {
          waitTextContent.push(waitTextScreenshot);
        }
        return { content: waitTextContent };

      case 'testdriver_waitForImage':
        await client.waitForImage(args.description, args.timeout);
        
        const waitImageScreenshot = await captureScreenshot(client);
        const waitImageContent = [{
          type: 'text',
          text: `Successfully found image: "${args.description}"`
        }];
        if (waitImageScreenshot) {
          waitImageContent.push(waitImageScreenshot);
        }
        return { content: waitImageContent };

      case 'testdriver_assert':
        const result = await client.assert(args.expect, args.async, args.invert);
        
        const assertScreenshot = await captureScreenshot(client);
        const assertContent = [{
          type: 'text',
          text: `Assertion ${args.invert ? 'NOT ' : ''}passed: "${args.expect}"`
        }];
        if (assertScreenshot) {
          assertContent.push(assertScreenshot);
        }
        return { content: assertContent };

      case 'testdriver_remember':
        const rememberedText = await client.remember(args.description);
        
        const rememberScreenshot = await captureScreenshot(client);
        const rememberContent = [{
          type: 'text',
          text: `Extracted text: "${rememberedText}"`
        }];
        if (rememberScreenshot) {
          rememberContent.push(rememberScreenshot);
        }
        return { content: rememberContent };

      case 'testdriver_focusApplication':
        await client.focusApplication(args.name);
        
        const focusScreenshot = await captureScreenshot(client);
        const focusContent = [{
          type: 'text',
          text: `Successfully focused application: "${args.name}"`
        }];
        if (focusScreenshot) {
          focusContent.push(focusScreenshot);
        }
        return { content: focusContent };

      case 'testdriver_exec':
        const execResult = await client.exec(args.language, args.code, args.timeout, args.silent);
        
        const execScreenshot = await captureScreenshot(client);
        const execContent = [{
          type: 'text',
          text: `Execution result:\n${execResult || '(no output)'}`
        }];
        if (execScreenshot) {
          execContent.push(execScreenshot);
        }
        return { content: execContent };

      case 'testdriver_matchImage':
        await client.matchImage(args.path, args.action, args.invert);
        
        const matchImageScreenshot = await captureScreenshot(client);
        const matchImageContent = [{
          type: 'text',
          text: `Image ${args.invert ? 'NOT ' : ''}matched: "${args.path}"`
        }];
        if (matchImageScreenshot) {
          matchImageContent.push(matchImageScreenshot);
        }
        return { content: matchImageContent };

      case 'testdriver_run':
        await client.run(args.file);
        
        const runScreenshot = await captureScreenshot(client);
        const runContent = [{
          type: 'text',
          text: `Successfully ran file: "${args.file}"`
        }];
        if (runScreenshot) {
          runContent.push(runScreenshot);
        }
        return { content: runContent };

      case 'testdriver_getScreenshot':
        const screenshot = await client.system.captureScreenBase64();
        if (args.base64) {
          return {
            content: [{
              type: 'text',
              text: 'Screenshot captured successfully'
            }, {
              type: 'image',
              data: screenshot,
              mimeType: 'image/png'
            }]
          };
        }
        return {
          content: [{
            type: 'text',
            text: 'Screenshot captured'
          }]
        };

      case 'testdriver_writeTestFile':
        try {
          const filePath = resolve(args.filePath);
          const dir = dirname(filePath);
          
          // Ensure directory exists
          await mkdir(dir, { recursive: true });
          
          let content = args.content;
          
          // Auto-format based on file type
          const ext = args.format || extname(filePath).slice(1);
          
          if (args.append) {
            await appendFile(filePath, '\n' + content);
          } else {
            await writeFile(filePath, content);
          }
          
          return {
            content: [{
              type: 'text',
              text: `Successfully ${args.append ? 'appended to' : 'created'} test file: ${filePath}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error writing test file: ${error.message}`
            }],
            isError: true
          };
        }

      case 'testdriver_readTestFile':
        try {
          const filePath = resolve(args.filePath);
          const content = await readFile(filePath, 'utf-8');
          return {
            content: [{
              type: 'text',
              text: `Contents of ${filePath}:\n\n${content}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error reading test file: ${error.message}`
            }],
            isError: true
          };
        }

      case 'testdriver_runTestFile':
        try {
          const filePath = resolve(args.filePath);
          await client.run(filePath);
          
          const runTestScreenshot = await captureScreenshot(client);
          const runTestContent = [{
            type: 'text',
            text: `Successfully executed test file: ${filePath}`
          }];
          if (runTestScreenshot) {
            runTestContent.push(runTestScreenshot);
          }
          return { content: runTestContent };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error running test file: ${error.message}`
            }],
            isError: true
          };
        }

      case 'testdriver_appendYamlCommand':
        try {
          const filePath = resolve(args.filePath);
          const dir = dirname(filePath);
          await mkdir(dir, { recursive: true });
          
          // Create YAML command object
          const cmdObj = { command: args.command, ...args.params };
          const yamlLine = yaml.dump([cmdObj], { indent: 2 })
            .split('\n')
            .slice(1) // Remove array marker
            .map(line => '  ' + line)
            .join('\n');
          
          // Check if file exists and has content
          let existingContent = '';
          try {
            existingContent = await readFile(filePath, 'utf-8');
          } catch (err) {
            // File doesn't exist, create with header
            existingContent = 'commands:\n';
          }
          
          // Append command
          const newContent = existingContent.trimEnd() + '\n' + yamlLine;
          await writeFile(filePath, newContent);
          
          return {
            content: [{
              type: 'text',
              text: `Successfully appended ${args.command} command to ${filePath}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error appending command: ${error.message}`
            }],
            isError: true
          };
        }

      case 'testdriver_createTestFromActions':
        try {
          const filePath = resolve(args.filePath);
          const dir = dirname(filePath);
          await mkdir(dir, { recursive: true });
          
          const format = args.format || 'yaml';
          const actions = args.actions || actionHistory;
          const metadata = args.metadata || {};
          
          let content = '';
          
          if (format === 'yaml') {
            // Generate YAML test
            const yamlTest = {
              name: metadata.name || 'Generated Test',
              description: metadata.description || 'Auto-generated from MCP actions',
            };
            
            if (metadata.tags && metadata.tags.length > 0) {
              yamlTest.tags = metadata.tags;
            }
            
            yamlTest.commands = actions.map(action => ({
              command: action.command,
              ...action.params
            }));
            
            content = yaml.dump(yamlTest, { indent: 2 });
          } else {
            // Generate JavaScript test
            content = generateJavaScriptTest(actions, metadata);
          }
          
          await writeFile(filePath, content);
          
          return {
            content: [{
              type: 'text',
              text: `Successfully created test file: ${filePath}\nFormat: ${format}\nActions: ${actions.length}\n\nYou can now run this test with testdriver_runTestFile.`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error creating test file: ${error.message}`
            }],
            isError: true
          };
        }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error.message}`
      }],
      isError: true
    };
  }
}

/**
 * Generate JavaScript test file from actions
 */
function generateJavaScriptTest(actions, metadata) {
  const testName = metadata.name || 'Generated Test';
  const description = metadata.description || 'Auto-generated from MCP actions';
  
  let code = `/**
 * ${testName}
 * ${description}
 * 
 * Auto-generated by TestDriver MCP Server
 */

import { describe, it, beforeAll, afterAll } from 'vitest';
import { createTestClient, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('${testName}', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('${description}', async () => {
`;

  // Convert actions to JavaScript SDK calls
  actions.forEach(action => {
    const cmd = convertActionToJS(action);
    code += `    ${cmd}\n`;
  });

  code += `  });
});
`;

  return code;
}

/**
 * Convert action object to JavaScript SDK call
 */
function convertActionToJS(action) {
  const { command, params } = action;
  
  // Map YAML commands to SDK methods
  const methodMap = {
    'hover-text': 'hoverText',
    'hover-image': 'hoverImage',
    'type': 'type',
    'press-keys': 'pressKeys',
    'scroll': 'scroll',
    'scroll-until-text': 'scrollUntilText',
    'scroll-until-image': 'scrollUntilImage',
    'wait': 'wait',
    'wait-for-text': 'waitForText',
    'wait-for-image': 'waitForImage',
    'assert': 'assert',
    'remember': 'remember',
    'focus-application': 'focusApplication',
    'exec': 'exec',
    'match-image': 'matchImage',
    'run': 'run'
  };
  
  const method = methodMap[command] || command;
  const args = [];
  
  // Build arguments based on command type
  switch (command) {
    case 'hover-text':
      if (params.text) args.push(`'${params.text}'`);
      if (params.description) args.push(`'${params.description}'`);
      if (params.action) args.push(`'${params.action}'`);
      break;
    case 'type':
      if (params.text) args.push(`'${params.text}'`);
      break;
    case 'press-keys':
      if (params.keys) {
        const keys = Array.isArray(params.keys) ? params.keys : [params.keys];
        args.push(`[${keys.map(k => `'${k}'`).join(', ')}]`);
      }
      break;
    case 'wait':
      if (params.timeout) args.push(params.timeout);
      break;
    case 'assert':
      if (params.expect) args.push(`'${params.expect}'`);
      break;
    case 'remember':
      if (params.description) args.push(`'${params.description}'`);
      break;
    default:
      // Generic parameter handling
      Object.entries(params).forEach(([key, value]) => {
        if (typeof value === 'string') {
          args.push(`'${value}'`);
        } else {
          args.push(JSON.stringify(value));
        }
      });
  }
  
  return `await client.${method}(${args.join(', ')});`;
}

/**
 * Main server setup
 */
async function main() {
  const server = new Server(
    {
      name: 'testdriver-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOLS
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return await executeTool(name, args || {});
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('TestDriver MCP Server running on stdio');
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
