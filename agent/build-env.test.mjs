/**
 * Regression cover for the silent sandbox substitution in `buildEnv`.
 *
 * `connect({ sandboxId })` used to treat "attach to this sandbox" as a hint: if
 * the reconnect threw, it swallowed the error and provisioned a brand-new
 * sandbox in its place, then resolved as success. That is right for the CLI
 * (`reconnect: true` means "reattach to my last sandbox, else make one") and
 * catastrophic for a durable adapter.
 *
 * The eve agent parks between every tool call, which drops the realtime socket;
 * on resume it reconnects by sandbox id. When that reconnect quietly forked a
 * fresh sandbox, the replacement had never been through `provision.*` — those
 * only run at session start, never on a reconnect — so the agent got a blank
 * desktop reported as "reconnected, state preserved". It could not recover,
 * either: the durable handle still held the dead id, so the next park forked
 * another orphan, each one pinning a team concurrency slot until reaped.
 *
 * So: `requireSandbox` callers must see the failure, and the CLI's forgiving
 * behavior must not change.
 */

import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const TestDriverAgent = require("./index.js");

const NEW_SANDBOX_ID = "sb-brand-new-blank";

/**
 * A minimal `this` for `buildEnv` — it only touches the collaborators stubbed
 * here. Returns the fake plus a record of which provisioning path it took.
 */
function fakeAgent({ sandboxId, connectFails = false, CI = false }) {
  const calls = { connectToSandboxDirect: 0, createNewSandbox: 0 };
  const self = {
    instance: null,
    sandboxId,
    newSandbox: false,
    keepAlive: 900_000,
    ip: null,
    config: { CI, TD_RESOLUTION: [1366, 768] },
    emitter: { emit() {} },
    sandbox: { setConnectionParams() {}, async send() {} },
    async newSession() {},
    async connectToSandboxService() {},
    async renderSandbox() {},
    async runLifecycle() {},
    async connectToSandboxDirect(id) {
      calls.connectToSandboxDirect++;
      if (connectFails) throw new Error("sandbox is gone (reaped)");
      return { instanceId: id, sandboxId: id, url: "https://sandbox.example" };
    },
    async createNewSandbox() {
      calls.createNewSandbox++;
      return { sandbox: { sandboxId: NEW_SANDBOX_ID, url: "https://new.example" } };
    },
  };
  return { self, calls };
}

const buildEnv = (self, options) =>
  TestDriverAgent.prototype.buildEnv.call(self, options);

describe("buildEnv({ requireSandbox: true })", () => {
  it("throws instead of substituting a fresh sandbox when the target is gone", async () => {
    const { self, calls } = fakeAgent({ sandboxId: "sb-dead", connectFails: true });

    await expect(buildEnv(self, { requireSandbox: true })).rejects.toThrow(
      /Failed to reconnect to sandbox sb-dead/,
    );

    // The whole point: no blank replacement was provisioned behind the caller's back.
    expect(calls.createNewSandbox).toBe(0);
    expect(self.instance).toBeNull();
  });

  it("preserves the underlying failure as the error cause", async () => {
    const { self } = fakeAgent({ sandboxId: "sb-dead", connectFails: true });

    const err = await buildEnv(self, { requireSandbox: true }).catch((e) => e);

    expect(err.cause).toBeInstanceOf(Error);
    expect(err.cause.message).toBe("sandbox is gone (reaped)");
  });

  it("attaches to the requested sandbox when it is alive", async () => {
    const { self, calls } = fakeAgent({ sandboxId: "sb-live" });

    await buildEnv(self, { requireSandbox: true });

    expect(self.instance.sandboxId).toBe("sb-live");
    expect(calls.createNewSandbox).toBe(0);
  });

  it("reconnects even under CI, which otherwise forces a new sandbox", async () => {
    // CI normally sets createNew and nulls sandboxId, which would skip the
    // reconnect entirely and hand back a blank sandbox — the same failure by a
    // different route. An explicit reconnect request has to win.
    const { self, calls } = fakeAgent({ sandboxId: "sb-live", CI: true });

    await buildEnv(self, { requireSandbox: true });

    expect(self.instance.sandboxId).toBe("sb-live");
    expect(calls.createNewSandbox).toBe(0);
  });

  it("rejects a strict reconnect with no sandbox to reconnect to", async () => {
    const { self, calls } = fakeAgent({ sandboxId: null });

    await expect(buildEnv(self, { requireSandbox: true })).rejects.toThrow(
      /requires a sandboxId/,
    );
    expect(calls.createNewSandbox).toBe(0);
  });
});

describe("buildEnv default (CLI reconnect-or-create) is unchanged", () => {
  it("falls through to a new sandbox when the last one is gone", async () => {
    const { self, calls } = fakeAgent({ sandboxId: "sb-dead", connectFails: true });

    await buildEnv(self, {});

    expect(calls.connectToSandboxDirect).toBe(1);
    expect(calls.createNewSandbox).toBe(1);
    expect(self.instance.sandboxId).toBe(NEW_SANDBOX_ID);
  });

  it("reconnects when the last sandbox is alive", async () => {
    const { self, calls } = fakeAgent({ sandboxId: "sb-live" });

    await buildEnv(self, {});

    expect(self.instance.sandboxId).toBe("sb-live");
    expect(calls.createNewSandbox).toBe(0);
  });

  it("creates a new sandbox under CI", async () => {
    const { self, calls } = fakeAgent({ sandboxId: "sb-live", CI: true });

    await buildEnv(self, {});

    expect(calls.connectToSandboxDirect).toBe(0);
    expect(calls.createNewSandbox).toBe(1);
  });
});
