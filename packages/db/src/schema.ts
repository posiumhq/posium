import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createId as createCuid } from "@paralleldrive/cuid2";
import { createId, isValidEntityType } from "@posium/id";
import type { TestStep } from "@posium/types";

// ============================================================================
// JSONB Types
// ============================================================================

/**
 * Legacy step format (to be migrated).
 * TODO: Update seed data and remove this type.
 */
export type LegacyStep = {
  type?: string;
  action?: string;
  selector?: string;
  value?: string;
  timeout?: number;
};

/**
 * Test step structure for JSONB storage.
 * Accepts both new TestStep format and legacy format during migration.
 * TODO: Remove LegacyStep once seed data is updated.
 */
export type DbTestStep = TestStep | LegacyStep;

/**
 * Test steps structure for JSONB storage.
 */
export type DbTestSteps = {
  steps: DbTestStep[];
};

/** Test snapshot for editing/debugging context */
export type TestSnapshot = Record<string, unknown>;

/** Environment configuration */
export type EnvironmentConfig = Record<string, string | number | boolean>;

/** Schedule metadata */
export type ScheduleMetadata = Record<string, unknown>;

/** Run configuration snapshot */
export type RunConfig = {
  browser?: string;
  headless?: boolean;
  timeout?: number;
  retries?: number;
  [key: string]: unknown;
};

/** Run summary */
export type RunSummary = {
  total?: number;
  passed?: number;
  failed?: number;
  skipped?: number;
  duration?: number;
  [key: string]: unknown;
};

/** Run metadata */
export type RunMetadata = Record<string, unknown>;

/** Error structure */
export type ErrorData = {
  message: string;
  stack?: string;
  type?: string;
  [key: string]: unknown;
};

/** Report event data payload */
export type ReportEventData = Record<string, unknown>;

/** Artifact metadata */
export type ArtifactMeta = Record<string, unknown>;

/** AI conversation metadata */
export type AiConversationMetadata = Record<string, unknown>;

/** AI message payload */
export type AiMessagePayload = Record<string, unknown>;

/** Integration config */
export type IntegrationConfig = Record<string, unknown>;

/** Webhook payload and response */
export type WebhookPayload = Record<string, unknown>;
export type WebhookResponse = Record<string, unknown>;

/** Notif channel config */
export type NotifChannelConfig = {
  email?: string;
  webhookUrl?: string;
  [key: string]: unknown;
};

/** Notif body */
export type NotifBody = Record<string, unknown>;

/** User preferences */
export type UserPrefs = {
  theme?: "light" | "dark" | "system";
  locale?: string;
  timezone?: string;
  defaultOrgId?: string;
  onboarding?: Record<string, boolean>;
  [key: string]: unknown;
};

/** Org member preferences */
export type OrgMemberPrefs = {
  starredProjects?: string[];
  sidebarState?: Record<string, boolean>;
  projectSortOrder?: string[];
  [key: string]: unknown;
};

