/**
 * TestDriver action core — framework-agnostic.
 *
 * This module owns the actual computer-use logic: it holds the singleton SDK,
 * the element-reference map, and the "last screenshot" used by `check`, and
 * exposes one async function per action. Every function returns a neutral
 * {@link ActionResult} — no MCP types, no eve types — so it can be wrapped by:
 *
 *   - the MCP server (`server.ts`), which turns images into resource URIs and
 *     calls `createToolResult`, and
 *   - eve `defineTool()` files, which return the text/code/images as eve content.
 *
 * Keep MCP- and eve-specific concerns (Sentry, progress heartbeats, abort
 * racing, image stores, UI resources) in the adapters. This file only knows
 * about the TestDriver SDK and `generateActionCode`.
 *
 * State is process-global and single-session by design: one sandbox at a time,
 * mirroring how the stdio MCP server has always behaved.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { generateActionCode } from "../codegen.js";
import { getProvisionOptions, SessionStartInputSchema, type SessionStartInput } from "../provision-types.js";
import { SessionManager, sessionManager as globalSessionManager, type SessionState } from "../session.js";

// Re-export the input contract so adapters (MCP server, eve tools) share one
// source of truth for the session_start schema instead of redeclaring it.
export { SessionStartInputSchema, type SessionStartInput };

// =============================================================================
// Neutral result shape
// =============================================================================

export interface ActionImage {
  kind: "screenshot" | "cropped";
  /** Raw base64 (no `data:` prefix). */
  base64: string;
}

export interface ActionResult {
  /** Whether the action succeeded (assertions/finds may legitimately be false). */
  ok: boolean;
  /** Human/agent-readable summary line(s). */
  text: string;
  /** Structured fields for programmatic consumers and UIs. */
  data: Record<string, unknown>;
  /** Code to append to the test file, when the action produces test code. */
  code?: string;
  /** Images produced by the action (screenshots / cropped element shots). */
  images?: ActionImage[];
}

/** Thrown when an action runs without an active/valid session. */
export class NoActiveSessionError extends Error {
  readonly code: "NO_SESSION" | "SESSION_EXPIRED";
  readonly expiredSessionId?: string;
  constructor(code: "NO_SESSION" | "SESSION_EXPIRED", message: string, expiredSessionId?: string) {
    super(message);
    this.name = "NoActiveSessionError";
    this.code = code;
    this.expiredSessionId = expiredSessionId;
  }
}

// =============================================================================
// Per-connection state (isolated via AsyncLocalStorage)
// =============================================================================

/**
 * The mutable state a single sandbox session needs: the live SDK handle, the
 * element-ref map from `find`/`findall`, the "last screenshot" `check` diffs
 * against, the adapter recovery hook, the in-flight reconnect promise, and the
 * session-lifecycle manager.
 *
 * This used to be a bag of module-level singletons ("single sandbox per
 * process"). That is correct for hosts that ARE one-session-per-process — eve
 * (each durable turn is its own recycled process) and the stdio MCP server — but
 * the Streamable-HTTP MCP server is one long-lived process serving *concurrent*
 * clients, where shared singletons let one client's tool call read another
 * client's sandbox. So the state moves into {@link CoreContext} and is resolved
 * per async call via {@link als}.
 */
export interface CoreContext {
  /**
   * The live SDK handle. Only ever assigned once its `connect()` has resolved —
   * see {@link sdkGeneration}. Readers may assume `sdk.connected === true`.
   */
  sdk: any;
  /**
   * Monotonic epoch, bumped by every flow that starts building a new SDK
   * (`sessionStart` / `reconnectSession`).
   *
   * Why: a flow can be abandoned while its `connect()` is still in flight — eve's
   * per-action deadline explicitly stops waiting on the SDK promise but cannot
   * cancel it, so the abandoned action keeps running and races the retry that
   * replaced it. Both then reach for `c.sdk`. Without an epoch the loser lands
   * last and installs its (older, or half-built) SDK over the winner's, and every
   * subsequent action fails against a connection nobody is maintaining.
   *
   * Each flow captures the epoch before it builds, and publishes only if the
   * epoch is still its own. The loser closes the sandbox it built instead of
   * leaking it — an orphaned sandbox pins a team concurrency slot for the whole
   * keepAlive window (15 min for eve), which is what eventually starves the team
   * and turns every later `connect()` into a slot-denial poll.
   */
  sdkGeneration: number;
  lastScreenshotBase64: string | null;
  reconnectResolver: ReconnectResolver | null;
  /** In-flight reconnect, so concurrent actions in one context share one rebuild. */
  reconnecting: Promise<void> | null;
  /** Stored element instances from `find`/`findall`, addressable by ref. */
  elementRefs: Map<
    string,
    { element: any; description: string; coords: { x: number; y: number; centerX: number; centerY: number } }
  >;
  /** Session lifecycle for THIS context. */
  sessions: SessionManager;
  /**
   * Opaque per-connection scratch space for adapters (e.g. the MCP server's
   * image store). mcp-core doesn't read this; it just guarantees each isolated
   * context gets its own object, so adapter-side per-connection state rides along
   * with the same AsyncLocalStorage isolation instead of needing a second one.
   */
  adapter: Record<string, unknown>;
}

/** Build a fresh, empty context. Callers that want isolation mint one per connection. */
export function createCoreContext(): CoreContext {
  return {
    sdk: null,
    sdkGeneration: 0,
    lastScreenshotBase64: null,
    reconnectResolver: null,
    reconnecting: null,
    elementRefs: new Map(),
    // Reuse the shared SessionManager for the global context so that consumers
    // still importing `sessionManager` from ../session observe the same state;
    // isolated contexts get their own instance.
    sessions: globalSessionManager,
    adapter: {},
  };
}

const als = new AsyncLocalStorage<CoreContext>();

