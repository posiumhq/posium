/**
 * Transaction utilities for atomic multi-entity operations.
 *
 * Use withTransaction when you need to ensure multiple database
 * operations succeed or fail together.
 */

import type { DBType } from "@posium/db";
import type { ServiceContext } from "./context.js";

/**
 * Execute a function within a database transaction.
 *
 * The callback receives a new context with the transaction connection.
 * All database operations within the callback will be part of the same
 * transaction and will be rolled back if any operation fails.
 *
 * @example
 * ```typescript
 * const result = await withTransaction(ctx, async (txCtx) => {
 *   const project = await projectService.create(txCtx, projectInput);
 *   const env = await environmentService.create(txCtx, {
 *     projectId: project.id,
 *     name: "Production",
 *     isDefault: true,
 *   });
 *   return { project, env };
 * });
 * ```
 */
export async function withTransaction<T>(
  ctx: ServiceContext,
  fn: (txCtx: ServiceContext) => Promise<T>
): Promise<T> {
  return await ctx.db.transaction(async (tx) => {
    const txCtx: ServiceContext = {
      ...ctx,
      // Drizzle transaction has the same interface as the database
      db: tx as unknown as DBType,
      // Reset cached org role since we're in a new context
      _orgRole: undefined,
    };
    return await fn(txCtx);
  });
}

/**
 * Execute multiple operations in parallel, then commit all in a transaction.
 *
 * This is useful when you have independent operations that can be
 * executed concurrently but need to be committed atomically.
 *
 * @example
 * ```typescript
 * const [project, team] = await withParallelTransaction(ctx, async (txCtx) => {
 *   return await Promise.all([
 *     projectService.create(txCtx, projectInput),
 *     teamService.create(txCtx, teamInput),
 *   ]);
 * });
 * ```
 */
export async function withParallelTransaction<T>(
  ctx: ServiceContext,
  fn: (txCtx: ServiceContext) => Promise<T>
): Promise<T> {
  // Same as withTransaction - the parallelism is handled in the callback
  return await withTransaction(ctx, fn);
}
