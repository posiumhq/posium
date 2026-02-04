import type { NormalizedEnvironment } from "./types.js";

/**
 * Environment alias mappings (case-insensitive)
 */
const ENVIRONMENT_ALIASES: Record<string, NormalizedEnvironment> = {
  // Development
  dev: "development",
  development: "development",

  // Production
  prod: "production",
  production: "production",

  // Staging
  stage: "staging",
  stag: "staging",
  staging: "staging",

  // Test
  test: "test",
  testing: "test",
};

/**
 * Normalize an environment string to a standard value
 *
 * Handles common aliases (case-insensitive):
 * - "dev" | "development" → "development"
 * - "prod" | "production" → "production"
 * - "stage" | "stag" | "staging" → "staging"
 * - "test" | "testing" → "test"
 *
 * Unknown values are returned as-is (lowercase)
 *
 * @param env - Environment string to normalize
 * @returns Normalized environment name
 *
 * @example
 * normalizeEnvironment("dev")    // "development"
 * normalizeEnvironment("PROD")   // "production"
 * normalizeEnvironment("Stage")  // "staging"
 * normalizeEnvironment("custom") // "custom"
 */
export function normalizeEnvironment(env: string): NormalizedEnvironment {
  const lowered = env.toLowerCase().trim();
  return ENVIRONMENT_ALIASES[lowered] ?? lowered;
}

/**
 * Get the current environment from options or NODE_ENV
 *
 * @param providedEnv - User-provided environment (optional)
 * @returns Normalized environment name
 */
export function resolveEnvironment(
  providedEnv?: string,
): NormalizedEnvironment {
  const env = providedEnv ?? process.env.NODE_ENV ?? "development";
  return normalizeEnvironment(env);
}
