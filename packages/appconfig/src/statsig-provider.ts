import type {
  StatsigOptions,
  StatsigUser,
  NormalizedEnvironment,
} from "./types.js";
import { StatsigInitError } from "./errors.js";

/**
 * Internal options for creating a Statsig provider
 * Includes the environment from AppConfig
 */
export interface CreateStatsigProviderOptions extends StatsigOptions {
  /**
   * Environment tier (inherited from AppConfig)
   */
  environment: NormalizedEnvironment;
}

/**
 * Statsig provider instance interface
 */
export interface StatsigProviderInstance {
  /**
   * Get dynamic config values from Statsig
   * Returns values from Statsig's cached config (auto-refreshed in background)
   * @param configName - The name of the dynamic config in Statsig
   * @param user - Optional user context for evaluation (enables experimentation)
   */
  getDynamicConfig: (
    configName: string,
    user?: StatsigUser,
  ) => Record<string, unknown>;

  /**
   * Get parameter store accessor from Statsig
   * @param storeName - The name of the parameter store in Statsig
   * @param user - Optional user context for evaluation
   */
  getParameterStore: (
    storeName: string,
    user?: StatsigUser,
  ) => ParameterStoreAccessor;

  /**
   * Shutdown the Statsig client
   */
  shutdown: () => Promise<void>;

  /**
   * Whether Statsig is available and initialized
   */
  isAvailable: boolean;

  /**
   * The underlying Statsig client instance
   * Use this for direct access to feature gates, experiments, layers, etc.
   * @see https://docs.statsig.com/server-core/node-core
   */
  client: import("@statsig/statsig-node-core").Statsig;
}

/**
 * Parameter store accessor for typed value retrieval
 * Uses the SDK's getValue<T> method with type inference
 */
export interface ParameterStoreAccessor {
  getValue: <T>(key: string, defaultValue: T) => T;
}

// Lazy-loaded Statsig module (only loaded when secretKey provided)
let statsigModule: typeof import("@statsig/statsig-node-core") | null = null;

/** Default environment variable for Statsig secret key */
const STATSIG_SECRET_KEY_ENV = "STATSIG_SECRET_KEY";

/**
 * Dynamically load the Statsig SDK
 * Returns null if SDK is not installed (graceful degradation for OSS users)
 */
async function loadStatsigModule(): Promise<
  typeof import("@statsig/statsig-node-core") | null
> {
  if (statsigModule) return statsigModule;

  try {
    statsigModule = await import("@statsig/statsig-node-core");
    return statsigModule;
  } catch {
    // Statsig SDK not installed - graceful degradation
    return null;
  }
}

/**
 * Build a StatsigUser object for evaluation
 */
function buildStatsigUser(
  StatsigUserClass: typeof import("@statsig/statsig-node-core").StatsigUser,
  user?: StatsigUser,
): import("@statsig/statsig-node-core").StatsigUser {
  if (!user) {
    return new StatsigUserClass({ userID: "server" });
  }

  return new StatsigUserClass({
    userID: user.userID ?? "server",
    email: user.email,
    ip: user.ip,
    userAgent: user.userAgent,
    country: user.country,
    locale: user.locale,
    appVersion: user.appVersion,
    customIDs: user.customIDs,
    custom: user.custom,
    privateAttributes: user.privateAttributes,
  });
}

/**
 * Create a Statsig provider instance
 * Returns null if Statsig SDK is not installed or options not provided
 *
 * The provider uses the new @statsig/statsig-node-core SDK which provides:
 * - Instance-based API (better for testing/multi-tenant)
 * - getDynamicConfig() for dynamic configs
 * - getParameterStore() for parameter stores
 * - Native binary with better performance
 *
 * @param options - Statsig configuration options with environment
 * @returns Provider instance or null if Statsig unavailable
 * @throws StatsigInitError if secretKey provided but initialization fails
 */
export async function createStatsigProvider(
  options?: CreateStatsigProviderOptions,
): Promise<StatsigProviderInstance | null> {
  // Resolve secret key: explicit option > environment variable
  const secretKey = options?.secretKey ?? process.env[STATSIG_SECRET_KEY_ENV];

  if (!secretKey) {
    return null;
  }

  const module = await loadStatsigModule();
  if (!module) {
    // Statsig SDK not installed - graceful degradation for OSS users
    return null;
  }

  const { Statsig, StatsigUser: StatsigUserClass } = module;

  try {
    // Create instance with secret key and options
    // Environment is passed as a string in StatsigOptions
    const statsig = new Statsig(secretKey, {
      environment: options?.environment ?? "development",
    });

    // Initialize (no arguments - options passed to constructor)
    await statsig.initialize();

    return {
      isAvailable: true,
      client: statsig,

      getDynamicConfig(
        configName: string,
        user?: StatsigUser,
      ): Record<string, unknown> {
        try {
          const statsigUser = buildStatsigUser(StatsigUserClass, user);
          const config = statsig.getDynamicConfig(statsigUser, configName);
          // Return the config values object directly
          return (config.value as Record<string, unknown>) ?? {};
        } catch {
          // Return empty object on error - file config will be used
          return {};
        }
      },

      getParameterStore(
        storeName: string,
        user?: StatsigUser,
      ): ParameterStoreAccessor {
        const statsigUser = buildStatsigUser(StatsigUserClass, user);
        const store = statsig.getParameterStore(statsigUser, storeName);

        return {
          getValue: <T>(key: string, defaultValue: T): T =>
            store.getValue(key, defaultValue),
        };
      },

      async shutdown(): Promise<void> {
        await statsig.shutdown();
      },
    };
  } catch (error) {
    throw new StatsigInitError(error instanceof Error ? error : undefined);
  }
}
