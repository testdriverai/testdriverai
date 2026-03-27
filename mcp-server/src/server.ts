#!/usr/bin/env node
/**
 * TestDriver MCP Server
 * Enables AI agents to iteratively build tests with visual feedback
 */

// Configure logger to use stderr to avoid corrupting MCP JSON-RPC stream on stdout
process.env.TD_STDIO = "stderr";
// Enable debug mode to preserve croppedImage in SDK responses (needed for MCP App visuals)
process.env.TD_DEBUG = "true";

import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import * as Sentry from "@sentry/node";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { z } from "zod";

import { generateActionCode } from "./codegen.js";
import { getProvisionOptions, SessionStartInputSchema, type SessionStartInput } from "./provision-types.js";
import { sessionManager, type SessionState } from "./session.js";

// =============================================================================
// Sentry
// =============================================================================

// Read version from main package.json (../../package.json from mcp-server/dist/)
const sdkRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(sdkRoot, "package.json"), "utf-8"));
const version = packageJson.version || "1.0.0";

// Derive release channel and infrastructure environment from package version
import semver from "semver";

const CHANNEL_TO_ENV: Record<string, string> = {
  dev: "dev",
  test: "staging",
  canary: "production",
  stable: "production",
};
const VALID_CHANNELS = new Set(Object.keys(CHANNEL_TO_ENV));
const VALID_ENVS = new Set(["dev", "staging", "production"]);

function resolveChannel(ver: string): string {
  if (process.env.TD_CHANNEL && VALID_CHANNELS.has(process.env.TD_CHANNEL)) return process.env.TD_CHANNEL;
  if (process.env.TD_ENV && VALID_CHANNELS.has(process.env.TD_ENV)) return process.env.TD_ENV;
  const pre = semver.prerelease(ver);
  if (pre && pre.length > 0 && VALID_CHANNELS.has(String(pre[0]))) return String(pre[0]);
  return "stable";
}

function resolveSentryEnvironment(ver: string): string {
  if (process.env.TD_ENV && VALID_ENVS.has(process.env.TD_ENV)) return process.env.TD_ENV;
  return CHANNEL_TO_ENV[resolveChannel(ver)] || "production";
}

const activeChannel = resolveChannel(version);
const sentryEnvironment = resolveSentryEnvironment(version);

const isSentryEnabled = () => {
  if (process.env.TD_TELEMETRY === "false") {
    return false;
  }
  return true;
};

if (isSentryEnabled()) {
  console.error("Analytics enabled. Set TD_TELEMETRY=false to disable.");
  Sentry.init({
    dsn:
      process.env.SENTRY_DSN ||
      "https://452bd5a00dbd83a38ee8813e11c57694@o4510262629236736.ingest.us.sentry.io/4510480443637760",
    environment: sentryEnvironment,
    release: version,
    sampleRate: 1.0,
    tracesSampleRate: 1.0,
    sendDefaultPii: true,
    integrations: [Sentry.httpIntegration(), Sentry.nodeContextIntegration()],
    initialScope: {
      tags: {
        channel: activeChannel,
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
      },
    },
    // Filter out expected test/element failures - only report actual exceptions and crashes
    beforeSend(event, hint) {
      const error = hint.originalException;
      
      if (error && typeof error === "object" && "message" in error) {
        const msg = (error as { message: string }).message;
        
        // Don't send user-initiated exits
        if (msg.includes("User cancelled")) {
          return null;
        }
        
        // Don't send expected test/element failures - these are normal test outcomes, not crashes
        if (
          msg.includes("Element not found") ||
          msg.includes("No elements found") ||
          msg.includes("No element found") ||
          msg.includes("Assertion failed") ||
          msg.includes("assertion failed")
        ) {
          return null;
        }
      }
      
      // Filter out TestFailure errors (test failures, not crashes)
      if (error && typeof error === "object" && "name" in error && (error as { name: string }).name === "TestFailure") {
        return null;
      }

      // Filter out ElementNotFoundError - expected test outcome, not a crash
      if (error && typeof error === "object" && "name" in error && (error as { name: string }).name === "ElementNotFoundError") {
        return null;
      }
      
      return event;
    },
  });
}

