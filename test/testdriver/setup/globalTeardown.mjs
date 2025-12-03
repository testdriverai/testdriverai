/**
 * Vitest Global Teardown
 * Saves test results and dashcam URLs after all tests complete
 */

import { saveTestResults } from "./testHelpers.mjs";

export default async function globalTeardown() {
  console.log("\n🎬 Saving test results and dashcam URLs...");
  saveTestResults();
}
