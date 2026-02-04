import type { z } from "zod";
import { loadConfigDir } from "./file-loader.js";
import { deepMerge } from "./merge.js";
import { resolveEnvironment } from "./environment.js";
import {
  createStatsigProvider,
  type StatsigProviderInstance,
} from "./statsig-provider.js";
import type {
  AppConfigOptions,
  ConfigFromSchema,
  ConfigPaths,
  ConfigPathValue,
  StatsigUser,
  NormalizedEnvironment,
} from "./types.js";
import { ConfigValidationError, NotInitializedError } from "./errors.js";
import { extractEnvMapping } from "./zod-env.js";

/** Default config directory */
const DEFAULT_CONFIG_DIR = "./appconfig";

/**
 * AppConfig - Runtime dynamic configuration with type safety
 *
 * Features:
 * - Zod schema for type safety and validation
 * - Directory-based config files with environment-specific overrides
 * - Optional Statsig Parameter Store for runtime dynamic config
 * - Deep merge of config sources: Statsig > Env File > Base File > Schema defaults
 * - Graceful degradation when Statsig unavailable (OSS-friendly)
 * - Unified environment for both file loading and Statsig tier
 *
 * @example
 * ```typescript
 * import { AppConfig } from "@posium/appconfig";
 * import { z } from "zod";
 *
 * const schema = z.object({
 *   rateLimitPerMinute: z.number().default(100),
 *   features: z.object({
 *     darkMode: z.boolean().default(false),
 *   }).default({}),
 * });
 *
 * const config = new AppConfig({
 *   schema,
 *   configDir: "./appconfig", // Contains config.json, config.development.json, etc.
 *   environment: "development", // Or auto-detect from NODE_ENV
 *   statsig: { secretKey: process.env.STATSIG_SECRET_KEY },
 * });
 *
 * await config.initialize();
 *
 * const limit = config.get("rateLimitPerMinute"); // number
 * const features = config.get("features"); // { darkMode: boolean }
 * ```
 */
export class AppConfig<TSchema extends z.ZodObject<z.ZodRawShape>> {
  private readonly schema: TSchema;
  private readonly configDir: string;
  private readonly environment: NormalizedEnvironment;
  private readonly statsigOptions?: AppConfigOptions<TSchema>["statsig"];
  private readonly statsigConfigName: string;
  private readonly envMapping: Record<string, string>;

  private fileConfig: Record<string, unknown> = {};
  private envConfig: Record<string, unknown> = {};
  private statsigProvider: StatsigProviderInstance | null = null;
  private cachedConfig: ConfigFromSchema<TSchema> | null = null;
  private initialized = false;
  private loadedConfigFiles: string[] = [];

  constructor(options: AppConfigOptions<TSchema>) {
    this.schema = options.schema;
    this.configDir = options.configDir ?? DEFAULT_CONFIG_DIR;
    this.environment = resolveEnvironment(options.environment);
    this.statsigOptions = options.statsig;
    this.statsigConfigName = options.statsig?.configName ?? "app_config";

    // Auto-extract env mapping from schema .env() annotations
    this.envMapping = extractEnvMapping(options.schema);
  }

  /**
   * Initialize the config system
   * - Loads config files ONCE from configDir (config.json + config.<env>.json)
   * - Connects to Statsig if configured (provides runtime dynamic config)
   * - Validates merged config against schema
   *
   * Must be called before using get() or getAll()
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load file config from directory (config.json + config.<env>.json)
    const fileResult = loadConfigDir(this.configDir, this.environment);
    if (fileResult) {
      this.fileConfig = fileResult.data;
      this.loadedConfigFiles = fileResult.loadedFiles;
    }

    // Load env vars into config object
    this.envConfig = this.loadEnvVars();

    // Initialize Statsig with the unified environment
    if (this.statsigOptions) {
      this.statsigProvider = await createStatsigProvider({
        ...this.statsigOptions,
        environment: this.environment,
      });
    }

    // Compute initial merged config
    this.computeMergedConfig();
    this.initialized = true;
  }

  /**
   * Load environment variables according to the env mapping
   * @returns Config object with values from process.env
   */
  private loadEnvVars(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [envKey, configPath] of Object.entries(this.envMapping)) {
      const value = process.env[envKey];
      if (value !== undefined) {
        this.setPath(result, configPath, value);
      }
    }

