/**
 * Packer AMI Integration Test
 *
 * Builds a fresh AMI via `packer build`, then runs the hover-image test suite
 * against it. This is an end-to-end validation that a newly built runner image
 * can provision a sandbox, execute commands, and interact with a browser.
 *
 * Usage:
 *   TD_API_ROOT=http://localhost:1337 \
 *   TD_API_KEY=<key> \
 *   npx vitest run examples/packer-hover-image.test.mjs
 *
 * The packer build takes ~25 minutes, and the hover-image test ~5-10 minutes,
 * so the overall test timeout is set to 60 minutes.
 *
 * Set TD_SANDBOX_AMI to skip the packer build and use an existing AMI.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";
import { getDefaults } from "../examples/config.mjs";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKER_DIR = path.resolve(__dirname, "../../runner/packer");

// 60 minute timeout for the entire suite (packer build + test)
const SUITE_TIMEOUT = 60 * 60 * 1000;

/**
 * Build a fresh AMI using packer.
 * Returns the AMI ID string (e.g. "ami-0337d8cd7cff854a4").
 */
function buildAmi() {
  console.log("[packer] Starting AMI build — this takes ~25 minutes...");
  const startTime = Date.now();

  // packer build outputs "us-east-2: ami-XXXX" on the last relevant line
  // Use -machine-readable for reliable parsing
  const output = execSync("packer build -machine-readable .", {
    cwd: PACKER_DIR,
    encoding: "utf-8",
    timeout: 45 * 60 * 1000, // 45 minute hard limit on packer
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  // Machine-readable output has lines like:
  //   timestamp,target,type,data
  //   ...,artifact,0,id,us-east-2:ami-XXXXXXXXXXXX
  const amiMatch = output.match(/,artifact,\d+,id,[\w-]+:(ami-[a-f0-9]+)/);
  if (!amiMatch) {
    // Fallback: try human-readable format
    const humanMatch = output.match(/[\w-]+:\s*(ami-[a-f0-9]+)/);
    if (!humanMatch) {
      console.error("[packer] Build output (last 2000 chars):", output.slice(-2000));
      throw new Error("Failed to extract AMI ID from packer build output");
    }
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`[packer] AMI built: ${humanMatch[1]} (${elapsed} min)`);
    return humanMatch[1];
  }

  const amiId = amiMatch[1];
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`[packer] AMI built: ${amiId} (${elapsed} min)`);
  return amiId;
}

/**
 * Deregister an AMI and delete its backing snapshot.
 * Best-effort — failures are logged but don't fail the test.
 */
function cleanupAmi(amiId) {
  if (!amiId) return;
  try {
    console.log(`[cleanup] Deregistering AMI ${amiId}...`);
    // Get snapshot IDs before deregistering
    const describeOutput = execSync(
      `aws ec2 describe-images --image-ids ${amiId} --query "Images[0].BlockDeviceMappings[*].Ebs.SnapshotId" --output text`,
      { encoding: "utf-8", timeout: 15000 },
    ).trim();

    execSync(`aws ec2 deregister-image --image-id ${amiId}`, {
      timeout: 15000,
    });

    // Delete backing snapshots
    if (describeOutput && describeOutput !== "None") {
      for (const snapId of describeOutput.split(/\s+/)) {
        if (snapId.startsWith("snap-")) {
          console.log(`[cleanup] Deleting snapshot ${snapId}...`);
          execSync(`aws ec2 delete-snapshot --snapshot-id ${snapId}`, {
            timeout: 15000,
          });
        }
      }
    }
    console.log(`[cleanup] AMI ${amiId} cleaned up`);
  } catch (err) {
    console.warn(`[cleanup] Failed to clean up AMI ${amiId}: ${err.message}`);
  }
}

// ── Hover-Image login helper ─────────────────────────────────────────────

async function performLogin(client, username = "standard_user") {
  await client.focusApplication("Google Chrome");
  const password = await client.extract("the password");
  const usernameField = await client.find("username input");
  await usernameField.click();
  await client.type(username);
  await client.pressKeys(["tab"]);
  await client.type(password, { secret: true });
  await client.pressKeys(["tab"]);
  await client.pressKeys(["enter"]);
}

// ── Test Suite ───────────────────────────────────────────────────────────

describe("Packer AMI → Hover Image", { timeout: SUITE_TIMEOUT }, () => {
  let amiId;
  let builtAmi = false;

  beforeAll(() => {
    // If TD_SANDBOX_AMI is set, skip the packer build
    if (process.env.TD_SANDBOX_AMI) {
      amiId = process.env.TD_SANDBOX_AMI;
      console.log(`[packer] Using existing AMI: ${amiId}`);
    } else {
      amiId = buildAmi();
      builtAmi = true;
    }
  });

  afterAll(() => {
    // Only clean up AMIs we built (don't delete pre-existing ones)
    if (builtAmi && amiId && process.env.TD_PACKER_CLEANUP !== "false") {
      cleanupAmi(amiId);
    }
  });

  it(
    "should click on shopping cart icon and verify empty cart",
    { timeout: SUITE_TIMEOUT },
    async (context) => {
      const testdriver = TestDriver(context, {
        ...getDefaults(context),
        os: "windows",
        sandboxAmi: amiId,
      });

      // Provision Chrome on the freshly-built AMI
      await testdriver.provision.chrome({
        url: "http://testdriver-sandbox.vercel.app/login",
      });

      // Perform login
      await performLogin(testdriver);

      // Click on the shopping cart icon
      await testdriver.focusApplication("Google Chrome");
      const cartIcon = await testdriver.find(
        "shopping cart icon next to the Cart text in the top right corner",
      );
      await cartIcon.click();

      // Assert that you see an empty shopping cart
      const result = await testdriver.assert("Your cart is empty");
      expect(result).toBeTruthy();
    },
  );
});