/**
 * The fallback context used when no isolated context is active — i.e. for eve
 * and the stdio MCP server, which are one-session-per-process and never call
 * {@link runInContext}. Behavior for those hosts is byte-identical to the old
 * module-global singletons.
 */
const globalContext: CoreContext = createCoreContext();

/** Resolve the active context: the ALS store if one is running, else the global. */
function ctx(): CoreContext {
  return als.getStore() ?? globalContext;
}

/**
 * Run `fn` with `context` as the active {@link CoreContext}, isolating every
 * action's state (sdk, element refs, session, recovery hook) for the duration.
 * The HTTP MCP server wraps each connection's request handling in this so
 * concurrent clients never share a sandbox. Hosts that don't call this keep
 * using {@link globalContext} exactly as before.
 */
export function runInContext<T>(context: CoreContext, fn: () => T): T {
  return als.run(context, fn);
}

/** Build an isolated context whose SessionManager is its own (not the global). */
export function createIsolatedContext(): CoreContext {
  const c = createCoreContext();
  c.sessions = new SessionManager();
  return c;
}

/** The active context's adapter scratch space (see {@link CoreContext.adapter}). */
export function getAdapterState(): Record<string, unknown> {
  return ctx().adapter;
}

/** The active context's current session (null when none). Adapters use this for
 *  read-only lookups (e.g. the MCP server's testFile/expiry) that must resolve
 *  the caller's own session, not a process-global one. */
export function getCurrentSession(): SessionState | null {
  return ctx().sessions.getCurrentSession();
}

/** Time remaining (ms) on a session in the active context. */
export function getSessionTimeRemaining(sessionId: string): number {
  return ctx().sessions.getTimeRemaining(sessionId);
}

/**
 * Optional adapter-supplied recovery hook. When the SDK is missing or stale at
 * action time, {@link requireActiveSession} calls this to obtain the params
 * needed to rebuild the connection from the still-alive sandbox, then reconnects
 * before throwing NO_SESSION.
 *
 * Why a hook instead of mcp-core owning the handle: the durable facts (sandbox
 * id, config) and the API key must survive a host process recycle, but this
 * context's state does NOT — it resets on the very recycle we're recovering
 * from. So the *durable owner* (eve's per-session state) registers a resolver
 * that reads its own durable store and re-resolves the key per call. Hosts with
 * one long-lived process (stdio MCP server, CLI) register nothing: the resolver
 * stays null and behavior is unchanged — `requireActiveSession` throws the same
 * NO_SESSION/SESSION_EXPIRED as before.
 *
 * The resolver returns `null` when it has nothing to recover from (no sandbox
 * provisioned this session), in which case we fall through to the normal throw.
 * It is re-registered each step by the adapter (context state resets on recycle),
 * so a stale closure can't outlive the process it was bound to.
 */
export type ReconnectResolver = () => Promise<ReconnectParams | null>;

/**
 * Register (or clear, with `null`) the recovery hook. Durable adapters call this
 * at the start of each step with a resolver bound to the current tool context.
 */
export function setReconnectResolver(resolver: ReconnectResolver | null): void {
  ctx().reconnectResolver = resolver;
}

/** Expose internals the adapters legitimately need (read-only intent). */
export function getSdk(): any {
  return ctx().sdk;
}
export function getLastScreenshotBase64(): string | null {
  return ctx().lastScreenshotBase64;
}
export function getElementRef(ref: string) {
  return ctx().elementRefs.get(ref);
}

/**
 * Cheap, side-effect-free check for a usable in-process session: a *connected*
 * SDK and a current session that is active and hasn't expired. Durable adapters
 * call this *before* doing any expensive reconnect prep (e.g. re-resolving an API
 * key), so the common warm-process path stays free. Note: unlike
 * `requireActiveSession`, this does NOT refresh the keepAlive window — it only
 * reports liveness.
 *
 * Both extra conditions matter, and neither used to be checked:
 *
 *  - `sdk.connected` — the SDK sets this only when `connect()` resolves, and it
 *    is the flag `_ensureConnected()` gates every command on. A mere `!!c.sdk`
 *    accepted an SDK whose `connect()` was still in flight, so a caller could be
 *    told the session was live and then have the very next action throw "SDK is
 *    not connected. Call connect() first."
 *  - `status === "active"` — `isSessionValid()` deliberately accepts
 *    `"initializing"` (it only rejects `expired`/`error`), so a session that was
 *    created but never finished connecting counted as usable.
 */
export function hasLiveSession(): boolean {
  const c = ctx();
  const session = c.sessions.getCurrentSession();
  if (!sdkIsConnected(c.sdk) || !session) return false;
  return session.status === "active" && c.sessions.isSessionValid(session.sessionId);
}

/**
 * Drop the in-process session and SDK handle after the caller has released the
 * sandbox out-of-band (eve's `session_end`, which calls `sdk.sandbox.close()`).
 *
 * Without this, ending a session left the context claiming a live one: `close()`
 * tears down the sandbox's Ably client but never clears the SDK's own `connected`
 * flag, and the session stayed `active` in the registry pointing at a sandbox that
 * no longer exists — so `hasLiveSession()` answered true and `session_status`
 * reported an active session for a dead VM.
 *
 * Bumping the epoch is the important part: any build still in flight (an abandoned
 * action's reconnect) now loses its publish and closes the sandbox it opened,
 * instead of resurrecting a session the caller explicitly ended — which would
 * silently re-take a team concurrency slot.
 */
