/**
 * TestDriver SDK - Parse Test (Vitest)
 * Opens Airbnb and runs the .parse() SDK command to analyze the screen.
 */

import { describe, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";
import { getDefaults } from "./config.mjs";

describe("Parse Test", () => {
  it("should open Airbnb and parse the screen", async (context) => {
    const testdriver = TestDriver(context, { ...getDefaults(context) });
    await testdriver.provision.chrome({ url: "https://www.airbnb.com" });

    const result = await testdriver.parse();
    console.log(`Found ${result.elements?.length || 0} elements`);
    console.log(JSON.stringify(result, null, 2));
  });
});