function captureException(error: Error, context: { tags?: Record<string, string>; extra?: Record<string, unknown> } = {}) {
  if (!isSentryEnabled()) return;
  
  Sentry.withScope((scope) => {
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

function setSessionContext(sessionId: string, sandboxId?: string) {
  if (!isSentryEnabled()) return;
  
  Sentry.setTag("session", sessionId);
  if (sandboxId) {
    Sentry.setTag("sandbox", sandboxId);
  }
  Sentry.setContext("session", {
    sessionId,
    sandboxId,
  });
}

async function flushSentry(timeout = 2000) {
  if (!isSentryEnabled()) return;
  await Sentry.flush(timeout);
}

// =============================================================================
// Logging
// =============================================================================

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

// Set via TD_LOG_LEVEL env var (default: INFO)
const currentLogLevel = LOG_LEVELS[(process.env.TD_LOG_LEVEL?.toUpperCase() as LogLevel) || "INFO"] ?? LOG_LEVELS.INFO;

function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  if (LOG_LEVELS[level] < currentLogLevel) return;
  
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  const dataStr = data ? ` ${JSON.stringify(data)}` : "";
  console.error(`${prefix} ${message}${dataStr}`);
}

const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log("DEBUG", msg, data),
  info: (msg: string, data?: Record<string, unknown>) => log("INFO", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log("WARN", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log("ERROR", msg, data),
};

// Get directory for UI files - works both from source and compiled
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = __filename.endsWith(".ts")
  ? path.join(__dirname, "..", "dist")
  : __dirname;

// Resource URI for the screenshot result UI
const RESOURCE_URI = "ui://testdriver/mcp-app.html";

// Resource URI base for serving screenshot blobs (with dynamic IDs)
const SCREENSHOT_RESOURCE_BASE = "screenshot://testdriver/screenshot";
const CROPPED_IMAGE_RESOURCE_BASE = "screenshot://testdriver/cropped";

// SDK instance (will be initialized on session start)
let sdk: any = null;

// Last screenshot base64 for check comparisons
let lastScreenshotBase64: string | null = null;

// =============================================================================
// Image Store - Stores images with unique IDs for reload persistence
// =============================================================================

interface StoredImage {
  data: string;  // base64 image data
  type: "screenshot" | "cropped";
  timestamp: number;
}

// Map of image ID -> image data
const imageStore = new Map<string, StoredImage>();

// Counter for generating unique image IDs
let imageIdCounter = 0;

// Maximum number of images to store (to prevent memory leaks)
const MAX_STORED_IMAGES = 100;

/**
 * Store an image and return its unique resource URI
 */
function storeImage(data: string, type: "screenshot" | "cropped"): string {
  const id = `${type}-${++imageIdCounter}`;
  
  // Clean up old images if we exceed the limit
  if (imageStore.size >= MAX_STORED_IMAGES) {
    // Remove oldest images (first entries in the map)
    const entriesToRemove = Math.floor(MAX_STORED_IMAGES / 4);
    const keys = Array.from(imageStore.keys()).slice(0, entriesToRemove);
    for (const key of keys) {
      imageStore.delete(key);
    }
    logger.debug("storeImage: Cleaned up old images", { removed: entriesToRemove, remaining: imageStore.size });
  }
  
  imageStore.set(id, {
    data,
    type,
    timestamp: Date.now(),
  });
  
  logger.debug("storeImage: Stored image", { id, type, dataLength: data.length });
  
  const base = type === "screenshot" ? SCREENSHOT_RESOURCE_BASE : CROPPED_IMAGE_RESOURCE_BASE;
  return `${base}/${id}`;
}

/**
 * Get an image by its ID
 */
function getStoredImage(id: string): StoredImage | undefined {
  return imageStore.get(id);
}

/**
 * Get session info for structured content
 */
function getSessionData(session: SessionState | null) {
  if (!session) return { id: null, expiresIn: 0 };
  return {
    id: session.sessionId,
    expiresIn: sessionManager.getTimeRemaining(session.sessionId),
  };
}

/**
 * Check if session is ready for use - returns error result if not
 * This helper provides clear, actionable error messages for the AI
 * 
 * Auto-extends the session on each successful check to prevent expiry during active use
 */
function requireActiveSession(): { valid: true } | { valid: false; error: CallToolResult } {
  const session = sessionManager.getCurrentSession();
  
  // No session ever created
  if (!sdk || !session) {
    return {
      valid: false,
      error: createToolResult(
        false,
        "ERROR: No active session. You must call session_start first to create a sandbox before using any other tools.",
        { 
          error: "NO_SESSION",
          action: "session_start",
          message: "No sandbox session exists. Call session_start to create one."
        }
      )
    };
  }
  
  // Session exists but has expired
  if (!sessionManager.isSessionValid(session.sessionId)) {
    // Clear the SDK reference since the sandbox is no longer available
    sdk = null;
    return {
      valid: false,
      error: createToolResult(
        false,
        "ERROR: Session has expired or timed out. The sandbox is no longer available. You must call session_start again to create a new sandbox session before continuing.",
        { 
          error: "SESSION_EXPIRED",
          action: "session_start",
          message: "The previous sandbox session has expired. Call session_start to create a new one.",
          expiredSessionId: session.sessionId
        }
      )
    };
  }
  
  // Auto-extend session on each command to prevent expiry during active use
  // This resets the expiry timer back to the original keepAlive duration
  sessionManager.refreshSession(session.sessionId);
  
  return { valid: true };
}

/**
 * Create tool result with structured content for MCP App
 * Images: imageUrl (data URL) goes to structuredContent for UI to display
 * The croppedImage from find() is small (~10KB) so it's acceptable as data URL
 * 
 * If generatedCode is provided, it's appended to the text response with instructions
 * for the agent to write it to the test file.
 */
function createToolResult(
  success: boolean,
  textContent: string,
  structuredData: Record<string, unknown>,
  generatedCode?: string
): CallToolResult {
  // Build text content - append generated code if provided with directive instructions
  let fullText = textContent;
  if (generatedCode && success) {
    // Get the test file from the current session
    const session = sessionManager.getCurrentSession();
    const testFile = session?.testFile;
    
    if (testFile) {
      fullText += `\n\n⚠️ ACTION REQUIRED: Append this code to ${testFile}:\n\`\`\`javascript\n${generatedCode}\n\`\`\``;
    } else {
      fullText += `\n\n⚠️ ACTION REQUIRED: Append this code to the test file:\n\`\`\`javascript\n${generatedCode}\n\`\`\``;
    }
  }
  
  const content: CallToolResult["content"] = [{ type: "text", text: fullText }];
  
  logger.debug("createToolResult", { 
    success, 
    action: structuredData.action,
    hasImage: !!structuredData.imageUrl,
    duration: structuredData.duration,
    hasGeneratedCode: !!generatedCode
  });
  
  // structuredContent goes to UI (includes imageUrl for display)
  // Always include success flag so UI can display correct status indicator
  // Include generatedCode and testFile in structured data so agents can programmatically handle it
  const session = sessionManager.getCurrentSession();
  return {
    content,
    structuredContent: { 
      ...structuredData, 
      success,
      generatedCode: generatedCode && success ? generatedCode : undefined,
      testFile: session?.testFile || undefined,
    },
  };
}

// Create MCP server wrapped with Sentry for automatic tracing
const server = isSentryEnabled()
  ? Sentry.wrapMcpServerWithSentry(
      new McpServer({
        name: "testdriver",
        version: version,
      })
    )
  : new McpServer({
      name: "testdriver",
      version: version,
    });

// Element reference storage (for click/hover after find)
// Stores actual Element instances - no raw coordinates as input
const elementRefs = new Map<string, { element: any; description: string; coords: { x: number; y: number; centerX: number; centerY: number } }>();

// =============================================================================
// Register UI Resource
// =============================================================================

registerAppResource(
  server,
  RESOURCE_URI,
  RESOURCE_URI,
  { mimeType: RESOURCE_MIME_TYPE, description: "TestDriver Screenshot Viewer UI" },
  async (): Promise<ReadResourceResult> => {
    const htmlPath = path.join(DIST_DIR, "mcp-app.html");
    
    if (!fs.existsSync(htmlPath)) {
      throw new Error(`UI file not found: ${htmlPath}`);
    }
    
    const html = fs.readFileSync(htmlPath, "utf-8");
    return {
      contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }],
    };
  }
);

// Register screenshot resource template for serving binary blobs by ID
server.registerResource(
  "Screenshot",
  new ResourceTemplate(`${SCREENSHOT_RESOURCE_BASE}/{imageId}`, { list: undefined }),
  {
    description: "Screenshot from TestDriver session served as base64 blob",
    mimeType: "image/png",
  },
  async (uri: URL, variables: Variables): Promise<ReadResourceResult> => {
    const imageId = variables.imageId as string;
    const image = getStoredImage(imageId);
    
    if (!image) {
      throw new Error(`Screenshot not found: ${imageId}. It may have been cleaned up.`);
    }
    
    logger.debug("screenshot resource: Serving screenshot blob", { 
      imageId,
      blobLength: image.data.length 
    });
    
    return {
      contents: [{
        uri: uri.href,
        mimeType: "image/png",
        blob: image.data,
      }],
    };
  }
);

// Register cropped image resource template for serving find operation results by ID
server.registerResource(
  "CroppedImage",
  new ResourceTemplate(`${CROPPED_IMAGE_RESOURCE_BASE}/{imageId}`, { list: undefined }),
  {
    description: "Cropped image from find operations served as base64 blob",
    mimeType: "image/png",
  },
  async (uri: URL, variables: Variables): Promise<ReadResourceResult> => {
    const imageId = variables.imageId as string;
    const image = getStoredImage(imageId);
    
    if (!image) {
      throw new Error(`Cropped image not found: ${imageId}. It may have been cleaned up.`);
    }
    
    logger.debug("cropped image resource: Serving cropped image blob", { 
      imageId,
      blobLength: image.data.length 
    });
    
    return {
      contents: [{
        uri: uri.href,
        mimeType: "image/png",
        blob: image.data,
      }],
    };
  }
);

// =============================================================================
// Tools
// =============================================================================

// Session Start
registerAppTool(
  server,
  "session_start",
  {
    title: "Session Start",
    description: `Start a new TestDriver session and provision a sandbox with browser or app.

⚠️ IMPORTANT - Test File Parameter:
When 'testFile' is provided, you MUST append the generated code to that file after EVERY successful action.
Each tool response includes "ACTION REQUIRED: Append this code..." - you must write that code to the test file immediately.

Provision types:
- chrome: Launch Chrome browser (default). Use 'url' for starting page.
- chromeExtension: Launch Chrome with an extension. Use 'extensionPath' or 'extensionId'.
- vscode: Launch VS Code. Use 'workspace' and optional 'extensions'.
- installer: Download and install an app. Use 'installerUrl' (required).
- electron: Launch an Electron app. Use 'appPath' (required).

Self-hosted mode:
- Provide 'ip' parameter to connect directly to a self-hosted Windows instance
- Set 'os' to 'windows' when connecting to Windows instances
- The IP can be from an AWS EC2 instance spawned via CloudFormation
- See https://docs.testdriver.ai/v7/aws-setup for AWS setup guide

Debug mode (connect to existing sandbox):
- Provide 'sandboxId' to connect to an existing sandbox (e.g., from a failed test with debugOnFailure: true)
- Skips provisioning - connects to sandbox in its current state
- Use this to interactively debug failed tests without re-running from scratch`,
    inputSchema: SessionStartInputSchema as any,
    _meta: { ui: { resourceUri: RESOURCE_URI, expanded: true } },
  },
  async (params: SessionStartInput): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("session_start: Starting", { 
      type: params.type, 
      url: params.url,
      os: params.os, 
      reconnect: params.reconnect,
      sandboxId: params.sandboxId,
    });

    try {
      // Validate required fields for specific provision types (unless connecting to existing sandbox)
      if (!params.sandboxId) {
        if (params.type === "installer" && !params.installerUrl) {
          return createToolResult(false, "installer type requires 'installerUrl' parameter", { error: "Missing required parameter: installerUrl" });
        }
        if (params.type === "electron" && !params.appPath) {
          return createToolResult(false, "electron type requires 'appPath' parameter", { error: "Missing required parameter: appPath" });
        }
      }

      // Create new session
      const newSession = sessionManager.createSession({
        os: params.os,
        keepAlive: params.keepAlive,
        testFile: params.testFile,
      });
      logger.debug("session_start: Session created", { sessionId: newSession.sessionId });

      // Determine API root
      const apiRoot = params.apiRoot || process.env.TD_API_ROOT || "https://api.testdriver.ai";
      logger.debug("session_start: Using API root", { apiRoot });

      // Initialize SDK
      logger.debug("session_start: Initializing SDK");
      const TestDriverSDK = (await import("../../sdk.js")).default;
      
      // Determine preview mode from environment variable
      // TD_PREVIEW can be "ide", "browser", or "none"
      // Default to "ide" so the live preview shows within the IDE
      const previewMode = process.env.TD_PREVIEW || "ide";
      logger.debug("session_start: Preview mode", { preview: previewMode });
      
      // Get IP from params or environment (for self-hosted instances)
      const instanceIp = params.ip || process.env.TD_IP;
      
      // Get API key - check multiple sources for GitHub Copilot coding agent compatibility
      // 1. TD_API_KEY (standard environment variable)
      // 2. COPILOT_MCP_TD_API_KEY (fallback for GitHub Copilot coding agent)
      const apiKey = process.env.TD_API_KEY || process.env.COPILOT_MCP_TD_API_KEY || "";
      
      if (!apiKey) {
        logger.error("session_start: No API key found", {
          hasTD_API_KEY: !!process.env.TD_API_KEY,
          hasCOPILOT_MCP_TD_API_KEY: !!process.env.COPILOT_MCP_TD_API_KEY,
          availableEnvVars: Object.keys(process.env).filter(k => k.includes('TD') || k.includes('COPILOT_MCP'))
        });
        return createToolResult(false, "No API key found. Please set TD_API_KEY or COPILOT_MCP_TD_API_KEY environment variable.", { 
          error: "Missing API key",
          hint: "For GitHub Copilot coding agent, create a Copilot environment secret named COPILOT_MCP_TD_API_KEY"
        });
      }
      
      logger.debug("session_start: API key found", { 
        source: process.env.TD_API_KEY ? "TD_API_KEY" : "COPILOT_MCP_TD_API_KEY",
        keyPrefix: apiKey.substring(0, 7) + "..."
      });
      
      sdk = new TestDriverSDK(apiKey, {
        os: params.os,
        logging: false,
        apiRoot,
        preview: previewMode as "browser" | "ide" | "none",
        ip: instanceIp,
      });

      // Handle sandboxId mode - connect to existing sandbox (debug-on-failure mode)
      if (params.sandboxId) {
        logger.info("session_start: Connecting to existing sandbox (debug mode)", { sandboxId: params.sandboxId });
        await sdk.connect({
          sandboxId: params.sandboxId,
          keepAlive: params.keepAlive,
        });
        
        // Get sandbox ID
        const instance = sdk.getInstance();
        logger.info("session_start: Connected to existing sandbox", { instanceId: instance?.instanceId });
        sessionManager.activateSession(newSession.sessionId, instance?.instanceId || params.sandboxId);
        
        // Set Sentry context for error tracking
        setSessionContext(newSession.sessionId, instance?.instanceId);
        
        // Capture screenshot of current state
        logger.debug("session_start: Capturing screenshot of existing sandbox");
        const screenshotBase64 = await sdk.agent.system.captureScreenBase64(1, false, true);
        
        let screenshotResourceUri: string | undefined;
        if (screenshotBase64) {
          screenshotResourceUri = storeImage(screenshotBase64, "screenshot");
          lastScreenshotBase64 = screenshotBase64;
        }

        const duration = Date.now() - startTime;
        logger.info("session_start: Connected to existing sandbox", { duration, sessionId: newSession.sessionId, sandboxId: params.sandboxId });

        return createToolResult(
          true,
          `Connected to existing sandbox (debug mode)
Session: ${newSession.sessionId}
Sandbox: ${params.sandboxId}
Expires in: ${Math.round(params.keepAlive / 1000)}s

You are now connected to the sandbox in its current state. Use find, click, type, etc. to interact.`,
          { 
            action: "session_start",
            sessionId: newSession.sessionId, 
            sandboxId: params.sandboxId,
            debugMode: true,
            screenshotResourceUri,
            duration 
          },
          "// Connected to existing sandbox - no provision code needed"
        );
      }

      // Connect to sandbox
      if (instanceIp) {
        logger.info("session_start: Connecting to self-hosted instance...", { ip: instanceIp });
      } else {
        logger.info("session_start: Connecting to cloud sandbox...");
      }
      await sdk.connect({
        reconnect: params.reconnect,
        keepAlive: params.keepAlive,
        ip: instanceIp,
      });

      // Get sandbox ID
      const instance = sdk.getInstance();
      logger.info("session_start: Connected to sandbox", { instanceId: instance?.instanceId });
      sessionManager.activateSession(newSession.sessionId, instance?.instanceId || "unknown");
      
      // Set Sentry context for error tracking
      setSessionContext(newSession.sessionId, instance?.instanceId);

      // Get provision-specific options
      const provisionOptions = getProvisionOptions(params);
      let provisionCmd = "";

      // Provision based on type
      switch (params.type) {
        case "chrome": {
          const chromeOpts = provisionOptions as { url: string; maximized?: boolean; guest?: boolean };
          logger.info("session_start: Provisioning Chrome", { url: chromeOpts.url });
          await sdk.provision.chrome(chromeOpts);
          provisionCmd = "provision.chrome";
          logger.debug("session_start: Chrome provisioned");
          break;
        }
        
        case "chromeExtension": {
          const extOpts = provisionOptions as { extensionPath?: string; extensionId?: string; maximized?: boolean };
          logger.info("session_start: Provisioning Chrome Extension", { extensionPath: extOpts.extensionPath, extensionId: extOpts.extensionId });
          await sdk.provision.chromeExtension(extOpts);
          provisionCmd = "provision.chromeExtension";
          logger.debug("session_start: Chrome Extension provisioned");
          break;
        }
        
        case "vscode": {
          const vscodeOpts = provisionOptions as { workspace?: string; extensions?: string[] };
          logger.info("session_start: Provisioning VS Code", { workspace: vscodeOpts.workspace });
          await sdk.provision.vscode(vscodeOpts);
          provisionCmd = "provision.vscode";
          logger.debug("session_start: VS Code provisioned");
          break;
        }
        
        case "installer": {
          const installerOpts = provisionOptions as { url: string; filename?: string; appName?: string; launch?: boolean };
          logger.info("session_start: Provisioning installer", { url: installerOpts.url });
          await sdk.provision.installer(installerOpts);
          provisionCmd = "provision.installer";
          logger.debug("session_start: Installer provisioned");
          break;
        }
        
        case "electron": {
          const electronOpts = provisionOptions as { appPath: string; args?: string[] };
          logger.info("session_start: Provisioning Electron", { appPath: electronOpts.appPath });
          await sdk.provision.electron(electronOpts);
          provisionCmd = "provision.electron";
          logger.debug("session_start: Electron app provisioned");
          break;
        }
      }

      // Capture initial screenshot after provisioning
      logger.debug("session_start: Capturing initial screenshot");
      const screenshotBase64 = await sdk.agent.system.captureScreenBase64(1, false, true);
      
      let screenshotResourceUri: string | undefined;
      if (screenshotBase64) {
        screenshotResourceUri = storeImage(screenshotBase64, "screenshot");
        lastScreenshotBase64 = screenshotBase64;
      }

      const duration = Date.now() - startTime;
      logger.info("session_start: Completed", { duration, sessionId: newSession.sessionId, selfHosted: !!instanceIp });

      // Generate the code for this provision action
      const generatedCode = generateActionCode(provisionCmd, provisionOptions);

      // Build debugger URL for the session
      const debuggerUrl = instance?.debuggerUrl || (instanceIp ? `http://${instanceIp}:9222` : null);

      const connectionType = instanceIp ? `Self-hosted (${instanceIp})` : "Cloud";
      return createToolResult(
        true,
        `Session started: ${newSession.sessionId}\nConnection: ${connectionType}\nType: ${params.type}\nSandbox: ${instance?.instanceId}\nExpires in: ${Math.round(params.keepAlive / 1000)}s

IMPORTANT - If creating a new test project, use these EXACT dependencies in package.json:
{
  "type": "module",
  "devDependencies": {
    "testdriverai": "beta",
    "vitest": "^4.0.0"
  },
  "scripts": {
    "test": "vitest"
  }
}`,
        { 
          action: "session_start",
          sessionId: newSession.sessionId, 
          provisionType: params.type, 
          selfHosted: !!instanceIp, 
          instanceIp: instanceIp || undefined,
          debuggerUrl,
          screenshotResourceUri,
          duration 
        },
        generatedCode
      );
    } catch (error) {
      logger.error("session_start: Failed", { error: String(error) });
      captureException(error as Error, { tags: { tool: "session_start" }, extra: { params } });
      throw error;
    }
  }
);

