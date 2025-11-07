# Type Safety & IDE Autocomplete

The TestDriver SDK now includes comprehensive type definitions that provide strict type checking and intelligent autocomplete in your IDE.

## Features

### ✅ Strict Type Checking
- All command parameters are strictly typed based on `schema.json`
- Enum values for actions, directions, methods, and keys
- Proper return type definitions
- JSDoc annotations for JavaScript and TypeScript definitions for TypeScript

### ✅ IDE Autocomplete
- Method autocomplete when typing `client.`
- Parameter autocomplete for enum values
- Inline documentation with parameter descriptions
- Type hints showing expected parameter types

## Type Definitions

### ClickAction
Valid actions for clicking and hovering:
```typescript
'click' | 'right-click' | 'double-click' | 'hover' | 'drag-start' | 'drag-end'
```

**Example:**
```javascript
await client.hoverText('Submit', null, 'double-click');
await client.click(100, 200, 'right-click');
```

### ScrollDirection
Valid scroll directions:
```typescript
'up' | 'down' | 'left' | 'right'
```

**Example:**
```javascript
await client.scroll('down', 300, 'keyboard');
await client.scrollUntilText('Footer', 'down');
```

### ScrollMethod
Valid scroll methods:
```typescript
'keyboard' | 'mouse'
```

**Example:**
```javascript
await client.scroll('down', 300, 'mouse');
await client.scrollUntilImage('Logo', 'up', 5000, 'keyboard');
```

### TextMatchMethod
Valid text matching methods:
```typescript
'ai' | 'turbo'
```

**Example:**
```javascript
await client.hoverText('Login', null, 'click', 'turbo');
await client.waitForText('Success', 5000, 'ai');
```

### ExecLanguage
Valid execution languages:
```typescript
'js' | 'pwsh'
```

**Example:**
```javascript
await client.exec('js', 'return 2 + 2;', 5000);
await client.exec('pwsh', 'Get-Date', 3000);
```

### KeyboardKey
All valid keyboard keys including:
- **Characters:** `'a'` - `'z'`, `'0'` - `'9'`, symbols
- **Modifiers:** `'shift'`, `'ctrl'`, `'alt'`, `'command'`, `'option'`
- **Function Keys:** `'f1'` - `'f24'`
- **Special Keys:** `'enter'`, `'tab'`, `'escape'`, `'backspace'`, `'delete'`
- **Navigation:** `'up'`, `'down'`, `'left'`, `'right'`, `'home'`, `'end'`, `'pageup'`, `'pagedown'`
- **Media Keys:** `'volumeup'`, `'volumedown'`, `'playpause'`
- And many more...

**Example:**
```javascript
await client.pressKeys(['ctrl', 'a']);
await client.pressKeys(['enter']);
await client.pressKeys(['shift', 'tab']);
```

## Method Signatures

### hoverText
```typescript
hoverText(
  text: string,
  description?: string | null,
  action?: ClickAction,
  method?: TextMatchMethod,
  timeout?: number
): Promise<HoverResult>
```

### type
```typescript
type(
  text: string | number,
  delay?: number
): Promise<void>
```

### pressKeys
```typescript
pressKeys(
  keys: KeyboardKey[]
): Promise<void>
```

### scroll
```typescript
scroll(
  direction?: ScrollDirection,
  amount?: number,
  method?: ScrollMethod
): Promise<void>
```

### waitForText
```typescript
waitForText(
  text: string,
  timeout?: number,
  method?: TextMatchMethod,
  invert?: boolean
): Promise<void>
```

### scrollUntilText
```typescript
scrollUntilText(
  text: string,
  direction?: ScrollDirection,
  maxDistance?: number,
  textMatchMethod?: TextMatchMethod,
  method?: ScrollMethod,
  invert?: boolean
): Promise<void>
```

### hoverImage
```typescript
hoverImage(
  description: string,
  action?: ClickAction
): Promise<HoverResult>
```

### matchImage
```typescript
matchImage(
  imagePath: string,
  action?: ClickAction,
  invert?: boolean
): Promise<boolean>
```

### waitForImage
```typescript
waitForImage(
  description: string,
  timeout?: number,
  invert?: boolean
): Promise<void>
```

### scrollUntilImage
```typescript
scrollUntilImage(
  description: string,
  direction?: ScrollDirection,
  maxDistance?: number,
  method?: ScrollMethod,
  path?: string | null,
  invert?: boolean
): Promise<void>
```

### click
```typescript
click(
  x: number,
  y: number,
  action?: ClickAction
): Promise<void>
```

### hover
```typescript
hover(
  x: number,
  y: number
): Promise<void>
```

### focusApplication
```typescript
focusApplication(
  name: string
): Promise<string>
```

### remember
```typescript
remember(
  description: string
): Promise<string>
```

### assert
```typescript
assert(
  assertion: string,
  async?: boolean,
  invert?: boolean
): Promise<boolean>
```

### exec
```typescript
exec(
  language: ExecLanguage,
  code: string,
  timeout: number,
  silent?: boolean
): Promise<string>
```

### wait
```typescript
wait(
  timeout?: number
): Promise<void>
```

## IDE Setup

### VS Code

The types work automatically in VS Code with IntelliSense. Just import the SDK:

```javascript
const TestDriver = require('testdriverai');
const client = new TestDriver(process.env.TD_API_KEY);

// Start typing and see autocomplete!
await client.
```

### TypeScript Projects

For TypeScript projects, import the types:

```typescript
import TestDriver, { ClickAction, KeyboardKey } from 'testdriverai';

const client = new TestDriver(process.env.TD_API_KEY);
await client.hoverText('Login', null, 'click');
```

### JSDoc in JavaScript

The types are also available via JSDoc:

```javascript
/** @type {import('testdriverai').default} */
const client = new TestDriver(process.env.TD_API_KEY);
```

## Benefits

### 1. Catch Errors Early
Invalid values are caught by your IDE before runtime:
```javascript
// ❌ IDE will warn: 'middle-click' is not a valid ClickAction
await client.hoverText('Submit', null, 'middle-click');

// ✅ Valid
await client.hoverText('Submit', null, 'click');
```

### 2. Discover Available Options
Autocomplete shows all valid options:
```javascript
await client.scroll('d' // Autocomplete shows: 'down'
```

### 3. Self-Documenting Code
Hover over any method to see its documentation:
```javascript
// Hover over 'hoverText' to see:
// hoverText(text: string, description?: string | null, action?: ClickAction, ...)
await client.hoverText('Submit');
```

### 4. No Duplicate Maintenance
Types are generated dynamically from the command definitions - no need to maintain types in multiple places!

## Examples

See `type-checking-demo.js` for a complete example demonstrating all type features.

## Schema Source

All types are derived from `/schema.json`, which defines the TestDriver YAML command format. The SDK dynamically maps these to camelCase JavaScript methods while preserving strict typing.