export function clearSession(): void {
  const c = ctx();
  const current = c.sessions.getCurrentSession();
  if (current) c.sessions.endSession(current.sessionId);
  c.sdk = null;
  c.lastScreenshotBase64 = null;
  c.elementRefs.clear();
  c.sdkGeneration++;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Load the TestDriver SDK, working in two very different hosts:
 *
 *  - eve's dev-runtime / build: it externalizes the `testdriverai` package, so
 *    the bare specifier resolves from eve's node_modules and is NOT pulled into
 *    the bundle/snapshot (which would drag in sdk.js's monorepo-relative
 *    `require('../shared/load-env')` and fail).
 *  - the standalone MCP server (stdio/CLI): it is a separate package nested in
 *    `sdk/`, so `testdriverai` is not self-referenceable there; fall back to the
 *    relative `../../../sdk.js` it has always used.
 *
 * Both specifiers are computed/indirected so a static bundler can't follow them.
 */
async function loadTestDriverSdk(): Promise<{ default: any }> {
  const pkg = "testdriverai";
  try {
    return (await import(/* @vite-ignore */ pkg)) as { default: any };
  } catch {
    const rel = ["..", "..", "..", "sdk.js"].join("/");
    return (await import(/* @vite-ignore */ rel)) as { default: any };
  }
}

/**
 * Strip the large/derived fields the SDK attaches to a response so they don't
 * bloat the agent's context. Returns a shallow clone safe to mutate further.
 */
function leanResponse(raw: any): Record<string, unknown> {
  const r = { ...(raw || {}) } as Record<string, unknown>;
  delete r.croppedImage;
  delete r.extractedText;
  delete r.pixelDiffImage;
  return r;
}

/** Normalize a possibly-`data:`-prefixed base64 string to bare base64. */
function bareBase64(s: string): string {
  return s.startsWith("data:") ? s.replace(/^data:image\/\w+;base64,/, "") : s;
}

/**
 * Whether the live SDK's realtime (Ably) transport is actually usable right now.
 *
 * A recycled host gives us a brand-new singleton (`sdk === null`) — caught by the
 * `!sdk` check below. But a *parked* host is subtler: the process froze between
 * steps, Ably's idle timer tore down the transport ("No activity seen from
 * realtime…"), and on thaw the singleton + session still look valid while the
 * socket underneath is dead. Sending over it doesn't fail fast — it hangs for the
 * SDK's full command timeout. So we also treat any non-`connected` Ably state as
 * "needs reconnect". `_ably` is SDK-internal, so every hop is optional-chained
 * and a throw counts as unhealthy: a false negative costs a cheap reconnect, a
 * false positive costs a multi-minute hang, so we fail safe toward reconnecting.
 */
function realtimeIsHealthy(s: any): boolean {
  try {
    return sdkIsConnected(s) && s?.sandbox?._ably?.connection?.state === "connected";
  } catch {
    return false;
  }
}

/**
 * Whether `s` is an SDK that has finished connecting.
 *
 * `connected` flips to true only at the end of `connect()` and is exactly what
 * the SDK's own `_ensureConnected()` guards every command on, so it is the one
 * honest answer to "can I use this handle". Checking only for the *object* let a
 * still-connecting SDK pass as usable. Optional-chained and defensive: an
 * unusable handle must read as not-connected rather than throw.
 */
function sdkIsConnected(s: any): boolean {
  try {
    return s?.connected === true;
  } catch {
    return false;
  }
}

/**
 * Close a sandbox we built but are not going to publish (we lost the epoch race).
 * Best-effort, but worth awaiting: `close()` publishes `end-session` and leaves
 * presence, which releases the team concurrency slot immediately instead of
 * letting the orphan pin it for the full keepAlive window.
 */
async function discardSdk(sdk: any): Promise<void> {
  try {
    await sdk?.sandbox?.close?.();
  } catch {
    /* best effort — the server reaps the orphan on lease expiry regardless */
  }
}

/**
 * Publish `sdk` as the context's handle, unless a newer flow superseded us while
 * we were connecting. Returns false when superseded, having closed the sandbox we
 * built so it can't linger as an orphan holding a concurrency slot.
 *
 * Call this immediately after `connect()` resolves and before touching `c.sdk`.
 */
async function publishSdk(c: CoreContext, sdk: any, generation: number): Promise<boolean> {
  if (c.sdkGeneration !== generation) {
    await discardSdk(sdk);
    return false;
  }
  c.sdk = sdk;
  return true;
}

/** Result for a `sessionStart` that lost the epoch race to a newer session_start. */
function supersededResult(): ActionResult {
  return {
    ok: false,
    text:
      "This session_start was superseded by a newer one that is already connected. " +
      "The sandbox this call provisioned has been released. Use the active session, " +
      "or call session_end and then session_start if you need a fresh sandbox.",
    data: { action: "session_start", error: "SESSION_SUPERSEDED" },
  };
}

/**
 * Attempt to rebuild the singleton from the adapter-registered recovery hook.
 * Returns true if a usable session now exists, false if there was nothing to
 * recover from (no resolver, or it returned null). Throws SESSION_EXPIRED when a
 * recovery was attempted but the sandbox is genuinely gone.
 *
 * Concurrent actions in one step share a single in-flight rebuild via
 * {@link reconnecting} so a parked socket isn't reconnected N times in parallel.
 */
async function tryRecoverSession(): Promise<boolean> {
  const c = ctx();
  if (!c.reconnectResolver) return false;
  if (!c.reconnecting) {
    const resolver = c.reconnectResolver;
    c.reconnecting = (async () => {
      const params = await resolver();
      if (!params?.sandboxId) return; // nothing provisioned this session
      // Close any half-dead socket on the outgoing SDK before replacing it, so a
      // parked-then-rebuilt session doesn't leak an orphaned Ably connection.
      try {
        c.sdk?.sandbox?._ably?.close?.();
      } catch {
        /* best effort — reconnectSession installs a fresh SDK regardless */
      }
      await reconnectSession(params);
    })().finally(() => {
      c.reconnecting = null;
    });
  }
  try {
    await c.reconnecting;
  } catch (err) {
    c.sdk = null;
    if (err instanceof NoActiveSessionError) throw err;
    throw new NoActiveSessionError(
      "SESSION_EXPIRED",
      `Could not reconnect to the sandbox: ${err instanceof Error ? err.message : String(err)}. The sandbox has expired — call session_start again to create a new one.`
    );
  }
  const session = c.sessions.getCurrentSession();
  return !!c.sdk && !!session && c.sessions.isSessionValid(session.sessionId);
}

/**
 * Validate the active session and auto-extend it (active use keeps it alive),
 * mirroring the MCP server's `requireActiveSession`. When the in-process
 * connection was lost (host recycle wiped the singletons, or a park killed the
 * realtime socket), this first tries to self-heal via the adapter-registered
 * recovery hook ({@link setReconnectResolver}) — so every action recovers at one
 * chokepoint instead of each tool wrapping its own reconnect. Throws
 * {@link NoActiveSessionError} only when there is no usable sandbox AND nothing
 * to recover from.
 */
async function requireActiveSession(): Promise<void> {
  const c = ctx();
  const session = c.sessions.getCurrentSession();

  // Recoverable conditions:
  //  - context state wiped by a host recycle (`!sdk || !session`), or
  //  - the SDK exists but its realtime socket died during a park
  //    (`!realtimeIsHealthy`). We only treat a dead socket as recoverable when a
  //    recovery hook is registered — i.e. a durable host (eve) that actually
  //    parks. Long-lived hosts (stdio MCP, CLI) register no resolver, so a
  //    transient in-process Ably blip is left to Ably's own auto-reconnect rather
  //    than forcing a full rebuild — preserving their prior behavior.
  const socketDead = !!c.sdk && !!session && !!c.reconnectResolver && !realtimeIsHealthy(c.sdk);
  const needsRecovery = !c.sdk || !session || socketDead;
  if (needsRecovery) {
    const recovered = await tryRecoverSession();
    if (!recovered) {
      // Nothing to recover from (no resolver, or it had no sandbox to rebuild).
      // If the socket was dead, don't send the action into the void — surface
      // SESSION_EXPIRED so the agent re-provisions instead of hanging.
      if (socketDead) {
        c.sdk = null;
        throw new NoActiveSessionError(
          "SESSION_EXPIRED",
          "The sandbox connection was lost and could not be restored. Call session_start again to create a new sandbox session.",
          session?.sessionId
        );
      }
      // Otherwise the SDK was simply absent — the standard NO_SESSION.
      throw new NoActiveSessionError(
        "NO_SESSION",
        "No active session. Call session_start first to create a sandbox before using any other tools."
      );
    }
  }

  const current = c.sessions.getCurrentSession();
  if (!current || !c.sessions.isSessionValid(current.sessionId)) {
    c.sdk = null;
    throw new NoActiveSessionError(
      "SESSION_EXPIRED",
      "Session has expired or timed out. Call session_start again to create a new sandbox session.",
      current?.sessionId
    );
  }

  // Reset the keepAlive timer on each command so active use doesn't expire.
  c.sessions.refreshSession(current.sessionId);
}

/**
 * Capture a fresh full-screen screenshot as bare base64 (or null on failure).
 *
 * Pass an explicit `sdk` from any flow that owns a local handle (`sessionStart`):
 * reading `ctx().sdk` there would let a concurrent rebuild swap the instance out
 * between provisioning and the screenshot. Actions that have already been through
 * `requireActiveSession()` can omit it — the context's SDK is the right one.
 */
async function captureScreen(sdk: any = ctx().sdk): Promise<string | null> {
  try {
    const b64 = await sdk.agent.system.captureScreenBase64(1, false, true);
    return b64 || null;
  } catch {
    return null;
  }
}

// =============================================================================
// Session lifecycle
// =============================================================================

export interface SessionStartHooks {
  /** Called before a long await; return a stop fn. Lets adapters heartbeat. */
  onProgress?: (message: string) => void;
}

/**
 * Start a session and provision a sandbox. The adapter is responsible for
 * progress/heartbeat and abort; this performs the provisioning and returns the
 * neutral result (including the initial screenshot and provision code).
 */
export async function sessionStart(
  params: SessionStartInput,
  resolved: { os: "linux" | "windows"; e2bTemplateId?: string; apiKey?: string },
  hooks: SessionStartHooks = {}
): Promise<ActionResult> {
  const c = ctx();
  const progress = hooks.onProgress ?? (() => {});

  // Validate required fields for specific provision types (unless reconnecting).
  if (!params.sandboxId) {
    if (params.type === "installer" && !params.installerUrl) {
      return { ok: false, text: "installer type requires 'installerUrl' parameter", data: { error: "Missing required parameter: installerUrl" } };
    }
    if (params.type === "electron" && !params.appPath) {
      return { ok: false, text: "electron type requires 'appPath' parameter", data: { error: "Missing required parameter: appPath" } };
    }
  }

  // NOTE: the session is deliberately NOT created here. `createSession()` marks
  // the new session *current* immediately, with status "initializing" — and
  // `isSessionValid()` accepts that status — so creating it before `connect()`
  // published a half-real session to every concurrent reader, and a `connect()`
  // that threw or stalled (e.g. polling for a free concurrency slot) left it
  // current forever. That is the `session_status: initializing` that never
  // resolves. We create and activate it below, only once we have a live sandbox.
  const apiRoot = params.apiRoot || process.env.TD_API_ROOT || "https://api.testdriver.ai";
  const previewMode = process.env.TD_PREVIEW || "ide";
  const instanceIp = params.ip || process.env.TD_IP;
  // An adapter may resolve a per-caller key out-of-band (e.g. the eve agent's
  // browser OAuth device flow, where each user carries their own team key).
  // Prefer that; otherwise fall back to the process-wide env keys the MCP/CLI
  // host has always used.
  const apiKey = resolved.apiKey || process.env.TD_API_KEY || process.env.COPILOT_MCP_TD_API_KEY || "";

  if (!apiKey) {
    return {
      ok: false,
      text: "No API key found. Please set TD_API_KEY or COPILOT_MCP_TD_API_KEY environment variable.",
      data: {
        error: "Missing API key",
        action: "session_start",
        hint: "For GitHub Copilot coding agent, create a Copilot environment secret named COPILOT_MCP_TD_API_KEY",
      },
    };
  }

  // Build into a LOCAL handle and publish to `c.sdk` only once `connect()` has
  // resolved. Assigning `c.sdk` up front exposed an SDK whose `connected` flag is
  // still false to every concurrent reader, and — because each step below used to
  // re-read `c.sdk` — let a concurrent rebuild swap the instance out *between*
  // connect and provision, so provisioning ran against a handle that had never
  // been connected and threw "SDK is not connected. Call connect() first."
  // Everything below uses `sdk`; `c.sdk` is written exactly once, at publish.
  const generation = ++c.sdkGeneration;
  const TestDriverSDK = (await loadTestDriverSdk()).default;
  const sdk = new TestDriverSDK(apiKey, {
    os: resolved.os,
    logging: false,
    apiRoot,
    preview: previewMode as "browser" | "ide" | "none",
    ip: instanceIp,
    e2bTemplateId: resolved.e2bTemplateId,
  });

  // Debug mode — attach to an existing sandbox, skip provisioning.
  if (params.sandboxId) {
    progress(`Connecting to existing sandbox ${params.sandboxId}...`);
    // Debug mode attaches to one specific sandbox in its current state, so a
    // substitute is never acceptable here either — the whole point is to inspect
    // THAT sandbox. Fail loudly if it's gone.
    await sdk.connect({
      sandboxId: params.sandboxId,
      keepAlive: params.keepAlive,
      requireSandbox: true,
    });
    if (!(await publishSdk(c, sdk, generation))) return supersededResult();

    const instance = sdk.getInstance();
    const newSession = c.sessions.createSession({
      os: resolved.os,
      keepAlive: params.keepAlive,
      testFile: params.testFile,
    });
    c.sessions.activateSession(newSession.sessionId, instance?.instanceId || params.sandboxId);

    progress("Capturing screenshot...");
    const shot = await captureScreen(sdk);
    if (shot) c.lastScreenshotBase64 = shot;

    return {
      ok: true,
      text: `Connected to existing sandbox (debug mode)\nSession: ${newSession.sessionId}\nSandbox: ${params.sandboxId}\n\nUse find, click, type, etc. to interact.`,
      data: { action: "session_start", sessionId: newSession.sessionId, sandboxId: params.sandboxId, debugMode: true },
      code: "// Connected to existing sandbox - no provision code needed",
      images: shot ? [{ kind: "screenshot", base64: shot }] : undefined,
    };
  }

  progress(instanceIp ? `Connecting to self-hosted instance ${instanceIp}...` : "Connecting to cloud sandbox...");
  await sdk.connect({ reconnect: params.reconnect, keepAlive: params.keepAlive, ip: instanceIp });
  if (!(await publishSdk(c, sdk, generation))) return supersededResult();

  const instance = sdk.getInstance();
  const newSession = c.sessions.createSession({
    os: resolved.os,
    keepAlive: params.keepAlive,
    testFile: params.testFile,
  });
  c.sessions.activateSession(newSession.sessionId, instance?.instanceId || "unknown");

  const provisionOptions = getProvisionOptions(params);
  let provisionCmd = "";

  progress(`Provisioning ${params.type}...`);
  switch (params.type) {
    case "chrome":
      await sdk.provision.chrome(provisionOptions);
      provisionCmd = "provision.chrome";
      break;
    case "chromeExtension":
      await sdk.provision.chromeExtension(provisionOptions);
      provisionCmd = "provision.chromeExtension";
      break;
    case "vscode":
      await sdk.provision.vscode(provisionOptions);
      provisionCmd = "provision.vscode";
      break;
    case "installer":
      await sdk.provision.installer(provisionOptions);
      provisionCmd = "provision.installer";
      break;
    case "electron":
      await sdk.provision.electron(provisionOptions);
      provisionCmd = "provision.electron";
      break;
  }

  progress("Capturing screenshot...");
  const shot = await captureScreen(sdk);
  if (shot) c.lastScreenshotBase64 = shot;

  const debuggerUrl = instance?.debuggerUrl || (instanceIp ? `http://${instanceIp}:9222` : null);
  const connectionType = instanceIp ? `Self-hosted (${instanceIp})` : "Cloud";

  return {
    ok: true,
    text: `Session started: ${newSession.sessionId}\nConnection: ${connectionType}\nType: ${params.type}\nSandbox: ${instance?.instanceId}\nExpires in: ${Math.round(params.keepAlive / 1000)}s`,
    data: {
      action: "session_start",
      sessionId: newSession.sessionId,
      // The cloud sandbox id (`sb-…`). Surfaced so durable adapters (eve) can
      // persist it and later reconnect the singleton after a process recycle —
      // see `reconnectSession`/`ensureActiveSession` below.
      sandboxId: instance?.instanceId,
      provisionType: params.type,
      selfHosted: !!instanceIp,
      instanceIp: instanceIp || undefined,
      debuggerUrl,
    },
    code: generateActionCode(provisionCmd, provisionOptions),
    images: shot ? [{ kind: "screenshot", base64: shot }] : undefined,
  };
}

// =============================================================================
// Reconnect (durable adapters)
// =============================================================================

/**
 * Parameters needed to rebuild the singleton SDK and reconnect to a sandbox
 * that is still alive on the server but whose in-process connection was lost
 * (e.g. the host process was recycled between durable workflow steps).
 */
export interface ReconnectParams {
  /** Cloud sandbox id (`sb-…`) to reconnect to. */
  sandboxId: string;
  os: "linux" | "windows";
  keepAlive: number;
  apiKey: string;
  apiRoot?: string;
  e2bTemplateId?: string;
  /** Self-hosted instance IP, when the original session used one. */
  ip?: string;
  testFile?: string;
}

/**
 * Rebuild the process-global SDK and reconnect it to an existing sandbox by id,
 * skipping provisioning. This is the recovery path for hosts that do NOT keep a
 * single long-lived process: eve runs each turn as a durable workflow on Vercel
 * and may park or recycle the process between steps, which drops the SDK's
 * realtime connection and wipes this module's singletons. The sandbox itself can
 * still be alive on the server (the API holds it for `keepAlive`/grace), so we
 * re-`connect({ sandboxId })` and re-register a local session instead of failing
 * the action with NO_SESSION.
 *
 * Returns the (re)activated session id. Throws if the reconnect fails (the
 * sandbox is gone) — callers translate that into a SESSION_EXPIRED so the agent
 * knows to call session_start again.
 */
export async function reconnectSession(params: ReconnectParams): Promise<string> {
  const c = ctx();
  const apiRoot = params.apiRoot || process.env.TD_API_ROOT || "https://api.testdriver.ai";
  const previewMode = process.env.TD_PREVIEW || "ide";

  // Local handle + epoch, published only after connect() — see sessionStart and
  // CoreContext.sdkGeneration. This path is the one an abandoned action reaches
  // (eve stops waiting on a slow action but cannot cancel it, so the zombie keeps
  // running and calls in here), which is exactly how a stale rebuild used to land
  // on top of a newer, healthy SDK.
  const generation = ++c.sdkGeneration;
  const TestDriverSDK = (await loadTestDriverSdk()).default;
  const sdk = new TestDriverSDK(params.apiKey, {
    os: params.os,
    logging: false,
    apiRoot,
    preview: previewMode as "browser" | "ide" | "none",
    ip: params.ip,
    e2bTemplateId: params.e2bTemplateId,
  });

  // `requireSandbox` makes the SDK throw instead of quietly provisioning a
  // replacement when this sandbox is gone. The replacement would never have been
  // through `provision.*` (only `sessionStart` runs that, never this path), so a
  // "successful" reconnect would hand the agent a blank desktop and durable
  // callers would keep reconnecting to the same dead id, forking a new orphan —
  // each one holding a concurrency slot — on every park. A throw here surfaces as
  // SESSION_EXPIRED, which is what actually makes the agent re-provision.
  await sdk.connect({
    sandboxId: params.sandboxId,
    keepAlive: params.keepAlive,
    requireSandbox: true,
  });

  // Superseded: a newer rebuild already published a live SDK. Release the sandbox
  // we just attached (`publishSdk` closes it) and hand back the winner's session
  // rather than clobbering it. The session is only created on the winning path, so
  // a loser never leaves a stray "initializing" session current.
  if (!(await publishSdk(c, sdk, generation))) {
    const current = c.sessions.getCurrentSession();
    if (current && c.sessions.isSessionValid(current.sessionId)) return current.sessionId;
    throw new NoActiveSessionError(
      "SESSION_EXPIRED",
      "The sandbox connection was superseded and no active session remains. Call session_start again to create a new sandbox session."
    );
  }

  const session = c.sessions.createSession({
    os: params.os,
    keepAlive: params.keepAlive,
    testFile: params.testFile,
  });
  const instance = sdk.getInstance();
  c.sessions.activateSession(session.sessionId, instance?.instanceId || params.sandboxId);
  return session.sessionId;
}

/**
 * Ensure there is a usable session before an action, reconnecting from durable
 * state if the in-process singleton was lost. Returns true when a fresh
 * reconnect happened (the caller may want to recapture context), false when the
 * existing session was already usable.
 *
 * Durable adapters call this at the top of each tool, passing the sandbox id and
 * config they persisted at session_start. Hosts with a single long-lived process
 * (the stdio MCP server, the CLI) never persist a sandbox id, so they pass none
 * and this is a no-op — `requireActiveSession()` inside each action still guards
 * them exactly as before.
 */
export async function ensureActiveSession(params?: ReconnectParams): Promise<boolean> {
  const c = ctx();
  const session = c.sessions.getCurrentSession();
  // Already have a live SDK + valid session — nothing to do.
  if (c.sdk && session && c.sessions.isSessionValid(session.sessionId)) {
    return false;
  }
  // No durable handle to recover from — leave the (missing/expired) state as-is
  // so the action's own requireActiveSession() throws the right NO_SESSION /
  // SESSION_EXPIRED error.
  if (!params?.sandboxId) {
    return false;
  }
  try {
    await reconnectSession(params);
    return true;
  } catch (err) {
    // The sandbox is gone (server killed it after grace/disconnect cap, or the
    // id is stale). Surface a SESSION_EXPIRED so the adapter's mapper tells the
    // agent to call session_start again, instead of a raw connect error.
    c.sdk = null;
    throw new NoActiveSessionError(
      "SESSION_EXPIRED",
      `Could not reconnect to sandbox ${params.sandboxId}: ${err instanceof Error ? err.message : String(err)}. The sandbox has expired — call session_start again to create a new one.`,
      params.sandboxId
    );
  }
}

/** Disconnect the SDK (best-effort); used by adapters on cancel/teardown. */
export async function disconnect(): Promise<void> {
  try {
    await ctx().sdk?.disconnect?.();
  } catch {
    /* best effort */
  }
}

export function sessionStatus(): ActionResult {
  const c = ctx();
  const session = c.sessions.getCurrentSession();
  if (!session) {
    return { ok: false, text: "No active session", data: { error: "No active session. Call session_start first." } };
  }
  const summary = c.sessions.getSessionSummary(session.sessionId);
  return {
    ok: true,
    text: `Session: ${session.sessionId}\nStatus: ${session.status}\nTime remaining: ${Math.round((summary?.timeRemaining || 0) / 1000)}s`,
    data: { action: "session_status", ...summary, sessionId: session.sessionId, status: session.status },
  };
}

export function sessionExtend(additionalMs: number): ActionResult {
  const c = ctx();
  const session = c.sessions.getCurrentSession();
  if (!session) return { ok: false, text: "No active session", data: { action: "session_extend" } };
  c.sessions.extendSession(session.sessionId, additionalMs);
  const newExpiry = c.sessions.getTimeRemaining(session.sessionId);
  return {
    ok: true,
    text: `Session extended by ${additionalMs / 1000}s. New expiry: ${Math.round(newExpiry / 1000)}s`,
    data: { action: "session_extend", newExpiry },
  };
}

// =============================================================================
// Element location
// =============================================================================

export async function find(description: string, timeout?: number): Promise<ActionResult> {
  await requireActiveSession();
  const c = ctx();
  const element = await c.sdk.find(description, timeout ? { timeout } : undefined);
  const found = element.found();
  const coords = element.getCoordinates();

  const ref = `el-${Date.now()}`;
  if (found && coords) {
    c.elementRefs.set(ref, {
      element,
      description,
      coords: { x: coords.x, y: coords.y, centerX: coords.centerX, centerY: coords.centerY },
    });
  }

  const raw = element._response || {};
  const images: ActionImage[] = [];
  if (raw.croppedImage) {
    images.push({ kind: "cropped", base64: bareBase64(raw.croppedImage) });
  } else if (!found) {
    const shot = await captureScreen();
    if (shot) images.push({ kind: "screenshot", base64: shot });
  }
  const data = leanResponse(raw);

  return {
    ok: found,
    text: found
      ? `Found: "${description}" at (${(raw.coordinates as any)?.x}, ${(raw.coordinates as any)?.y})\nRef: ${ref}`
      : `Element not found: "${description}"`,
    data: {
      ...data,
      action: "find",
      element: found ? { description, centerX: coords?.centerX, centerY: coords?.centerY, confidence: element.confidence, ref } : undefined,
      ref,
    },
    code: found ? generateActionCode("find", { description }) : undefined,
    images: images.length ? images : undefined,
  };
}

export async function findAll(description: string, timeout?: number): Promise<ActionResult> {
  await requireActiveSession();
  const c = ctx();
  const elements = await c.sdk.findAll(description, timeout ? { timeout } : undefined);
  const count = elements.length;

  const refs: string[] = [];
  const elementInfos: Array<{ ref: string; x: number; y: number; centerX: number; centerY: number; confidence: number }> = [];
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const coords = el.getCoordinates();
    if (!coords) continue;
    const ref = `el-${Date.now()}-${i}`;
    c.elementRefs.set(ref, { element: el, description: `${description} [${i}]`, coords });
    refs.push(ref);
    elementInfos.push({ ref, x: coords.x, y: coords.y, centerX: coords.centerX, centerY: coords.centerY, confidence: el.confidence });
  }

  const raw = elements[0]?._response || {};
  const images: ActionImage[] = [];
  if (raw.croppedImage) {
    images.push({ kind: "cropped", base64: bareBase64(raw.croppedImage) });
  } else if (count === 0) {
    const shot = await captureScreen();
    if (shot) images.push({ kind: "screenshot", base64: shot });
  }
  const data = leanResponse(raw);

  return {
    ok: count > 0,
    text:
      count > 0
        ? `Found ${count} elements matching "${description}":\n${refs.map((r, i) => `  [${i}] ${r}`).join("\n")}`
        : `No elements found matching: "${description}"`,
    data: { ...data, action: "findall", count, refs, elements: elementInfos },
    code: count > 0 ? generateActionCode("findall", { description }) : undefined,
    images: images.length ? images : undefined,
  };
}

