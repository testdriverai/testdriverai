/**
 * Thread-safe global for AWS instance management.
 *
 * Both setup-aws.mjs and setup-self-hosted.mjs need to share a
 * `globalThis.__testdriverAWS` object so that hooks.mjs can call
 * `terminateInstance(testId)` after dashcam.stop() completes.
 *
 * Under pool:"threads", each worker thread has its own `globalThis`,
 * so this doesn't leak across threads. Under pool:"forks", each forked
 * process has its own `globalThis` too.
 *
 * This module is the single source of truth for creating and accessing
 * that global, replacing the inline assignments that previously existed
 * in both setup files.
 */

import { execSync } from "child_process";

/**
 * Ensure `globalThis.__testdriverAWS` exists, creating it if necessary.
 * Idempotent — safe to call from both setup-aws and setup-self-hosted
 * in the same worker.
 *
 * @param {Map} localInstances - The per-file testInstances Map to attach
 * @returns {typeof globalThis.__testdriverAWS}
 */
export function ensureAWSGlobal(localInstances) {
  if (!globalThis.__testdriverAWS) {
    globalThis.__testdriverAWS = {
      instances: localInstances,

      /**
       * Terminate the instance for a given test ID.
       * Called by hooks.mjs after dashcam.stop() completes.
       */
      async terminateInstance(testId) {
        const instanceInfo = localInstances.get(testId);
        if (!instanceInfo) return;

        const { instanceId, awsRegion } = instanceInfo;
        console.log(`[TestDriver] Terminating AWS instance: ${instanceId}`);

        try {
          execSync(
            `aws ec2 terminate-instances --region "${awsRegion}" --instance-ids "${instanceId}"`,
            { encoding: "utf-8", env: process.env, stdio: "inherit" },
          );
          console.log(`[TestDriver] Instance terminated: ${instanceId}`);
        } catch (error) {
          console.error(
            "[TestDriver] Failed to terminate instance:",
            error.message,
          );
        } finally {
          localInstances.delete(testId);
        }
      },
    };
  }

  return globalThis.__testdriverAWS;
}

/**
 * Emergency cleanup — terminate every tracked instance.
 * Called from afterAll() hooks in setup-aws / setup-self-hosted.
 *
 * Does NOT call process.exit() — let Vitest handle shutdown.
 * Under pool:"threads", calling process.exit() from a worker would kill
 * every thread in the process.
 */
export function cleanupAllInstances() {
  const aws = globalThis.__testdriverAWS;
  if (!aws || !aws.instances || aws.instances.size === 0) return;

  console.log(
    `[TestDriver] Emergency cleanup: terminating ${aws.instances.size} instance(s)`,
  );

  for (const [, instanceInfo] of aws.instances.entries()) {
    const { instanceId, awsRegion } = instanceInfo;
    try {
      console.log(`[TestDriver] Terminating instance: ${instanceId}`);
      execSync(
        `aws ec2 terminate-instances --region "${awsRegion}" --instance-ids "${instanceId}"`,
        { encoding: "utf-8", stdio: "inherit" },
      );
    } catch (error) {
      console.error(
        `[TestDriver] Failed to terminate instance ${instanceId}:`,
        error.message,
      );
    }
  }

  aws.instances.clear();
}
