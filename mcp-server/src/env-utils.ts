/**
 * Utilities for resolving TestDriver environment variables.
 *
 * These helpers centralise the "param > env var > default" fallback logic
 * so the server handler stays clean and the logic can be unit-tested
 * independently.
 */

// ============================================================
// OS resolution
// ============================================================

const VALID_OS_VALUES = ["linux", "windows"] as const;
export type SandboxOs = (typeof VALID_OS_VALUES)[number];

/**
 * Resolve the sandbox OS with the following priority:
 *   1. Explicit `os` parameter passed to session_start
 *   2. `TD_OS` environment variable (validated against supported values)
 *   3. `"linux"` default
 *
 * Mirrors the behaviour in `hooks.mjs` so the MCP server and the
 * Vitest integration are consistent.
 *
 * @param explicitOs - The value passed explicitly by the caller (may be undefined)
 * @param env        - The environment variables map (defaults to `process.env`)
 * @returns          - The resolved OS and a warning message if TD_OS was invalid
 */
export function resolveOs(
  explicitOs: SandboxOs | undefined,
  env: NodeJS.ProcessEnv = process.env,
): { os: SandboxOs; warning?: string } {
  if (explicitOs) {
    return { os: explicitOs };
  }

  const envOs = env.TD_OS;
  if (envOs) {
    if ((VALID_OS_VALUES as readonly string[]).includes(envOs)) {
      return { os: envOs as SandboxOs };
    }
    return {
      os: "linux",
      warning: `TD_OS has unsupported value "${envOs}" (supported: ${VALID_OS_VALUES.join(", ")}), ignoring`,
    };
  }

  return { os: "linux" };
}

// ============================================================
// E2B template ID resolution
// ============================================================

/**
 * Resolve the E2B template ID with the following priority:
 *   1. Explicit `e2bTemplateId` parameter passed to session_start
 *   2. `TD_E2B_TEMPLATE_ID` environment variable
 *   3. `undefined` (let the SDK use its own default)
 *
 * Mirrors the behaviour in `hooks.mjs`:
 *   ```js
 *   if (!config.e2bTemplateId && process.env.TD_E2B_TEMPLATE_ID) {
 *     config.e2bTemplateId = process.env.TD_E2B_TEMPLATE_ID;
 *   }
 *   ```
 *
 * @param explicitId - The value passed explicitly by the caller (may be undefined)
 * @param env        - The environment variables map (defaults to `process.env`)
 * @returns          - The resolved template ID, or undefined if none is set
 */
export function resolveE2bTemplateId(
  explicitId: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return explicitId || env.TD_E2B_TEMPLATE_ID;
}
