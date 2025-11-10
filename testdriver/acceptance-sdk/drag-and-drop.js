#!/usr/bin/env node

/**
 * TestDriver SDK - Drag and Drop Test
 * Converted from: testdriver/acceptance/drag-and-drop.yaml
 * 
 * Original test: Drag "New Text Document" to "Recycle Bin"
 */

const TestDriver = require('../../sdk');

async function main() {
  const client = new TestDriver(process.env.TD_API_KEY, {
    resolution: '1366x768',
    analytics: true,
    logging: true
  });

  try {
    console.log('🔐 Authenticating...');
    await client.auth();

    console.log('🔌 Connecting to sandbox...');
    await client.connect({ newSandbox: true });
    console.log('✅ Connected!');

    // Step 1: Show the desktop
    console.log('\n🖥️ Showing desktop...');
    await client.pressKeys(['win', 'd']);
    console.log('✅ Desktop shown');

    // Step 2: Open the context menu
    console.log('\n📋 Opening context menu...');
    await client.pressKeys(['shift', 'f10']);
    console.log('✅ Context menu opened');

    // Step 3: Hover over "New" in the context menu
    console.log('\n🖱️ Hovering over "New"...');
    await client.hoverText('New', 'new option in the open context menu on the desktop', 'hover');
    console.log('✅ Hovered over "New"');

    // Step 4: Click "Text Document" in the context menu
    console.log('\n🖱️ Clicking "Text Document"...');
    await client.hoverText('Text Document', 'text document option in the new submenu of the desktop context menu', 'click');
    console.log('✅ "Text Document" clicked');

    // Step 5: Unfocus the "Text Document" text field
    console.log('\n⎋ Unfocusing text field...');
    await client.pressKeys(['esc']);
    console.log('✅ Text field unfocused');

    // Step 6: Drag the "New Text Document" icon to the "Recycle Bin"
    console.log('\n🔄 Dragging "New Text Document" to "Recycle Bin"...');
    await client.hoverText('New Text Document', 'new text document icon in the center of the desktop', 'drag-start');
    await client.hoverText('Recycle Bin', 'recycle bin icon in the top left corner of the desktop', 'drag-end');
    console.log('✅ Drag complete');

    // Assert "New Text Document" icon is not on the Desktop
    console.log('\n✔️ Asserting "New Text Document" is not visible...');
    await client.assert('the "New Text Document" icon is not visible on the Desktop');
    console.log('✅ Assertion passed!');

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    console.log('\n🧹 Disconnecting...');
    await client.disconnect();
    console.log('👋 Done!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
