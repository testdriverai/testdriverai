/**
 * TestDriver SDK - Drag and Drop Test (Vitest)
 * Converted from: testdriver/acceptance/drag-and-drop.yaml
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

const isLinux = (process.env.TD_OS || "linux") === "linux";

describe("Drag and Drop Test", () => {
  it.skipIf(isLinux)(
    'should drag "New Text Document" to "Recycle Bin"',
    async (context) => {
      const testdriver = TestDriver(context, { ip: context.ip || process.env.TD_IP, headless: true });
      await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

      //
      // Show the desktop
      await testdriver.pressKeys(["win", "d"]);

      // Open the context menu
      await testdriver.pressKeys(["shift", "f10"]);

      // Hover over "New" in the context menu
      const newOption = await testdriver.find(
        "New, new option in the open context menu on the desktop",
      );
      await newOption.hover();

      // Click "Text Document" in the context menu
      const textDocOption = await testdriver.find(
        "Text Document, text document option in the new submenu of the desktop context menu",
      );
      await textDocOption.click();

      // Unfocus the "Text Document" text field
      await testdriver.pressKeys(["esc"]);

      // Drag the "New Text Document" icon to the "Recycle Bin"
      const textDoc = await testdriver.find(
        "New Text Document, new text document icon in the center of the desktop",
      );
      await textDoc.mouseDown();

      const recycleBin = await testdriver.find(
        "Recycle Bin, recycle bin icon in the top left corner of the desktop",
      );
      await recycleBin.mouseUp();

      // Assert "New Text Document" icon is not on the Desktop
      const result = await testdriver.assert(
        'the "New Text Document" icon is not visible on the Desktop',
      );
      expect(result).toBeTruthy();
    },
  );
});
