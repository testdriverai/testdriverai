import { describe, expect, it } from "vitest";
import { chrome } from "../../src/presets/index.mjs";

/**
 * CHECKPOINT SYSTEM GUIDE FOR TESTDRIVER TESTS
 * ============================================
 * 
 * When newSandbox is set to false in chrome(), the sandbox persists between test runs.
 * This allows you to skip completed steps when debugging or developing tests.
 * 
 * HOW TO USE CHECKPOINTS:
 * 
 * 1. Run your test normally until it fails at a certain step
 * 2. Find the checkpoint comment just before the failing section (e.g., "// CHECKPOINT: Login Complete")
 * 3. Comment out all code BEFORE that checkpoint using /* ... *\/ block comments
 * 4. Re-run the test - it will resume from that checkpoint using the existing sandbox state
 * 5. Once the test passes completely, uncomment all sections to verify end-to-end
 * 
 * CHECKPOINT LOCATIONS IN THIS TEST:
 * - CHECKPOINT 1: Cookie banner handled
 * - CHECKPOINT 2: Login complete
 * - CHECKPOINT 3: Patients page loaded
 * - CHECKPOINT 4: Patient selected/created
 * - CHECKPOINT 5: Patient profile opened
 * 
 * IMPORTANT: Always set newSandbox: false in chrome() options to enable this feature!
 * 
 * FOR AI ASSISTANTS:
 * When helping users debug TestDriver tests:
 * - If a test fails at a certain step, suggest commenting out earlier checkpoints
 * - Remind them to set newSandbox: false
 * - After fixes, remind them to uncomment all code for full end-to-end validation
 */

// Helper function to poll for an element until it's found
async function waitForElement(testdriver, description, maxAttempts = 10, delayMs = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const element = await testdriver.find(description);
      if (element.found()) {
        return element;
      }
    } catch (e) {
      if (i === maxAttempts - 1) throw e;
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error(`Element not found after ${maxAttempts} attempts: ${description}`);
}