// Session Status
server.registerTool(
  "session_status",
  {
    description: "Check the current session status and time remaining",
    inputSchema: z.object({}),
  },
  async (): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("session_status: Checking");
    const session = sessionManager.getCurrentSession();

    if (!session) {
      logger.warn("session_status: No active session");
      return createToolResult(false, "No active session", { error: "No active session. Call session_start first." });
    }

    const summary = sessionManager.getSessionSummary(session.sessionId);
    const duration = Date.now() - startTime;
    logger.info("session_status: Completed", { 
      sessionId: session.sessionId, 
      status: session.status,
      timeRemaining: summary?.timeRemaining,
      duration 
    });

    return createToolResult(
      true,
      `Session: ${session.sessionId}\nStatus: ${session.status}\nTime remaining: ${Math.round((summary?.timeRemaining || 0) / 1000)}s`,
      { action: "session_status", ...summary, sessionId: session.sessionId, status: session.status, duration }
    );
  }
);

// Session Extend
server.registerTool(
  "session_extend",
  {
    description: "Extend the session keepAlive time",
    inputSchema: z.object({
      additionalMs: z.number().default(60000).describe("Additional time in ms"),
    }),
  },
  async (params) => {
    logger.info("session_extend: Extending", { additionalMs: params.additionalMs });
    const session = sessionManager.getCurrentSession();

    if (!session) {
      logger.warn("session_extend: No active session");
      return { content: [{ type: "text" as const, text: "No active session" }] };
    }

    sessionManager.extendSession(session.sessionId, params.additionalMs);
    const newExpiry = sessionManager.getTimeRemaining(session.sessionId);
    logger.info("session_extend: Extended", { sessionId: session.sessionId, newExpiry });

    return {
      content: [
        {
          type: "text" as const,
          text: `Session extended by ${params.additionalMs / 1000}s. New expiry: ${Math.round(newExpiry / 1000)}s`,
        },
      ],
    };
  }
);

// Find Element
registerAppTool(
  server,
  "find",
  {
    title: "Find Element",
    description: "Find an element on screen by natural language description",
    inputSchema: z.object({
      description: z.string().describe("Natural language description of the element"),
      timeout: z.number().optional().describe("Timeout in ms for polling"),
    }) as any,
    _meta: { ui: { resourceUri: RESOURCE_URI, expanded: true } },
  },
  async (params: { description: string; timeout?: number }): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("find: Starting", { description: params.description, timeout: params.timeout });

    const sessionCheck = requireActiveSession();
    if (!sessionCheck.valid) {
      logger.warn("find: No active session");
      return sessionCheck.error;
    }

    try {
      logger.debug("find: Calling SDK find");
      const element = await sdk.find(params.description, params.timeout ? { timeout: params.timeout } : undefined);
      const found = element.found();
      const coords = element.getCoordinates();

      // Store element ref for later use (stores actual Element instance)
      const elementRef = `el-${Date.now()}`;
      if (found && coords) {
        elementRefs.set(elementRef, {
          element: element,  // Store the actual Element instance
          description: params.description,
          coords: {
            x: coords.x,
            y: coords.y,
            centerX: coords.centerX,
            centerY: coords.centerY,
          },
        });
        logger.info("find: Element found", { 
          description: params.description, 
          coords: { x: coords.centerX, y: coords.centerY },
          confidence: element.confidence,
          elementRef 
        });
      } else {
        logger.warn("find: Element not found", { description: params.description });
      }

      // Return raw SDK response directly
      const rawResponse = element._response || {};
      const duration = Date.now() - startTime;
      
      // Store cropped image for resource serving (instead of inline data URL)
      let croppedImageResourceUri: string | undefined;
      let screenshotResourceUri: string | undefined;
      const croppedImage = rawResponse.croppedImage;
      if (croppedImage) {
        const imageData = croppedImage.startsWith('data:') 
          ? croppedImage.replace(/^data:image\/\w+;base64,/, '')
          : croppedImage;
        croppedImageResourceUri = storeImage(imageData, "cropped");
        // Remove croppedImage from response to avoid context bloat
        delete rawResponse.croppedImage;
      } else if (!found) {
        // Element not found and no cropped image - capture a fresh screenshot
        // so the user can see what's currently visible on screen
        try {
          const screenshotBase64 = await sdk.agent.system.captureScreenBase64(1, false, true);
          if (screenshotBase64) {
            screenshotResourceUri = storeImage(screenshotBase64, "screenshot");
            logger.debug("find: Captured screenshot for not-found state");
          }
        } catch (e) {
          logger.warn("find: Failed to capture screenshot for not-found state", { error: String(e) });
        }
      }
      
      // Remove extractedText and pixelDiffImage from response to reduce context bloat
      delete rawResponse.extractedText;
      delete rawResponse.pixelDiffImage;

      // Generate code for this find action
      const generatedCode = found ? generateActionCode("find", { description: params.description }) : undefined;

      // Build element info for display (cropped image is always centered on element)
      const elementInfo = found ? {
        description: params.description,
        centerX: coords?.centerX,
        centerY: coords?.centerY,
        confidence: element.confidence,
        ref: elementRef,
      } : undefined;

      return createToolResult(
        found,
        found
          ? `Found: "${params.description}" at (${rawResponse.coordinates?.x}, ${rawResponse.coordinates?.y})\nRef: ${elementRef}`
          : `Element not found: "${params.description}"`,
        {
          ...rawResponse,
          action: "find",
          element: elementInfo,
          ref: elementRef,
          croppedImageResourceUri,
          screenshotResourceUri,
          duration,
        },
        generatedCode
      );
    } catch (error) {
      logger.error("find: Failed", { error: String(error), description: params.description });
      captureException(error as Error, { tags: { tool: "find" }, extra: { description: params.description } });
      throw error;
    }
  }
);

