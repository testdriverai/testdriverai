import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  addDashcamLog,
  authDashcam,
  createTestClient,
  launchChrome,
  setupTest,
  startDashcam,
  stopDashcam,
  teardownTest,
  waitForPage,
} from "./setup/testHelpers.mjs";

describe.sequential("Type Test", () => {
  let testdriver;

  beforeAll(async () => {
    testdriver = createTestClient({ task: { id: "type-test-suite" } });
    await setupTest(testdriver, { prerun: false }); // Skip prerun, we'll handle dashcam manually

    // One-time dashcam setup (auth and add logs)
    await authDashcam(testdriver);
    await addDashcamLog(testdriver);
    await launchChrome(testdriver);
    await waitForPage(testdriver, "TestDriver.ai Sandbox");
  });

  beforeEach(async () => {
    await startDashcam(testdriver);
  }, 60000);

  afterEach(async (context) => {
    // Stop dashcam first to get the URL
    const dashcamUrl = await stopDashcam(testdriver);
    console.log("📤 Dashcam URL:", dashcamUrl);

    // Use teardownTest to track results, but skip postrun (already stopped dashcam) and disconnect
    await teardownTest(testdriver, {
      task: context.task,
      dashcamUrl: dashcamUrl, // Pass the dashcam URL we already got
      postrun: false, // Skip postrun since we manually stopped dashcam
      disconnect: false, // Don't disconnect, we'll do that in afterAll
    });
  });

  afterAll(async () => {
    await testdriver.disconnect();
  });

  it("should enter standard_user in username field", async () => {
    await testdriver.focusApplication("Google Chrome");
    const usernameField = await testdriver.find(
      "Username, input field for username",
    );
    await usernameField.click();
    await testdriver.type("standard_user");

    const result = await testdriver.assert(
      'the username field contains "standard_user"',
    );
    expect(result).toBeTruthy();
  });

  it("should show validation message when clicking Sign In without password", async () => {
    const signInButton = await testdriver.find(
      "Sign in, black button below the password field",
    );
    await signInButton.click();

    await testdriver.focusApplication("Google Chrome");
    const result = await testdriver.assert(
      "Please fill out this field is visible near the password field",
    );
    expect(result).toBeTruthy();
  });
});
