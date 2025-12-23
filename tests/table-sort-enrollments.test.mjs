/**
 * Test case 7: Sort by Enrollments (ascending, numeric)
 * 
 * 1. Open page: https://practicetestautomation.com/practice-test-table/
 * 2. Set Sort by = Enrollments
 * 3. Verify visible rows are ordered from smallest to largest enrollment
 * 4. Verify numbers with commas sort correctly
 * 5. Fails if the sort is lexicographic (string-based) instead of numeric
 * 
 * EXPECTED: This test should PASS if enrollments are sorted ascending numerically
 *           This test should FAIL if sort is lexicographic or descending
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

    // Scroll down to see the Sort by dropdown
    await testdriver.scroll("down");
    await testdriver.scroll("down");
    
    // Step 2: Find and click the Sort by dropdown
    const sortDropdown = await testdriver.find("Sort by dropdown", { timeout: 15000 });
    console.log("Sort by dropdown found:", sortDropdown.found());
    expect(sortDropdown.found()).toBeTruthy();
    await sortDropdown.click();
    
    // Select "Enrollments" from the dropdown options
    const enrollmentsOption = await testdriver.find("Enrollments option", { timeout: 10000 });
    console.log("Enrollments option found:", enrollmentsOption.found());
    expect(enrollmentsOption.found()).toBeTruthy();
    await enrollmentsOption.click();
    
    // Scroll to the TOP of the page to see the first rows of the sorted table
    await testdriver.scroll("up");
    await testdriver.scroll("up");
    await testdriver.scroll("up");
    
    // Small wait for sort to complete
    await testdriver.pressKeys([""]); // No-op to add small delay
    
    // Scroll down just enough to see the table header and first data rows
    await testdriver.scroll("down");
    
    // Step 3: Verify the sort is NUMERIC ASCENDING (smallest to largest)
    // For numeric ascending: 10 < 11 < 50 < 1000 < 1200 < 1365
    // If lexicographic: "1,000" < "10" < "11" < "1,200" < "1365" < "50" (wrong - strings compare char by char)
    // 
    // The TEST PASSES if first rows show small numbers like 10, 11, 50
    // The TEST FAILS if first rows show large numbers like 1000, 1200, 1365
    const sortResult = await testdriver.assert(
      "The table is sorted by Enrollments in ASCENDING numeric order. " +
      "The FIRST visible enrollment numbers in the table should be the SMALLEST values. " +
      "For example, if the data contains values like 10, 11, 50, 1000, and 1365, " +
      "then 10 or 11 should appear at the TOP of the sorted table. " +
      "If a large number like 1365 appears first, the sort is WRONG (descending or lexicographic)."
    );
    console.log("Numeric ascending sort assertion result:", sortResult);
    expect(sortResult).toBeTruthy();
  });
});
