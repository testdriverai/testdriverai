---
name: actions
description: Perform actions in TestDriver tests. Use when clicking, typing, pressing keys, scrolling, hovering, dragging, or interacting with UI elements.
---

# Performing Actions

Read these docs:
- `node_modules/testdriverai/docs/v7/click.mdx`
- `node_modules/testdriverai/docs/v7/type.mdx`
- `node_modules/testdriverai/docs/v7/press-keys.mdx`
- `node_modules/testdriverai/docs/v7/scroll.mdx`
- `node_modules/testdriverai/docs/v7/hover.mdx`
- `node_modules/testdriverai/docs/v7/double-click.mdx`
- `node_modules/testdriverai/docs/v7/right-click.mdx`
- `node_modules/testdriverai/docs/v7/mouse-down.mdx`
- `node_modules/testdriverai/docs/v7/mouse-up.mdx`

## Click Actions

```javascript
const element = await testdriver.find("button");
await element.click();
await element.doubleClick();
await element.rightClick();
await element.hover();
```

## Typing

```javascript
await testdriver.find("Email input").click();
await testdriver.type("user@example.com");
```

### Clear before typing
```javascript
await testdriver.find("Search input").click();
await testdriver.pressKeys(["ctrl", "a"]);
await testdriver.type("new search term");
```

## Keyboard Input

```javascript
await testdriver.pressKeys(["enter"]);
await testdriver.pressKeys(["tab"]);
await testdriver.pressKeys(["escape"]);
await testdriver.pressKeys(["ctrl", "a"]);  // Select all
await testdriver.pressKeys(["ctrl", "c"]);  // Copy
await testdriver.pressKeys(["ctrl", "v"]);  // Paste
await testdriver.pressKeys(["alt", "f4"]);  // Close (Windows)
await testdriver.pressKeys(["cmd", "q"]);   // Quit (macOS)
```

## Scrolling

```javascript
await testdriver.scroll("down");
await testdriver.scroll("up");
await testdriver.scrollUntilText("Footer content");
await testdriver.scrollUntilImage("Product image at bottom");
```

## Drag and Drop

```javascript
const source = await testdriver.find("Draggable item");
const target = await testdriver.find("Drop zone");
await source.mouseDown();
await target.hover();
await target.mouseUp();
```

## Execute Code in Sandbox

```javascript
// JavaScript (browser)
const title = await testdriver.exec("js", "return document.title", 5000);

// Shell (Linux)
await testdriver.exec("sh", "ls -la", 5000);

// PowerShell (Windows)
await testdriver.exec("pwsh", "Get-Date", 5000);
```

## Examples

- `node_modules/testdriverai/examples/type.test.mjs`
- `node_modules/testdriverai/examples/press-keys.test.mjs`
- `node_modules/testdriverai/examples/scroll.test.mjs`
- `node_modules/testdriverai/examples/drag-and-drop.test.mjs`
