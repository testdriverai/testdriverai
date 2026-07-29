/**
 * Unit tests for env-utils.ts
 *
 * Verifies that the OS and E2B template ID resolution helpers apply the
 * correct priority order:
 *   explicit param  >  environment variable  >  built-in default
 */

import { describe, it, expect } from "vitest";
import { resolveOs, resolveE2bTemplateId } from "./env-utils.js";

// ---------------------------------------------------------------------------
// resolveOs
// ---------------------------------------------------------------------------

describe("resolveOs", () => {
  it("returns the explicit param when provided", () => {
    const { os } = resolveOs("windows", { TD_OS: "linux" });
    expect(os).toBe("windows");
  });

  it("falls back to TD_OS env var when no explicit param is given", () => {
    const { os } = resolveOs(undefined, { TD_OS: "windows" });
    expect(os).toBe("windows");
  });

  it("defaults to linux when neither param nor TD_OS is set", () => {
    const { os } = resolveOs(undefined, {});
    expect(os).toBe("linux");
  });

  it("returns linux and a warning when TD_OS has an unsupported value", () => {
    const { os, warning } = resolveOs(undefined, { TD_OS: "mac" });
    expect(os).toBe("linux");
    expect(warning).toMatch(/unsupported/i);
    expect(warning).toContain("mac");
  });

  it("returns linux and a warning when TD_OS is 'Linux' (wrong case)", () => {
    const { os, warning } = resolveOs(undefined, { TD_OS: "Linux" });
    expect(os).toBe("linux");
    expect(warning).toBeDefined();
  });

  it("explicit param takes priority over TD_OS env var", () => {
    const { os, warning } = resolveOs("linux", { TD_OS: "windows" });
    expect(os).toBe("linux");
    expect(warning).toBeUndefined();
  });

  it("returns no warning when TD_OS is valid", () => {
    const { os, warning } = resolveOs(undefined, { TD_OS: "windows" });
    expect(os).toBe("windows");
    expect(warning).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveE2bTemplateId
// ---------------------------------------------------------------------------

describe("resolveE2bTemplateId", () => {
  it("returns the explicit param when provided", () => {
    const id = resolveE2bTemplateId("explicit-id", { TD_E2B_TEMPLATE_ID: "env-id" });
    expect(id).toBe("explicit-id");
  });

  it("falls back to TD_E2B_TEMPLATE_ID env var when no explicit param is given", () => {
    const id = resolveE2bTemplateId(undefined, { TD_E2B_TEMPLATE_ID: "env-id" });
    expect(id).toBe("env-id");
  });

  it("returns undefined when neither param nor TD_E2B_TEMPLATE_ID is set", () => {
    const id = resolveE2bTemplateId(undefined, {});
    expect(id).toBeUndefined();
  });

  it("explicit param takes priority over TD_E2B_TEMPLATE_ID env var", () => {
    const id = resolveE2bTemplateId("my-template", { TD_E2B_TEMPLATE_ID: "other-template" });
    expect(id).toBe("my-template");
  });
});
