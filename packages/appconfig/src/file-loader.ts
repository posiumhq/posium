import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { ConfigFileError } from "./errors.js";
import { deepMerge } from "./merge.js";
import type { NormalizedEnvironment } from "./types.js";

export interface FileLoaderResult {
  /** Merged config data from all loaded files */
  data: Record<string, unknown>;
  /** List of files that were loaded */
  loadedFiles: string[];
}

/**
 * Load a single JSON config file
 * Returns null if file doesn't exist
 *
 * @param filePath - Absolute path to JSON config file
 * @returns Parsed config data or null if not found
 * @throws ConfigFileError if file exists but cannot be read/parsed
 */
function loadJsonFile(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    throw new ConfigFileError(
      filePath,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Load config files from a directory with environment-specific overrides
 *
 * Loads files in order (each subsequent file overrides the previous):
 * 1. config.json - Base configuration
 * 2. config.<environment>.json - Environment-specific overrides
 *
 * @param configDir - Directory containing config files (relative or absolute)
 * @param environment - Normalized environment name (e.g., "development", "production")
 * @returns Merged config data and list of loaded files, or null if directory doesn't exist
 * @throws ConfigFileError if a file exists but cannot be read/parsed
 *
 * @example
 * ```typescript
 * // Directory structure:
 * // appconfig/
 * // ├── config.json           { "port": 3000, "debug": false }
 * // └── config.development.json { "debug": true }
 *
 * const result = loadConfigDir("./appconfig", "development");
 * // result.data = { "port": 3000, "debug": true }
 * // result.loadedFiles = ["./appconfig/config.json", "./appconfig/config.development.json"]
 * ```
 */
export function loadConfigDir(
  configDir: string,
  environment: NormalizedEnvironment,
): FileLoaderResult | null {
  const absoluteDir = resolve(process.cwd(), configDir);

  // Check if directory exists
  if (!existsSync(absoluteDir)) {
    return null;
  }

  const loadedFiles: string[] = [];
  let mergedData: Record<string, unknown> = {};

  // 1. Load base config (config.json)
  const baseConfigPath = join(absoluteDir, "config.json");
  const baseConfig = loadJsonFile(baseConfigPath);
  if (baseConfig) {
    mergedData = baseConfig;
    loadedFiles.push(baseConfigPath);
  }

  // 2. Load environment-specific config (config.<env>.json)
  const envConfigPath = join(absoluteDir, `config.${environment}.json`);
  const envConfig = loadJsonFile(envConfigPath);
  if (envConfig) {
    mergedData = deepMerge(mergedData, envConfig);
    loadedFiles.push(envConfigPath);
  }

  // Return null if no files were loaded (directory exists but no config files)
  if (loadedFiles.length === 0) {
    return null;
  }

  return {
    data: mergedData,
    loadedFiles,
  };
}
