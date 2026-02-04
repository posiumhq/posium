/**
 * Type definitions for EnvironmentVarService.
 */

/**
 * Environment variable with decrypted value.
 */
export interface EnvironmentVar {
  id: string;
  environmentId: string;
  key: string;
  value: string; // Decrypted if secret
  isSecret: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

/**
 * Environment variable metadata (without value).
 * Used for listing to avoid exposing values.
 */
export interface EnvironmentVarMetadata {
  id: string;
  environmentId: string;
  key: string;
  isSecret: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

/**
 * Options for listing environment variables.
 */
export interface ListEnvironmentVarsOptions {
  environmentId: string;
}

/**
 * Input for creating an environment variable.
 */
export interface CreateEnvironmentVarInput {
  environmentId: string;
  key: string;
  value: string;
  isSecret?: boolean; // Default false
}

/**
 * Input for updating an environment variable.
 */
export interface UpdateEnvironmentVarInput {
  value?: string;
  isSecret?: boolean;
}
