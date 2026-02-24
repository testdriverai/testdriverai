/**
 * Thread-safe global state for AWS instance management.
 *
 * Under pool:"threads", each worker thread has its own globalThis but shares
 * the same process. This module provides a single idempotent initializer that
 * both setup-aws.mjs and setup-self-hosted.mjs call, preventing one from
 * clobbering the other's instance map.
 *
 * Under pool:"forks", each fork has its own globalThis AND its own process,
 * so this is also safe.
 */

import { execSync } from "child_process";

/**
 * Idempotently create and return the globalThis.__testdriverAWS object.
 * Preserves any existing instances Map entries if already initialized.
 *
 * @param {Map} [localInstances] - Optional local instances Map to merge
 * @returns {{ instances: Map, terminateInstance: (testId: string) => Promise<void> }}
 */
export function ensureAWSGlobal(localInstances) {
  if (globalThis.__testdriverAWS) {
    // Already initialized — merge local instances if provided
    if (localInstances) {
      for (const [key, value] of localInstances.entries()) {
        globalThis.__testdriverAWS.instances.set(key, value);
      }
    }
    return globalThis.__testdriverAWS;
  }

  const instances = localInstances || new Map();

  globalThis.__testdriverAWS = {
    instances,

    /**
     * Terminate the AWS instance for a given test ID.
     * Called by hooks.mjs onTestFinished cleanup after dashcam.stop() completes.
     */
    async terminateInstance(testId) {
      const instanceInfo = instances.get(testId);
      if (!instanceInfo) {
        return; // No instance was spawned for this test
      }

      const { instanceId, awsRegion } = instanceInfo;

      console.log(`[TestDriver] Terminating AWS instance: ${instanceId}`);

      try {
        execSync(
          `aws ec2 terminate-instances --region "${awsRegion}" --instance-ids "${instanceId}"`,
          {
            encoding: "utf-8",
            env: process.env,
            stdio: "inherit",
          },
        );

        console.log(`[TestDriver] Instance terminated: ${instanceId}`);
      } catch (error) {
        console.error(
          "[TestDriver] Failed to terminate instance:",
          error.message,
        );
        // Don't throw - we don't want to fail the test because of cleanup issues
      } finally {
        instances.delete(testId);
      }
    },
  };

  return globalThis.__testdriverAWS;
}

/**
 * Emergency cleanup: terminate all tracked instances.
 * Used by afterAll() hooks as a safety net.
 * Does NOT call process.exit() — let Vitest handle shutdown.
 */
export function cleanupAllInstances() {
  const awsGlobal = globalThis.__testdriverAWS;
  if (!awsGlobal || awsGlobal.instances.size === 0) {
    return;
  }

  console.log(
    `[TestDriver] Cleanup: terminating ${awsGlobal.instances.size} remaining instance(s)`,
  );

  for (const [testId, instanceInfo] of awsGlobal.instances.entries()) {
    const { instanceId, awsRegion } = instanceInfo;

    try {
      console.log(`[TestDriver] Terminating instance: ${instanceId}`);
      execSync(
        `aws ec2 terminate-instances --region "${awsRegion}" --instance-ids "${instanceId}"`,
        {
          encoding: "utf-8",
          stdio: "inherit",
        },
      );
    } catch (error) {
      console.error(
        `[TestDriver] Failed to terminate instance ${instanceId}:`,
        error.message,
      );
    }
  }

  awsGlobal.instances.clear();
}