// Find All Elements
registerAppTool(
  server,
  "findall",
  {
    title: "Find All Elements",
    description: "Find all elements on screen matching a natural language description. Returns an array of element references.",
    inputSchema: z.object({
      description: z.string().describe("Natural language description of the elements to find"),
      timeout: z.number().optional().describe("Timeout in ms for polling"),
    }) as any,
    _meta: { ui: { resourceUri: RESOURCE_URI, expanded: true } },
  },
  async (params: { description: string; timeout?: number }): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("findall: Starting", { description: params.description, timeout: params.timeout });

    const sessionCheck = requireActiveSession();
    if (!sessionCheck.valid) {
      logger.warn("findall: No active session");
      return sessionCheck.error;
    }

    try {
      logger.debug("findall: Calling SDK findAll");
      const elements = await sdk.findAll(params.description, params.timeout ? { timeout: params.timeout } : undefined);
      const count = elements.length;

      // Store element refs for later use
      const refs: string[] = [];
      const elementInfos: Array<{ ref: string; x: number; y: number; centerX: number; centerY: number; confidence: number }> = [];
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const coords = element.getCoordinates();
        const elementRef = `el-${Date.now()}-${i}`;
        
        if (coords) {
          elementRefs.set(elementRef, {
            element: element,
            description: `${params.description} [${i}]`,
            coords: {
              x: coords.x,
              y: coords.y,
              centerX: coords.centerX,
              centerY: coords.centerY,
            },
          });
          refs.push(elementRef);
          elementInfos.push({
            ref: elementRef,
            x: coords.x,
            y: coords.y,
            centerX: coords.centerX,
            centerY: coords.centerY,
            confidence: element.confidence,
          });
        }
      }

      logger.info("findall: Elements found", { 
        description: params.description, 
        count,
        refs 
      });

      // Get the first element's response for the image (shows all highlights)
      const rawResponse = elements[0]?._response || {};
      const duration = Date.now() - startTime;
      
      // Store cropped image for resource serving (instead of inline data URL)
      let croppedImageResourceUri: string | undefined;
      let screenshotResourceUri: string | undefined;
      const croppedImage = rawResponse.croppedImage;
      if (croppedImage) {
        const imageData = croppedImage.startsWith('data:') 
          ? croppedImage.replace(/^data:image\/\w+;base64,/, '')
          : croppedImage;
        croppedImageResourceUri = storeImage(imageData, "cropped");
        // Remove croppedImage from response to avoid context bloat
        delete rawResponse.croppedImage;
      } else if (count === 0) {
        // No elements found and no cropped image - capture a fresh screenshot
        // so the user can see what's currently visible on screen
        try {
          const screenshotBase64 = await sdk.agent.system.captureScreenBase64(1, false, true);
          if (screenshotBase64) {
            screenshotResourceUri = storeImage(screenshotBase64, "screenshot");
            logger.debug("findall: Captured screenshot for not-found state");
          }
        } catch (e) {
          logger.warn("findall: Failed to capture screenshot for not-found state", { error: String(e) });
        }
      }
      
      // Remove extractedText and pixelDiffImage from response to reduce context bloat
      delete rawResponse.extractedText;
      delete rawResponse.pixelDiffImage;

      // Generate code for this findall action
      const generatedCode = count > 0 ? generateActionCode("findall", { description: params.description }) : undefined;

      // Build refs list for text output
      const refsList = refs.map((ref, i) => `  [${i}] ${ref}`).join('\n');

      return createToolResult(
        count > 0,
        count > 0
          ? `Found ${count} elements matching "${params.description}":\n${refsList}`
          : `No elements found matching: "${params.description}"`,
        {
          ...rawResponse,
          count,
          refs,
          elements: elementInfos,
          croppedImageResourceUri,
          screenshotResourceUri,
          duration,
        },
        generatedCode
      );
    } catch (error) {
      logger.error("findall: Failed", { error: String(error), description: params.description });
      captureException(error as Error, { tags: { tool: "findall" }, extra: { description: params.description } });
      throw error;
    }
  }
);

// Click
registerAppTool(
  server,
  "click",
  {
    title: "Click Element",
    description: "Click on a previously found element. Use 'find' first to locate the element.",
    inputSchema: z.object({
      elementRef: z.string().describe("Reference to previously found element (required). Get this from a 'find' call."),
      action: z.enum(["click", "double-click", "right-click"]).default("click"),
    }) as any,
    _meta: { ui: { resourceUri: RESOURCE_URI, expanded: true } },
  },
  async (params: { elementRef: string; action: "click" | "double-click" | "right-click" }): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("click: Starting", { elementRef: params.elementRef, action: params.action });

    const sessionCheck = requireActiveSession();
    if (!sessionCheck.valid) {
      logger.warn("click: No active session");
      return sessionCheck.error;
    }

    // Look up the element reference
    const ref = elementRefs.get(params.elementRef);
    if (!ref) {
      logger.warn("click: Element reference not found", { elementRef: params.elementRef });
      return createToolResult(false, `Element reference "${params.elementRef}" not found. Use 'find' first to locate the element.`, { error: "Element reference not found" });
    }

    const { element, description, coords } = ref;

    try {
      logger.debug("click: Executing click on element", { description, action: params.action });
      
      // Use the Element's click method instead of raw coordinates
      if (params.action === "click") {
        await element.click();
      } else if (params.action === "double-click") {
        await element.doubleClick();
      } else if (params.action === "right-click") {
        await element.rightClick();
      }

      // Capture screenshot after click to show result
      logger.debug("click: Capturing screenshot after click");
      const screenshotBase64 = await sdk.agent.system.captureScreenBase64(1, false, true);
      
      let screenshotResourceUri: string | undefined;
      if (screenshotBase64) {
        screenshotResourceUri = storeImage(screenshotBase64, "screenshot");
        lastScreenshotBase64 = screenshotBase64;
      }

      const rawResponse = element._response || {};
      // Remove large data from response to reduce context bloat
      delete rawResponse.croppedImage;
      delete rawResponse.extractedText;
      delete rawResponse.pixelDiffImage;
      
      const duration = Date.now() - startTime;
      logger.info("click: Completed", { description, duration });

      // Generate code for this click action
      const generatedCode = generateActionCode("click", { action: params.action });

      return createToolResult(
        true,
        `Clicked on "${description}"`,
        { 
          ...rawResponse, 
          action: "click", 
          clickAction: params.action, 
          clickPosition: coords, 
          screenshotResourceUri,
          duration 
        },
        generatedCode
      );
    } catch (error) {
      logger.error("click: Failed", { error: String(error), description });
      captureException(error as Error, { tags: { tool: "click" }, extra: { elementRef: params.elementRef, action: params.action } });
      throw error;
    }
  }
);

// Hover
registerAppTool(
  server,
  "hover",
  {
    title: "Hover Element",
    description: "Hover over a previously found element. Use 'find' first to locate the element.",
    inputSchema: z.object({
      elementRef: z.string().describe("Reference to previously found element (required). Get this from a 'find' call."),
    }) as any,
    _meta: { ui: { resourceUri: RESOURCE_URI, expanded: true } },
  },
  async (params: { elementRef: string }): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("hover: Starting", { elementRef: params.elementRef });

    const sessionCheck = requireActiveSession();
    if (!sessionCheck.valid) {
      logger.warn("hover: No active session");
      return sessionCheck.error;
    }

    // Look up the element reference
    const ref = elementRefs.get(params.elementRef);
    if (!ref) {
      logger.warn("hover: Element reference not found", { elementRef: params.elementRef });
      return createToolResult(false, `Element reference "${params.elementRef}" not found. Use 'find' first to locate the element.`, { error: "Element reference not found" });
    }

    const { element, description, coords } = ref;

    try {
      logger.debug("hover: Executing hover on element", { description });
      await element.hover();

      // Capture screenshot after hover to show result
      logger.debug("hover: Capturing screenshot after hover");
      const screenshotBase64 = await sdk.agent.system.captureScreenBase64(1, false, true);
      
      let screenshotResourceUri: string | undefined;
      if (screenshotBase64) {
        screenshotResourceUri = storeImage(screenshotBase64, "screenshot");
        lastScreenshotBase64 = screenshotBase64;
      }

      const rawResponse = element._response || {};
      // Remove large data from response to reduce context bloat
      delete rawResponse.croppedImage;
      delete rawResponse.extractedText;
      delete rawResponse.pixelDiffImage;
      
      const duration = Date.now() - startTime;
      logger.info("hover: Completed", { description, duration });

      // Generate code for this hover action
      const generatedCode = generateActionCode("hover", {});

      return createToolResult(
        true,
        `Hovered over "${description}"`,
        { 
          ...rawResponse, 
          action: "hover", 
          screenshotResourceUri,
          duration 
        },
        generatedCode
      );
    } catch (error) {
      logger.error("hover: Failed", { error: String(error), description });
      captureException(error as Error, { tags: { tool: "hover" }, extra: { elementRef: params.elementRef } });
      throw error;
    }
  }
);