// =============================================================================
// Element interaction (require a ref from find/findall)
// =============================================================================

async function actOnRef(
  ref: string,
  verb: "click" | "double-click" | "right-click" | "hover",
  action: "click" | "hover"
): Promise<ActionResult> {
  await requireActiveSession();
  const c = ctx();
  const stored = c.elementRefs.get(ref);
  if (!stored) {
    return { ok: false, text: `Element reference "${ref}" not found. Use 'find' first to locate the element.`, data: { error: "Element reference not found" } };
  }
  const { element, description, coords } = stored;

  if (verb === "click") await element.click();
  else if (verb === "double-click") await element.doubleClick();
  else if (verb === "right-click") await element.rightClick();
  else if (verb === "hover") await element.hover();

  const shot = await captureScreen();
  if (shot) c.lastScreenshotBase64 = shot;
  const data = leanResponse(element._response);

  if (action === "hover") {
    return {
      ok: true,
      text: `Hovered over "${description}"`,
      data: { ...data, action: "hover" },
      code: generateActionCode("hover", {}),
      images: shot ? [{ kind: "screenshot", base64: shot }] : undefined,
    };
  }
  return {
    ok: true,
    text: `Clicked on "${description}"`,
    data: { ...data, action: "click", clickAction: verb, clickPosition: coords },
    code: generateActionCode("click", { action: verb }),
    images: shot ? [{ kind: "screenshot", base64: shot }] : undefined,
  };
}

