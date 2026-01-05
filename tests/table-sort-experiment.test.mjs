/**
 * Experiment file - reconnects to existing sandbox
 * Test case 7: Sort by Enrollments (ascending, numeric)
 * Run AFTER table-sort-setup.test.mjs passes (within 2 minutes)
 */
import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";

describe("Table Sort Experiment", () => {

  it("should sort by Enrollments and verify numeric ordering", async (context) => {
    const testdriver = TestDriver(context, { 
      newSandbox: true, 
      headless: false,
      reconnect: true  // Reconnects to last sandbox
    });
    
    // NO provision here! The sandbox is already running from setup.test.mjs
    
    // Click on the Sort By dropdown and select Enrollments
    const sortDropdown = await testdriver.find("Sort By dropdown");
    console.log("Sort dropdown found:", sortDropdown.found());
    await sortDropdown.click();
    
    // Select Enrollments from the dropdown
    const enrollmentsOption = await testdriver.find("Enrollments option in dropdown");
    console.log("Enrollments option found:", enrollmentsOption.found());
    await enrollmentsOption.click();
    
    // Verify the table is now sorted by enrollments (ascending, numeric)
    // The numbers should be ordered from smallest to largest: 10, 11, 50, 1000, 1,200
    // If lexicographic: 1,000, 1,200, 10, 11, 50 (wrong - strings sort by first character)
    const result = await testdriver.assert("The table shows enrollment numbers in ascending numeric order where smaller numbers like 10 or 11 appear before larger numbers like 1000 or 1200");
    console.log("Sort assertion result:", result);
    expect(result).toBeTruthy();
    
    // Also verify numbers with commas sort correctly (1,200 should be after 1,000)
    const commaResult = await testdriver.assert("Numbers with commas like 1,000 and 1,200 are sorted correctly as numbers, not as text");
    console.log("Comma sort assertion:", commaResult);
    expect(commaResult).toBeTruthy();
  });
});