// Wait
server.registerTool(
  "wait",
  {
    description: "Wait for a specified amount of time",
    inputSchema: z.object({
      timeout: z.number().default(3000).describe("Time to wait in milliseconds (default: 3000)"),
    }),
  },
  async (params): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("wait: Starting", { timeout: params.timeout });

    const sessionCheck = requireActiveSession();
    if (!sessionCheck.valid) {
      logger.warn("wait: No active session");
      return sessionCheck.error;
    }

    try {
      logger.debug("wait: Waiting", { timeout: params.timeout });
      await sdk.wait(params.timeout);

      const duration = Date.now() - startTime;
      logger.info("wait: Completed", { timeout: params.timeout, duration });

      // Generate code for this wait action
      const generatedCode = generateActionCode("wait", { timeout: params.timeout });

      return createToolResult(
        true,
        `Waited for ${params.timeout}ms`,
        { action: "wait", timeout: params.timeout, duration },
        generatedCode
      );
    } catch (error) {
      logger.error("wait: Failed", { error: String(error) });
      captureException(error as Error, { tags: { tool: "wait" }, extra: { timeout: params.timeout } });
      throw error;
    }
  }
);

// Focus Application
server.registerTool(
  "focus_application",
  {
    description: "Bring an application window to the foreground",
    inputSchema: z.object({
      name: z.string().describe("Name of the application to focus (e.g., 'Google Chrome', 'Visual Studio Code')"),
    }),
  },
  async (params): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("focus_application: Starting", { name: params.name });

    const sessionCheck = requireActiveSession();
    if (!sessionCheck.valid) {
      logger.warn("focus_application: No active session");
      return sessionCheck.error;
    }

    try {
      logger.debug("focus_application: Focusing", { name: params.name });
      await sdk.focusApplication(params.name);

      const duration = Date.now() - startTime;
      logger.info("focus_application: Completed", { name: params.name, duration });

      // Generate code for this focus action
      const generatedCode = generateActionCode("focus_application", { name: params.name });

      return createToolResult(
        true,
        `Focused application: "${params.name}"`,
        { action: "focus", name: params.name, duration },
        generatedCode
      );
    } catch (error) {
      logger.error("focus_application: Failed", { error: String(error), name: params.name });
      captureException(error as Error, { tags: { tool: "focus_application" }, extra: { name: params.name } });
      throw error;
    }
  }
);

// Find and Click
registerAppTool(
  server,
  "find_and_click",
  {
    title: "Find and Click",
    description: "Find an element and click it in one action",
    inputSchema: z.object({
      description: z.string().describe("Natural language description of element"),
      action: z.enum(["click", "double-click", "right-click"]).default("click"),
    }) as any,
    _meta: { ui: { resourceUri: RESOURCE_URI, expanded: true } },
  },
  async (params: { description: string; action: "click" | "double-click" | "right-click" }): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("find_and_click: Starting", { description: params.description, action: params.action });

    const sessionCheck = requireActiveSession();
    if (!sessionCheck.valid) {
      logger.warn("find_and_click: No active session");
      return sessionCheck.error;
    }

    try {
      logger.debug("find_and_click: Finding element");
      const element = await sdk.find(params.description);
      const found = element.found();

      if (!found) {
        logger.warn("find_and_click: Element not found", { description: params.description });
        
        // Capture screenshot to show current state even when element not found
        const rawResponse = element._response || {};
        const duration = Date.now() - startTime;
        
        // Store cropped image (screenshot) for resource serving
        let croppedImageResourceUri: string | undefined;
        let screenshotResourceUri: string | undefined;
        const croppedImage = rawResponse.croppedImage;
        if (croppedImage) {
          const imageData = croppedImage.startsWith('data:') 
            ? croppedImage.replace(/^data:image\/\w+;base64,/, '')
            : croppedImage;
          croppedImageResourceUri = storeImage(imageData, "screenshot");
          delete rawResponse.croppedImage;
        } else {
          // No cropped image - capture a fresh screenshot so the user can see
          // what's currently visible on screen when element was not found
          try {
            const screenshotBase64 = await sdk.agent.system.captureScreenBase64(1, false, true);
            if (screenshotBase64) {
              screenshotResourceUri = storeImage(screenshotBase64, "screenshot");
              logger.debug("find_and_click: Captured screenshot for not-found state");
            }
          } catch (e) {
            logger.warn("find_and_click: Failed to capture screenshot for not-found state", { error: String(e) });
          }
        }
        
        // Remove extractedText and pixelDiffImage from response to reduce context bloat
        delete rawResponse.extractedText;
        delete rawResponse.pixelDiffImage;
        
        return createToolResult(
          false, 
          `Element not found: "${params.description}"`, 
          { 
            ...rawResponse,
            action: "find_and_click",
            error: "Element not found", 
            croppedImageResourceUri,
            screenshotResourceUri,
            duration 
          }
        );
      }

      const coords = element.getCoordinates();

      // Store element ref for later use (in case user wants to interact again)
      const elementRef = `el-${Date.now()}`;
      if (coords) {
        elementRefs.set(elementRef, {
          element: element,
          description: params.description,
          coords: {
            x: coords.x,
            y: coords.y,
            centerX: coords.centerX,
            centerY: coords.centerY,
          },
        });
      }

      logger.debug("find_and_click: Element found, clicking", { action: params.action, elementRef });
      if (params.action === "click") {
        await element.click();
      } else if (params.action === "double-click") {
        await element.doubleClick();
      } else if (params.action === "right-click") {
        await element.rightClick();
      }

      // Return raw SDK response directly
      const rawResponse = element._response || {};
      const duration = Date.now() - startTime;
      
      // Store cropped image for resource serving (instead of inline data URL)
      let croppedImageResourceUri: string | undefined;
      const croppedImage = rawResponse.croppedImage;
      if (croppedImage) {
        const imageData = croppedImage.startsWith('data:') 
          ? croppedImage.replace(/^data:image\/\w+;base64,/, '')
          : croppedImage;
        croppedImageResourceUri = storeImage(imageData, "cropped");
        // Remove croppedImage from response to avoid context bloat
        delete rawResponse.croppedImage;
      }
      
      // Remove extractedText and pixelDiffImage from response to reduce context bloat
      delete rawResponse.extractedText;
      delete rawResponse.pixelDiffImage;

      // Generate code for this find_and_click action
      const generatedCode = generateActionCode("find_and_click", { description: params.description, action: params.action });

      // Build element info for display (match find action format)
      const elementInfo = coords ? {
        description: params.description,
        centerX: coords.centerX,
        centerY: coords.centerY,
        confidence: element.confidence,
        ref: elementRef,
      } : undefined;

      return createToolResult(
        true,
        `Found and clicked: "${params.description}" at (${rawResponse.coordinates?.x}, ${rawResponse.coordinates?.y})\nRef: ${elementRef}`,
        {
          ...rawResponse,
          action: "find_and_click",
          element: elementInfo,
          ref: elementRef,
          clickAction: params.action,
          clickPosition: coords ? { x: coords.centerX, y: coords.centerY } : undefined,
          croppedImageResourceUri,
          duration,
        },
        generatedCode
      );
    } catch (error) {
      logger.error("find_and_click: Failed", { error: String(error), description: params.description });
      captureException(error as Error, { tags: { tool: "find_and_click" }, extra: { description: params.description, action: params.action } });
      throw error;
    }
  }
);

// Type
server.registerTool(
  "type",
  {
    description: "Type text into the currently focused field",
    inputSchema: z.object({
      text: z.string().describe("Text to type"),
      secret: z.boolean().default(false).describe("Whether this is sensitive data"),
      delay: z.number().optional().describe("Delay between keystrokes in ms"),
    }),
  },
  async (params): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("type: Starting", { textLength: params.text.length, secret: params.secret });

    const sessionCheck = requireActiveSession();
    if (!sessionCheck.valid) {
      logger.warn("type: No active session");
      return sessionCheck.error;
    }

    try {
      logger.debug("type: Typing text");
      await sdk.type(params.text, { secret: params.secret, delay: params.delay });

      const duration = Date.now() - startTime;
      logger.info("type: Completed", { duration });

      // Generate code for this type action
      const generatedCode = generateActionCode("type", { text: params.text, secret: params.secret });

      return createToolResult(
        true,
        `Typed: ${params.secret ? "[secret text]" : `"${params.text}"`}`,
        { action: "type", text: params.secret ? "[SECRET]" : params.text, duration },
        generatedCode
      );
    } catch (error) {
      logger.error("type: Failed", { error: String(error) });
      captureException(error as Error, { tags: { tool: "type" }, extra: { textLength: params.text.length, secret: params.secret } });
      throw error;
    }
  }
);

