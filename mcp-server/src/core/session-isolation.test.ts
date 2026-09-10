/**
 * Regression cover for cross-session sandbox adoption.
 *
 * Observed in an `eve dev` log: session A provisioned `sb-725a91b9`, then a
 * later, unrelated session B called `session_start` and got
 * `warm_noop {sandboxId: "sb-725a91b9"}` — B adopted A's sandbox, drove A's
 * browser, and then ended it. The cause was every eve session sharing mcp-core's
 * ONE global context on a long-lived host.
 *
 * These tests pin the property eve now relies on: state keyed to a context is
 * invisible to another context, and the epoch that drives SESSION_SUPERSEDED is
 * per-context rather than shared.
 */

import { describe, it, expect } from "vitest";
import { createIsolatedContext, hasLiveSession, runInContext, type CoreContext } from "./actions.js";

/** A context that looks exactly like one holding a live, provisioned sandbox. */
function contextWithLiveSandbox(sandboxId: string): CoreContext {
  const c = createIsolatedContext();
  c.sdk = { connected: true };
  const session = c.sessions.createSession({ os: "linux", keepAlive: 60_000 });
  c.sessions.activateSession(session.sessionId, sandboxId);
  return c;
}

describe("per-session context isolation", () => {
  it("does not show one session's live sandbox to another session", () => {
    // The exact adoption bug: B must NOT see A's sandbox as its own warm session.
    const a = contextWithLiveSandbox("sb-725a91b9");
    const b = createIsolatedContext();

    expect(runInContext(a, () => hasLiveSession())).toBe(true);
    expect(runInContext(b, () => hasLiveSession())).toBe(false);
  });

  it("keeps each session's sandbox id to itself", () => {
    const a = contextWithLiveSandbox("sb-aaa");
    const b = contextWithLiveSandbox("sb-bbb");

    const idIn = (c: CoreContext) =>
      runInContext(c, () => c.sessions.getCurrentSession()?.sandboxId);

    expect(idIn(a)).toBe("sb-aaa");
    expect(idIn(b)).toBe("sb-bbb");
  });

  it("does not let one session's provision bump another's SDK epoch", () => {
    // Shared epochs are why two concurrent sessions could each supersede the
    // other's publish and neither could ever win — the SESSION_SUPERSEDED loop.
    const a = createIsolatedContext();
    const b = createIsolatedContext();
    const bEpochBefore = b.sdkGeneration;

    runInContext(a, () => {
      a.sdkGeneration++;
    });

    expect(b.sdkGeneration).toBe(bEpochBefore);
  });

  it("does not leak element refs across sessions", () => {
    const a = createIsolatedContext();
    const b = createIsolatedContext();

    a.elementRefs.set("el-1", {
      element: {},
      description: "login button",
      coords: { x: 1, y: 2, centerX: 1, centerY: 2 },
    });

    expect(b.elementRefs.has("el-1")).toBe(false);
  });
});