export function click(ref: string, action: "click" | "double-click" | "right-click" = "click"): Promise<ActionResult> {
  return actOnRef(ref, action, "click");
}
export function hover(ref: string): Promise<ActionResult> {
  return actOnRef(ref, "hover", "hover");
}

export async function findAndClick(description: string, action: "click" | "double-click" | "right-click" = "click"): Promise<ActionResult> {
  await requireActiveSession();
  const c = ctx();
  const element = await c.sdk.find(description);
  const found = element.found();

  if (!found) {
    const raw = element._response || {};
    const images: ActionImage[] = [];
    if (raw.croppedImage) images.push({ kind: "screenshot", base64: bareBase64(raw.croppedImage) });
    else {
      const shot = await captureScreen();
      if (shot) images.push({ kind: "screenshot", base64: shot });
    }
    return {
      ok: false,
      text: `Element not found: "${description}"`,
      data: { ...leanResponse(raw), action: "find_and_click", error: "Element not found" },
      images: images.length ? images : undefined,
    };
  }

  const coords = element.getCoordinates();
  const ref = `el-${Date.now()}`;
  if (coords) c.elementRefs.set(ref, { element, description, coords });

  if (action === "click") await element.click();
  else if (action === "double-click") await element.doubleClick();
  else if (action === "right-click") await element.rightClick();

  const raw = element._response || {};
  const images: ActionImage[] = [];
  if (raw.croppedImage) images.push({ kind: "cropped", base64: bareBase64(raw.croppedImage) });
  const data = leanResponse(raw);

  return {
    ok: true,
    text: `Found and clicked: "${description}" at (${(raw.coordinates as any)?.x}, ${(raw.coordinates as any)?.y})\nRef: ${ref}`,
    data: {
      ...data,
      action: "find_and_click",
      element: coords ? { description, centerX: coords.centerX, centerY: coords.centerY, confidence: element.confidence, ref } : undefined,
      ref,
      clickAction: action,
      clickPosition: coords ? { x: coords.centerX, y: coords.centerY } : undefined,
    },
    code: generateActionCode("find_and_click", { description, action }),
    images: images.length ? images : undefined,
  };
}

