/**
 * EnvironmentService - Environment management business logic.
 *
 * Handles CRUD operations for project environments.
 */

import { eq, and, isNull, desc } from "drizzle-orm";
import { schema } from "@posium/db";
import { publish, EVENTS } from "@posium/appevents";
import type { ServiceContext } from "../../context.js";
import { requireActorUserId } from "../../context.js";
import { NotFoundError, ConflictError } from "../../errors.js";
import { requireOrgMembership } from "../../auth/membership.js";
import { withTransaction } from "../../transactions.js";
import type {
  Environment,
  EnvironmentConfig,
  ListEnvironmentsOptions,
  CreateEnvironmentInput,
  UpdateEnvironmentInput,
} from "./environment.types.js";

// Query limits to prevent memory issues
const MAX_ENVIRONMENTS_PER_PROJECT = 50;

/**
 * EnvironmentService interface.
 */
export interface EnvironmentService {
  /** List all environments in a project */
  list(ctx: ServiceContext, options: ListEnvironmentsOptions): Promise<Environment[]>;

  /** Get a single environment by ID */
  getById(ctx: ServiceContext, id: string): Promise<Environment>;

  /** Create a new environment */
  create(ctx: ServiceContext, input: CreateEnvironmentInput): Promise<Environment>;

  /** Update an environment */
  update(ctx: ServiceContext, id: string, input: UpdateEnvironmentInput): Promise<Environment>;

  /** Soft delete an environment */
  delete(ctx: ServiceContext, id: string): Promise<void>;
}

/**
 * Get project and verify org membership.
 */
async function getProjectForEnvironment(
  ctx: ServiceContext,
  projectId: string
): Promise<{ id: string; orgId: string }> {
  const [project] = await ctx.db
    .select({ id: schema.project.id, orgId: schema.project.orgId })
    .from(schema.project)
    .where(and(eq(schema.project.id, projectId), isNull(schema.project.deletedAt)))
    .limit(1);

  if (!project) {
    throw new NotFoundError("Project", projectId);
  }

  await requireOrgMembership(ctx, project.orgId);
  return project;
}

/**
 * Get environment and verify org membership.
 */
async function getEnvironmentWithAuth(
  ctx: ServiceContext,
  environmentId: string
): Promise<{
  environment: typeof schema.environment.$inferSelect;
  project: { id: string; orgId: string };
}> {
  const [environment] = await ctx.db
    .select()
    .from(schema.environment)
    .where(and(eq(schema.environment.id, environmentId), isNull(schema.environment.deletedAt)))
    .limit(1);

  if (!environment) {
    throw new NotFoundError("Environment", environmentId);
  }

  const project = await getProjectForEnvironment(ctx, environment.projectId);
  return { environment, project };
}

/**
 * Creates an EnvironmentService instance.
 */
