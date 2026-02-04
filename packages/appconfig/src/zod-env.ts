/**
 * Zod Extension for Environment Variable Mapping
 *
 * Adds `.env("VAR_NAME")` method to Zod types so env mapping is co-located with schema definitions.
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import "@posium/appconfig/zod-env"; // Activate .env() extension
 *
 * const schema = z.object({
 *   port: z.coerce.number().default(3004).env("PORT"),
 *   openRouter: z.object({
 *     apiKey: z.string().min(1).env("OPENROUTER_API_KEY"),
 *   }),
 * });
 * ```
 */

import { z, type core } from "zod";

// Symbol to store env var name (avoids conflicts with other metadata)
const ENV_VAR_KEY = Symbol.for("appconfig.envVar");

// Type augmentation for .env() method
// Zod 4 classic exports ZodType with 3 type parameters: Output, Input, Internals
declare module "zod" {
  interface ZodType<
    out Output,
    out Input,
    out Internals extends core.$ZodTypeInternals<Output, Input>,
  > {
    /**
     * Map this field to an environment variable.
     * The env var value will be loaded and merged with highest priority.
     *
     * @param varName - The environment variable name (e.g., "PORT", "DATABASE_URL")
     * @returns The same schema for method chaining
     *
     * @example
     * ```typescript
     * z.string().env("DATABASE_URL")
     * z.coerce.number().default(3000).env("PORT")
     * ```
     */
    env(varName: string): this;
  }
}

// Extend ZodType prototype to add .env() method
z.ZodType.prototype.env = function (varName: string) {
  // Store env var name in schema's definition
  // Using symbol key to avoid conflicts
  (this as unknown as { _def: Record<symbol, string> })._def[ENV_VAR_KEY] =
    varName;
  return this;
};

// Type alias for any Zod schema (Zod 4 compatible)
type AnyZodType = z.ZodType<unknown, unknown, core.$ZodTypeInternals>;

/**
 * Get the environment variable name from a Zod schema
 * @param schema - Any Zod schema
 * @returns The env var name if set, undefined otherwise
 */
export function getEnvVar(schema: AnyZodType): string | undefined {
  return (schema as unknown as { _def?: Record<symbol, string> })._def?.[
    ENV_VAR_KEY
  ];
}

/**
 * Extract environment variable mapping from a Zod object schema
 *
 * Traverses the schema recursively and collects all `.env()` annotations,
 * mapping env var names to their dot-notation config paths.
 *
 * @param schema - A Zod object schema with optional `.env()` annotations
 * @returns Mapping of env var names to config paths (e.g., `{ "PORT": "port", "DATABASE_URL": "database.url" }`)
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   port: z.number().env("PORT"),
 *   database: z.object({
 *     url: z.string().env("DATABASE_URL"),
 *   }),
 * });
 *
 * extractEnvMapping(schema);
 * // Returns: { "PORT": "port", "DATABASE_URL": "database.url" }
 * ```
 */
export function extractEnvMapping(
  schema: z.ZodObject<z.ZodRawShape>
): Record<string, string> {
  const mapping: Record<string, string> = {};

  function traverse(shape: z.ZodRawShape, prefix = ""): void {
    for (const [key, value] of Object.entries(shape)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const zodValue = value as AnyZodType;

      // Check for env var on this field
      const envVar = getEnvVar(zodValue);
      if (envVar) {
        mapping[envVar] = path;
      }

      // Unwrap wrapper types to check for nested objects and env vars
      let innerSchema: AnyZodType | undefined = zodValue;

      // Keep unwrapping until we hit a non-wrapper type
      while (innerSchema) {
        // Check if inner schema has env var (handles z.string().env("X").default("y"))
        const innerEnvVar = getEnvVar(innerSchema);
        if (innerEnvVar && !mapping[innerEnvVar]) {
          mapping[innerEnvVar] = path;
        }

        // Check if it's a ZodObject - traverse its shape
        if (innerSchema instanceof z.ZodObject) {
          traverse(innerSchema.shape as z.ZodRawShape, path);
          break;
        }

        // Get the inner type for wrappers (ZodDefault, ZodOptional, ZodNullable, ZodEffects)
        const def = innerSchema._def as {
          innerType?: AnyZodType;
          schema?: AnyZodType; // ZodEffects uses 'schema' instead of 'innerType'
        };
        innerSchema = def.innerType ?? def.schema;
      }
    }
  }

  traverse(schema.shape as z.ZodRawShape);
  return mapping;
}
