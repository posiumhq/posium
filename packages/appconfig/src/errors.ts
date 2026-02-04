import type { ZodError } from "zod";

/**
 * Base error class for AppConfig errors
 */
export class AppConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppConfigError";
  }
}

/**
 * Error thrown when loading or parsing config file fails
 */
export class ConfigFileError extends AppConfigError {
  constructor(
    public readonly filePath: string,
    cause?: Error,
  ) {
    super(`Failed to load config file: ${filePath}`);
    this.name = "ConfigFileError";
    this.cause = cause;
  }
}

/**
 * Error thrown when config validation against schema fails
 */
export class ConfigValidationError extends AppConfigError {
  constructor(public readonly zodError: ZodError) {
    super(`Config validation failed: ${zodError.message}`);
    this.name = "ConfigValidationError";
  }
}

/**
 * Error thrown when Statsig initialization fails
 */
export class StatsigInitError extends AppConfigError {
  constructor(cause?: Error) {
    super("Failed to initialize Statsig");
    this.name = "StatsigInitError";
    this.cause = cause;
  }
}

/**
 * Error thrown when AppConfig methods are called before initialization
 */
export class NotInitializedError extends AppConfigError {
  constructor() {
    super("AppConfig not initialized. Call initialize() before using.");
    this.name = "NotInitializedError";
  }
}