    return result;
  }

  /**
   * Set a value at a dot-notation path in an object
   * Creates nested objects as needed
   */
  private setPath(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const keys = path.split(".");
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]!;
      if (!(key in current) || typeof current[key] !== "object") {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    const lastKey = keys[keys.length - 1]!;
    current[lastKey] = value;
  }

  /**
   * Get a configuration value by path (supports dot-notation for nested values)
   * Returns type-safe value based on schema
   *
   * When Statsig is enabled:
   * - Returns latest value from Statsig's auto-refreshed cache
   * - Deep merged with file config and schema defaults
   * - User context enables experimentation (different users can get different values)
   *
   * When Statsig is disabled:
   * - Returns static value from file config + schema defaults
   *
   * @param path - The configuration path (e.g., "port" or "features.darkMode")
   * @param user - Optional user context for Statsig evaluation (enables experimentation)
   * @throws NotInitializedError if called before initialize()
   *
   * @example
   * ```typescript
   * // Top-level access
   * config.get("port")           // number
   * config.get("features")       // { darkMode: boolean, ... }
   *
   * // Nested access with dot-notation
   * config.get("features.darkMode")     // boolean
   * config.get("api.timeout")           // number
   * ```
   */
  get<P extends ConfigPaths<TSchema>>(
    path: P,
    user?: StatsigUser,
  ): ConfigPathValue<TSchema, P> {
    this.ensureInitialized();
    // Re-compute merged config on each get() to pick up Statsig updates
    // This is efficient because Statsig SDK caches values locally
    const config = this.getCachedOrCompute(user);
    return this.getValueAtPath(config, path) as ConfigPathValue<TSchema, P>;
  }

  /**
   * Traverse an object by dot-notation path
   */
  private getValueAtPath(obj: unknown, path: string): unknown {
    return path
      .split(".")
      .reduce<unknown>(
        (current, key) =>
          current !== null && typeof current === "object"
            ? (current as Record<string, unknown>)[key]
            : undefined,
        obj,
      );
  }

  /**
   * Get the entire configuration object
   *
   * @param user - Optional user context for Statsig evaluation (enables experimentation)
   * @throws NotInitializedError if called before initialize()
   */
  getAll(user?: StatsigUser): ConfigFromSchema<TSchema> {
    this.ensureInitialized();
    return { ...this.getCachedOrCompute(user) };
  }

  /**
   * Get the current normalized environment
   * Returns the environment used for file loading and Statsig tier
   */
  get currentEnvironment(): NormalizedEnvironment {
    return this.environment;
  }

  /**
   * Get the list of config files that were loaded
   * Returns empty array if no files were found
   */
  get configFiles(): readonly string[] {
    return this.loadedConfigFiles;
  }

  /**
   * Check if Statsig is connected and available
   * Returns false if Statsig not configured or SDK not installed
   */
  get isStatsigAvailable(): boolean {
    return this.statsigProvider?.isAvailable ?? false;
  }

  /**
   * Get the underlying Statsig client for direct access to feature gates,
   * experiments, layers, parameter stores, and other Statsig features.
   * Returns null if Statsig is not configured or not available.
   *
   * @example
   * ```typescript
   * const client = config.statsig;
   * if (client) {
   *   const user = new StatsigUser({ userID: "user123" });
   *   const gate = client.checkGate(user, "my_feature_gate");
   *   const experiment = client.getExperiment(user, "my_experiment");
   *   const paramStore = client.getParameterStore(user, "my_param_store");
   * }
   * ```
   */
  get statsig(): import("@statsig/statsig-node-core").Statsig | null {
    return this.statsigProvider?.client ?? null;
  }

  /**
   * Gracefully shutdown (closes Statsig connection)
   * Call this on application shutdown
   *
   * After shutdown, get() and getAll() will throw NotInitializedError.
   * Call initialize() again to re-use the config instance.
   */
  async shutdown(): Promise<void> {
    if (this.statsigProvider) {
      await this.statsigProvider.shutdown();
      this.statsigProvider = null;
    }
    this.initialized = false;
    this.cachedConfig = null;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new NotInitializedError();
    }
  }

  /**
   * Get cached config or recompute if Statsig is enabled
   * When Statsig is disabled, returns cached config (static)
   * When Statsig is enabled, recomputes to get latest dynamic values
   */
  private getCachedOrCompute(user?: StatsigUser): ConfigFromSchema<TSchema> {
    if (!this.statsigProvider) {
      // No Statsig - return cached static config
      return this.cachedConfig!;
    }

    // With Statsig - recompute to get latest dynamic values
    // Statsig SDK caches values locally and auto-refreshes in background
    // User context enables experimentation (different users can get different values)
    const statsigConfig = this.statsigProvider.getDynamicConfig(
      this.statsigConfigName,
      user,
    );

    // Deep merge: file config as base, Statsig overrides, env vars highest priority
    const merged = deepMerge(this.fileConfig, statsigConfig, this.envConfig);

    // Validate and apply schema defaults
    const result = this.schema.safeParse(merged);
    if (!result.success) {
      throw new ConfigValidationError(result.error);
    }

    return result.data as ConfigFromSchema<TSchema>;
  }

  /**
   * Compute initial merged config from all sources
   * Priority: Env vars > Statsig > Env File > Base File > Schema defaults (at each nested level)
   */
  private computeMergedConfig(): void {
    let statsigConfig: Record<string, unknown> = {};

    if (this.statsigProvider) {
      statsigConfig = this.statsigProvider.getDynamicConfig(
        this.statsigConfigName,
      );
    }

    // Deep merge: file config as base, Statsig overrides, env vars highest priority
    const merged = deepMerge(this.fileConfig, statsigConfig, this.envConfig);

    // Validate and apply schema defaults
    const result = this.schema.safeParse(merged);
    if (!result.success) {
      throw new ConfigValidationError(result.error);
    }

    this.cachedConfig = result.data as ConfigFromSchema<TSchema>;
  }
}

// Re-export types and errors
export * from "./types.js";
export * from "./errors.js";
export { deepMerge } from "./merge.js";
export { normalizeEnvironment, resolveEnvironment } from "./environment.js";
export { extractEnvMapping, getEnvVar } from "./zod-env.js";