export function createEnvironmentService(): EnvironmentService {
  return {
    async list(ctx, options) {
      const { projectId } = options;

      // Verify project exists and user has access
      await getProjectForEnvironment(ctx, projectId);

      // Get all environments for this project
      const environments = await ctx.db
        .select({
          id: schema.environment.id,
          projectId: schema.environment.projectId,
          name: schema.environment.name,
          isDefault: schema.environment.isDefault,
          config: schema.environment.config,
          createdAt: schema.environment.createdAt,
          updatedAt: schema.environment.updatedAt,
        })
        .from(schema.environment)
        .where(and(eq(schema.environment.projectId, projectId), isNull(schema.environment.deletedAt)))
        .orderBy(desc(schema.environment.createdAt))
        .limit(MAX_ENVIRONMENTS_PER_PROJECT);

      return environments.map((env) => ({
        id: env.id,
        projectId: env.projectId,
        name: env.name,
        isDefault: env.isDefault,
        config: (env.config ?? {}) as EnvironmentConfig,
        createdAt: env.createdAt,
        updatedAt: env.updatedAt,
      }));
    },

    async getById(ctx, id) {
      const { environment } = await getEnvironmentWithAuth(ctx, id);

      return {
        id: environment.id,
        projectId: environment.projectId,
        name: environment.name,
        isDefault: environment.isDefault,
        config: (environment.config ?? {}) as EnvironmentConfig,
        createdAt: environment.createdAt,
        updatedAt: environment.updatedAt,
      };
    },

    async create(ctx, input) {
      const userId = requireActorUserId(ctx.actor);
      const { projectId, name, isDefault, config } = input;

      // Verify project exists and user has access
      await getProjectForEnvironment(ctx, projectId);

      // Check for duplicate name in project
      const [existing] = await ctx.db
        .select({ id: schema.environment.id })
        .from(schema.environment)
        .where(
          and(
            eq(schema.environment.projectId, projectId),
            eq(schema.environment.name, name),
            isNull(schema.environment.deletedAt)
          )
        )
        .limit(1);

      if (existing) {
        throw new ConflictError(`Environment with name '${name}' already exists in this project`);
      }

      // Use transaction to atomically handle isDefault flag
      const newEnvironment = await withTransaction(ctx, async (txCtx) => {
        // If this environment should be default, unset any existing default
        if (isDefault) {
          await txCtx.db
            .update(schema.environment)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(
              and(
                eq(schema.environment.projectId, projectId),
                eq(schema.environment.isDefault, true),
                isNull(schema.environment.deletedAt)
              )
            );
        }

        // Create the environment
        const [created] = await txCtx.db
          .insert(schema.environment)
          .values({
            projectId,
            name,
            isDefault: isDefault ?? false,
            config: config ?? {},
            createdBy: userId,
          })
          .returning();

        if (!created) {
          throw new Error("Failed to create environment");
        }

        return created;
      });

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.ENVIRONMENT_CREATED_V1, {
          environmentId: newEnvironment.id,
          projectId,
          name,
          createdByUserId: userId,
        });
      }

      return {
        id: newEnvironment.id,
        projectId: newEnvironment.projectId,
        name: newEnvironment.name,
        isDefault: newEnvironment.isDefault,
        config: (newEnvironment.config ?? {}) as EnvironmentConfig,
        createdAt: newEnvironment.createdAt,
        updatedAt: newEnvironment.updatedAt,
      };
    },

    async update(ctx, id, input) {
      requireActorUserId(ctx.actor);
      const { environment } = await getEnvironmentWithAuth(ctx, id);

      // Check for duplicate name if changing name
      if (input.name !== undefined && input.name !== environment.name) {
        const [existing] = await ctx.db
          .select({ id: schema.environment.id })
          .from(schema.environment)
          .where(
            and(
              eq(schema.environment.projectId, environment.projectId),
              eq(schema.environment.name, input.name),
              isNull(schema.environment.deletedAt)
            )
          )
          .limit(1);

        if (existing) {
          throw new ConflictError(`Environment with name '${input.name}' already exists in this project`);
        }
      }

      // Build update object
      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updates.name = input.name;
      if (input.isDefault !== undefined) updates.isDefault = input.isDefault;
      if (input.config !== undefined) updates.config = input.config;

      // Use transaction if changing isDefault to atomically handle the flag
      const needsTransaction = input.isDefault === true && !environment.isDefault;

      if (needsTransaction) {
        const updated = await withTransaction(ctx, async (txCtx) => {
          // Unset any existing default
          await txCtx.db
            .update(schema.environment)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(
              and(
                eq(schema.environment.projectId, environment.projectId),
                eq(schema.environment.isDefault, true),
                isNull(schema.environment.deletedAt)
              )
            );

          // Update this environment
          const [result] = await txCtx.db
            .update(schema.environment)
            .set(updates)
            .where(eq(schema.environment.id, id))
            .returning();

          return result;
        });

        if (!updated) {
          throw new Error("Failed to update environment");
        }

        return {
          id: updated.id,
          projectId: updated.projectId,
          name: updated.name,
          isDefault: updated.isDefault,
          config: (updated.config ?? {}) as EnvironmentConfig,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        };
      }

      // No transaction needed for simple updates
      const [updated] = await ctx.db
        .update(schema.environment)
        .set(updates)
        .where(eq(schema.environment.id, id))
        .returning();

      if (!updated) {
        throw new Error("Failed to update environment");
      }

      return {
        id: updated.id,
        projectId: updated.projectId,
        name: updated.name,
        isDefault: updated.isDefault,
        config: (updated.config ?? {}) as EnvironmentConfig,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    },

    async delete(ctx, id) {
      const userId = requireActorUserId(ctx.actor);
      const { environment } = await getEnvironmentWithAuth(ctx, id);

      // Prevent deletion of default environment
      if (environment.isDefault) {
        throw new ConflictError(
          "Cannot delete the default environment. Please set another environment as default first."
        );
      }

      // Soft delete
      await ctx.db
        .update(schema.environment)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.environment.id, id));

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.ENVIRONMENT_DELETED_V1, {
          environmentId: id,
          projectId: environment.projectId,
          deletedByUserId: userId,
        });
      }
    },
  };
}
