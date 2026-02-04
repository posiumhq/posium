/**
 * EnvironmentVarService - Environment variable management business logic.
 *
 * Handles CRUD operations for environment variables (secrets and plaintext).
 */

import { eq, and, isNull, desc } from "drizzle-orm";
import { schema } from "@posium/db";
import { publish, EVENTS } from "@posium/appevents";
import type { ServiceContext } from "../../context.js";
import { requireActorUserId } from "../../context.js";
import { NotFoundError, ConflictError, ValidationError } from "../../errors.js";
import { requireOrgMembership } from "../../auth/membership.js";
import { getCryptoService } from "../../crypto/index.js";
import type {
  EnvironmentVar,
  EnvironmentVarMetadata,
  ListEnvironmentVarsOptions,
  CreateEnvironmentVarInput,
  UpdateEnvironmentVarInput,
} from "./environment-var.types.js";

// Query limits to prevent memory issues
const MAX_VARS_PER_ENVIRONMENT = 100;

// Regex for valid environment variable key
const KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/**
 * EnvironmentVarService interface.
 */
export interface EnvironmentVarService {
  /** List all variables in an environment (metadata only, no values) */
  list(ctx: ServiceContext, options: ListEnvironmentVarsOptions): Promise<EnvironmentVarMetadata[]>;

  /** Get a single variable by ID (includes decrypted value) */
  getById(ctx: ServiceContext, id: string): Promise<EnvironmentVar>;

  /** Create a new variable */
  create(ctx: ServiceContext, input: CreateEnvironmentVarInput): Promise<EnvironmentVarMetadata>;

  /** Update a variable */
  update(ctx: ServiceContext, id: string, input: UpdateEnvironmentVarInput): Promise<EnvironmentVarMetadata>;

  /** Soft delete a variable */
  delete(ctx: ServiceContext, id: string): Promise<void>;

  /** Get all variables for an environment as key-value pairs (for runner) */
  getAllForEnvironment(ctx: ServiceContext, environmentId: string): Promise<Record<string, string>>;
}

/**
 * Get environment and verify org membership.
 */
async function getEnvironmentWithAuth(
  ctx: ServiceContext,
  environmentId: string
): Promise<{
  environment: { id: string; projectId: string };
  project: { id: string; orgId: string };
}> {
  const [environment] = await ctx.db
    .select({
      id: schema.environment.id,
      projectId: schema.environment.projectId,
    })
    .from(schema.environment)
    .where(and(eq(schema.environment.id, environmentId), isNull(schema.environment.deletedAt)))
    .limit(1);

  if (!environment) {
    throw new NotFoundError("Environment", environmentId);
  }

  // Get project and verify org membership
  const [project] = await ctx.db
    .select({ id: schema.project.id, orgId: schema.project.orgId })
    .from(schema.project)
    .where(and(eq(schema.project.id, environment.projectId), isNull(schema.project.deletedAt)))
    .limit(1);

  if (!project) {
    throw new NotFoundError("Project", environment.projectId);
  }

  await requireOrgMembership(ctx, project.orgId);
  return { environment, project };
}

/**
 * Get variable and verify org membership.
 */
async function getVarWithAuth(
  ctx: ServiceContext,
  varId: string
): Promise<{
  envVar: typeof schema.environmentVar.$inferSelect;
  environment: { id: string; projectId: string };
  project: { id: string; orgId: string };
}> {
  const [envVar] = await ctx.db
    .select()
    .from(schema.environmentVar)
    .where(and(eq(schema.environmentVar.id, varId), isNull(schema.environmentVar.deletedAt)))
    .limit(1);

  if (!envVar) {
    throw new NotFoundError("EnvironmentVar", varId);
  }

  const { environment, project } = await getEnvironmentWithAuth(ctx, envVar.environmentId);
  return { envVar, environment, project };
}

/**
 * Encrypt value if isSecret is true.
 */
function encryptValue(value: string, isSecret: boolean): string {
  if (!isSecret) {
    return value;
  }

  const crypto = getCryptoService();
  if (!crypto) {
    throw new ValidationError(
      "Cannot create secrets: SECRETS_MASTER_KEY environment variable is not set"
    );
  }

  return crypto.encrypt(value);
}

/**
 * Decrypt value if isSecret is true.
 */
function decryptValue(value: string, isSecret: boolean): string {
  if (!isSecret) {
    return value;
  }

  const crypto = getCryptoService();
  if (!crypto) {
    throw new ValidationError(
      "Cannot read secrets: SECRETS_MASTER_KEY environment variable is not set"
    );
  }

  return crypto.decrypt(value);
}

/**
 * Validate environment variable key format.
 */
function validateKey(key: string): void {
  if (!KEY_PATTERN.test(key)) {
    throw new ValidationError(
      "Variable key must be uppercase with underscores (e.g., API_KEY, DATABASE_URL)"
    );
  }
}

/**
 * Creates an EnvironmentVarService instance.
 */