// =============================================================================
// Input
// =============================================================================

export async function type(text: string, secret = false, delay?: number): Promise<ActionResult> {
  await requireActiveSession();
  await ctx().sdk.type(text, { secret, delay });
  return {
    ok: true,
    text: `Typed: ${secret ? "[secret text]" : `"${text}"`}`,
    data: { action: "type", text: secret ? "[SECRET]" : text },
    code: generateActionCode("type", { text, secret }),
  };
}

export async function pressKeys(keys: string[]): Promise<ActionResult> {
  await requireActiveSession();
  await ctx().sdk.pressKeys(keys);
  return {
    ok: true,
    text: `Pressed keys: ${keys.join(" + ")}`,
    data: { action: "press_keys", keys },
    code: generateActionCode("press_keys", { keys }),
  };
}

export async function scroll(direction: "up" | "down" | "left" | "right" = "down", amount?: number): Promise<ActionResult> {
  await requireActiveSession();
  await ctx().sdk.scroll(direction, amount ? { amount } : undefined);
  return {
    ok: true,
    text: `Scrolled ${direction}${amount ? ` by ${amount}px` : ""}`,
    data: { action: "scroll", scrollDirection: direction, direction, amount },
    code: generateActionCode("scroll", { direction, amount }),
  };
}

export async function focusApplication(name: string): Promise<ActionResult> {
  await requireActiveSession();
  await ctx().sdk.focusApplication(name);
  return {
    ok: true,
    text: `Focused application: "${name}"`,
    data: { action: "focus", name },
    code: generateActionCode("focus_application", { name }),
  };
}