/** Audit log diff */
export type AuditDiff = {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

/** Audit log metadata */
export type AuditMeta = Record<string, unknown>;

// ============================================================================
// Base Fields Helper
// ============================================================================

/**
 * Base fields for all tables - includes id with entity prefix, createdAt, updatedAt, and deletedAt
 */
export const baseFields = (entityType: string) => {
  return {
    id: text("id")
      .primaryKey()
      .$defaultFn(() =>
        entityType && isValidEntityType(entityType)
          ? createId(entityType)
          : createCuid(),
      ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  };
};

/**
 * Base fields without deletedAt for tables that don't use soft delete
 */
export const baseFieldsNoDelete = (entityType: string) => {
  return {
    id: text("id")
      .primaryKey()
      .$defaultFn(() =>
        entityType && isValidEntityType(entityType)
          ? createId(entityType)
          : createCuid(),
      ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  };
};

// ============================================================================
// Better Auth Core Tables
// ============================================================================

export const user = pgTable("user", {
  ...baseFields("user"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  name: text("name").notNull(),
  image: text("image"),
  // Admin plugin fields
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
});

export const session = pgTable(
  "session",
  {
    ...baseFields("session"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    // Admin plugin field
    impersonatedBy: text("impersonated_by"),
    // Organization plugin field
    activeOrgId: text("active_org_id"),
    // Custom fields
    activeTeamId: text("active_team_id"),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const org = pgTable("org", {
  ...baseFields("org"),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"), // BetterAuth expects text, not jsonb
});

export const orgMember = pgTable(
  "org_member",
  {
    ...baseFields("orgMember"),
    orgId: text("org_id")
      .notNull()
      .references(() => org.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
  },
  (table) => [
    unique("org_member_org_id_user_id_unique").on(table.orgId, table.userId),
    index("org_member_org_id_idx").on(table.orgId),
    index("org_member_user_id_idx").on(table.userId),
  ],
);

export const apikey = pgTable(
  "apikey",
  {
    ...baseFields("apikey"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name"),
    prefix: text("prefix"),
    start: text("start"),
    key: text("key").notNull(), // hashed key - BetterAuth expects this column name
    enabled: boolean("enabled").default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    permissions: text("permissions"),
    metadata: text("metadata"), // BetterAuth expects text, not jsonb
    // Rate limiting fields
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at", { withTimezone: true }),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitTimeWindow: integer("rate_limit_time_window").default(86400000),
    rateLimitMax: integer("rate_limit_max").default(10),
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request", { withTimezone: true }),
  },
  (table) => [
    index("apikey_key_idx").on(table.key),
    index("apikey_user_id_idx").on(table.userId),
  ],
);

export const account = pgTable(
  "account",
  {
    ...baseFieldsNoDelete("account"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    ...baseFieldsNoDelete("verification"),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const invitation = pgTable(
  "invitation",
  {
    ...baseFields("invitation"),
    orgId: text("org_id")
      .notNull()
      .references(() => org.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"), // optional - BetterAuth plugin expectation
    status: text("status").default("pending").notNull(), // pending/accepted/expired
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("invitation_org_id_idx").on(table.orgId),
    index("invitation_email_idx").on(table.email),
  ],
);

// ============================================================================
// Better Auth Relations (for experimental joins feature)
// ============================================================================

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(orgMember),
  invitations: many(invitation),
  apikeys: many(apikey),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const orgRelations = relations(org, ({ many }) => ({
  members: many(orgMember),
  invitations: many(invitation),
}));

export const orgMemberRelations = relations(orgMember, ({ one }) => ({
  organization: one(org, {
    fields: [orgMember.orgId],
    references: [org.id],
  }),
  user: one(user, {
    fields: [orgMember.userId],
    references: [user.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(org, {
    fields: [invitation.orgId],
    references: [org.id],
  }),
  inviter: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));

export const apikeyRelations = relations(apikey, ({ one }) => ({
  user: one(user, {
    fields: [apikey.userId],
    references: [user.id],
  }),
}));

// ============================================================================
// Product Schema - Projects
// ============================================================================

export const project = pgTable(
  "project",
  {
    ...baseFields("project"),
    orgId: text("org_id")
      .notNull()
      .references(() => org.id),
    name: text("name").notNull(),
    description: text("description"),
    logo: text("logo"),
    url: text("url"),
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => [index("project_org_id_idx").on(table.orgId)],
);

export const projectMember = pgTable(
  "project_member",
  {
    ...baseFields("projectMember"),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id),
    orgMemberId: text("org_member_id")
      .notNull()
      .references(() => orgMember.id),
    role: text("role").notNull(), // owner/admin/editor/viewer
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => [
    unique("project_member_project_id_org_member_id_unique").on(
      table.projectId,
      table.orgMemberId,
    ),
    index("project_member_project_id_idx").on(table.projectId),
    index("project_member_org_member_id_idx").on(table.orgMemberId),
  ],
);

// ============================================================================
// Product Schema - Tests
// ============================================================================

export const suite = pgTable(
  "suite",
  {
    ...baseFields("suite"),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id),
    parentSuiteId: text("parent_suite_id"),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull(),
    setupTestId: text("setup_test_id"),
    teardownTestId: text("teardown_test_id"),
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => [
    index("suite_project_id_idx").on(table.projectId),
    index("suite_project_id_parent_suite_id_idx").on(
      table.projectId,
      table.parentSuiteId,
    ),
    index("suite_project_id_name_idx").on(table.projectId, table.name),
  ],
);

export const test = pgTable(
  "test",
  {
    ...baseFields("test"),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id),
    suiteId: text("suite_id").references(() => suite.id),
    kind: text("kind").notNull(), // test/setup/teardown
    name: text("name").notNull(),
    description: text("description"),
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => [
    index("test_project_id_idx").on(table.projectId),
    index("test_project_id_suite_id_idx").on(table.projectId, table.suiteId),
    index("test_project_id_name_idx").on(table.projectId, table.name),
  ],
);

export const testVersion = pgTable(
  "test_version",
  {
    ...baseFields("testVersion"),
    testId: text("test_id")
      .notNull()
      .references(() => test.id),
    version: integer("version").notNull(),
    basedOnVersionId: text("based_on_version_id"),
    changelog: text("changelog"),
    steps: jsonb("steps").notNull().$type<DbTestSteps>(),
    snapshot: jsonb("snapshot").$type<TestSnapshot>(),
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => [
    unique("test_version_test_id_version_unique").on(
      table.testId,
      table.version,
    ),
    index("test_version_test_id_idx").on(table.testId),
    index("test_version_based_on_version_id_idx").on(table.basedOnVersionId),
  ],
);

export const testDraft = pgTable(
  "test_draft",
  {
    ...baseFields("testDraft"),
    testId: text("test_id")
      .notNull()
      .references(() => test.id),
    baseVersionId: text("base_version_id").references(() => testVersion.id),
    steps: jsonb("steps").notNull().$type<DbTestSteps>(),
    snapshot: jsonb("snapshot").$type<TestSnapshot>(),
    status: text("status").notNull(), // active/abandoned
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => [
    unique("test_draft_test_id_unique").on(table.testId),
    index("test_draft_test_id_updated_at_idx").on(
      table.testId,
      table.updatedAt,
    ),
  ],
);

// ============================================================================
// Product Schema - Modules (Reusable Steps)
// ============================================================================

export const module = pgTable(
  "module",
  {
    ...baseFields("module"),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id),
    name: text("name").notNull(),
    description: text("description"),
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => [
    unique("module_project_id_name_unique").on(table.projectId, table.name),
    index("module_project_id_idx").on(table.projectId),
  ],
);

export const moduleVersion = pgTable(
  "module_version",
  {
    ...baseFields("moduleVersion"),
    moduleId: text("module_id")
      .notNull()
      .references(() => module.id),
    version: integer("version").notNull(),
    steps: jsonb("steps").notNull().$type<DbTestSteps>(),
    snapshot: jsonb("snapshot").$type<TestSnapshot>(),
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => [
    unique("module_version_module_id_version_unique").on(
      table.moduleId,
      table.version,
    ),
    index("module_version_module_id_idx").on(table.moduleId),
  ],
);

// ============================================================================
// Product Schema - Environments
// ============================================================================

export const environment = pgTable(
  "environment",
  {
    ...baseFields("environment"),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull(),
    config: jsonb("config").notNull().$type<EnvironmentConfig>(),
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => [
    unique("environment_project_id_name_unique").on(
      table.projectId,
      table.name,
    ),
    index("environment_project_id_idx").on(table.projectId),
  ],
);

export const environmentVar = pgTable(
  "environment_var",
  {
    ...baseFields("envVar"),
    environmentId: text("environment_id")
      .notNull()
      .references(() => environment.id),
    key: text("key").notNull(),
    value: text("value").notNull(), // Plaintext for regular vars, encrypted for secrets
    isSecret: boolean("is_secret").notNull().default(false),
  },
  (table) => [
    unique("environment_var_environment_id_key_unique").on(
      table.environmentId,
      table.key,
    ),
    index("environment_var_environment_id_idx").on(table.environmentId),
  ],
);

// ============================================================================
// Product Schema - Planning
// ============================================================================

export const plan = pgTable(
  "plan",
  {
    ...baseFields("plan"),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id),
    name: text("name").notNull(),
    description: text("description"),
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => [
    index("plan_project_id_name_idx").on(table.projectId, table.name),
    index("plan_project_id_idx").on(table.projectId),
  ],
);

export const planItem = pgTable(
  "plan_item",
  {
    ...baseFields("planItem"),
    planId: text("plan_id")
      .notNull()
      .references(() => plan.id),
    testId: text("test_id").references(() => test.id),
    suiteId: text("suite_id").references(() => suite.id),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    index("plan_item_plan_id_sort_order_idx").on(table.planId, table.sortOrder),
    index("plan_item_plan_id_idx").on(table.planId),
  ],
);

export const schedule = pgTable(
  "schedule",
  {
    ...baseFields("schedule"),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id),
    planId: text("plan_id")
      .notNull()
      .references(() => plan.id),
    environmentId: text("environment_id").references(() => environment.id),
    name: text("name").notNull(),
    cron: text("cron").notNull(),
    timezone: text("timezone").notNull(),
    status: text("status").notNull(), // enabled/disabled
    jobScheduleId: text("job_schedule_id"), // pgboss schedule id
    metadata: jsonb("metadata").$type<ScheduleMetadata>(),
    lastRunId: text("last_run_id"),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => [
    index("schedule_project_id_idx").on(table.projectId),
    index("schedule_project_id_status_idx").on(table.projectId, table.status),
    index("schedule_project_id_name_idx").on(table.projectId, table.name),
  ],
);

// ============================================================================
// Product Schema - Execution
// ============================================================================

export const run = pgTable(
  "run",
  {
    ...baseFields("run"),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id),
    planId: text("plan_id").references(() => plan.id),
    testId: text("test_id").references(() => test.id),
    suiteId: text("suite_id").references(() => suite.id),
    scheduleId: text("schedule_id").references(() => schedule.id),
    environmentId: text("environment_id").references(() => environment.id),
    trigger: text("trigger").notNull(), // manual/schedule/api/webhook
    status: text("status").notNull(), // queued/running/passed/failed/...
    triggeredByUserId: text("triggered_by_user_id").references(() => user.id),
    triggeredByApiKeyId: text("triggered_by_api_key_id").references(
      () => apikey.id,
    ),
    jobId: text("job_id"), // pgboss job id
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    config: jsonb("config").notNull().$type<RunConfig>(),
    summary: jsonb("summary").$type<RunSummary>(),
    metadata: jsonb("metadata").$type<RunMetadata>(),
  },
  (table) => [
    index("run_project_id_created_at_idx").on(table.projectId, table.createdAt),
    index("run_project_id_status_idx").on(table.projectId, table.status),
    index("run_project_id_trigger_idx").on(table.projectId, table.trigger),
    index("run_suite_id_created_at_idx").on(table.suiteId, table.createdAt),
    index("run_test_id_created_at_idx").on(table.testId, table.createdAt),
  ],
);

export const runTest = pgTable(
  "run_test",
  {
    ...baseFields("runTest"),
    runId: text("run_id")
      .notNull()
      .references(() => run.id),
    testId: text("test_id")
      .notNull()
      .references(() => test.id),
    testVersionId: text("test_version_id").references(() => testVersion.id),
    status: text("status").notNull(), // queued/running/passed/failed/...
    attempt: integer("attempt").notNull(),
    durationMs: integer("duration_ms"),
    error: jsonb("error").$type<ErrorData>(),
  },
  (table) => [
    index("run_test_run_id_idx").on(table.runId),
    index("run_test_run_id_test_id_idx").on(table.runId, table.testId),
    index("run_test_test_id_idx").on(table.testId),
  ],
);

export const reportEvent = pgTable(
  "report_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() =>
        isValidEntityType("reportEvent")
          ? createId("reportEvent")
          : createCuid(),
      ),
    runId: text("run_id")
      .notNull()
      .references(() => run.id),
    runTestId: text("run_test_id").references(() => runTest.id),
    event: text("event").notNull(), // onBegin/onTestBegin/onTestEnd/onEnd/...
    data: jsonb("data").notNull().$type<ReportEventData>(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("report_event_run_id_ts_idx").on(table.runId, table.ts),
    index("report_event_run_test_id_idx").on(table.runTestId),
    index("report_event_event_idx").on(table.event),
  ],
);

export const runArtifact = pgTable(
  "run_artifact",
  {
    ...baseFields("runArtifact"),
    runId: text("run_id")
      .notNull()
      .references(() => run.id),
    runTestId: text("run_test_id").references(() => runTest.id),
    type: text("type").notNull(), // playwright_report_json/trace/video/...
    storageUrl: text("storage_url").notNull(),
    sha256: text("sha256"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    meta: jsonb("meta").$type<ArtifactMeta>(),
  },
  (table) => [
    index("run_artifact_run_id_idx").on(table.runId),
    index("run_artifact_run_test_id_idx").on(table.runTestId),
  ],
);

// ============================================================================
// AI Editor
// ============================================================================

export const aiConversation = pgTable(
  "ai_conversation",
  {
    ...baseFields("aiConversation"),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id),
    testId: text("test_id")
      .notNull()
      .references(() => test.id),
    status: text("status").notNull(), // active/closed
    provider: text("provider"),
    model: text("model"),
    systemPrompt: text("system_prompt"),
    metadata: jsonb("metadata").$type<AiConversationMetadata>(),
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => [
    unique("ai_conversation_test_id_unique").on(table.testId),
    index("ai_conversation_project_id_created_at_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

export const aiMessage = pgTable(
  "ai_message",
  {
    ...baseFields("aiMessage"),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => aiConversation.id),
    role: text("role").notNull(), // system/user/assistant/tool
    content: text("content"),
    payload: jsonb("payload").$type<AiMessagePayload>(),
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => [
    index("ai_message_conversation_id_created_at_idx").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const aiMessageFeedback = pgTable(
  "ai_message_feedback",
  {
    ...baseFields("aiMessageFeedback"),
    messageId: text("message_id")
      .notNull()
      .references(() => aiMessage.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    rating: text("rating").notNull(), // up/down
    comment: text("comment"),
  },
  (table) => [
    unique("ai_message_feedback_message_id_user_id_unique").on(
      table.messageId,
      table.userId,
    ),
    index("ai_message_feedback_message_id_idx").on(table.messageId),
  ],
);

// ============================================================================
// Integrations
// ============================================================================

export const integration = pgTable(
  "integration",
  {
    ...baseFields("integration"),
    orgId: text("org_id")
      .notNull()
      .references(() => org.id),
    type: text("type").notNull(), // slack/jira/webhook/...
    name: text("name").notNull(),
    status: text("status").notNull(), // active/disabled/error
    config: jsonb("config").notNull().$type<IntegrationConfig>(),
    encryptedSecrets: text("encrypted_secrets").notNull(),
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => [
    index("integration_org_id_idx").on(table.orgId),
    index("integration_org_id_type_idx").on(table.orgId, table.type),
  ],
);

// ============================================================================
// Project Webhooks
// ============================================================================

export const projectHook = pgTable(
  "project_hook",
  {
    ...baseFields("projectHook"),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id),
    url: text("url").notNull(),
    secret: text("secret"),
    isActive: boolean("is_active").notNull(),
    createdBy: text("created_by").references(() => user.id),
    lastEditedBy: text("last_edited_by").references(() => user.id),
  },
  (table) => [index("project_hook_project_id_idx").on(table.projectId)],
);

export const projectHookSub = pgTable(
  "project_hook_sub",
  {
    ...baseFields("projectHookSub"),
    hookId: text("hook_id")
      .notNull()
      .references(() => projectHook.id),
    eventType: text("event_type").notNull(), // run_started/run_completed/run_failed/etc
  },
  (table) => [
    unique("project_hook_sub_hook_id_event_type_unique").on(
      table.hookId,
      table.eventType,
    ),
    index("project_hook_sub_hook_id_idx").on(table.hookId),
  ],
);

export const projectHookLog = pgTable(
  "project_hook_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() =>
        isValidEntityType("projectHookLog")
          ? createId("projectHookLog")
          : createCuid(),
      ),
    hookSubId: text("hook_sub_id")
      .notNull()
      .references(() => projectHookSub.id),
    payload: jsonb("payload").notNull().$type<WebhookPayload>(),
    response: jsonb("response").$type<WebhookResponse>(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    success: boolean("success").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("project_hook_log_hook_sub_id_sent_at_idx").on(
      table.hookSubId,
      table.sentAt,
    ),
  ],
);

// ============================================================================
// Tags
// ============================================================================

export const tag = pgTable(
  "tag",
  {
    ...baseFields("tag"),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id),
    name: text("name").notNull(),
    color: text("color"),
  },
  (table) => [
    unique("tag_project_id_name_unique").on(table.projectId, table.name),
    index("tag_project_id_idx").on(table.projectId),
  ],
);

export const testTag = pgTable(
  "test_tag",
  {
    ...baseFields("testTag"),
    testId: text("test_id")
      .notNull()
      .references(() => test.id),
    tagId: text("tag_id")
      .notNull()
      .references(() => tag.id),
  },
  (table) => [
    unique("test_tag_test_id_tag_id_unique").on(table.testId, table.tagId),
    index("test_tag_test_id_idx").on(table.testId),
    index("test_tag_tag_id_idx").on(table.tagId),
  ],
);

export const suiteTag = pgTable(
  "suite_tag",
  {
    ...baseFields("suiteTag"),
    suiteId: text("suite_id")
      .notNull()
      .references(() => suite.id),
    tagId: text("tag_id")
      .notNull()
      .references(() => tag.id),
  },
  (table) => [
    unique("suite_tag_suite_id_tag_id_unique").on(table.suiteId, table.tagId),
    index("suite_tag_suite_id_idx").on(table.suiteId),
    index("suite_tag_tag_id_idx").on(table.tagId),
  ],
);

// ============================================================================
// User Preferences
// ============================================================================

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id),
  prefs: jsonb("prefs").notNull().$type<UserPrefs>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const orgMemberPreferences = pgTable("org_member_preferences", {
  orgMemberId: text("org_member_id")
    .primaryKey()
    .references(() => orgMember.id),
  prefs: jsonb("prefs").notNull().$type<OrgMemberPrefs>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const orgMemberNotifChannel = pgTable(
  "org_member_notif_channel",
  {
    ...baseFields("orgMemberNotifChannel"),
    orgMemberId: text("org_member_id")
      .notNull()
      .references(() => orgMember.id),
    name: text("name").notNull(),
    type: text("type").notNull(), // email/slack_webhook/discord_webhook/generic_webhook
    config: jsonb("config").$type<NotifChannelConfig>(),
    enabled: boolean("enabled").notNull(),
  },
  (table) => [
    index("org_member_notif_channel_org_member_id_type_idx").on(
      table.orgMemberId,
      table.type,
    ),
  ],
);

export const orgMemberNotifRule = pgTable(
  "org_member_notif_rule",
  {
    ...baseFields("orgMemberNotifRule"),
    orgMemberId: text("org_member_id")
      .notNull()
      .references(() => orgMember.id),
    event: text("event").notNull(), // run_failed/run_passed/...
    channelId: text("channel_id")
      .notNull()
      .references(() => orgMemberNotifChannel.id),
    enabled: boolean("enabled").notNull(),
  },
  (table) => [
    index("org_member_notif_rule_org_member_id_event_idx").on(
      table.orgMemberId,
      table.event,
    ),
  ],
);

export const orgMemberNotifLog = pgTable(
  "org_member_notif_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() =>
        isValidEntityType("orgMemberNotifLog")
          ? createId("orgMemberNotifLog")
          : createCuid(),
      ),
    notifRuleId: text("notif_rule_id")
      .notNull()
      .references(() => orgMemberNotifRule.id),
    body: jsonb("body").notNull().$type<NotifBody>(),
    response: jsonb("response").$type<WebhookResponse>(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    success: boolean("success").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("org_member_notif_log_notif_rule_id_sent_at_idx").on(
      table.notifRuleId,
      table.sentAt,
    ),
  ],
);

// ============================================================================
// Audit Log
// ============================================================================

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() =>
        isValidEntityType("auditLog") ? createId("auditLog") : createCuid(),
      ),
    orgId: text("org_id").references(() => org.id),
    projectId: text("project_id").references(() => project.id),
    actorUserId: text("actor_user_id").references(() => user.id),
    actorApiKeyId: text("actor_api_key_id").references(() => apikey.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    summary: text("summary"),
    diff: jsonb("diff").$type<AuditDiff>(),
    meta: jsonb("meta").$type<AuditMeta>(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("audit_log_org_id_created_at_idx").on(table.orgId, table.createdAt),
    index("audit_log_project_id_created_at_idx").on(
      table.projectId,
      table.createdAt,
    ),
    index("audit_log_entity_type_entity_id_idx").on(
      table.entityType,
      table.entityId,
    ),
  ],
);

// ============================================================================
// Better Auth Aliases
// ============================================================================
// Better Auth's drizzle adapter with experimental.joins expects specific model
// names in the query object. These aliases ensure db.query.member and
// db.query.organization work correctly.

export { org as organization };
export { orgMember as member };
export { orgRelations as organizationRelations };
export { orgMemberRelations as memberRelations };
