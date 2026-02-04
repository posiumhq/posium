import { config } from "@posium/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    ignores: ["dist/**", "*.config.ts", "*.config.mjs"],
  },
];
