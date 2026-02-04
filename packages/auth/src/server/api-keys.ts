/**
 * API Key CRUD Operations.
 *
 * These functions provide the core operations for managing org-level API keys:
 * - createKey: Create a new API key
 * - listKeys: List all API keys for an org (filtered by user access)
 * - updateKey: Update an existing API key
 * - deleteKey: Delete an API key
 *
 * All operations use the Service User pattern: keys are owned by a hidden
 * service user for each org, enabling org-level ownership within BetterAuth's
 * user-scoped model.
 */

import { and, eq, inArray } from "drizzle-orm";
import { createId } from "@posium/id";
import * as schema from "@posium/db/schema";
import type { AuthDatabase, Auth } from "./config.js";
import type {
  CreateKeyInput,
  UpdateKeyInput,
  ApiKeyInfo,
  CreateKeyResult,
} from "./types.js";
import {
  getServiceUserEmail,
  parseApiKeyMetadata,
  parsePermissions,
  buildPermissions,
  buildMetadata,
  extractProjectIds,
  hasOrgPermission,
} from "./api-key-utils.js";
import { getOrCreateServiceUser } from "./service-user.js";
import {
  isOrgAdmin,
  canCreateKey,
  canManageKey,
  getAccessibleProjectIds,
} from "./api-key-auth.js";

/**
 * Error thrown when a user is not authorized to perform an operation.
 */
