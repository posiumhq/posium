import type { z } from "zod";

/**
 * User context for Statsig evaluation
 * Compatible with @statsig/statsig-node-core StatsigUser type
 */
export interface StatsigUser {
  userID?: string;
  customIDs?: Record<string, string>;
  email?: string;
  ip?: string;
  userAgent?: string;
  country?: string;
  locale?: string;
  appVersion?: string;
  custom?: Record<string, string | number | boolean | string[]>;
  privateAttributes?: Record<string, string | number | boolean | string[]>;
}

/**
 * Normalized environment values
 */
export type NormalizedEnvironment =
  | "development"
  | "staging"
  | "production"
  | "test"
  | string;

/**
 * Statsig configuration options
 */
export interface StatsigOptions {
  /**
   * Statsig server secret key
   * @default process.env.STATSIG_SECRET_KEY
   */
  secretKey?: string;

  /**
   * Name of the Dynamic Config in Statsig
   * @default "app_config"
   */
  configName?: string;
}

/**
 * Configuration options for AppConfig
 */
export interface AppConfigOptions<TSchema extends z.ZodObject<z.ZodRawShape>> {
  /**
   * Zod schema defining the configuration structure and defaults
   */
  schema: TSchema;

  /**
   * Directory containing config files
   * - config.json: Base configuration (always loaded if exists)
   * - config.<env>.json: Environment-specific overrides
   *
   * @default "./appconfig"
   *
   * @example
   * ```
   * appconfig/
   * ├── config.json           # Base config
   * ├── config.development.json
   * ├── config.staging.json
   * └── config.production.json
   * ```
   */
  configDir?: string;

  /**
   * Environment name for loading config.<env>.json and Statsig tier
   *
   * Supports aliases (case-insensitive):
   * - "dev" | "development" → "development"
   * - "prod" | "production" → "production"
   * - "stage" | "stag" | "staging" → "staging"
   * - "test" | "testing" → "test"
   *
   * @default process.env.NODE_ENV || "development"
   */
  environment?: string;

  /**
   * Statsig configuration (optional - OSS users can omit)
   * When provided, enables runtime dynamic config via Statsig Parameter Store
   * The environment tier is automatically inherited from the top-level environment
   */
  statsig?: StatsigOptions;
}

/**
 * Infer the configuration type from a Zod schema
 */
export type ConfigFromSchema<TSchema extends z.ZodObject<z.ZodRawShape>> =
  z.infer<TSchema>;

/**
 * Extract valid keys from a Zod object schema
 */
export type ConfigKeys<TSchema extends z.ZodObject<z.ZodRawShape>> =
  keyof z.infer<TSchema>;

/**
 * Get the type of a specific config key
 */
export type ConfigValue<
  TSchema extends z.ZodObject<z.ZodRawShape>,
  K extends ConfigKeys<TSchema>,
> = z.infer<TSchema>[K];

/**
 * Generate all valid dot-notation paths for a type
 * e.g., { a: { b: number } } → "a" | "a.b"
 */
export type Paths<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? K | `${K}.${Paths<T[K]>}`
        : K;
    }[keyof T & string]
  : never;

/**
 * Get the type at a given dot-notation path
 * e.g., PathValue<{ a: { b: number } }, "a.b"> → number
 */
export type PathValue<
  T,
  P extends string,
> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? PathValue<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

/**
 * All valid paths for a schema's inferred type
 */
export type ConfigPaths<TSchema extends z.ZodObject<z.ZodRawShape>> = Paths<
  z.infer<TSchema>
>;

/**
 * Get the type at a path in a schema's inferred type
 */
export type ConfigPathValue<
  TSchema extends z.ZodObject<z.ZodRawShape>,
  P extends ConfigPaths<TSchema>,
> = PathValue<z.infer<TSchema>, P>;
