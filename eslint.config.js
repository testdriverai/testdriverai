const globals = require("globals");
const pluginJs = require("@eslint/js");

module.exports = [
  pluginJs.configs.recommended,
  {
    // Base config for all JavaScript files - provides Node.js globals
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // Specific config for interface and agent files - adds browser globals
    files: ["./interfaces/**/*.js", "./agent/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    // Specific config for test files - adds Jest and Mocha globals
    files: ["test/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.jest,
        ...globals.mocha,
      },
    },
  },
  {
    // Config for ES Module files (.mjs) - used in SDK tests
    files: ["**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Warn about floating promises (unawaited async calls)
      // This catches missing `await` on async methods like click(), assert(), etc.
      // Note: For TypeScript projects, use @typescript-eslint/no-floating-promises instead
      "require-await": "warn",
    },
  },
  {
    // this needs to be it's own object for some reason
    // https://github.com/eslint/eslint/issues/17400
    ignores: [
      "agent/lib/subimage/**",
      "node_modules/**",
      ".git",
      "test-results/**",
      "examples/test-recording-example.test.js",
      "vitest.config.example.js",
    ],
  },
];