export class ForbiddenError extends Error {
  code = "FORBIDDEN" as const;

  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Error thrown when a resource is not found.
 */
export class NotFoundError extends Error {
  code = "NOT_FOUND" as const;

  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Error thrown when input validation fails.
 */
export class BadRequestError extends Error {
  code = "BAD_REQUEST" as const;

  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

/**
 * Create a new API key for an organization.
 *
 * @throws {ForbiddenError} If user is not authorized to create key with given scope/projects
 * @throws {BadRequestError} If project-scoped key is missing projectIds or projects don't belong to org
 *
 * @example
 * ```ts
 * const result = await createKey(db, auth, {
 *   orgId: "org_123",
 *   name: "CI/CD Key",
 *   scope: "org",
 *   createdBy: "usr_456"
 * });
 * console.log(result.key); // Full key - display once!
 * ```
 */
export async function createKey(
  db: AuthDatabase,
  auth: Auth,
  input: CreateKeyInput
): Promise<CreateKeyResult> {
  // Validate project-scoped keys have projectIds
  if (input.scope === "project" && (!input.projectIds || input.projectIds.length === 0)) {
    throw new BadRequestError("projectIds required when scope is 'project'");
  }

  // Verify projects belong to org BEFORE authorization (BadRequestError before ForbiddenError)
  if (input.scope === "project" && input.projectIds?.length) {
    const projects = await db.query.project.findMany({
      where: and(
        inArray(schema.project.id, input.projectIds),
        eq(schema.project.orgId, input.orgId)
      ),
      columns: { id: true },
    });

    if (projects.length !== input.projectIds.length) {
      throw new BadRequestError("One or more projects do not belong to this organization");
    }
  }

  // Check authorization
  const canCreate = await canCreateKey(
    db,
    input.orgId,
    input.createdBy,
    input.scope,
    input.projectIds
  );

  if (!canCreate) {
    throw new ForbiddenError("Not authorized to create API key with this scope");
  }

  // Get or create service user
  const { userId: serviceUserId } = await getOrCreateServiceUser(input.orgId, db);

  // Build permissions
  const permissions = buildPermissions(
    input.scope,
    input.orgId,
    input.projectIds || []
  );

  // Create key via BetterAuth
  const result = await auth.api.createApiKey({
    body: {
      userId: serviceUserId,
      name: input.name,
      prefix: "apikey_",
      permissions,
      expiresIn: input.expiresInDays
        ? input.expiresInDays * 24 * 60 * 60
        : undefined,
      metadata: buildMetadata(
        input.orgId,
        input.createdBy,
        "", // Will update with suffix after
        input.scope,
        input.projectIds || []
      ),
    },
  });

  // Extract suffix from key and update metadata via direct DB
  // Note: BetterAuth's updateApiKey doesn't reliably persist metadata updates,
  // so we use direct DB update like seed.ts does for other fields
  const suffix = result.key.slice(-5);
  await db
    .update(schema.apikey)
    .set({
      metadata: JSON.stringify(buildMetadata(
        input.orgId,
        input.createdBy,
        suffix,
        input.scope,
        input.projectIds || []
      )),
    })
    .where(eq(schema.apikey.id, result.id));

  // Log audit event
  await logApiKeyAction(
    db,
    "create",
    input.orgId,
    result.id,
    input.createdBy,
    `Created API key "${input.name}" with ${input.scope} scope`
  );

  return {
    id: result.id,
    key: result.key,
    name: input.name,
    scope: input.scope,
    expiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
  };
}

/**
 * List API keys for an organization.
 *
 * Returns only keys the user can see:
 * - Admins see all keys
 * - Members see only keys for projects they have access to
 *
 * @example
 * ```ts
 * const keys = await listKeys(db, "org_123", "usr_456");
 * // Returns ApiKeyInfo[] filtered by user's access
 * ```
 */
export async function listKeys(
  db: AuthDatabase,
  orgId: string,
  userId: string,
  projectId?: string
): Promise<ApiKeyInfo[]> {
  // Get service user
  const email = getServiceUserEmail(orgId);
  const serviceUser = await db.query.user.findFirst({
    where: eq(schema.user.email, email),
    columns: { id: true },
  });

  if (!serviceUser) {
    return [];
  }

  // Direct DB query - BetterAuth's listApiKeys requires session cookies
  const keys = await db.query.apikey.findMany({
    where: eq(schema.apikey.userId, serviceUser.id),
  });

  const userIsAdmin = await isOrgAdmin(db, orgId, userId);

  // If not admin, get user's accessible project IDs
  let accessibleProjectIds: string[] = [];
  if (!userIsAdmin) {
    accessibleProjectIds = await getAccessibleProjectIds(db, userId, orgId);
  }

  // Filter keys based on user access and optional projectId filter
  const filteredKeys = keys.filter((key: typeof keys[number]) => {
    const perms = parsePermissions(key.permissions);
    const orgResource = `org:${orgId}`;
    const isOrgWide = perms[orgResource] !== undefined;

    // If filtering by projectId
    if (projectId) {
      const projectResource = `project:${projectId}`;
      // Include if org-wide OR includes this specific project
      if (!isOrgWide && perms[projectResource] === undefined) {
        return false;
      }
    }

    // Admins can see all keys
    if (userIsAdmin) return true;

    // Non-admins cannot see org-wide keys
    if (isOrgWide) return false;

    // Non-admins can only see keys for projects they have access to
    const keyProjectIds = extractProjectIds(perms);
    return keyProjectIds.some((pid) => accessibleProjectIds.includes(pid));
  });

  // Collect all project IDs for batch lookup
  const allProjectIds = new Set<string>();
  for (const key of filteredKeys) {
    const perms = parsePermissions(key.permissions);
    extractProjectIds(perms).forEach((id) => allProjectIds.add(id));
  }

  // Batch fetch project names
  const projectsMap = new Map<string, { id: string; name: string }>();
  if (allProjectIds.size > 0) {
    const projects = await db.query.project.findMany({
      where: inArray(schema.project.id, [...allProjectIds]),
      columns: { id: true, name: true },
    });
    projects.forEach((p: { id: string; name: string }) => projectsMap.set(p.id, p));
  }

  // Build response
  return filteredKeys.map((key: typeof filteredKeys[number]) => {
    const metadata = parseApiKeyMetadata(key.metadata);
    const perms = parsePermissions(key.permissions);
    const isOrgWide = hasOrgPermission(perms, orgId);
    const projectIds = extractProjectIds(perms);

    const projects = projectIds
      .map((id) => projectsMap.get(id))
      .filter((p): p is { id: string; name: string } => p !== undefined);

    return {
      id: key.id,
      name: key.name || "",
      displayKey: `${key.prefix || "apikey_"}•••••${metadata.suffix || "?????"}`,
      enabled: key.enabled ?? true,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      createdBy: metadata.createdBy || "",
      scope: metadata.scope || (isOrgWide ? "org" : "project"),
      isOrgWide,
      projects,
    };
  });
}

/**
 * Update an existing API key.
 *
 * @throws {NotFoundError} If key or service user not found
 * @throws {ForbiddenError} If user is not authorized to update this key
 * @throws {BadRequestError} If changing to project scope without projectIds
 *
 * @example
 * ```ts
 * await updateKey(db, auth, {
 *   orgId: "org_123",
 *   keyId: "apikey_456",
 *   name: "New Name",
 *   enabled: false
 * }, "usr_789");
 * ```
 */
export async function updateKey(
  db: AuthDatabase,
  auth: Auth,
  input: UpdateKeyInput,
  userId: string
): Promise<{ success: boolean }> {
  // Check if user can manage this key
  const canManage = await canManageKey(db, input.orgId, userId, input.keyId);
  if (!canManage) {
    throw new ForbiddenError("Not authorized to update this API key");
  }

  // Get service user
  const email = getServiceUserEmail(input.orgId);
  const serviceUser = await db.query.user.findFirst({
    where: eq(schema.user.email, email),
    columns: { id: true },
  });

  if (!serviceUser) {
    throw new NotFoundError("Service user not found");
  }

  // Get the key
  const key = await db.query.apikey.findFirst({
    where: and(
      eq(schema.apikey.id, input.keyId),
      eq(schema.apikey.userId, serviceUser.id)
    ),
  });

  if (!key) {
    throw new NotFoundError("API key not found");
  }

  // Build update payload
  const updates: Record<string, unknown> = {};
  const existingMeta = parseApiKeyMetadata(key.metadata);

  if (input.name !== undefined) {
    updates.name = input.name;
  }

  if (input.enabled !== undefined) {
    updates.enabled = input.enabled;
  }

  // Handle scope/permission changes
  if (input.scope !== undefined) {
    const currentScope = existingMeta.scope || "project";

    // Validate projectIds first (BadRequestError before ForbiddenError)
    if (input.scope === "project" && !input.projectIds?.length) {
      throw new BadRequestError("projectIds required when scope is 'project'");
    }

    // Always validate authorization for the target scope/projects
    // This prevents both scope escalation AND project list escalation
    const canChangeScope = await canCreateKey(
      db,
      input.orgId,
      userId,
      input.scope,
      input.projectIds
    );
    if (!canChangeScope) {
      throw new ForbiddenError(
        input.scope !== currentScope
          ? "Not authorized to change key to this scope"
          : "Not authorized to access one or more target projects"
      );
    }

    if (input.scope === "project") {
      // projectIds is guaranteed to exist here due to early validation above
      const projectIds = input.projectIds!;

      // Verify projects belong to org
      const projects = await db.query.project.findMany({
        where: and(
          inArray(schema.project.id, projectIds),
          eq(schema.project.orgId, input.orgId)
        ),
        columns: { id: true },
      });

      if (projects.length !== projectIds.length) {
        throw new BadRequestError("One or more projects do not belong to this organization");
      }

      // Build project-scoped permissions
      updates.permissions = buildPermissions("project", input.orgId, projectIds);
      updates.metadata = buildMetadata(
        input.orgId,
        existingMeta.createdBy || "",
        existingMeta.suffix || "",
        "project",
        projectIds
      );
    } else {
      // Change to org-wide
      updates.permissions = buildPermissions("org", input.orgId, []);
      updates.metadata = buildMetadata(
        input.orgId,
        existingMeta.createdBy || "",
        existingMeta.suffix || "",
        "org",
        []
      );
    }
  }

  // Update via BetterAuth
  await auth.api.updateApiKey({
    body: {
      userId: serviceUser.id,
      keyId: input.keyId,
      ...updates,
    },
  });

  // Log audit event with scope change details if applicable
  const currentScope = existingMeta.scope || "project";
  const isScopeChange = input.scope !== undefined && input.scope !== currentScope;
  const summary = isScopeChange
    ? `Changed API key "${key.name || input.keyId}" scope from ${currentScope} to ${input.scope}`
    : `Updated API key "${key.name || input.keyId}"`;

  // Build diff in expected {before, after} format
  const diff: { before?: Record<string, unknown>; after?: Record<string, unknown> } = {};
  if (Object.keys(updates).length > 0) {
    diff.before = {
      name: key.name,
      enabled: key.enabled,
      scope: currentScope,
    };
    diff.after = {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
      ...(input.scope !== undefined && { scope: input.scope }),
      ...(input.projectIds !== undefined && { projectIds: input.projectIds }),
    };
  }

  await logApiKeyAction(
    db,
    "update",
    input.orgId,
    input.keyId,
    userId,
    summary,
    Object.keys(diff).length > 0 ? diff : undefined
  );

  return { success: true };
}

/**
 * Delete an API key.
 *
 * Uses direct database deletion because BetterAuth's deleteApiKey
 * requires session cookies that service users don't have.
 *
 * @throws {NotFoundError} If key or service user not found
 * @throws {ForbiddenError} If user is not authorized to delete this key
 *
 * @example
 * ```ts
 * await deleteKey(db, "org_123", "apikey_456", "usr_789");
 * ```
 */
export async function deleteKey(
  db: AuthDatabase,
  orgId: string,
  keyId: string,
  deletedBy: string
): Promise<{ success: boolean }> {
  // Check if user can manage this key
  const canManage = await canManageKey(db, orgId, deletedBy, keyId);
  if (!canManage) {
    throw new ForbiddenError("Not authorized to delete this API key");
  }

  // Get service user
  const email = getServiceUserEmail(orgId);
  const serviceUser = await db.query.user.findFirst({
    where: eq(schema.user.email, email),
    columns: { id: true },
  });

  if (!serviceUser) {
    throw new NotFoundError("Service user not found");
  }

  // Get the key (for audit log)
  const key = await db.query.apikey.findFirst({
    where: and(eq(schema.apikey.id, keyId), eq(schema.apikey.userId, serviceUser.id)),
    columns: { id: true, name: true },
  });

  if (!key) {
    throw new NotFoundError("API key not found");
  }

  // Direct deletion - BetterAuth's deleteApiKey requires session cookies
  await db.delete(schema.apikey).where(eq(schema.apikey.id, keyId));

  // Log audit event
  await logApiKeyAction(
    db,
    "delete",
    orgId,
    keyId,
    deletedBy,
    `Deleted API key "${key.name || keyId}"`
  );

  return { success: true };
}

/**
 * Log an API key action to the audit log.
 */
async function logApiKeyAction(
  db: AuthDatabase,
  action: "create" | "update" | "delete",
  orgId: string,
  keyId: string,
  actorUserId: string,
  summary: string,
  diff?: Record<string, unknown>
): Promise<void> {
  await db.insert(schema.auditLog).values({
    id: createId("auditLog"),
    orgId,
    actorUserId,
    action: `api_key.${action}`,
    entityType: "apikey",
    entityId: keyId,
    summary,
    diff: diff as schema.AuditDiff | undefined,
    createdAt: new Date(),
  });
}
