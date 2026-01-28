#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import util from "util";
import { z } from "zod";

const execAsync = util.promisify(exec);
const EXEC_OPTIONS = { maxBuffer: 1024 * 1024 * 10 }; // 10MB buffer

// Store recent test runs for the dashboard
const recentRuns = [];

const server = new Server(
  {
    name: "testdriver-plugin",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "setup_testdriver",
        description: "Initialize TestDriver in the current project",
        inputSchema: z.object({}).shape,
      },
      {
        name: "create_test",
        description: "Create a new TestDriver test file",
        inputSchema: z.object({
          filename: z
            .string()
            .describe("Path to the new test file (e.g., tests/login.test.mjs)"),
          url: z.string().optional().describe("Initial URL to open"),
          description: z
            .string()
            .optional()
            .describe("Description of the test"),
        }).shape,
      },
      {
        name: "run_tests",
        description: "Run TestDriver tests using Vitest",
        inputSchema: z.object({
          testFile: z.string().optional().describe("Specific test file to run"),
        }).shape,
      },
      {
        name: "query_results",
        description: "Query test results (returns last run summary)",
        inputSchema: z.object({}).shape,
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "setup_testdriver") {
      // Check for .env
      let envExists = false;
      try {
        await fs.access(".env");
        envExists = true;
      } catch {}

      if (!envExists) {
        await fs.writeFile(".env", "TD_API_KEY=\n");
      }

      // Check for vitest.config.mjs (basic check)
      // In a real plugin, we might want to be more sophisticated

      return {
        content: [
          {
            type: "text",
            text: "TestDriver initialized. Please check .env and add your API Key.",
          },
        ],
      };
    } else if (name === "create_test") {
      const filename = args.filename;
      const url = args.url || "https://example.com";
      const desc = args.description || "My Test Suite";

      const content = `import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/lib/vitest/hooks.mjs";

describe("${desc}", () => {
  it("should perform the test", async (context) => {
    const testdriver = TestDriver(context);
    await testdriver.provision.chrome({ url: '${url}' });
    
    // Add your steps here
    // await testdriver.find("element").click();
    
    const result = await testdriver.assert("The page loaded correctly");
    expect(result).toBeTruthy();
  });
});
`;
      // Ensure directory exists
      const dir = path.dirname(filename);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filename, content);

      return {
        content: [{ type: "text", text: `Created test file: ${filename}` }],
      };
    } else if (name === "run_tests") {
      const command = args.testFile
        ? `npx vitest run ${args.testFile}`
        : "npx vitest run";

      // We'll capture output to parse for links, but returning the output is the main goal
      // In a real implementation this should stream or handle long output better
      try {
        const { stdout, stderr } = await execAsync(command, EXEC_OPTIONS);

        // Parse for Replay URLs
        // Example: https://dashcam.io/replay/12345
        const replayMatch = stdout.match(
          /(https:\/\/dashcam\.io\/replay\/[a-zA-Z0-9-]+)/g,
        );
        if (replayMatch) {
          replayMatch.forEach((url) => {
            recentRuns.push({
              id: Date.now().toString(),
              url: url,
              timestamp: new Date().toISOString(),
              command: command,
            });
          });
        }

        // Also capture failed runs or regular runs without replays if needed
        if (recentRuns.length > 10) recentRuns.shift(); // Keep last 10

        return {
          content: [{ type: "text", text: stdout + "\n" + stderr }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text:
                error.stdout +
                "\n" +
                error.stderr +
                "\nError: " +
                error.message,
            },
          ],
          isError: true,
        };
      }
    } else if (name === "query_results") {
      // Basic implementation: return recent runs tracked by this server instance
      return {
        content: [{ type: "text", text: JSON.stringify(recentRuns, null, 2) }],
      };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "testdriver://dashboard",
        mimeType: "text/html",
        name: "TestDriver Dashboard",
      },
      ...recentRuns.map((run) => ({
        uri: `testdriver://run/${run.id}`,
        mimeType: "text/html",
        name: `Test Run ${run.id}`,
      })),
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (uri === "testdriver://dashboard") {
    const list = recentRuns
      .map(
        (run) => `
            <li>
                <a href="testdriver://run/${run.id}">Run ${run.timestamp}</a>
                <br/>
                <code>${run.url}</code>
            </li>
        `,
      )
      .join("");

    return {
      contents: [
        {
          uri,
          mimeType: "text/html",
          text: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: system-ui, sans-serif; padding: 20px; }
                            h1 { color: #333; }
                            ul { list-style: none; padding: 0; }
                            li { margin-bottom: 20px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
                        </style>
                    </head>
                    <body>
                        <h1>TestDriver Dashboard</h1>
                        <h2>Recent Runs</h2>
                        <ul>${list}</ul>
                        ${recentRuns.length === 0 ? "<p>No runs recorded yet.</p>" : ""}
                    </body>
                    </html>
                `,
        },
      ],
    };
  }

  if (uri.startsWith("testdriver://run/")) {
    const id = uri.split("/").pop();
    const run = recentRuns.find((r) => r.id === id);

    if (run) {
      // Embed dashcam/replay URL
      // We'll trust the URL found in stdout
      return {
        contents: [
          {
            uri,
            mimeType: "text/html",
            text: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <style>
                                body { margin: 0; height: 100vh; display: flex; flex-direction: column; }
                                iframe { flex: 1; border: none; }
                                .header { padding: 10px; background: #eee; }
                            </style>
                        </head>
                        <body>
                            <div class="header">
                                <a href="testdriver://dashboard">← Back to Dashboard</a> | 
                                <span>Run ${id}</span> | 
                                <a href="${run.url}" target="_blank">Open in Browser</a>
                            </div>
                            <iframe src="${run.url}"></iframe>
                        </body>
                        </html>
                     `,
          },
        ],
      };
    }
  }

  throw new Error(`Resource not found: ${uri}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
