/**
 * Post-spawn hook to disable Windows Defender
 * 
 * Usage in vitest.config.mjs:
 * ```js
 * setupFiles: [
 *   'testdriverai/vitest/setup',
 *   'testdriverai/vitest/setup-aws',
 *   'testdriverai/vitest/setup-disable-defender'
 * ]
 * ```
 */

import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { beforeEach } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

beforeEach(async (context) => {
  // Only run if we have an instance IP (self-hosted mode)
  if (!context.ip) return;

  // Get instance ID from global state set by setup-aws
  const instanceInfo = globalThis.__testdriverAWS?.instances?.get(context.task.id);
  if (!instanceInfo?.instanceId) {
    console.warn('[TestDriver] No instance ID found, skipping Defender disable');
    return;
  }

  const { instanceId, awsRegion } = instanceInfo;
  const scriptPath = join(__dirname, '../../setup/aws/disable-defender.sh');

  console.log(`[TestDriver] Disabling Windows Defender on ${instanceId}...`);

  try {
    execSync(`bash ${scriptPath}`, {
      encoding: 'utf-8',
      env: {
        ...process.env,
        AWS_REGION: awsRegion,
        INSTANCE_ID: instanceId,
      },
      stdio: 'inherit',
    });
  } catch (error) {
    console.warn('[TestDriver] Failed to disable Defender:', error.message);
    // Don't throw - this is optional optimization
  }
});
