/**
 * Type definitions for EnvironmentService.
 */

/**
 * Environment configuration.
 * Values must be primitives (string, number, boolean) to match schema.
 */
export type EnvironmentConfig = Record<string, string | number | boolean>;

/**
 * Basic environment info.
 */
export interface Environment {
  id: string;
  projectId: string;
  name: string;
  isDefault: boolean;
  config: EnvironmentConfig;
  createdAt: Date;
  updatedAt: Date | null;
}

/**
 * Options for listing environments.
 */
export interface ListEnvironmentsOptions {
  projectId: string;
}

/**
 * Input for creating an environment.
 */
export interface CreateEnvironmentInput {
  projectId: string;
  name: string;
  isDefault?: boolean;
  config?: EnvironmentConfig;
}

/**
 * Input for updating an environment.
 */
export interface UpdateEnvironmentInput {
  name?: string;
  isDefault?: boolean;
  config?: EnvironmentConfig;
}
