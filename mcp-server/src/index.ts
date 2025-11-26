#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import TestDriver from "testdriverai";
import { z } from "zod";

// Global TestDriver instance - maintains persistent connection
let testdriver: any = null;
let isConnected = false;
let sandboxInstance: any = null;

// Create MCP server
const server = new Server(
  {
    name: "testdriverai",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Zod schemas for tool inputs
const ConnectSchema = z.object({
  apiKey: z.string().optional().describe("TestDriver API key (optional if TD_API_KEY env var is set)"),
  sandboxId: z.string().optional().describe("Existing sandbox ID to reconnect to"),
  newSandbox: z.boolean().optional().describe("Force creation of a new sandbox"),
  resolution: z.string().optional().describe("Sandbox resolution (default: '1366x768')"),
  cache: z.boolean().optional().describe("Enable/disable cache (default: true)"),
});

const FindSchema = z.object({
  description: z.string().describe("Description of the element to find"),
  cacheThreshold: z.number().optional().describe("Cache threshold (0-1, lower = stricter)"),
});

const FindAllSchema = z.object({
  description: z.string().describe("Description of the elements to find"),
  cacheThreshold: z.number().optional().describe("Cache threshold (0-1, lower = stricter)"),
});

const ClickSchema = z.object({
  x: z.number().describe("X coordinate"),
  y: z.number().describe("Y coordinate"),
  action: z.enum(["click", "right-click", "double-click", "mouseDown", "mouseUp"]).optional().describe("Type of click action"),
});

const HoverSchema = z.object({
  x: z.number().describe("X coordinate"),
  y: z.number().describe("Y coordinate"),
});

const TypeSchema = z.object({
  text: z.union([z.string(), z.number()]).describe("Text to type"),
  delay: z.number().optional().describe("Delay between keystrokes in ms (default: 250)"),
});

const PressKeysSchema = z.object({
  keys: z.array(z.string()).describe("Array of keys to press (e.g., ['ctrl', 'c'])"),
});

const ScrollSchema = z.object({
  direction: z.enum(["up", "down", "left", "right"]).optional().describe("Scroll direction"),
  amount: z.number().optional().describe("Amount to scroll in pixels (default: 300)"),
  method: z.enum(["keyboard", "mouse"]).optional().describe("Scroll method (default: 'mouse')"),
});

const AssertSchema = z.object({
  assertion: z.string().describe("Assertion to check (e.g., 'the login was successful')"),
  async: z.boolean().optional().describe("Run asynchronously (default: false)"),
  invert: z.boolean().optional().describe("Invert the assertion (default: false)"),
});

const RememberSchema = z.object({
  description: z.string().describe("What to remember from the screen"),
});

const ScreenshotSchema = z.object({
  scale: z.number().optional().describe("Scale factor (default: 1)"),
  mouse: z.boolean().optional().describe("Include mouse cursor (default: false)"),
});

const FocusApplicationSchema = z.object({
  name: z.string().describe("Application name to focus"),
});

const ExecSchema = z.object({
  language: z.enum(["sh", "pwsh"]).describe("Language to execute ('sh' for shell scripts or 'pwsh' for PowerShell)"),
  code: z.string().describe("Code to execute"),
  timeout: z.number().describe("Timeout in milliseconds"),
  silent: z.boolean().optional().describe("Suppress output (default: false)"),
});

const WaitSchema = z.object({
  timeout: z.number().optional().describe("Time to wait in milliseconds (default: 1000)"),
});

const AISchema = z.object({
  task: z.string().describe("Natural language task description"),
  validateAndLoop: z.boolean().optional().describe("Validate and loop until complete"),
});

const DisconnectSchema = z.object({});

// Helper to ensure connected
function ensureConnected() {
  if (!isConnected || !testdriver) {
    throw new Error(
      "Not connected to TestDriver. Please call testdriver_connect first."
    );
  }
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "testdriver_connect",
        description:
          "Connect to a TestDriver sandbox environment. This must be called before any other TestDriver operations. Returns the debugger URL where you can watch the live VM screen.",
        inputSchema: ConnectSchema,
      },
      {
        name: "testdriver_disconnect",
        description: "Disconnect from the TestDriver sandbox and clean up resources.",
        inputSchema: DisconnectSchema,
      },
      {
        name: "testdriver_find",
        description:
          "Find an element by description. Returns element coordinates and metadata. The element is automatically located and can be interacted with.",
        inputSchema: FindSchema,
      },
      {
        name: "testdriver_findAll",
        description:
          "Find all elements matching a description. Returns an array of elements with coordinates and metadata.",
        inputSchema: FindAllSchema,
      },
      {
        name: "testdriver_click",
        description:
          "Click at specific screen coordinates. Can perform click, right-click, double-click, mouseDown, or mouseUp actions.",
        inputSchema: ClickSchema,
      },
      {
        name: "testdriver_hover",
        description: "Hover the mouse at specific screen coordinates.",
        inputSchema: HoverSchema,
      },
      {
        name: "testdriver_type",
        description:
          "Type text into the currently focused field. Make sure to focus the correct field first (e.g., by clicking on it).",
        inputSchema: TypeSchema,
      },
      {
        name: "testdriver_pressKeys",
        description:
          "Press keyboard key combinations. Useful for shortcuts like Ctrl+C, Ctrl+V, etc.",
        inputSchema: PressKeysSchema,
      },
      {
        name: "testdriver_scroll",
        description:
          "Scroll the screen in a direction by a certain amount using keyboard or mouse.",
        inputSchema: ScrollSchema,
      },
      {
        name: "testdriver_assert",
        description:
          "Make an AI-powered assertion about the current screen state. Use this to verify that actions succeeded (e.g., 'the user is logged in', 'the form was submitted successfully').",
        inputSchema: AssertSchema,
      },
      {
        name: "testdriver_remember",
        description:
          "Extract and remember information from the screen using AI. Useful for capturing dynamic values like order numbers, timestamps, etc.",
        inputSchema: RememberSchema,
      },
      {
        name: "testdriver_screenshot",
        description:
          "Capture a screenshot of the current screen state. Returns base64 encoded PNG image. Use this frequently to verify actions succeeded.",
        inputSchema: ScreenshotSchema,
      },
      {
        name: "testdriver_focusApplication",
        description:
          "Focus (bring to front) an application by name. Useful for switching between applications.",
        inputSchema: FocusApplicationSchema,
      },
      {
        name: "testdriver_exec",
        description:
          "Execute shell (sh) or PowerShell (pwsh) code in the sandbox. Useful for advanced automation tasks.",
        inputSchema: ExecSchema,
      },
      {
        name: "testdriver_wait",
        description:
          "⚠️ DEPRECATED - DO NOT USE. Instead of wait(), use find() in a polling loop to wait for elements. Example: `let el; for (let i = 0; i < 10; i++) { try { el = await find('button'); if (el.found()) break; } catch {} await new Promise(r => setTimeout(r, 1000)); }`. Arbitrary waits make tests brittle and slow. Only use wait() if absolutely necessary for timing-dependent operations that cannot be detected via UI state.",
        inputSchema: WaitSchema,
      },
      {
        name: "testdriver_ai",
        description:
          "Execute a natural language task using AI. This is the SDK equivalent of the CLI's exploratory loop. The AI will attempt to complete the task autonomously.",
        inputSchema: AISchema,
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "testdriver_connect": {
        const { apiKey, sandboxId, newSandbox, resolution, cache } =
          ConnectSchema.parse(args);

        // Use provided API key or fall back to TD_API_KEY environment variable
        const effectiveApiKey = apiKey || process.env.TD_API_KEY;
        
        if (!effectiveApiKey) {
          return {
            content: [
              {
                type: "text",
                text: "❌ No API key provided. Please either:\n" +
                  "1. Pass apiKey parameter to testdriver_connect, or\n" +
                  "2. Set TD_API_KEY environment variable in your MCP configuration\n\n" +
                  "Get your API key from: https://v6.testdriver.ai/settings",
              },
            ],
            isError: true,
          };
        }

        testdriver = new TestDriver(effectiveApiKey, {
          resolution: resolution || "1366x768",
          cache: cache !== false,
        });

        sandboxInstance = await testdriver.connect({
          sandboxId,
          newSandbox,
        });

        isConnected = true;

        const debuggerUrl = `https://v6.testdriver.ai/debugger/${testdriver.getSessionId()}`;

        return {
          content: [
            {
              type: "text",
              text: `✅ Connected to TestDriver sandbox!\n\n` +
                `🔧 Instance: ${sandboxInstance.instanceId}\n` +
                `🌐 IP: ${sandboxInstance.ip}\n` +
                `📝 Session: ${testdriver.getSessionId()}\n\n` +
                `🎥 Watch live: ${debuggerUrl}\n\n` +
                `💡 This is a persistent connection. The sandbox will remain active until you disconnect.\n` +
                `   You can now use TestDriver tools to interact with the sandbox and create test code.\n\n` +
                `📖 To create a Vitest test:\n` +
                `   1. Use find(), click(), type(), assert() etc. to interact\n` +
                `   2. Take screenshots to verify each step\n` +
                `   3. Generate Vitest code based on successful interactions\n` +
                `   4. The AI will help translate your steps into test code`,
            },
          ],
        };
      }

      case "testdriver_disconnect": {
        ensureConnected();
        await testdriver.disconnect();
        isConnected = false;
        testdriver = null;

        return {
          content: [
            {
              type: "text",
              text: "Disconnected from TestDriver sandbox.",
            },
          ],
        };
      }

      case "testdriver_find": {
        ensureConnected();
        const { description, cacheThreshold } = FindSchema.parse(args);

        const element = await testdriver.find(description, cacheThreshold);

        if (!element.found()) {
          return {
            content: [
              {
                type: "text",
                text: `Element "${description}" not found on screen.`,
              },
            ],
            isError: true,
          };
        }

        const coords = element.getCoordinates();
        const response = element.getResponse();

        return {
          content: [
            {
              type: "text",
              text: `Found element: "${description}"\n\n` +
                `Coordinates:\n` +
                `  Top-left: (${coords.x}, ${coords.y})\n` +
                `  Center: (${coords.centerX}, ${coords.centerY})\n` +
                `  Confidence: ${element.confidence || 'N/A'}\n\n` +
                `You can now interact with this element using click, hover, etc.`,
            },
          ],
        };
      }

      case "testdriver_findAll": {
        ensureConnected();
        const { description, cacheThreshold } = FindAllSchema.parse(args);

        const elements = await testdriver.findAll(description, cacheThreshold);

        if (elements.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No elements matching "${description}" found on screen.`,
              },
            ],
          };
        }

        const elementInfo = elements.map((el: any, i: number) => {
          const coords = el.getCoordinates();
          return `${i + 1}. Center: (${coords.centerX}, ${coords.centerY}), Confidence: ${el.confidence || 'N/A'}`;
        }).join('\n');

        return {
          content: [
            {
              type: "text",
              text: `Found ${elements.length} elements matching "${description}":\n\n${elementInfo}`,
            },
          ],
        };
      }

      case "testdriver_click": {
        ensureConnected();
        const { x, y, action } = ClickSchema.parse(args);

        await testdriver.click(x, y, action || "click");

        return {
          content: [
            {
              type: "text",
              text: `Clicked at (${x}, ${y}) with action: ${action || "click"}`,
            },
          ],
        };
      }

      case "testdriver_hover": {
        ensureConnected();
        const { x, y } = HoverSchema.parse(args);

        await testdriver.hover(x, y);

        return {
          content: [
            {
              type: "text",
              text: `Hovered at (${x}, ${y})`,
            },
          ],
        };
      }

      case "testdriver_type": {
        ensureConnected();
        const { text, delay } = TypeSchema.parse(args);

        await testdriver.type(text, delay);

        return {
          content: [
            {
              type: "text",
              text: `Typed: "${text}"`,
            },
          ],
        };
      }

      case "testdriver_pressKeys": {
        ensureConnected();
        const { keys } = PressKeysSchema.parse(args);

        await testdriver.pressKeys(keys);

        return {
          content: [
            {
              type: "text",
              text: `Pressed keys: ${keys.join(" + ")}`,
            },
          ],
        };
      }

      case "testdriver_scroll": {
        ensureConnected();
        const { direction, amount, method } = ScrollSchema.parse(args);

        await testdriver.scroll(direction, amount, method);

        return {
          content: [
            {
              type: "text",
              text: `Scrolled ${direction || "down"} by ${amount || 300}px using ${method || "mouse"}`,
            },
          ],
        };
      }

      case "testdriver_assert": {
        ensureConnected();
        const { assertion, async, invert } = AssertSchema.parse(args);

        const result = await testdriver.assert(assertion, async, invert);

        return {
          content: [
            {
              type: "text",
              text: result
                ? `✓ Assertion passed: "${assertion}"`
                : `✗ Assertion failed: "${assertion}"`,
            },
          ],
          isError: !result,
        };
      }

      case "testdriver_remember": {
        ensureConnected();
        const { description } = RememberSchema.parse(args);

        const value = await testdriver.remember(description);

        return {
          content: [
            {
              type: "text",
              text: `Remembered "${description}": ${value}`,
            },
          ],
        };
      }

      case "testdriver_screenshot": {
        ensureConnected();
        const { scale, mouse } = ScreenshotSchema.parse(args);

        const screenshot = await testdriver.screenshot(scale, true, mouse);

        return {
          content: [
            {
              type: "image",
              data: screenshot,
              mimeType: "image/png",
            },
            {
              type: "text",
              text: "Screenshot captured successfully.",
            },
          ],
        };
      }

      case "testdriver_focusApplication": {
        ensureConnected();
        const { name: appName } = FocusApplicationSchema.parse(args);

        const result = await testdriver.focusApplication(appName);

        return {
          content: [
            {
              type: "text",
              text: `Focused application: ${appName}\nResult: ${result}`,
            },
          ],
        };
      }

      case "testdriver_exec": {
        ensureConnected();
        const { language, code, timeout, silent } = ExecSchema.parse(args);

        const result = await testdriver.exec(language, code, timeout, silent);

        return {
          content: [
            {
              type: "text",
              text: `Executed ${language} code:\n\nOutput:\n${result}`,
            },
          ],
        };
      }

      case "testdriver_wait": {
        ensureConnected();
        const { timeout } = WaitSchema.parse(args);

        await testdriver.wait(timeout);

        return {
          content: [
            {
              type: "text",
              text: `Waited for ${timeout || 1000}ms`,
            },
          ],
        };
      }

      case "testdriver_ai": {
        ensureConnected();
        const { task, validateAndLoop } = AISchema.parse(args);

        const result = await testdriver.ai(task, { validateAndLoop });

        return {
          content: [
            {
              type: "text",
              text: result
                ? `AI task completed: "${task}"\n\nResult: ${result}`
                : `AI task executed: "${task}"`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}\n\nStack trace:\n${error.stack}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("TestDriver MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in MCP server:", error);
  process.exit(1);
});
