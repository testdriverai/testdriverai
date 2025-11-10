/**
 * TestDriver SDK - Drag and Drop Test (Vitest)
 * Converted from: testdriver/acceptance/drag-and-drop.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('Drag and Drop Test', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should drag "New Text Document" to "Recycle Bin"', async () => {
    // Show the desktop
    await client.pressKeys(['win', 'd']);

    // Open the context menu
    await client.pressKeys(['shift', 'f10']);

    // Hover over "New" in the context menu
    await client.hoverText('New', 'new option in the open context menu on the desktop', 'hover');

    // Click "Text Document" in the context menu
    await client.hoverText('Text Document', 'text document option in the new submenu of the desktop context menu', 'click');

    // Unfocus the "Text Document" text field
    await client.pressKeys(['esc']);

    // Drag the "New Text Document" icon to the "Recycle Bin"
    await client.hoverText('New Text Document', 'new text document icon in the center of the desktop', 'drag-start');
    await client.hoverText('Recycle Bin', 'recycle bin icon in the top left corner of the desktop', 'drag-end');

    // Assert "New Text Document" icon is not on the Desktop
    const result = await client.assert('the "New Text Document" icon is not visible on the Desktop');
    expect(result).toBeTruthy();
  });
});