export async function wait(timeout: number): Promise<ActionResult> {
  await requireActiveSession();
  await ctx().sdk.wait(timeout);
  return {
    ok: true,
    text: `Waited for ${timeout}ms`,
    data: { action: "wait", timeout },
    code: generateActionCode("wait", { timeout }),
  };
}

export async function exec(language: "sh" | "pwsh", code: string, timeout = 30000): Promise<ActionResult> {
  await requireActiveSession();
  const output = await ctx().sdk.exec(language, code, timeout);
  return {
    ok: true,
    text: `Executed ${language} code:\n${output || "(no output)"}`,
    data: { action: "exec", language, output },
    code: generateActionCode("exec", { language, code, timeout }),
  };
}

// =============================================================================
// Verification
// =============================================================================

export async function assert(assertion: string): Promise<ActionResult> {
  await requireActiveSession();
  const result = await ctx().sdk.assert(assertion);
  return {
    ok: result,
    text: result ? `✓ Assertion passed: "${assertion}"` : `✗ Assertion failed: "${assertion}"`,
    data: { action: "assert", assertion, passed: result },
    code: generateActionCode("assert", { assertion }),
  };
}

/**
 * AI analysis of the current screen vs. a "before" state. Does NOT generate
 * code. `referenceImage` (bare base64), if provided, is used as the before
 * image instead of the last captured screenshot.
 */