// Press Keys
server.registerTool(
  "press_keys",
  {
    description: "Press keyboard keys or shortcuts",
    inputSchema: z.object({
      keys: z.array(z.string()).describe("Array of keys to press (e.g., ['ctrl', 'a'])"),
    }),
  },
  async (params): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("press_keys: Starting", { keys: params.keys });

    const sessionCheck = requireActiveSession();
    if (!sessionCheck.valid) {
      logger.warn("press_keys: No active session");
      return sessionCheck.error;
    }

    try {
      logger.debug("press_keys: Pressing keys");
      await sdk.pressKeys(params.keys);

      const duration = Date.now() - startTime;
      logger.info("press_keys: Completed", { keys: params.keys, duration });

      // Generate code for this press_keys action
      const generatedCode = generateActionCode("press_keys", { keys: params.keys });

      return createToolResult(
        true,
        `Pressed keys: ${params.keys.join(" + ")}`,
        { action: "press_keys", keys: params.keys, duration },
        generatedCode
      );
    } catch (error) {
      logger.error("press_keys: Failed", { error: String(error), keys: params.keys });
      captureException(error as Error, { tags: { tool: "press_keys" }, extra: { keys: params.keys } });
      throw error;
    }
  }
);

// Scroll
server.registerTool(
  "scroll",
  {
    description: "Scroll the page or element",
    inputSchema: z.object({
      direction: z.enum(["up", "down", "left", "right"]).default("down"),
      amount: z.number().optional().describe("Amount to scroll in pixels"),
    }),
  },
  async (params): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("scroll: Starting", { direction: params.direction, amount: params.amount });

    const sessionCheck = requireActiveSession();
    if (!sessionCheck.valid) {
      logger.warn("scroll: No active session");
      return sessionCheck.error;
    }

    try {
      logger.debug("scroll: Scrolling");
      await sdk.scroll(params.direction, params.amount ? { amount: params.amount } : undefined);

      const duration = Date.now() - startTime;
      logger.info("scroll: Completed", { direction: params.direction, duration });

      // Generate code for this scroll action
      const generatedCode = generateActionCode("scroll", { direction: params.direction, amount: params.amount });

      return createToolResult(
        true,
        `Scrolled ${params.direction}${params.amount ? ` by ${params.amount}px` : ""}`,
        { action: "scroll", scrollDirection: params.direction, direction: params.direction, amount: params.amount, duration },
        generatedCode
      );
    } catch (error) {
      logger.error("scroll: Failed", { error: String(error), direction: params.direction });
      captureException(error as Error, { tags: { tool: "scroll" }, extra: { direction: params.direction, amount: params.amount } });
      throw error;
    }
  }
);

// Assert - generates code for test files
server.registerTool(
  "assert",
  {
    description: `Make an AI-powered assertion about the current screen state. GENERATES CODE for the test file.

Use this when you want a verification step recorded in the generated test. This will add code like:
  const assertResult = await testdriver.assert("your assertion");
  expect(assertResult).toBeTruthy();

Unlike 'check' which is for your understanding during development, 'assert' creates verification code that runs in CI/CD.`,
    inputSchema: z.object({
      assertion: z.string().describe("Natural language assertion to verify"),
    }),
  },
  async (params): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("assert: Starting", { assertion: params.assertion });

    const sessionCheck = requireActiveSession();
    if (!sessionCheck.valid) {
      logger.warn("assert: No active session");
      return sessionCheck.error;
    }

    try {
      logger.debug("assert: Running assertion");
      const result = await sdk.assert(params.assertion);

      const duration = Date.now() - startTime;
      logger.info("assert: Completed", { assertion: params.assertion, passed: result, duration });

      // Generate code for this assert action
      const generatedCode = generateActionCode("assert", { assertion: params.assertion });

      return createToolResult(
        result,
        result ? `✓ Assertion passed: "${params.assertion}"` : `✗ Assertion failed: "${params.assertion}"`,
        { action: "assert", assertion: params.assertion, passed: result, success: result, duration },
        generatedCode
      );
    } catch (error) {
      logger.error("assert: Failed", { error: String(error), assertion: params.assertion });
      captureException(error as Error, { tags: { tool: "assert" }, extra: { assertion: params.assertion } });
      throw error;
    }
  }
);

// Check - AI uses this to understand the screen state (DOES NOT generate code)
registerAppTool(
  server,
  "check",
  {
    title: "Check Screen State",
    description: `👁️ THIS IS HOW YOU SEE THE SCREEN. Use this tool whenever you need to understand what's currently displayed.

This tool captures a screenshot and returns AI analysis to YOU. Use it to:
- See what's on the screen right now
- Verify if your last action worked
- Understand the current application state
- Check if elements are visible or if navigation completed

Examples:
- "What is currently on the screen?"
- "Did the button click work?"
- "Is the login form visible?"
- "Did the page navigate to the dashboard?"

⚠️ Do NOT use 'screenshot' to see the screen - that only shows the user, not you.

Note: This tool does NOT generate test code. Use 'assert' when you want to add a verification step to the test file.

You can optionally provide a reference image URI to compare against a previous state.`,
    inputSchema: z.object({
      task: z.string().describe("The task or condition to verify (e.g., 'Did the login succeed?', 'Is the modal visible?')"),
      referenceImageUri: z.string().optional().describe("Optional screenshot resource URI (e.g., 'screenshot://testdriver/screenshot/screenshot-1') to compare against instead of the automatically captured 'before' screenshot. Use a screenshotResourceUri from a previous action."),
    }) as any,
    _meta: { ui: { resourceUri: RESOURCE_URI, expanded: true } },
  },
  async (params: { task: string; referenceImageUri?: string }): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("check: Starting", { task: params.task, hasReferenceImageUri: !!params.referenceImageUri });

    const sessionCheck = requireActiveSession();
    if (!sessionCheck.valid) {
      logger.warn("check: No active session");
      return sessionCheck.error;
    }

    try {
      // Capture current screenshot
      logger.debug("check: Capturing current screenshot");
      const currentScreenshot = await sdk.agent.system.captureScreenBase64(1, false, true);
      
      // Use provided reference image URI, last screenshot as "before" state, or current if no previous screenshot
      let beforeScreenshot: string;
      if (params.referenceImageUri) {
        // Extract image ID from URI (e.g., "screenshot://testdriver/screenshot/screenshot-1" -> "screenshot-1")
        const uriParts = params.referenceImageUri.split('/');
        const imageId = uriParts[uriParts.length - 1];
        
        logger.info("check: Looking up reference image", { 
          referenceImageUri: params.referenceImageUri, 
          extractedImageId: imageId,
          imageStoreSize: imageStore.size,
          availableKeys: Array.from(imageStore.keys())
        });
        
        const storedImage = getStoredImage(imageId);
        
        if (storedImage) {
          logger.info("check: Found reference image", { 
            imageId, 
            dataLength: storedImage.data?.length,
            type: storedImage.type,
            hasData: !!storedImage.data
          });
          beforeScreenshot = storedImage.data;
        } else {
          logger.warn("check: Reference image NOT found in store, falling back to last screenshot", { 
            referenceImageUri: params.referenceImageUri, 
            imageId,
            imageStoreSize: imageStore.size,
            availableKeys: Array.from(imageStore.keys())
          });
          beforeScreenshot = lastScreenshotBase64 || currentScreenshot;
        }
      } else {
        beforeScreenshot = lastScreenshotBase64 || currentScreenshot;
      }
      
      // Update last screenshot for next check
      lastScreenshotBase64 = currentScreenshot;
      
      // Get system state
      const mousePosition = await sdk.agent.system.getMousePosition();
      const activeWindow = await sdk.agent.system.activeWin();
      
      // Call the check endpoint
      logger.info("check: Calling check API endpoint", { 
        hasLastScreenshot: beforeScreenshot !== currentScreenshot,
        usingReferenceImageUri: !!params.referenceImageUri,
        beforeScreenshotLength: beforeScreenshot?.length || 0,
        currentScreenshotLength: currentScreenshot?.length || 0,
        beforeScreenshotPreview: beforeScreenshot?.substring(0, 50),
        currentScreenshotPreview: currentScreenshot?.substring(0, 50)
      });
      const response = await sdk.agent.sdk.req("check", {
        tasks: [params.task],
        images: [beforeScreenshot, currentScreenshot],
        mousePosition,
        activeWindow,
      });

      const aiResponse = response.data;
      
      // Store screenshot for resource serving
      let screenshotResourceUri: string | undefined;
      if (currentScreenshot) {
        screenshotResourceUri = storeImage(currentScreenshot, "screenshot");
      }
      
      // Determine if the check passed based on the AI response
      // The AI typically returns markdown with its analysis
      // We consider it "complete" if the response doesn't contain code blocks (indicating more work needed)
      const hasCodeBlocks = aiResponse && (
        aiResponse.includes("```yml") || 
        aiResponse.includes("```yaml") ||
        aiResponse.includes("- command:")
      );
      const isComplete = !hasCodeBlocks;

      const duration = Date.now() - startTime;
      logger.info("check: Completed", { task: params.task, complete: isComplete, duration });

      // Note: check doesn't generate code - it's for AI understanding, not test recording
      return createToolResult(
        isComplete,
        isComplete 
          ? `✓ Task appears complete: "${params.task}"\n\nAI Analysis:\n${aiResponse}`
          : `⚠ Task may not be complete: "${params.task}"\n\nAI Analysis:\n${aiResponse}`,
        { 
          action: "check", 
          task: params.task, 
          complete: isComplete, 
          success: isComplete, 
          aiResponse, 
          screenshotResourceUri,
          duration 
        }
      );
    } catch (error) {
      logger.error("check: Failed", { error: String(error), task: params.task });
      captureException(error as Error, { tags: { tool: "check" }, extra: { task: params.task } });
      throw error;
    }
  }
);

