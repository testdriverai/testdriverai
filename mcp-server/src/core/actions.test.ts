/**
 * Unit tests for the session-liveness predicate.
 *
 * Regression cover for the "SDK is not connected. Call connect() first." cascade:
 * `hasLiveSession()` used to answer `!!c.sdk && session valid`, which accepted
 *   - an SDK whose `connect()` was still in flight (`connected === false`), and
 *   - a session still in its `initializing` status (`isSessionValid()` only
 *     rejects `expired`/`error`).
 *
 * Both are reachable whenever a rebuild is racing an in-flight action, and either
 * one made eve's `session_start` take its warm no-op path over a connection that
 * could not serve a single command.
 */

import { describe, it, expect } from "vitest";
import { clearSession, createIsolatedContext, hasLiveSession, runInContext, type CoreContext } from "./actions.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A context holding `sdk`, with a session that is active unless told otherwise. */
function contextWith(sdk: unknown, opts: { activate?: boolean } = {}): CoreContext {
  const c = createIsolatedContext();
  c.sdk = sdk;
  const session = c.sessions.createSession({ os: "linux", keepAlive: 60_000 });
  if (opts.activate !== false) c.sessions.activateSession(session.sessionId, "sb-test");
  return c;
}

const live = (c: CoreContext) => runInContext(c, () => hasLiveSession());

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("hasLiveSession", () => {
  it("accepts a connected SDK on an active session", () => {
    expect(live(contextWith({ connected: true }))).toBe(true);
  });

  it("rejects an SDK whose connect() has not resolved yet", () => {
    // The half-built handle: the object exists, so the old `!!c.sdk` said "live",
    // but every command would throw from _ensureConnected().
    expect(live(contextWith({ connected: false }))).toBe(false);
  });

  it("rejects a session that was created but never activated", () => {
    // status stays "initializing" — which isSessionValid() deliberately accepts.
    expect(live(contextWith({ connected: true }, { activate: false }))).toBe(false);
  });

  it("rejects when there is no SDK at all", () => {
    expect(live(contextWith(null))).toBe(false);
  });

  it("rejects an expired session even with a connected SDK", () => {
    const c = createIsolatedContext();
    c.sdk = { connected: true };
    const session = c.sessions.createSession({ os: "linux", keepAlive: -1 });
    c.sessions.activateSession(session.sessionId, "sb-test");
    expect(live(c)).toBe(false);
  });

  it("does not throw on a hostile/exotic sdk handle", () => {
    // The predicate must fail safe (unusable → "not live"), never propagate.
    const hostile = {
      get connected(): boolean {
        throw new Error("boom");
      },
    };
    expect(() => live(contextWith(hostile))).not.toThrow();
    expect(live(contextWith(hostile))).toBe(false);
  });
});

describe("clearSession", () => {
  it("stops reporting a live session once the sandbox is released", () => {
    // session_end's shape: sandbox.close() leaves sdk.connected true and the
    // session 'active', so only clearSession() can make the context honest.
    const c = contextWith({ connected: true });
    expect(live(c)).toBe(true);

    runInContext(c, () => clearSession());

    expect(live(c)).toBe(false);
    expect(c.sdk).toBeNull();
    expect(c.sessions.getCurrentSession()).toBeNull();
  });

  it("bumps the epoch so an in-flight build can no longer publish", () => {
    const c = contextWith({ connected: true });
    const before = c.sdkGeneration;
    runInContext(c, () => clearSession());
    expect(c.sdkGeneration).toBeGreaterThan(before);
  });

  it("is safe to call with no session at all", () => {
    const c = createIsolatedContext();
    expect(() => runInContext(c, () => clearSession())).not.toThrow();
    expect(live(c)).toBe(false);
  });
});

describe("createIsolatedContext", () => {
  it("starts at generation 0 so the first build wins its epoch", () => {
    expect(createIsolatedContext().sdkGeneration).toBe(0);
  });

  it("gives each context its own SessionManager", () => {
    const a = createIsolatedContext();
    const b = createIsolatedContext();
    a.sessions.createSession({ os: "linux", keepAlive: 60_000 });
    expect(a.sessions.getCurrentSession()).not.toBeNull();
    expect(b.sessions.getCurrentSession()).toBeNull();
  });
});
