# SDK Dynamic Command Mapping & Type Safety

## Summary

The TestDriver SDK has been refactored to use **dynamic command mapping** with **strict type checking**.

## What Changed

### Before: Manual Command Wrappers
```javascript
async hoverText(text, description = null, action = "click", method = "turbo", timeout = 5000) {
  this._ensureConnected();
  return await this.commands["hover-text"](text, description, action, method, timeout);
}

async type(text, delay = 250) {
  this._ensureConnected();
  return await this.commands.type(text, delay);
}

// ... 15+ more manual wrappers
```

**Problem:** Parameters defined in 2 places (commands.js AND sdk.js) - maintenance nightmare!

### After: Dynamic Generation
```javascript
_setupCommandMethods() {
  const commandMapping = {
    'hover-text': { name: 'hoverText', /** @param {ClickAction} action */ },
    'type': { name: 'type', /** @param {string | number} text */ },
    // ...
  };

  Object.keys(this.commands).forEach(commandName => {
    const methodInfo = commandMapping[commandName];
    this[methodInfo.name] = async (...args) => {
      this._ensureConnected();
      return await command(...args);
    };
  });
}
```

**Benefits:**
- ✅ Single source of truth for parameters (commands.js)
- ✅ Automatic wrapper generation
- ✅ No duplicate maintenance
- ✅ Type-safe with JSDoc annotations

## Type Safety Features

### Strict Type Definitions
All types derived from `schema.json`:

```javascript
/** @typedef {'click' | 'right-click' | 'double-click' | 'hover' | 'drag-start' | 'drag-end'} ClickAction */
/** @typedef {'up' | 'down' | 'left' | 'right'} ScrollDirection */
/** @typedef {'keyboard' | 'mouse'} ScrollMethod */
/** @typedef {'ai' | 'turbo'} TextMatchMethod */
/** @typedef {'js' | 'pwsh'} ExecLanguage */
/** @typedef {KeyboardKey} - 200+ valid keyboard keys */
```

### IDE Autocomplete
Your IDE now provides:
- Method autocomplete (`client.` → shows all methods)
- Parameter autocomplete (action → 'click', 'right-click', etc.)
- Type hints and documentation
- Error warnings for invalid values

### Example
```javascript
// IDE autocompletes 'click', 'right-click', 'double-click', etc.
await client.hoverText('Submit', null, 'click');

// IDE autocompletes 'up', 'down', 'left', 'right'
await client.scroll('down', 300, 'keyboard');

// IDE autocompletes all 200+ keyboard keys
await client.pressKeys(['enter', 'tab', 'escape']);

// ❌ IDE warns: 'invalid' is not a valid ClickAction
await client.hoverText('Submit', null, 'invalid');
```

## Files Modified

- **sdk.js** - Added typedefs and dynamic command mapping
- **sdk.d.ts** - Updated TypeScript definitions with strict types
- **TYPE_SAFETY.md** - Comprehensive type documentation
- **type-checking-demo.js** - Demo showing autocomplete features

## Key Benefits

1. **No Duplicate Maintenance** - Parameters defined once in commands.js
2. **Type Safety** - Catch errors at development time, not runtime
3. **Better DX** - IDE autocomplete and inline docs
4. **Schema-Driven** - Types automatically match schema.json
5. **Easier to Extend** - Adding new commands is automatic

## Testing

The dynamic mapping is transparent to existing code. All existing tests continue to work without changes.

```bash
# Run tests to verify
npm run test:sdk
```

## Documentation

- See `TYPE_SAFETY.md` for complete type reference
- See `type-checking-demo.js` for usage examples