// Exec
server.registerTool(
  "exec",
  {
    description: "Execute shell or PowerShell commands in the sandbox",
    inputSchema: z.object({
      language: z.enum(["sh", "pwsh"]).default("sh"),
      code: z.string().describe("Code to execute"),
      timeout: z.number().default(30000).describe("Timeout in ms"),
    }),
  },
  async (params): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("exec: Starting", { language: params.language, codeLength: params.code.length, timeout: params.timeout });

    const sessionCheck = requireActiveSession();
    if (!sessionCheck.valid) {
      logger.warn("exec: No active session");
      return sessionCheck.error;
    }

    try {
      logger.debug("exec: Executing code", { language: params.language });
      const output = await sdk.exec(params.language, params.code, params.timeout);

      const duration = Date.now() - startTime;
      logger.info("exec: Completed", { language: params.language, outputLength: output?.length || 0, duration });

      // Generate code for this exec action
      const generatedCode = generateActionCode("exec", { language: params.language, code: params.code, timeout: params.timeout });

      return createToolResult(
        true,
        `Executed ${params.language} code:\n${output || "(no output)"}`,
        { action: "exec", language: params.language, output, duration },
        generatedCode
      );
    } catch (error) {
      logger.error("exec: Failed", { error: String(error), language: params.language });
      captureException(error as Error, { tags: { tool: "exec" }, extra: { language: params.language, codeLength: params.code.length } });
      throw error;
    }
  }
);

// Parse auto-screenshot filename format: <seq>-<action>-<phase>-L<line>-<description>.png
// Example: 001-click-before-L42-submit-button.png
// Example: 003-click-error-L42-submit-button.png (error phase when action fails)
interface ParsedScreenshotInfo {
  sequence?: number;
  action?: string;
  phase?: "before" | "after" | "error";
  lineNumber?: number;
  description?: string;
}

function parseScreenshotFilename(filename: string): ParsedScreenshotInfo {
  // Match pattern: 001-click-before-L42-submit-button.png or 001-click-error-L42-submit-button.png
  const match = filename.match(/^(\d+)-([a-z]+)-(before|after|error)-L(\d+)-(.+)\.png$/i);
  if (match) {
    return {
      sequence: parseInt(match[1], 10),
      action: match[2].toLowerCase(),
      phase: match[3].toLowerCase() as "before" | "after" | "error",
      lineNumber: parseInt(match[4], 10),
      description: match[5],
    };
  }
  return {};
}

// List Local Screenshots - lists screenshots saved to .testdriver directory
server.registerTool(
  "list_local_screenshots",
  {
    description: `List and filter screenshots saved in the .testdriver directory.

Screenshots from auto-screenshot feature use the format: <seq>-<action>-<phase>-L<line>-<description>.png
Example: 001-click-before-L42-submit-button.png

This tool supports powerful filtering to find specific screenshots:
- By test file (directory)
- By line number or range
- By action type (click, find, type, assert, etc.)
- By phase (before/after/error - error screenshots are captured when actions fail)
- By regex pattern on filename
- By sequence number range

Returns a list of screenshot paths that can be viewed with the 'view_local_screenshot' tool.`,
    inputSchema: z.object({
      directory: z.string().optional().describe("Test file or subdirectory to search (e.g., 'login.test', 'mcp-screenshots'). If not provided, searches all."),
      line: z.number().optional().describe("Filter by exact line number from test file (e.g., 42 matches L42)"),
      lineRange: z.object({
        start: z.number().describe("Start line number (inclusive)"),
        end: z.number().describe("End line number (inclusive)"),
      }).optional().describe("Filter by line number range (e.g., { start: 10, end: 20 })"),
      action: z.string().optional().describe("Filter by action type: click, find, type, assert, provision, scroll, hover, etc."),
      phase: z.enum(["before", "after", "error"]).optional().describe("Filter by phase: 'before' (pre-action), 'after' (post-action), or 'error' (when action fails)"),
      pattern: z.string().optional().describe("Regex pattern to match against filename (e.g., 'submit|login' or 'button.*click')"),
      sequence: z.number().optional().describe("Filter by exact sequence number"),
      sequenceRange: z.object({
        start: z.number().describe("Start sequence (inclusive)"),
        end: z.number().describe("End sequence (inclusive)"),
      }).optional().describe("Filter by sequence range (e.g., { start: 1, end: 10 })"),
      limit: z.number().optional().describe("Maximum number of results to return (default: 50)"),
      sortBy: z.enum(["modified", "sequence", "line"]).optional().describe("Sort by: 'modified' (newest first), 'sequence' (execution order), or 'line' (line number). Default: 'modified'"),
    }),
  },
  async (params): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("list_local_screenshots: Starting", { ...params });

    try {
      // Find .testdriver directory - check current working directory and common locations
      const possiblePaths = [
        path.join(process.cwd(), ".testdriver"),
        path.join(os.homedir(), ".testdriver"),
      ];
      
      let testdriverDir: string | null = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          testdriverDir = p;
          break;
        }
      }
      
      if (!testdriverDir) {
        logger.warn("list_local_screenshots: .testdriver directory not found");
        return createToolResult(false, "No .testdriver directory found. Screenshots are saved here during test runs.", { error: "Directory not found" });
      }
      
      interface ScreenshotInfo {
        path: string;
        name: string;
        modified: Date;
        size: number;
        parsed: ParsedScreenshotInfo;
      }
      
      const screenshots: ScreenshotInfo[] = [];
      
      // Compile regex pattern if provided
      let regexPattern: RegExp | null = null;
      if (params.pattern) {
        try {
          regexPattern = new RegExp(params.pattern, "i");
        } catch {
          return createToolResult(false, `Invalid regex pattern: ${params.pattern}`, { error: "Invalid regex" });
        }
      }
      
      // Function to recursively find PNG files
      const findPngFiles = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            // If a specific directory was requested, only search that one
            if (!params.directory || entry.name === params.directory || dir !== testdriverDir) {
              findPngFiles(fullPath);
            }
          } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
            const parsed = parseScreenshotFilename(entry.name);
            
            // Apply filters
            if (params.line !== undefined && parsed.lineNumber !== params.line) continue;
            if (params.lineRange && (
              parsed.lineNumber === undefined ||
              parsed.lineNumber < params.lineRange.start ||
              parsed.lineNumber > params.lineRange.end
            )) continue;
            if (params.action && parsed.action !== params.action.toLowerCase()) continue;
            if (params.phase && parsed.phase !== params.phase) continue;
            if (params.sequence !== undefined && parsed.sequence !== params.sequence) continue;
            if (params.sequenceRange && (
              parsed.sequence === undefined ||
              parsed.sequence < params.sequenceRange.start ||
              parsed.sequence > params.sequenceRange.end
            )) continue;
            if (regexPattern && !regexPattern.test(entry.name)) continue;
            
            const stats = fs.statSync(fullPath);
            screenshots.push({
              path: fullPath,
              name: entry.name,
              modified: stats.mtime,
              size: stats.size,
              parsed,
            });
          }
        }
      };
      
      findPngFiles(testdriverDir);
      
      // Sort based on sortBy parameter
      const sortBy = params.sortBy || "modified";
      if (sortBy === "modified") {
        screenshots.sort((a, b) => b.modified.getTime() - a.modified.getTime());
      } else if (sortBy === "sequence") {
        screenshots.sort((a, b) => (a.parsed.sequence ?? Infinity) - (b.parsed.sequence ?? Infinity));
      } else if (sortBy === "line") {
        screenshots.sort((a, b) => (a.parsed.lineNumber ?? Infinity) - (b.parsed.lineNumber ?? Infinity));
      }
      
      const duration = Date.now() - startTime;
      logger.info("list_local_screenshots: Completed", { count: screenshots.length, duration });
      
      if (screenshots.length === 0) {
        const filters = [];
        if (params.directory) filters.push(`directory=${params.directory}`);
        if (params.line) filters.push(`line=${params.line}`);
        if (params.lineRange) filters.push(`lineRange=${params.lineRange.start}-${params.lineRange.end}`);
        if (params.action) filters.push(`action=${params.action}`);
        if (params.phase) filters.push(`phase=${params.phase}`);
        if (params.pattern) filters.push(`pattern=${params.pattern}`);
        if (params.sequence) filters.push(`sequence=${params.sequence}`);
        if (params.sequenceRange) filters.push(`sequenceRange=${params.sequenceRange.start}-${params.sequenceRange.end}`);
        
        const filterMsg = filters.length > 0 ? ` with filters: ${filters.join(", ")}` : "";
        return createToolResult(true, `No screenshots found in .testdriver directory${filterMsg}.`, { 
          action: "list_local_screenshots",
          count: 0,
          directory: testdriverDir,
          filters: params,
          duration 
        });
      }
      
      const limit = params.limit || 50;
      const limitedScreenshots = screenshots.slice(0, limit);
      
      // Format the list for display with parsed info
      const screenshotList = limitedScreenshots.map((s, i) => {
        const relativePath = path.relative(testdriverDir!, s.path);
        const sizeKB = Math.round(s.size / 1024);
        const timeAgo = formatTimeAgo(s.modified);
        
        // Add parsed info if available
        const parts = [`${i + 1}. ${relativePath}`];
        const meta = [];
        if (s.parsed.lineNumber) meta.push(`L${s.parsed.lineNumber}`);
        if (s.parsed.action) meta.push(s.parsed.action);
        if (s.parsed.phase) meta.push(s.parsed.phase);
        meta.push(`${sizeKB}KB`);
        meta.push(timeAgo);
        parts.push(`(${meta.join(", ")})`);
        
        return parts.join(" ");
      }).join("\n");
      
      const message = screenshots.length > limit 
        ? `Found ${screenshots.length} screenshots (showing ${limit} results, sorted by ${sortBy}):\n\n${screenshotList}`
        : `Found ${screenshots.length} screenshot(s) (sorted by ${sortBy}):\n\n${screenshotList}`;
      
      return createToolResult(true, message, { 
        action: "list_local_screenshots",
        count: screenshots.length,
        returned: limitedScreenshots.length,
        directory: testdriverDir,
        filters: params,
        sortBy,
        screenshots: limitedScreenshots.map(s => ({
          path: s.path,
          relativePath: path.relative(testdriverDir!, s.path),
          name: s.name,
          modified: s.modified.toISOString(),
          sizeBytes: s.size,
          sequence: s.parsed.sequence,
          action: s.parsed.action,
          phase: s.parsed.phase,
          lineNumber: s.parsed.lineNumber,
          description: s.parsed.description,
        })),
        duration 
      });
    } catch (error) {
      logger.error("list_local_screenshots: Failed", { error: String(error) });
      captureException(error as Error, { tags: { tool: "list_local_screenshots" } });
      throw error;
    }
  }
);

