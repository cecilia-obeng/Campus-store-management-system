
const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  // 1. Recommended JavaScript rules
  js.configs.recommended,

  // 2. General backend configuration
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^next$",
        },
      ],
    },
  },

  // 3. Test-specific configuration
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
];
