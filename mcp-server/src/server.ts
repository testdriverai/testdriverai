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
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import * as http from "http";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import type { CallToolResult, ReadResourceResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import * as Sentry from "@sentry/node";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { z } from "zod";

import * as core from "./core/actions.js";
import { NoActiveSessionError, type ActionResult } from "./core/actions.js";
import { resolveE2bTemplateId, resolveOs } from "./env-utils.js";
import { SessionStartInputSchema, type SessionStartInput } from "./provision-types.js";
import { type SessionState } from "./session.js";

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
  return resolveChannel(ver);
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
    sampleRate: 0.01,
    tracesSampleRate: 0.01,
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

// =============================================================================
// Image Store - Stores images with unique IDs for reload persistence
// =============================================================================

interface StoredImage {
  data: string;  // base64 image data
  type: "screenshot" | "cropped";
  timestamp: number;
}

// Maximum number of images to store (to prevent memory leaks)
const MAX_STORED_IMAGES = 100;

/**
 * Per-connection image store. It lives in the active {@link core.CoreContext}'s
 * adapter scratch space (not a module global), so concurrent HTTP MCP clients
 * don't share — or evict — each other's screenshots. The stdio/eve hosts have a
 * single context, so this behaves exactly like the old module-level Map for them.
 * Resource reads (which also run inside the connection's context) resolve the
 * same per-connection store, so a screenshot URI only resolves for the client
 * that produced it.
 */
interface ImageStoreState {
  images: Map<string, StoredImage>;
  counter: number;
}

function imageStoreState(): ImageStoreState {
  const adapter = core.getAdapterState();
  let state = adapter.imageStore as ImageStoreState | undefined;
  if (!state) {
    state = { images: new Map(), counter: 0 };
    adapter.imageStore = state;
  }
  return state;
}

/**
 * Store an image and return its unique resource URI
 */
function storeImage(data: string, type: "screenshot" | "cropped"): string {
  const state = imageStoreState();
  const imageStore = state.images;
  const id = `${type}-${++state.counter}`;

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
  return imageStoreState().images.get(id);
}

/** Diagnostics for the active connection's image store (used in debug logs). */
function imageStoreDiagnostics(): { imageStoreSize: number; availableKeys: string[] } {
  const images = imageStoreState().images;
  return { imageStoreSize: images.size, availableKeys: Array.from(images.keys()) };
}

/**
 * Get session info for structured content
 */
function getSessionData(session: SessionState | null) {
  if (!session) return { id: null, expiresIn: 0 };
  return {
    id: session.sessionId,
    expiresIn: core.getSessionTimeRemaining(session.sessionId),
  };
}

/**
 * Map a {@link NoActiveSessionError} thrown by the core into the exact same
 * "no/expired session" tool result the server's old `requireActiveSession`
 * produced. Kept byte-identical so external behavior is unchanged.
 */
function noSessionResult(err: NoActiveSessionError): CallToolResult {
  if (err.code === "SESSION_EXPIRED") {
    return createToolResult(
      false,
      "ERROR: Session has expired or timed out. The sandbox is no longer available. You must call session_start again to create a new sandbox session before continuing.",
      {
        error: "SESSION_EXPIRED",
        action: "session_start",
        message: "The previous sandbox session has expired. Call session_start to create a new one.",
        expiredSessionId: err.expiredSessionId,
      }
    );
  }
  return createToolResult(
    false,
    "ERROR: No active session. You must call session_start first to create a sandbox before using any other tools.",
    {
      error: "NO_SESSION",
      action: "session_start",
      message: "No sandbox session exists. Call session_start to create one.",
    }
  );
}

/**
 * Map a core {@link ActionResult} into an MCP CallToolResult, storing images as
 * resource URIs (the core returns BARE base64, which is what `storeImage` wants).
 */
function resultToMcp(r: ActionResult): CallToolResult {
  const data: Record<string, unknown> = { ...r.data };
  for (const img of r.images ?? []) {
    const uri = storeImage(img.base64, img.kind);
    if (img.kind === "cropped") data.croppedImageResourceUri = uri;
    else data.screenshotResourceUri = uri;
  }
  return createToolResult(r.ok, r.text, data, r.code);
}

// =============================================================================
// Progress reporting (MCP `notifications/progress`)
// =============================================================================

/** The `extra` argument every tool callback receives from the MCP SDK. */
type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

/**
 * Reports progress for a long-running tool back to the client.
 *
 * Per the MCP spec, progress is only sent when the caller included a
 * `progressToken` in the request's `_meta`. When no token is present this is a
 * no-op, so callers can report unconditionally without branching.
 *
 * Each `report()` call increments an internal counter (indeterminate progress —
 * we rarely know a real total ahead of time) and forwards a human-readable
 * `message`. A `heartbeat()` helper keeps the client's idle timeout alive while
 * a single long SDK call is in flight (e.g. provisioning a sandbox, polling a
 * find), which is the situation that was tripping the `session_start` timeout.
 */
interface ProgressReporter {
  /** Emit one progress step with an optional human-readable message. */
  report(message?: string): void;
  /**
   * Emit a progress tick every `intervalMs` until the returned stop function is
   * called. Use this around a single long `await` so the client keeps receiving
   * activity. Always pair with the returned `stop()` in a `finally`.
   */
  heartbeat(message: string, intervalMs?: number): () => void;
}

const DEFAULT_HEARTBEAT_MS = 3000;

function makeProgressReporter(extra: ToolExtra): ProgressReporter {
  const progressToken = extra?._meta?.progressToken;

  // No token → client did not opt into progress. Return a no-op reporter.
  if (progressToken === undefined || progressToken === null) {
    return {
      report: () => {},
      heartbeat: () => () => {},
    };
  }

  let progress = 0;

  const send = (message?: string) => {
    progress += 1;
    // Fire-and-forget: a failed notification must never break the tool call.
    void extra
      .sendNotification({
        method: "notifications/progress",
        params: { progressToken, progress, message },
      })
      .catch((err) => {
        logger.debug("progress: sendNotification failed", { error: String(err) });
      });
  };

  return {
    report: (message) => send(message),
    heartbeat: (message, intervalMs = DEFAULT_HEARTBEAT_MS) => {
      send(message);
      const timer = setInterval(() => send(message), intervalMs);
      // Don't let the heartbeat keep the event loop alive on its own.
      timer.unref?.();
      return () => clearInterval(timer);
    },
  };
}

// =============================================================================
// Cancellation (MCP `notifications/cancelled` → `extra.signal`)
// =============================================================================

/** Thrown when a tool call is aborted by the client. */
class ToolAbortError extends Error {
  constructor(tool: string) {
    super(`${tool} was cancelled by the client`);
    this.name = "ToolAbortError";
  }
}

/** Reject as soon as `signal` aborts. Used to race against long SDK calls. */
function rejectOnAbort(signal: AbortSignal | undefined, tool: string): { promise: Promise<never>; cleanup: () => void } {
  if (!signal) {
    // Never-resolving promise with a no-op cleanup — Promise.race ignores it.
    return { promise: new Promise<never>(() => {}), cleanup: () => {} };
  }
  let onAbort: () => void = () => {};
  const promise = new Promise<never>((_, reject) => {
    onAbort = () => reject(new ToolAbortError(tool));
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
  return { promise, cleanup: () => signal.removeEventListener("abort", onAbort) };
}

/**
 * Run a long-running SDK call, but settle as soon as the client aborts.
 *
 * The wrapped SDK methods are not themselves signal-aware, so on abort the
 * underlying work keeps running to completion in the background — but the tool
 * call returns promptly with a `ToolAbortError` instead of blocking the client.
 * Callers that hold cleanable resources (e.g. `session_start`) should catch
 * `ToolAbortError` and tear them down.
 */
async function raceAbort<T>(signal: AbortSignal | undefined, tool: string, work: Promise<T>): Promise<T> {
  if (signal?.aborted) {
    throw new ToolAbortError(tool);
  }
  const { promise, cleanup } = rejectOnAbort(signal, tool);
  try {
    return await Promise.race([work, promise]);
  } finally {
    cleanup();
  }
}

/**
 * If `error` is a client cancellation, return a "cancelled" tool result so the
 * caller can `return` it; otherwise return null so normal error handling (log +
 * Sentry + rethrow) proceeds. Keeps abort out of error reporting — a user
 * cancelling is not a failure.
 */
function cancelledResultOrNull(error: unknown, tool: string): CallToolResult | null {
  if (error instanceof ToolAbortError) {
    logger.info(`${tool}: Cancelled by client`);
    return createToolResult(false, `${tool} was cancelled.`, { action: tool, cancelled: true });
  }
  return null;
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
    const session = core.getCurrentSession();
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
  const session = core.getCurrentSession();
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

/**
 * Build a fully-registered MCP server instance (all resources + tools).
 *
 * This used to run once at module load against a single shared `server`. It is
 * now a factory so the HTTP transport can mint one server PER connection — each
 * bound (via the surrounding {@link core.runInContext}) to its own isolated
 * {@link core.CoreContext}. That's what stops one Streamable-HTTP client's tool
 * call from reading another client's sandbox. The stdio host calls this once and
 * runs it over the global context, so its behavior is unchanged.
 *
 * The tool/resource handlers below don't reference any per-connection state
 * directly — they go through the context-aware helpers (`storeImage`,
 * `getStoredImage`, `core.*`), which resolve the active context. So a single
 * copy of the registration code serves every connection correctly.
 */
function buildServer(): McpServer {
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
  async (params: SessionStartInput, extra: ToolExtra): Promise<CallToolResult> => {
    const startTime = Date.now();
    const progress = makeProgressReporter(extra);

    // Resolve OS with priority: explicit param > TD_OS env var > "linux" default
    // This mirrors the behavior of the Vitest hooks (hooks.mjs) which also reads TD_OS
    const { os: resolvedOs, warning: osWarning } = resolveOs(params.os);
    if (osWarning) {
      logger.warn(`session_start: ${osWarning}`);
    } else if (!params.os && resolvedOs !== "linux") {
      logger.info("session_start: Using TD_OS environment variable", { os: resolvedOs });
    }

    // Resolve E2B template ID with priority: explicit param > TD_E2B_TEMPLATE_ID env var
    // This mirrors the behavior of the Vitest hooks (hooks.mjs) which also reads TD_E2B_TEMPLATE_ID
    const resolvedE2bTemplateId = resolveE2bTemplateId(params.e2bTemplateId);
    if (!params.e2bTemplateId && resolvedE2bTemplateId) {
      logger.info("session_start: Using TD_E2B_TEMPLATE_ID environment variable", { e2bTemplateId: resolvedE2bTemplateId });
    }

    logger.info("session_start: Starting", {
      type: params.type,
      url: params.url,
      os: resolvedOs,
      reconnect: params.reconnect,
      sandboxId: params.sandboxId,
    });

    try {
      // The core owns session creation, SDK init, connect, provisioning and the
      // initial screenshot. We keep the abort race + heartbeat scaffolding here:
      // a heartbeat ticks while the long provisioning await is in flight, and the
      // whole core call is raced against the client's abort signal so cancellation
      // still returns promptly. Progress messages from the core are forwarded.
      const stopHeartbeat = progress.heartbeat(
        params.sandboxId
          ? `Connecting to existing sandbox ${params.sandboxId}...`
          : "Starting session..."
      );
      let result: ActionResult;
      try {
        result = await raceAbort(
          extra.signal,
          "session_start",
          core.sessionStart(
            params,
            { os: resolvedOs, e2bTemplateId: resolvedE2bTemplateId },
            { onProgress: (m) => progress.report(m) }
          )
        );
      } finally {
        stopHeartbeat();
      }

      const duration = Date.now() - startTime;

      // Set Sentry context once the session id is known.
      if (result.ok && typeof result.data.sessionId === "string") {
        setSessionContext(result.data.sessionId, (result.data.sandboxId as string) || undefined);
      }

      logger.info("session_start: Completed", { duration, ok: result.ok });

      if (!result.ok) {
        // Validation / missing-key failures: pass through with duration added.
        return resultToMcp({ ...result, data: { ...result.data, duration } });
      }

      // Reproduce the server's exact success output (text + data) which differs
      // from the core's neutral text. Images are mapped to resource URIs.
      const data: Record<string, unknown> = { ...result.data, duration };
      for (const img of result.images ?? []) {
        const uri = storeImage(img.base64, img.kind);
        if (img.kind === "cropped") data.croppedImageResourceUri = uri;
        else data.screenshotResourceUri = uri;
      }

      if (result.data.debugMode) {
        // Debug (existing-sandbox) success text — preserve original wording.
        const text = `Connected to existing sandbox (debug mode)
Session: ${result.data.sessionId}
Sandbox: ${result.data.sandboxId}
Expires in: ${Math.round(params.keepAlive / 1000)}s

You are now connected to the sandbox in its current state. Use find, click, type, etc. to interact.`;
        return createToolResult(true, text, data, result.code);
      }

      // Normal provisioning success — append the EXACT dependency guidance block.
      const text = `${result.text}

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
}`;
      return createToolResult(true, text, data, result.code);
    } catch (error) {
      // On client cancellation, tear down the half-provisioned session so we
      // don't leak a connected sandbox. The underlying SDK call may still be
      // running in the background; best-effort cleanup is all we can do.
      if (error instanceof ToolAbortError) {
        logger.info("session_start: Cancelled by client, tearing down session");
        try {
          await core.disconnect();
        } catch (cleanupErr) {
          logger.warn("session_start: Cleanup after cancel failed", { error: String(cleanupErr) });
        }
        return createToolResult(false, "Session start was cancelled.", { action: "session_start", cancelled: true });
      }
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

    const result = core.sessionStatus();
    const duration = Date.now() - startTime;
    logger.info("session_status: Completed", {
      ok: result.ok,
      sessionId: result.data.sessionId,
      status: result.data.status,
      duration,
    });

    return resultToMcp({ ...result, data: { ...result.data, duration } });
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

    const result = core.sessionExtend(params.additionalMs);

    if (!result.ok) {
      logger.warn("session_extend: No active session");
      return { content: [{ type: "text" as const, text: "No active session" }] };
    }

    logger.info("session_extend: Extended", { newExpiry: result.data.newExpiry });

    // Preserve the original plain content shape (not via createToolResult).
    return {
      content: [
        {
          type: "text" as const,
          text: result.text,
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
  async (params: { description: string; timeout?: number }, extra: ToolExtra): Promise<CallToolResult> => {
    const startTime = Date.now();
    const progress = makeProgressReporter(extra);
    logger.info("find: Starting", { description: params.description, timeout: params.timeout });

    try {
      logger.debug("find: Calling SDK find");
      const stopHeartbeat = progress.heartbeat(`Looking for "${params.description}"...`);
      let result: ActionResult;
      try {
        result = await raceAbort(extra.signal, "find", core.find(params.description, params.timeout));
      } finally {
        stopHeartbeat();
      }

      const duration = Date.now() - startTime;
      logger.info("find: Completed", { description: params.description, found: result.ok, duration });

      return resultToMcp({ ...result, data: { ...result.data, duration } });
    } catch (error) {
      if (error instanceof NoActiveSessionError) {
        logger.warn("find: No active session");
        return noSessionResult(error);
      }
      const cancelled = cancelledResultOrNull(error, "find");
      if (cancelled) return cancelled;
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
  async (params: { description: string; timeout?: number }, extra: ToolExtra): Promise<CallToolResult> => {
    const startTime = Date.now();
    const progress = makeProgressReporter(extra);
    logger.info("findall: Starting", { description: params.description, timeout: params.timeout });

    try {
      logger.debug("findall: Calling SDK findAll");
      const stopHeartbeat = progress.heartbeat(`Looking for all "${params.description}"...`);
      let result: ActionResult;
      try {
        result = await raceAbort(extra.signal, "findall", core.findAll(params.description, params.timeout));
      } finally {
        stopHeartbeat();
      }

      const duration = Date.now() - startTime;
      logger.info("findall: Completed", { description: params.description, count: result.data.count, duration });

      return resultToMcp({ ...result, data: { ...result.data, duration } });
    } catch (error) {
      if (error instanceof NoActiveSessionError) {
        logger.warn("findall: No active session");
        return noSessionResult(error);
      }
      const cancelled = cancelledResultOrNull(error, "findall");
      if (cancelled) return cancelled;
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

    try {
      logger.debug("click: Executing click on element", { elementRef: params.elementRef, action: params.action });
      const result = await core.click(params.elementRef, params.action);

      const duration = Date.now() - startTime;
      logger.info("click: Completed", { elementRef: params.elementRef, duration });

      return resultToMcp({ ...result, data: { ...result.data, duration } });
    } catch (error) {
      if (error instanceof NoActiveSessionError) {
        logger.warn("click: No active session");
        return noSessionResult(error);
      }
      logger.error("click: Failed", { error: String(error), elementRef: params.elementRef });
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

    try {
      logger.debug("hover: Executing hover on element", { elementRef: params.elementRef });
      const result = await core.hover(params.elementRef);

      const duration = Date.now() - startTime;
      logger.info("hover: Completed", { elementRef: params.elementRef, duration });

      return resultToMcp({ ...result, data: { ...result.data, duration } });
    } catch (error) {
      if (error instanceof NoActiveSessionError) {
        logger.warn("hover: No active session");
        return noSessionResult(error);
      }
      logger.error("hover: Failed", { error: String(error), elementRef: params.elementRef });
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

    try {
      logger.debug("wait: Waiting", { timeout: params.timeout });
      const result = await core.wait(params.timeout);

      const duration = Date.now() - startTime;
      logger.info("wait: Completed", { timeout: params.timeout, duration });

      return resultToMcp({ ...result, data: { ...result.data, duration } });
    } catch (error) {
      if (error instanceof NoActiveSessionError) {
        logger.warn("wait: No active session");
        return noSessionResult(error);
      }
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

    try {
      logger.debug("focus_application: Focusing", { name: params.name });
      const result = await core.focusApplication(params.name);

      const duration = Date.now() - startTime;
      logger.info("focus_application: Completed", { name: params.name, duration });

      return resultToMcp({ ...result, data: { ...result.data, duration } });
    } catch (error) {
      if (error instanceof NoActiveSessionError) {
        logger.warn("focus_application: No active session");
        return noSessionResult(error);
      }
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
  async (params: { description: string; action: "click" | "double-click" | "right-click" }, extra: ToolExtra): Promise<CallToolResult> => {
    const startTime = Date.now();
    const progress = makeProgressReporter(extra);
    logger.info("find_and_click: Starting", { description: params.description, action: params.action });

    try {
      logger.debug("find_and_click: Finding element");
      const stopHeartbeat = progress.heartbeat(`Looking for "${params.description}"...`);
      let result: ActionResult;
      try {
        result = await raceAbort(extra.signal, "find_and_click", core.findAndClick(params.description, params.action));
      } finally {
        stopHeartbeat();
      }

      const duration = Date.now() - startTime;
      logger.info("find_and_click: Completed", { description: params.description, found: result.ok, duration });

      return resultToMcp({ ...result, data: { ...result.data, duration } });
    } catch (error) {
      if (error instanceof NoActiveSessionError) {
        logger.warn("find_and_click: No active session");
        return noSessionResult(error);
      }
      const cancelled = cancelledResultOrNull(error, "find_and_click");
      if (cancelled) return cancelled;
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

    try {
      logger.debug("type: Typing text");
      const result = await core.type(params.text, params.secret, params.delay);

      const duration = Date.now() - startTime;
      logger.info("type: Completed", { duration });

      return resultToMcp({ ...result, data: { ...result.data, duration } });
    } catch (error) {
      if (error instanceof NoActiveSessionError) {
        logger.warn("type: No active session");
        return noSessionResult(error);
      }
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

    try {
      logger.debug("press_keys: Pressing keys");
      const result = await core.pressKeys(params.keys);

      const duration = Date.now() - startTime;
      logger.info("press_keys: Completed", { keys: params.keys, duration });

      return resultToMcp({ ...result, data: { ...result.data, duration } });
    } catch (error) {
      if (error instanceof NoActiveSessionError) {
        logger.warn("press_keys: No active session");
        return noSessionResult(error);
      }
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

    try {
      logger.debug("scroll: Scrolling");
      const result = await core.scroll(params.direction, params.amount);

      const duration = Date.now() - startTime;
      logger.info("scroll: Completed", { direction: params.direction, duration });

      return resultToMcp({ ...result, data: { ...result.data, duration } });
    } catch (error) {
      if (error instanceof NoActiveSessionError) {
        logger.warn("scroll: No active session");
        return noSessionResult(error);
      }
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

    try {
      logger.debug("assert: Running assertion");
      const result = await core.assert(params.assertion);

      const duration = Date.now() - startTime;
      logger.info("assert: Completed", { assertion: params.assertion, passed: result.ok, duration });

      return resultToMcp({ ...result, data: { ...result.data, duration } });
    } catch (error) {
      if (error instanceof NoActiveSessionError) {
        logger.warn("assert: No active session");
        return noSessionResult(error);
      }
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
  async (params: { task: string; referenceImageUri?: string }, extra: ToolExtra): Promise<CallToolResult> => {
    const startTime = Date.now();
    const progress = makeProgressReporter(extra);
    logger.info("check: Starting", { task: params.task, hasReferenceImageUri: !!params.referenceImageUri });

    try {
      // Resolve the optional reference image from the image store (a server/UI
      // concern). The core handles "last screenshot" / current-screenshot
      // fallback internally when no reference image is passed.
      let referenceImage: string | undefined;
      if (params.referenceImageUri) {
        // Extract image ID from URI (e.g., "screenshot://testdriver/screenshot/screenshot-1" -> "screenshot-1")
        const uriParts = params.referenceImageUri.split("/");
        const imageId = uriParts[uriParts.length - 1];

        logger.info("check: Looking up reference image", {
          referenceImageUri: params.referenceImageUri,
          extractedImageId: imageId,
          ...imageStoreDiagnostics(),
        });

        const storedImage = getStoredImage(imageId);

        if (storedImage) {
          logger.info("check: Found reference image", {
            imageId,
            dataLength: storedImage.data?.length,
            type: storedImage.type,
            hasData: !!storedImage.data,
          });
          referenceImage = storedImage.data;
        } else {
          logger.warn("check: Reference image NOT found in store, falling back to last screenshot", {
            referenceImageUri: params.referenceImageUri,
            imageId,
            ...imageStoreDiagnostics(),
          });
        }
      }

      progress.report("Capturing screenshot...");
      const stopHeartbeat = progress.heartbeat(`Checking: "${params.task}"...`);
      let result: ActionResult;
      try {
        result = await raceAbort(extra.signal, "check", core.check(params.task, referenceImage));
      } finally {
        stopHeartbeat();
      }

      const duration = Date.now() - startTime;
      logger.info("check: Completed", { task: params.task, complete: result.ok, duration });

      return resultToMcp({ ...result, data: { ...result.data, duration } });
    } catch (error) {
      if (error instanceof NoActiveSessionError) {
        logger.warn("check: No active session");
        return noSessionResult(error);
      }
      const cancelled = cancelledResultOrNull(error, "check");
      if (cancelled) return cancelled;
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

    try {
      logger.debug("exec: Executing code", { language: params.language });
      const result = await core.exec(params.language, params.code, params.timeout);

      const duration = Date.now() - startTime;
      logger.info("exec: Completed", { language: params.language, outputLength: (result.data.output as string)?.length || 0, duration });

      return resultToMcp({ ...result, data: { ...result.data, duration } });
    } catch (error) {
      if (error instanceof NoActiveSessionError) {
        logger.warn("exec: No active session");
        return noSessionResult(error);
      }
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

    try {
      const result = await core.screenshot();

      // Store the captured image as a resource URI (kept OUT of AI context — the
      // MCP app fetches it via resources/read). Preserve the original user-facing
      // text rather than the core's neutral text.
      const data: Record<string, unknown> = { action: "screenshot" };
      for (const img of result.images ?? []) {
        data.screenshotResourceUri = storeImage(img.base64, "screenshot");
      }

      const duration = Date.now() - startTime;
      data.duration = duration;
      logger.info("screenshot: Completed", { duration, hasImage: (result.images?.length ?? 0) > 0 });

      return createToolResult(true, "Screenshot captured and displayed to user", data);
    } catch (error) {
      if (error instanceof NoActiveSessionError) {
        logger.warn("screenshot: No active session");
        return noSessionResult(error);
      }
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
      skipSampleTest: z.boolean().default(false).describe("Skip scaffolding the example test files (tests/example.test.js + tests/login.js). Useful when an agent writes its own tests."),
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
        skipSampleTest: params.skipSampleTest,
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

  return server;
}


// =============================================================================
// HTTP transport (Streamable HTTP, no auth)
// =============================================================================

/** A live MCP connection: its transport, the server bound to it, and the
 *  isolated action context every one of its tool calls runs inside. */
interface HttpConnection {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  ctx: core.CoreContext;
}

/** Read and JSON-parse a request body. Returns undefined for an empty/invalid
 *  body (GET/DELETE carry none) so callers can treat "no body" uniformly. */
function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => {
      if (chunks.length === 0) return resolve(undefined);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch {
        resolve(undefined);
      }
    });
    req.on("error", () => resolve(undefined));
  });
}

/**
 * Serve the MCP server over Streamable HTTP with no authentication.
 *
 * This is what the eve agent (and any other Streamable-HTTP MCP client) connects
 * to. Each MCP session gets its OWN transport + server + isolated action context,
 * keyed by the `mcp-session-id` header:
 *
 *  - An `initialize` request (no session id yet) mints a fresh connection: a new
 *    isolated {@link core.CoreContext}, a server built over it, and a transport
 *    whose generated session id we store. Every later request carrying that id
 *    routes back to the same connection and runs inside its context via
 *    {@link core.runInContext} — so one client's tool call can only ever touch
 *    its own sandbox / element refs / image store. This is the fix for the
 *    cross-session bleed: state is per-connection, not process-global.
 *  - `DELETE` (or transport close) tears the connection down and drops it from
 *    the map, so a disconnecting client frees its slot and its context is GC'd.
 *
 * No auth is applied here by design (the connection is expected to be local-only
 * or otherwise protected outside the MCP layer). Do not expose this on a public
 * network without putting a real authenticating proxy in front of it.
 */
async function startHttpServer() {
  const host = process.env.TD_MCP_HOST || "127.0.0.1";
  const port = Number(process.env.TD_MCP_PORT || process.env.PORT || 8788);
  const mcpPath = process.env.TD_MCP_PATH || "/mcp";

  // Live connections keyed by MCP session id. One entry per connected client.
  const connections = new Map<string, HttpConnection>();

  const httpServer = http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url || "/", `http://${req.headers.host}`);

      // Lightweight health check for readiness probes / `eve dev`.
      if (req.method === "GET" && url.pathname === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "ok", server: "testdriver", version, sessions: connections.size }));
        return;
      }

      if (url.pathname !== mcpPath) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "Not found", hint: `MCP endpoint is ${mcpPath}` }));
        return;
      }

      const sessionId = req.headers["mcp-session-id"];
      const sid = Array.isArray(sessionId) ? sessionId[0] : sessionId;

      // POST bodies must be parsed here (to detect `initialize` and to hand the
      // transport a pre-parsed body). GET (SSE) and DELETE carry no JSON body.
      const body = req.method === "POST" ? await readJsonBody(req) : undefined;

      let connection: HttpConnection | undefined = sid ? connections.get(sid) : undefined;

      // A brand-new session: only an `initialize` request may create one.
      if (!connection) {
        if (sid) {
          // Client presented a session id we don't know — it was torn down or is
          // stale. 404 so the client re-initializes (matches SDK stateful mode).
          res.writeHead(404, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "Unknown or expired MCP session", sessionId: sid }));
          return;
        }
        if (!isInitializeRequest(body)) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "Bad Request: no MCP session id and not an initialize request" }));
          return;
        }

        // Mint an isolated context + a server bound to it + a transport.
        const ctx = core.createIsolatedContext();
        const mcpServer = buildServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newId: string) => {
            connections.set(newId, { transport, server: mcpServer, ctx });
            logger.info("http: MCP session initialized", { sessionId: newId, activeSessions: connections.size });
          },
        });
        // When the transport closes (client DELETE, network drop, or shutdown),
        // drop the connection and best-effort tear down its sandbox so a
        // disconnecting client doesn't leak a live VM.
        transport.onclose = () => {
          const closedId = transport.sessionId;
          if (closedId && connections.delete(closedId)) {
            logger.info("http: MCP session closed", { sessionId: closedId, activeSessions: connections.size });
          }
          // Disconnect the SDK inside this connection's context (best-effort).
          core.runInContext(ctx, () => { void core.disconnect(); });
        };

        await mcpServer.connect(transport);
        connection = { transport, server: mcpServer, ctx };
      }

      // Route the request through THIS connection's transport, inside THIS
      // connection's action context so every core.* call the handlers make
      // resolves the right sandbox / refs / image store.
      const conn = connection;
      await core.runInContext(conn.ctx, () =>
        conn.transport.handleRequest(req, res, body),
      ).catch((error: unknown) => {
        logger.error("http: handleRequest failed", { error: String(error) });
        captureException(error as Error, { tags: { phase: "http" } });
        if (!res.headersSent) {
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      });
    })().catch((error: unknown) => {
      logger.error("http: request handling failed", { error: String(error) });
      captureException(error as Error, { tags: { phase: "http" } });
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    });
  });

  await new Promise<void>((resolve) => httpServer.listen(port, host, resolve));
  logger.info("TestDriver MCP Server running on Streamable HTTP", {
    url: `http://${host}:${port}${mcpPath}`,
  });

  const shutdown = async () => {
    logger.info("Shutting down MCP Server", { activeSessions: connections.size });
    httpServer.close();
    for (const conn of connections.values()) {
      await conn.transport.close().catch(() => {});
    }
    connections.clear();
    await flushSentry();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Start the server
async function main() {
  // Transport selection: TD_MCP_TRANSPORT=http serves Streamable HTTP (used by
  // the eve agent); anything else (default) uses stdio for local CLI clients.
  const transportMode = (process.env.TD_MCP_TRANSPORT || "stdio").toLowerCase();

  logger.info("Starting TestDriver MCP Server", {
    version,
    transport: transportMode,
    logLevel: process.env.TD_LOG_LEVEL || "INFO",
    distDir: DIST_DIR,
    sentryEnabled: isSentryEnabled(),
  });

  if (transportMode === "http") {
    await startHttpServer();
    return;
  }

  // stdio: one long-lived server for the process. It runs over the global
  // action context (no runInContext wrap), so behavior is unchanged — a single
  // local CLI client, one sandbox at a time, exactly as before.
  const server = buildServer();
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
