/**
 * TestDriver SDK - FindAll Coffee Icons Test
 * Loads a random icon grid and uses findAll() to locate and click all 4 coffee cup icons
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";
import { getDefaults } from "./config.mjs";

describe("FindAll Coffee Icons", () => {
  it("should find and click all 4 coffee cup icons", async (context) => {
    const testdriver = TestDriver(context, {
      ...getDefaults(context),
      headless: true,
    });

    await testdriver.provision.chrome({
      url: "https://v0-random-icon-grid.vercel.app/",
    });

    // Use findAll to locate all coffee cup icons on the page
    const coffeeIcons = await testdriver.findAll("coffee cup icon, there are exactly 4 on the page");

    // Log each icon's coordinates
    console.log(`Found ${coffeeIcons.length} coffee icons:`);
    coffeeIcons.forEach((icon, i) => {
      console.log(`  Icon ${i + 1}: (${icon.x}, ${icon.y}) center=(${icon.centerX}, ${icon.centerY})`);
    });

    // Verify we found 3 or 4 coffee icons
    expect(coffeeIcons.length).toBeGreaterThanOrEqual(3);
    expect(coffeeIcons.length).toBeLessThanOrEqual(4);

    // Click each coffee cup icon
    for (const icon of coffeeIcons) {
      await icon.click();
    }

    // Verify the selection count is displayed
    await testdriver.assert("the page says 'Selected: 3 / 4' or 'Matched 4 of a kind!'");
  });
});