export function createEnvironmentVarService(): EnvironmentVarService {
  return {
    async list(ctx, options) {
      const { environmentId } = options;

      // Verify environment exists and user has access
      await getEnvironmentWithAuth(ctx, environmentId);

      // Get all variables for this environment (metadata only)
      const vars = await ctx.db
        .select({
          id: schema.environmentVar.id,
          environmentId: schema.environmentVar.environmentId,
          key: schema.environmentVar.key,
          isSecret: schema.environmentVar.isSecret,
          createdAt: schema.environmentVar.createdAt,
          updatedAt: schema.environmentVar.updatedAt,
        })
        .from(schema.environmentVar)
        .where(
          and(
            eq(schema.environmentVar.environmentId, environmentId),
            isNull(schema.environmentVar.deletedAt)
          )
        )
        .orderBy(desc(schema.environmentVar.createdAt))
        .limit(MAX_VARS_PER_ENVIRONMENT);

      return vars.map((v) => ({
        id: v.id,
        environmentId: v.environmentId,
        key: v.key,
        isSecret: v.isSecret,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      }));
    },

    async getById(ctx, id) {
      const { envVar } = await getVarWithAuth(ctx, id);

      // Decrypt value if it's a secret
      const value = decryptValue(envVar.value, envVar.isSecret);

      return {
        id: envVar.id,
        environmentId: envVar.environmentId,
        key: envVar.key,
        value,
        isSecret: envVar.isSecret,
        createdAt: envVar.createdAt,
        updatedAt: envVar.updatedAt,
      };
    },

    async create(ctx, input) {
      const userId = requireActorUserId(ctx.actor);
      const { environmentId, key, value, isSecret = false } = input;

      // Validate key format
      validateKey(key);

      // Verify environment exists and user has access
      const { project } = await getEnvironmentWithAuth(ctx, environmentId);

      // Check for duplicate key in environment
      const [existing] = await ctx.db
        .select({ id: schema.environmentVar.id })
        .from(schema.environmentVar)
        .where(
          and(
            eq(schema.environmentVar.environmentId, environmentId),
            eq(schema.environmentVar.key, key),
            isNull(schema.environmentVar.deletedAt)
          )
        )
        .limit(1);

      if (existing) {
        throw new ConflictError(`Variable with key '${key}' already exists in this environment`);
      }

      // Encrypt value if secret
      const storedValue = encryptValue(value, isSecret);

      // Create the variable
      const [created] = await ctx.db
        .insert(schema.environmentVar)
        .values({
          environmentId,
          key,
          value: storedValue,
          isSecret,
        })
        .returning();

      if (!created) {
        throw new Error("Failed to create environment variable");
      }

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.ENVIRONMENT_VAR_CREATED_V1, {
          varId: created.id,
          environmentId,
          projectId: project.id,
          key,
          isSecret,
          createdByUserId: userId,
        });
      }

      return {
        id: created.id,
        environmentId: created.environmentId,
        key: created.key,
        isSecret: created.isSecret,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
    },

    async update(ctx, id, input) {
      const userId = requireActorUserId(ctx.actor);
      const { envVar, project } = await getVarWithAuth(ctx, id);

      // Build update object
      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      // Determine if we're changing to/from secret
      const newIsSecret = input.isSecret ?? envVar.isSecret;
      const valueChanged = input.value !== undefined;
      const secretFlagChanged = input.isSecret !== undefined && input.isSecret !== envVar.isSecret;

      if (valueChanged || secretFlagChanged) {
        // Need to re-encrypt/decrypt the value
        let newValue: string;

        if (valueChanged) {
          // Use the new value
          newValue = input.value!;
        } else {
          // Decrypt existing value first
          newValue = decryptValue(envVar.value, envVar.isSecret);
        }

        // Encrypt with new secret flag
        updates.value = encryptValue(newValue, newIsSecret);
        updates.isSecret = newIsSecret;
      }

      // Update the variable
      const [updated] = await ctx.db
        .update(schema.environmentVar)
        .set(updates)
        .where(eq(schema.environmentVar.id, id))
        .returning();

      if (!updated) {
        throw new Error("Failed to update environment variable");
      }

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.ENVIRONMENT_VAR_UPDATED_V1, {
          varId: id,
          environmentId: envVar.environmentId,
          projectId: project.id,
          key: envVar.key,
          updatedByUserId: userId,
        });
      }

      return {
        id: updated.id,
        environmentId: updated.environmentId,
        key: updated.key,
        isSecret: updated.isSecret,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    },

    async delete(ctx, id) {
      const userId = requireActorUserId(ctx.actor);
      const { envVar, project } = await getVarWithAuth(ctx, id);

      // Soft delete
      await ctx.db
        .update(schema.environmentVar)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.environmentVar.id, id));

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.ENVIRONMENT_VAR_DELETED_V1, {
          varId: id,
          environmentId: envVar.environmentId,
          projectId: project.id,
          key: envVar.key,
          deletedByUserId: userId,
        });
      }
    },

    async getAllForEnvironment(ctx, environmentId) {
      // Verify environment exists and user has access
      await getEnvironmentWithAuth(ctx, environmentId);

      // Get all variables
      const vars = await ctx.db
        .select({
          key: schema.environmentVar.key,
          value: schema.environmentVar.value,
          isSecret: schema.environmentVar.isSecret,
        })
        .from(schema.environmentVar)
        .where(
          and(
            eq(schema.environmentVar.environmentId, environmentId),
            isNull(schema.environmentVar.deletedAt)
          )
        )
        .limit(MAX_VARS_PER_ENVIRONMENT);

      // Build key-value map, decrypting secrets
      const result: Record<string, string> = {};
      for (const v of vars) {
        result[v.key] = decryptValue(v.value, v.isSecret);
      }

      return result;
    },
  };
}
