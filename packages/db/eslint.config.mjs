import { config } from "@posium/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    ignores: ["dist/**", "scripts/**", "*.config.ts", "*.config.mjs"],
  },
];
