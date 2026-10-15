const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // describe, it, expect, beforeEach ... without importing them (CommonJS can't require vitest).
    globals: true,
    // Every test file resets the same database, so files must run one at a time.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
    },
  },
});
