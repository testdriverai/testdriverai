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
import { fileURLToPath } from "url";
import { z } from "zod";

import { generateActionCode } from "./codegen.js";
import { getProvisionOptions, SessionStartInputSchema, type SessionStartInput } from "./provision-types.js";
import { sessionManager, type SessionState } from "./session.js";

// =============================================================================
// Sentry
// =============================================================================

// Read version from package.json
const packageJsonPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
const version = packageJson.version || "1.0.0";

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
    environment: "mcp",
    release: `testdriverai-mcp@${version}`,
    sampleRate: 1.0,
    tracesSampleRate: 1.0,
    integrations: [Sentry.httpIntegration(), Sentry.nodeContextIntegration()],
    initialScope: {
      tags: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
      },
    },
    beforeSend(event, hint) {
      const error = hint.originalException;
      // Don't send user-initiated exits
      if (error && typeof error === "object" && "message" in error) {
        const msg = (error as { message: string }).message;
        if (msg.includes("User cancelled")) {
          return null;
        }
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
  
  return { valid: true };
}

/**
 * Create tool result with structured content for MCP App
 * Images: imageUrl (data URL) goes to structuredContent for UI to display
 * The croppedImage from find() is small (~10KB) so it's acceptable as data URL
 * 
 * If generatedCode is provided, it's appended to the text response so the agent
 * can add it to their test file.
 */
function createToolResult(
  success: boolean,
  textContent: string,
  structuredData: Record<string, unknown>,
  generatedCode?: string
): CallToolResult {
  // Build text content - append generated code if provided
  let fullText = textContent;
  if (generatedCode && success) {
    fullText += `\n\nAdd to test file:\n${generatedCode}`;
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
  return {
    content,
    structuredContent: structuredData,
  };
}

// Create MCP server
const server = new McpServer({
  name: "testdriver",
  version: "1.0.0",
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
- See https://docs.testdriver.ai/v7/aws-setup for AWS setup guide`,
    inputSchema: SessionStartInputSchema,
    _meta: { ui: { resourceUri: RESOURCE_URI } },
  },
  async (params: SessionStartInput): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("session_start: Starting", { 
      type: params.type, 
      url: params.url,
      os: params.os, 
      reconnect: params.reconnect 
    });

    try {
      // Validate required fields for specific provision types
      if (params.type === "installer" && !params.installerUrl) {
        return createToolResult(false, "installer type requires 'installerUrl' parameter", { error: "Missing required parameter: installerUrl" });
      }
      if (params.type === "electron" && !params.appPath) {
        return createToolResult(false, "electron type requires 'appPath' parameter", { error: "Missing required parameter: appPath" });
      }

      // Create new session
      const newSession = sessionManager.createSession({
        os: params.os,
        keepAlive: params.keepAlive,
        testFile: params.testFile,
      });
      logger.debug("session_start: Session created", { sessionId: newSession.sessionId });

      // Determine API root
      const apiRoot = params.apiRoot || process.env.TD_API_ROOT || "https://testdriver-api.onrender.com";
      logger.debug("session_start: Using API root", { apiRoot });

      // Initialize SDK
      logger.debug("session_start: Initializing SDK");
      const TestDriverSDK = (await import("../../sdk.js")).default;
      
      // Determine preview mode from environment variable
      // TD_PREVIEW can be "ide", "browser", or "none"
      // Default to "none" for MCP server (headless) unless explicitly set
      const previewMode = process.env.TD_PREVIEW || "none";
      logger.debug("session_start: Preview mode", { preview: previewMode });
      
      // Get IP from params or environment (for self-hosted instances)
      const instanceIp = params.ip || process.env.TD_IP;
      
      sdk = new TestDriverSDK(process.env.TD_API_KEY || "", {
        os: params.os,
        logging: false,
        apiRoot,
        preview: previewMode as "browser" | "ide" | "none",
        ip: instanceIp,
      });

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
        `Session started: ${newSession.sessionId}\nConnection: ${connectionType}\nType: ${params.type}\nSandbox: ${instance?.instanceId}\nExpires in: ${Math.round(params.keepAlive / 1000)}s`,
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
    }),
    _meta: { ui: { resourceUri: RESOURCE_URI } },
  },
  async (params): Promise<CallToolResult> => {
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
      const croppedImage = rawResponse.croppedImage;
      if (croppedImage) {
        const imageData = croppedImage.startsWith('data:') 
          ? croppedImage.replace(/^data:image\/\w+;base64,/, '')
          : croppedImage;
        croppedImageResourceUri = storeImage(imageData, "cropped");
        // Remove croppedImage from response to avoid context bloat
        delete rawResponse.croppedImage;
      }
      
      // Remove extractedText from response to reduce context bloat
      delete rawResponse.extractedText;

      // Generate code for this find action
      const generatedCode = found ? generateActionCode("find", { description: params.description }) : undefined;

      // Build element info for display (cropped image is always centered on element)
      const elementInfo = found ? {
        description: params.description,
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
    }),
    _meta: { ui: { resourceUri: RESOURCE_URI } },
  },
  async (params): Promise<CallToolResult> => {
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
      const croppedImage = rawResponse.croppedImage;
      if (croppedImage) {
        const imageData = croppedImage.startsWith('data:') 
          ? croppedImage.replace(/^data:image\/\w+;base64,/, '')
          : croppedImage;
        croppedImageResourceUri = storeImage(imageData, "cropped");
        // Remove croppedImage from response to avoid context bloat
        delete rawResponse.croppedImage;
      }
      
      // Remove extractedText from response to reduce context bloat
      delete rawResponse.extractedText;

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
    }),
    _meta: { ui: { resourceUri: RESOURCE_URI } },
  },
  async (params): Promise<CallToolResult> => {
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
    }),
    _meta: { ui: { resourceUri: RESOURCE_URI } },
  },
  async (params): Promise<CallToolResult> => {
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
    }),
    _meta: { ui: { resourceUri: RESOURCE_URI } },
  },
  async (params): Promise<CallToolResult> => {
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
        return createToolResult(false, `Element not found: "${params.description}"`, { error: "Element not found", duration: Date.now() - startTime });
      }

      logger.debug("find_and_click: Element found, clicking", { action: params.action });
      if (params.action === "click") {
        await element.click();
      } else if (params.action === "double-click") {
        await element.doubleClick();
      } else if (params.action === "right-click") {
        await element.rightClick();
      }

      const coords = element.getCoordinates();

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
      
      // Remove extractedText from response to reduce context bloat
      delete rawResponse.extractedText;

      // Generate code for this find_and_click action
      const generatedCode = generateActionCode("find_and_click", { description: params.description, action: params.action });

      // Build element info for display
      const elementInfo = coords ? {
        description: params.description,
        x: coords.x,
        y: coords.y,
        centerX: coords.centerX,
        centerY: coords.centerY,
        width: element.width,
        height: element.height,
        confidence: element.confidence,
      } : undefined;

      return createToolResult(
        true,
        `Found and clicked: "${params.description}" at (${rawResponse.coordinates?.x}, ${rawResponse.coordinates?.y})`,
        {
          ...rawResponse,
          action: "find_and_click",
          element: elementInfo,
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
    description: `Use this tool to understand the current screen state and verify if actions succeeded.

This is the PRIMARY tool for AI to understand what's on screen. It captures a screenshot, compares it with the previous state, and provides AI analysis of whether the task/condition is met.

IMPORTANT: This tool is for YOUR understanding during development only. It does NOT generate test code.
- Use 'check' to verify actions worked during development
- Use 'assert' when you want to add a verification step to the test file

Unlike 'assert' which generates code like \`await testdriver.assert("...")\`, 'check' returns detailed analysis to help you understand the current state but does NOT add anything to the test file.

Unlike 'screenshot' which just displays to the user, 'check' analyzes the screen and returns information to you (the AI).

Use after actions to verify they worked:
- "Did the button click work?"
- "Is the user logged in now?"
- "Has the form been submitted successfully?"
- "Did the page navigate to the dashboard?"
- "Is the modal dialog visible?"

When you want to add a verification step to the generated test, use 'assert' instead.

You can optionally provide a reference image URI to compare against instead of using the automatically captured "before" screenshot. This is useful for comparing the current state to a known baseline.`,
    inputSchema: z.object({
      task: z.string().describe("The task or condition to verify (e.g., 'Did the login succeed?', 'Is the modal visible?')"),
      referenceImageUri: z.string().optional().describe("Optional screenshot resource URI (e.g., 'screenshot://testdriver/screenshot/screenshot-1') to compare against instead of the automatically captured 'before' screenshot. Use a screenshotResourceUri from a previous action."),
    }),
    _meta: { ui: { resourceUri: RESOURCE_URI } },
  },
  async (params): Promise<CallToolResult> => {
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
    description: "Execute code in the sandbox (JavaScript, shell, or PowerShell)",
    inputSchema: z.object({
      language: z.enum(["js", "sh", "pwsh"]).default("js"),
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

// Screenshot - captures full screen to show user the current state
// NOTE: This is for SHOWING the user the screen, not for AI understanding.
// Use 'check' tool for AI to understand screen state.
registerAppTool(
  server,
  "screenshot",
  {
    title: "Screenshot",
    description: `Capture a screenshot of the current screen to show the user.

Use this tool to show the user what the screen looks like. The screenshot is displayed in the MCP App UI.

NOTE: This tool is for VISUAL DISPLAY to the user only. If you (the AI) need to understand or verify the screen state, use the 'check' tool instead.`,
    inputSchema: z.object({}),
    _meta: { ui: { resourceUri: RESOURCE_URI } },
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

// Verify
server.registerTool(
  "verify",
  {
    description: "Run the test file from scratch to verify it works",
    inputSchema: z.object({
      testFile: z.string().describe("Path to test file to run"),
    }),
  },
  async (params): Promise<CallToolResult> => {
    const startTime = Date.now();
    logger.info("verify: Starting", { testFile: params.testFile });
    const session = sessionManager.getCurrentSession();

    if (!fs.existsSync(params.testFile)) {
      logger.warn("verify: Test file not found", { testFile: params.testFile });
      return createToolResult(false, `Test file not found: ${params.testFile}`, { error: "Test file not found" });
    }

    const { execSync } = await import("child_process");
    try {
      logger.info("verify: Running vitest", { testFile: params.testFile });
      const output = execSync(`npx vitest run "${params.testFile}" --reporter=verbose`, {
        encoding: "utf-8",
        timeout: 300000,
        cwd: process.cwd(),
        env: { ...process.env },
      });

      const duration = Date.now() - startTime;
      logger.info("verify: Test passed", { testFile: params.testFile, duration });

      return createToolResult(
        true,
        `✓ Test passed!\n\n${output}`,
        {
          action: "verify",
          success: true,
          session: getSessionData(session),
          duration,
        }
      );
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error("verify: Test failed", { testFile: params.testFile, error: error.message, duration });

      return createToolResult(
        false,
        `✗ Test failed!\n\n${error.stdout || error.message}`,
        {
          action: "verify",
          success: false,
          error: error.stdout || error.message,
          session: getSessionData(session),
          duration,
        }
      );
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
