# Fixed: ES Module Configuration

## What Was Fixed

The error `ERR_REQUIRE_ESM` occurred because Vitest uses ES modules, but the project is CommonJS by default.

## Solution Applied

Renamed all module files to use `.mjs` extension:

1. **Config file**: `vitest.config.js` → `vitest.config.mjs`
2. **Setup files**: 
   - `setup/globalSetup.js` → `setup/globalSetup.mjs`
   - `setup/testHelpers.js` → `setup/testHelpers.mjs`
3. **Test files**: All `*.test.js` → `*.test.mjs`
4. **Updated imports**: Changed `require()` to `import` in testHelpers.mjs

## How to Run Tests

```bash
# Set your API key
export TD_API_KEY=your_api_key_here

# Run all tests
npm run test:sdk

# Run specific test
npx vitest run testdriver/acceptance-sdk/assert.test.mjs

# Run with UI
npm run test:sdk:ui
```

## Files Changed

- `vitest.config.mjs` - Updated file pattern and globalSetup path
- `setup/globalSetup.mjs` - ES module format
- `setup/testHelpers.mjs` - ES module format with proper imports
- `*.test.mjs` - All test files updated to import from `.mjs` files

## What Works Now

✅ Vitest loads correctly without ES module errors
✅ Global setup runs and validates API key
✅ Test files can import helpers and SDK
✅ Lifecycle hooks (prerun/postrun) are integrated

## Next Steps

1. Set `TD_API_KEY` environment variable
2. Run tests: `npm run test:sdk`
3. Tests will authenticate, connect to sandbox, and run assertions

The ESLint warnings about "import/export may appear only with sourceType: module" can be safely ignored - they're just because ESLint doesn't recognize `.mjs` files as ES modules by default.
