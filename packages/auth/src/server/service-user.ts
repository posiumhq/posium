/**
 * Service User Management for Org-Level API Keys.
 *
 * Each organization gets a hidden "service user" that owns all API keys.
 * This pattern enables org-level key ownership while working within
 * BetterAuth's user-scoped API key model.
 *
 * Service users:
 * - Never log in (no password)
 * - Have "service" role in org membership
 * - Are filtered from member UIs
 * - Own all API keys for their org
 */

import { eq } from "drizzle-orm";
import { createId } from "@posium/id";
import * as schema from "@posium/db/schema";
import type { AuthDatabase } from "./config.js";
import { getServiceUserEmail } from "./api-key-utils.js";

// Re-export for convenience
export { getServiceUserEmail } from "./api-key-utils.js";

/**
 * Get or create the service user for an organization.
 *
 * Uses atomic upsert to handle race conditions when multiple
 * requests try to create the service user simultaneously.
 *
 * @example
 * ```ts
 * const { userId, isNew } = await getOrCreateServiceUser("org_abc123", db);
 * // userId: "usr_svc_..."
 * // isNew: true (first call) or false (subsequent calls)
 * ```
 */
export async function getOrCreateServiceUser(
  orgId: string,
  db: AuthDatabase
): Promise<{ userId: string; isNew: boolean }> {
  const email = getServiceUserEmail(orgId);
  const newUserId = createId("user");

  // Atomic upsert - no race condition
  const [inserted] = await db
    .insert(schema.user)
    .values({
      id: newUserId,
      email,
      name: "Service Account",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing({ target: schema.user.email })
    .returning({ id: schema.user.id });

  if (inserted) {
    // New user was created, add as org member with "service" role
    await db
      .insert(schema.orgMember)
      .values({
        id: createId("orgMember"),
        orgId,
        userId: inserted.id,
        role: "service",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    return { userId: inserted.id, isNew: true };
  }

  // User already existed (conflict), fetch existing
  const existing = await db.query.user.findFirst({
    where: eq(schema.user.email, email),
    columns: { id: true },
  });

  if (!existing) {
    // This shouldn't happen, but handle it gracefully
    throw new Error(`Failed to find or create service user for org ${orgId}`);
  }

  // Ensure org membership exists - handles race condition where user was
  // created by concurrent request but membership creation may have failed
  await db
    .insert(schema.orgMember)
    .values({
      id: createId("orgMember"),
      orgId,
      userId: existing.id,
      role: "service",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  return { userId: existing.id, isNew: false };
}

/**
 * Clean up service user and their API keys when an org is deleted.
 *
 * This should be called as part of org deletion cleanup.
 * Uses direct DB operations because BetterAuth's listApiKeys and
 * deleteApiKey require session cookies that service users don't have.
 */
export async function deleteServiceUser(
  orgId: string,
  db: AuthDatabase
): Promise<void> {
  const email = getServiceUserEmail(orgId);

  const serviceUser = await db.query.user.findFirst({
    where: eq(schema.user.email, email),
    columns: { id: true },
  });

  if (!serviceUser) {
    return; // No service user to delete
  }

  // Delete all API keys first
  await db.delete(schema.apikey).where(eq(schema.apikey.userId, serviceUser.id));

  // Delete org membership
  await db.delete(schema.orgMember).where(eq(schema.orgMember.userId, serviceUser.id));

  // Delete the service user
  await db.delete(schema.user).where(eq(schema.user.id, serviceUser.id));
}
