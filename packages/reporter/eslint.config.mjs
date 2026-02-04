import { config } from '@posium/eslint-config/base';

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    ignores: [
      'dist/**',
      'playwright-report/**',
      'e2e/**',
      'vitest.config.ts',
      'playwright.config.ts',
      'test-results/**',
      'src/__tests__/**',
    ],
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      // Disable rules incompatible with Playwright Reporter interface
      // The Reporter interface expects void returns but async implementations are standard
      '@typescript-eslint/no-misused-promises': 'off',
      // Some any types are necessary for Playwright test serialization
      '@typescript-eslint/no-explicit-any': 'off',
      // Control characters in regex are intentional (ANSI escape codes)
      'no-control-regex': 'off',
      // Escape characters in regex are sometimes necessary
      'no-useless-escape': 'off',
    },
  },
];
