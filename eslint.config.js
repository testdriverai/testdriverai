const globals = require("globals");
const pluginJs = require("@eslint/js");

module.exports = [
  pluginJs.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
    },
  },
  {
    // this needs to be it's own object for some reason
    // https://github.com/eslint/eslint/issues/17400
    ignores: ["node_modules/**", ".git", "electron/terminal/xterm*"],
  },
];
