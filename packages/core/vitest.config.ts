import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

// Load .env.test file
dotenv.config({ path: ".env.test" });

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    passWithNoTests: true,
    testTimeout: 30000, // Longer timeout for database operations
    hookTimeout: 30000, // Longer timeout for beforeAll/afterAll hooks
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/testing/**", "src/**/*.types.ts"],
      reporter: ["text", "text-summary"],
    },
  },
});