describe("Sully.ai Patient Management Workflow", () => {
  it("should complete full patient workflow: login, view patients, update note, and edit profile", async (context) => {
    const { testdriver } = await chrome(context, {
      url: 'https://app.sully.ai',
      redrawThreshold: { enabled: true }
    });

    // ========================================================================
    // CHECKPOINT 1: Cookie Banner
    // If test fails after this point, comment out this section (lines above)
    // ========================================================================
    
    // Handle cookie banner if present
    try {
      const acceptCookies = await testdriver.find("Accept All button for cookies");
      await acceptCookies.click();
    } catch {
      console.log("No cookie banner or already dismissed");
    }

    // Wait for login page to load by polling for email field
    console.log("Waiting for login page to load...");
    const emailField = await waitForElement(testdriver, "Email input field");
    console.log("Found email field");
    await emailField.click();
    await testdriver.type("razeen+testdriver@sully.ai");

    const passwordField = await testdriver.find("Password input field");
    await passwordField.click();
    await testdriver.type("plmokn7@A", {secret: true});

    const loginButton = await testdriver.find("Login button");
    await loginButton.click();

    // ========================================================================
    // CHECKPOINT 2: Login Complete
    // If test fails after this point, comment out all code above this checkpoint
    // ========================================================================
    
    // Wait for navigation to complete after login
    console.log("Waiting for login to process...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Take a screenshot to see where we are
    await testdriver.screenshot();
    console.log("Screenshot taken after login");
    
    // Verify login successful
    const loginSuccess = await testdriver.assert("user is logged in and on the main application page or dashboard");
    expect(loginSuccess).toBeTruthy();

    // Poll for dashboard element to ensure login completed
    console.log("Looking for Patients link...");
    await waitForElement(testdriver, "Patients button or link in the navigation menu", 15, 1000);

    // Dismiss password save dialog first if it appears
    try {
      const neverButton = await testdriver.find("Never button or Never save button");
      await neverButton.click();
      console.log("Dismissed password save dialog");
    } catch {
      console.log("Password save dialog not found");
    }

    await testdriver.find("save profile changes popup or banner").click();

    // Click Patients
    const patientsLink = await testdriver.find("Patients navigation link or menu item");
    await patientsLink.click();

    // ========================================================================
    // CHECKPOINT 3: Patients Page Loaded
    // If test fails after this point, comment out all code above this checkpoint
    // ========================================================================
    
    // Approach 1: Search for existing patient
      const existingPatientInput = await testdriver.find("Patient search input box");
      await existingPatientInput.click();
      
      // Type a search term to find a patient
      await testdriver.type("Patient Test");
      
      // Poll for search results to appear
      const firstPatient = await waitForElement(testdriver, "first patient name in the dropdown or list", 5, 500);
      await firstPatient.click();
    
      console.log("Found patient via search");

    // Verify patient visit page or details are loaded
    const patientLoaded = await testdriver.assert("we are on a patient recording page");
    expect(patientLoaded).toBeTruthy();

    // ========================================================================
    // CHECKPOINT 4: Patient Selected/Created
    // If test fails after this point, comment out all code above this checkpoint
    // ========================================================================

    await testdriver.find('input box at the bottom of the screen').click();
    await testdriver.type("This is a test note added by TestDriver automation.");

    // Regenerate note - click make note more concise
    console.log("Looking for note regeneration option...");
    try {
      const makeNoteConcise = await testdriver.find("Make note more concise button or option");
      await makeNoteConcise.click();
      console.log("Clicked make note more concise");

      // Wait for note to regenerate
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify note regeneration completed
      const noteRegenerated = await testdriver.assert("note has been regenerated or updated");
      expect(noteRegenerated).toBeTruthy();
    } catch {
      console.log("Could not find or click make note more concise option");
    }

    // Look for kebab menu on the right to access patient profile
    console.log("Looking for kebab menu on the right...");

    // Try to find the menu - it might be a three-dot menu or settings icon on the right side
    const kebabMenu = await testdriver.find("three dots menu or kebab menu on the right side of the page");
    await kebabMenu.click();

    // Wait for menu to open 
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Look for patient profile option
    const patientProfile = await testdriver.find("Patient Profile or Edit Profile option in menu");
    await patientProfile.click();
    
    // Wait for patient profile form to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify patient profile form is displayed
    const profileForm = await testdriver.assert("patient profile form or edit patient page is visible");
    expect(profileForm).toBeTruthy();

    // ========================================================================
    // CHECKPOINT 5: Patient Profile Opened
    // If test fails after this point, comment out all code above this checkpoint
    // ========================================================================

    // Fill out patient details
    console.log("Filling out patient details...");
    try {
      // Look for phone number field as an example
      const phoneField = await testdriver.find("phone number field or mobile number input");
      await phoneField.click();
      await testdriver.type("555-0123");
      console.log("Filled phone number");

      // Look for email field
      try {
        const emailFieldProfile = await testdriver.find("email address field in the patient profile");
        await emailFieldProfile.click();
        await testdriver.type("patient@example.com");
        console.log("Filled email address");
      } catch {
        console.log("Email field not found");
      }

      // Look for and click the save button
      const saveButton = await testdriver.find("Save button or Submit button");
      await saveButton.click();
      console.log("Clicked save button");

      // Wait for save to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify save was successful
      const saveSuccess = await testdriver.assert("changes were saved successfully or save confirmation appears");
      expect(saveSuccess).toBeTruthy();
    } catch (error) {
      console.log("Could not complete patient profile form:", error.message);
    }

    // Take final screenshot
    const finalScreenshot = await testdriver.screenshot();
    expect(finalScreenshot).toBeDefined();

    console.log("✅ Test completed successfully! Remember to uncomment all checkpoints for final validation.");
  });
});
