/**
 * Popup Loading - Skip straight to the rocket match (skipToIcons=true)
 */
import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";

describe("Rocket Match (skipToIcons)", () => {
  it("should find the rocket in the icon grid", async (context) => {
    const testdriver = TestDriver(context, {
      preview: "ide",
      ip: context.ip || process.env.TD_IP,
    });

    await testdriver.provision.chrome({
      url: "https://v0-popup-with-loading-bar.vercel.app/?skipToIcons=true",
    });

    // Wait for the 5x5 grid of images to fully load and click the rocket
    await testdriver.find("The icon of a rocket in the 5x5 grid of images", {
      timeout: 60000,
      zoom: 1,
    }).click();

    // Assert the success message appears
    const rocketResult = await testdriver.assert(
      "The text 'You found the rocket!' is visible on the page"
    );
    expect(rocketResult).toBeTruthy();
  });
});