// Helper to format time ago
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// View Local Screenshot - view a screenshot from .testdriver directory
// Returns the image so AI clients that support images can see it
// Also displays to the user via MCP App
registerAppTool(
  server,
  "view_local_screenshot",
  {
    title: "View Local Screenshot",
    description: `View a screenshot from the .testdriver directory.

Use 'list_local_screenshots' first to see available screenshots, then use this tool to view one.

This tool returns the image content so AI clients that support images can see it directly.
The image is also displayed to the user via the MCP App UI.

Useful for:
- Reviewing screenshots from previous test runs
- Debugging test failures by examining saved screenshots
- Comparing current screen state to saved screenshots`,
    inputSchema: z.object({
      path: z.string().describe("Full path to the screenshot file (from list_local_screenshots)"),
    }) as any,
    _meta: { ui: { resourceUri: RESOURCE_URI, expanded: true } },
  },
  async (params: { path: string }): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("view_local_screenshot: Starting", { path: params.path });

    try {
      // Validate the path exists and is a PNG
      if (!fs.existsSync(params.path)) {
        logger.warn("view_local_screenshot: File not found", { path: params.path });
        return createToolResult(false, `Screenshot not found: ${params.path}`, { error: "File not found" });
      }
      
      if (!params.path.toLowerCase().endsWith(".png")) {
        logger.warn("view_local_screenshot: Not a PNG file", { path: params.path });
        return createToolResult(false, "Only PNG files are supported", { error: "Invalid file type" });
      }
      
      // Security check - only allow files from .testdriver directory
      const normalizedPath = path.resolve(params.path);
      if (!normalizedPath.includes(".testdriver")) {
        logger.warn("view_local_screenshot: Path not in .testdriver", { path: normalizedPath });
        return createToolResult(false, "Can only view screenshots from .testdriver directory", { error: "Security: path not allowed" });
      }
      
      // Read the file
      const imageBuffer = fs.readFileSync(params.path);
      const imageBase64 = imageBuffer.toString("base64");
      
      // Store image for MCP App UI display
      const screenshotResourceUri = storeImage(imageBase64, "screenshot");
      
      const stats = fs.statSync(params.path);
      const sizeKB = Math.round(stats.size / 1024);
      const fileName = path.basename(params.path);
      
      const duration = Date.now() - startTime;
      logger.info("view_local_screenshot: Completed", { path: params.path, sizeKB, duration });

      // Return the image content for AI clients that support images
      // The content array includes both text and image for maximum compatibility
      const content: CallToolResult["content"] = [
        { type: "text", text: `Screenshot: ${fileName} (${sizeKB}KB)` },
        { 
          type: "image", 
          data: imageBase64, 
          mimeType: "image/png" 
        },
      ];

      return {
        content,
        structuredContent: { 
          action: "view_local_screenshot",
          success: true,
          path: params.path,
          fileName,
          sizeBytes: stats.size,
          modified: stats.mtime.toISOString(),
          screenshotResourceUri,
          duration 
        },
      };
    } catch (error) {
      logger.error("view_local_screenshot: Failed", { error: String(error), path: params.path });
      captureException(error as Error, { tags: { tool: "view_local_screenshot" }, extra: { path: params.path } });
      throw error;
    }
  }
);

// Screenshot - captures full screen to show user the current state
// NOTE: This is for SHOWING the user the screen, not for AI understanding.
// Use 'check' tool for AI to understand screen state.
registerAppTool(
  server,
  "screenshot",
  {
    title: "Screenshot",
    description: `Display a screenshot to the user. This tool does NOT return the image to you (the AI).

⚠️ IMPORTANT: Do NOT use this tool to understand the screen state. The screenshot is ONLY displayed to the human user - you will NOT receive the image or any analysis.

If you need to:
- See what's on screen → use 'check' instead
- Verify an action worked → use 'check' instead  
- Understand the current state → use 'check' instead

Only use 'screenshot' when you explicitly want to show something to the human user without needing to see it yourself.`,
    inputSchema: z.object({}),
    _meta: { ui: { resourceUri: RESOURCE_URI, expanded: true } },
  },
  async (): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("screenshot: Starting");

    const sessionCheck = requireActiveSession();
    if (!sessionCheck.valid) {
      logger.warn("screenshot: No active session");
      return sessionCheck.error;
    }

    try {
      // Capture full screen screenshot
      const screenshotBase64 = await sdk.agent.system.captureScreenBase64(1, false, true);
      
      let screenshotResourceUri: string | undefined;
      if (screenshotBase64) {
        // Store raw base64 for the resource blob with unique ID
        screenshotResourceUri = storeImage(screenshotBase64, "screenshot");
      }
      
      const duration = Date.now() - startTime;
      logger.info("screenshot: Completed", { duration, hasImage: !!screenshotBase64 });

      // Only send the resource URI - the MCP app will fetch the image via resources/read
      // This keeps the base64 image data OUT of AI context
      return createToolResult(
        true,
        "Screenshot captured and displayed to user",
        { 
          action: "screenshot",
          screenshotResourceUri,
          duration 
        }
      );
    } catch (error) {
      logger.error("screenshot: Failed", { error: String(error) });
      return createToolResult(false, `Screenshot failed: ${error}`, { error: String(error) });
    }
  }
);

// Init - Initialize a new TestDriver project
server.registerTool(
  "init",
  {
    description: `Initialize a new TestDriver project with Vitest SDK examples.

This creates:
- package.json with proper dependencies
- Example test files (tests/example.test.js, tests/login.js)
- vitest.config.js
- .gitignore
- GitHub Actions workflow (.github/workflows/testdriver.yml)
- VSCode MCP config (.vscode/mcp.json)
- VSCode extensions recommendations (.vscode/extensions.json)
- TestDriver skills (.github/skills/)
- TestDriver agents (.github/agents/)
- .env file with API key (if provided)

API Key: The apiKey parameter is optional. If not provided, you'll need to manually add TD_API_KEY to the .env file after initialization. The project structure will still be created successfully.`,
    inputSchema: z.object({
      directory: z.string().optional().describe("Target directory (defaults to current working directory)"),
      apiKey: z.string().optional().describe("TestDriver API key (will be saved to .env)"),
      skipInstall: z.boolean().default(false).describe("Skip npm install step"),
    }),
  },
  async (params): Promise<CallToolResult> => {
    const startTime = Date.now();
    const targetDir = params.directory ? path.resolve(params.directory) : process.cwd();
    
    logger.info("init: Starting", { targetDir, hasApiKey: !!params.apiKey, skipInstall: params.skipInstall });

    try {
      // Import the shared init logic (dynamic import for ESM/CJS compatibility)
      const initProjectPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "lib", "init-project.js");
      const { initProject } = await import(pathToFileURL(initProjectPath).href);
      
      // Run the shared init logic
      const result = await initProject({
        targetDir,
        apiKey: params.apiKey,
        skipInstall: params.skipInstall,
      });

      const duration = Date.now() - startTime;
      logger.info("init: Completed", { targetDir, duration, success: result.success });

      const nextSteps = `

📚 Next steps:

1. Run your tests:
   vitest run

2. Use AI agents to write tests:
   Open VSCode/Cursor and use @testdriver agent

3. MCP server configured:
   TestDriver tools available via MCP in .vscode/mcp.json

4. For CI/CD, add TD_API_KEY to your GitHub repository secrets:
   Settings → Secrets → Actions → New repository secret

Learn more at https://docs.testdriver.ai/v7/getting-started/
`;

      const allMessages = [...result.results, ...result.errors.map((e: string) => `⚠️ ${e}`)];

      return createToolResult(
        result.success,
        result.success 
          ? `✅ TestDriver project initialized successfully!\n\n${allMessages.join("\n")}${nextSteps}`
          : `⚠️ TestDriver project initialization completed with errors:\n\n${allMessages.join("\n")}`,
        { 
          action: "init",
          targetDir,
          filesCreated: result.results.length,
          hasApiKey: !!params.apiKey,
          errors: result.errors,
          duration 
        }
      );
    } catch (error) {
      logger.error("init: Failed", { error: String(error), targetDir });
      captureException(error as Error, { tags: { tool: "init" }, extra: { targetDir } });
      throw error;
    }
  }
);


// Start the server
async function main() {
  logger.info("Starting TestDriver MCP Server", { 
    version,
    logLevel: process.env.TD_LOG_LEVEL || "INFO",
    distDir: DIST_DIR,
    sentryEnabled: isSentryEnabled(),
  });
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  logger.info("TestDriver MCP Server running on stdio");
  
  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down MCP Server");
    await flushSentry();
    process.exit(0);
  };
  
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(async (error) => {
  logger.error("Server failed to start", { error: String(error) });
  captureException(error as Error, { tags: { phase: "startup" } });
  await flushSentry();
  process.exit(1);
});
