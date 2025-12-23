/**
 * Test case 7: Sort by Enrollments (ascending, numeric)
 * 
 * 1. Open page: https://practicetestautomation.com/practice-test-table/
 * 2. Set Sort by = Enrollments
 * 3. Verify visible rows are ordered from smallest to largest enrollment
 * 4. Verify numbers with commas sort correctly
 * 5. Fails if the sort is lexicographic
 */
import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";

describe("Table Sort - Enrollments", () => {

  it("should sort enrollments numerically ascending", async (context) => {
    const testdriver = TestDriver(context, { 
      newSandbox: true, 
      headless: false 
    });
    
    // Step 1: Open the page
    await testdriver.provision.chrome({
      url: 'https://practicetestautomation.com/practice-test-table/',
    });

    // Wait for page to load - find the Sort By dropdown
    const sortDropdown = await testdriver.find("Sort By dropdown or select box", { timeout: 30000 });
    console.log("Sort dropdown found:", sortDropdown.found());
    expect(sortDropdown.found()).toBeTruthy();
    
    // Step 2: Click the Sort By dropdown
    await sortDropdown.click();
    
    // Select "Enrollments" from the dropdown options
    const enrollmentsOption = await testdriver.find("Enrollments option in the dropdown list", { timeout: 10000 });
    console.log("Enrollments option found:", enrollmentsOption.found());
    await enrollmentsOption.click();
    
    // Step 3 & 4: Verify the sort is numeric ascending (not lexicographic)
    // If numeric: smaller numbers (10, 11, 50) come before larger numbers (1000, 1200)
    // If lexicographic: would sort as strings (1,000 before 10 because '1' < '1')
    const sortResult = await testdriver.assert(
      "The table enrollment column is sorted in ascending NUMERIC order: " +
      "smaller enrollment numbers like 10, 11, 50 appear BEFORE larger numbers like 1000 or 1200. " +
      "This is correct numeric sorting, not alphabetical/lexicographic sorting."
    );
    console.log("Numeric sort assertion result:", sortResult);
    expect(sortResult).toBeTruthy();
    
    // Step 5: Verify numbers with commas are handled correctly
    // 1,200 should be treated as 1200 (greater than 1000), not as a string
    const commaResult = await testdriver.assert(
      "Any enrollment numbers with commas (like 1,200 or 1,000) are sorted correctly as numbers, " +
      "with 1,000 appearing before 1,200 in ascending order"
    );
    console.log("Comma number sorting result:", commaResult);
    expect(commaResult).toBeTruthy();
  });
});
