import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    passWithNoTests: true,
    testTimeout: 60000,
    hookTimeout: 60000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/shared/**", "src/**/*.d.ts"],
      reporter: ["text", "text-summary"],
    },
  },
});
