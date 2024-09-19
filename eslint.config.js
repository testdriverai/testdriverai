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
      },
    }
  },
  { 
    // this needs to be it's own object for some reason
    // https://github.com/eslint/eslint/issues/17400   
    ignores: ["lib/subimage/opencv.js", "node_modules/**", ".git"],
  }
];
