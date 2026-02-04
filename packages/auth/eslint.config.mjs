import { config } from "@posium/eslint-config/base";

export default [
  ...config,
  {
    ignores: ["dist/**", "*.config.ts", "*.config.mjs", "__tests__/**"],
  },
];
