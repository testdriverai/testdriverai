/**
 * TestDriver SDK - Exec JS Test (Vitest)
 * Converted from: testdriver/acceptance/exec-js.yaml
 */

import { describe, expect, it } from "vitest";
import { chrome } from "../../src/presets/index.mjs";

describe("Exec JavaScript Test", () => {
  it("should fetch user data from API and enter email", async (context) => {
    const { testdriver } = await chrome(context, {
      url: 'http://testdriver-sandbox.vercel.app/login',
    });

    //
    // Execute JavaScript to fetch user data
    const userEmail = await testdriver.exec(
      "js",
      `
      const response = await fetch('https://jsonplaceholder.typicode.com/users');
      const user = await response.json();
      console.log('user', user[0]);
      result = user[0].email;
    `,
      10000,
    );

    expect(userEmail).toBeTruthy();
    expect(userEmail).toContain("@");

    // Enter email in username field
    const usernameField = await testdriver.find(
      "Username, input field for username",
    );
    await usernameField.click();
    await testdriver.type(userEmail);

    // Assert email is in the field
    const result = await testdriver.assert(
      'the username field contains "Sincere@april.biz" which is a valid email address',
    );
    expect(result).toBeTruthy();
  });
});