export async function check(task: string, referenceImage?: string): Promise<ActionResult> {
  await requireActiveSession();
  const c = ctx();
  const currentScreenshot = await c.sdk.agent.system.captureScreenBase64(1, false, true);
  const beforeScreenshot = referenceImage || c.lastScreenshotBase64 || currentScreenshot;
  c.lastScreenshotBase64 = currentScreenshot;

  const mousePosition = await c.sdk.agent.system.getMousePosition();
  const activeWindow = await c.sdk.agent.system.activeWin();

  const response = await c.sdk.agent.sdk.req("check", {
    tasks: [task],
    images: [beforeScreenshot, currentScreenshot],
    mousePosition,
    activeWindow,
  });
  const aiResponse = response.data;

  const hasCodeBlocks =
    aiResponse && (aiResponse.includes("```yml") || aiResponse.includes("```yaml") || aiResponse.includes("- command:"));
  const isComplete = !hasCodeBlocks;

  return {
    ok: isComplete,
    text: isComplete
      ? `✓ Task appears complete: "${task}"\n\nAI Analysis:\n${aiResponse}`
      : `⚠ Task may not be complete: "${task}"\n\nAI Analysis:\n${aiResponse}`,
    data: { action: "check", task, complete: isComplete, aiResponse },
    images: currentScreenshot ? [{ kind: "screenshot", base64: currentScreenshot }] : undefined,
  };
}

/** Capture a screenshot for the user (cursor visible). */
export async function screenshot(): Promise<ActionResult> {
  await requireActiveSession();
  const c = ctx();
  const shot = await c.sdk.agent.system.captureScreenBase64(1, false, true);
  if (shot) c.lastScreenshotBase64 = shot;
  return {
    ok: !!shot,
    text: shot ? "Captured screenshot" : "Failed to capture screenshot",
    data: { action: "screenshot" },
    images: shot ? [{ kind: "screenshot", base64: shot }] : undefined,
  };
}

export type { SessionState };
