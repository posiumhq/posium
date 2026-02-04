/**
 * Event payload type definitions.
 *
 * Each event has a corresponding payload type that defines
 * the data structure passed with the event.
 */
import type { EVENTS } from "./events.js";

// Run event payloads
export interface RunCreatedPayload {
  runId: string;
  projectId: string;
  triggeredBy: "manual" | "schedule" | "api" | "webhook";
  triggeredByUserId?: string;
  triggeredByApiKeyId?: string;
}

export interface RunCompletedPayload {
  runId: string;
  projectId: string;
  status: "passed" | "failed" | "cancelled" | "timed_out";
  summary?: {
    total?: number;
    passed?: number;
    failed?: number;
    skipped?: number;
    durationMs?: number;
  };
}

// Organization event payloads
export interface OrgCreatedPayload {
  orgId: string;
  name: string;
  createdByUserId: string;
}

export interface OrgDeletedPayload {
  orgId: string;
  deletedByUserId: string;
}

export interface OrgMemberInvitedPayload {
  orgId: string;
  invitationId: string;
  email: string;
  role: string;
  invitedByUserId: string;
}

export interface OrgMemberAddedPayload {
  orgId: string;
  userId: string;
  role: string;
  addedByUserId: string;
}

export interface OrgMemberRemovedPayload {
  orgId: string;
  userId: string;
  removedByUserId: string;
}

// Project event payloads
export interface ProjectCreatedPayload {
  projectId: string;
  orgId: string;
  name: string;
  createdByUserId: string;
}

export interface ProjectDeletedPayload {
  projectId: string;
  orgId: string;
  deletedByUserId: string;
}

export interface ProjectUpdatedPayload {
  projectId: string;
  orgId: string;
  updatedByUserId: string;
  changes: Record<string, unknown>;
}

// Test event payloads
export interface TestCreatedPayload {
  testId: string;
  projectId: string;
  name: string;
  createdByUserId: string;
}

export interface TestDeletedPayload {
  testId: string;
  projectId: string;
  deletedByUserId: string;
}

export interface TestUpdatedPayload {
  testId: string;
  projectId: string;
  updatedByUserId: string;
  changes: Record<string, unknown>;
}

// Schedule event payloads
export interface ScheduleCreatedPayload {
  scheduleId: string;
  projectId: string;
  name: string;
  cron: string;
  createdByUserId: string;
}

export interface ScheduleUpdatedPayload {
  scheduleId: string;
  projectId: string;
  updatedByUserId: string;
  changes: Record<string, unknown>;
}

export interface ScheduleDeletedPayload {
  scheduleId: string;
  projectId: string;
  deletedByUserId: string;
}

// Suite event payloads
export interface SuiteCreatedPayload {
  suiteId: string;
  projectId: string;
  name: string;
  createdByUserId: string;
}

export interface SuiteDeletedPayload {
  suiteId: string;
  projectId: string;
  deletedByUserId: string;
}

// Environment event payloads
export interface EnvironmentCreatedPayload {
  environmentId: string;
  projectId: string;
  name: string;
  createdByUserId: string;
}

export interface EnvironmentDeletedPayload {
  environmentId: string;
  projectId: string;
  deletedByUserId: string;
}

// Environment variable event payloads
export interface EnvironmentVarCreatedPayload {
  varId: string;
  environmentId: string;
  projectId: string;
  key: string;
  isSecret: boolean;
  createdByUserId: string;
}

export interface EnvironmentVarUpdatedPayload {
  varId: string;
  environmentId: string;
  projectId: string;
  key: string;
  updatedByUserId: string;
}

export interface EnvironmentVarDeletedPayload {
  varId: string;
  environmentId: string;
  projectId: string;
  key: string;
  deletedByUserId: string;
}

/**
 * Map of event names to their payload types.
 * Used for type-safe event publishing.
 */
export interface EventPayloads {
  [EVENTS.RUN_CREATED_V1]: RunCreatedPayload;
  [EVENTS.RUN_COMPLETED_V1]: RunCompletedPayload;
  [EVENTS.ORG_CREATED_V1]: OrgCreatedPayload;
  [EVENTS.ORG_DELETED_V1]: OrgDeletedPayload;
  [EVENTS.ORG_MEMBER_ADDED_V1]: OrgMemberAddedPayload;
  [EVENTS.ORG_MEMBER_INVITED_V1]: OrgMemberInvitedPayload;
  [EVENTS.ORG_MEMBER_REMOVED_V1]: OrgMemberRemovedPayload;
  [EVENTS.PROJECT_CREATED_V1]: ProjectCreatedPayload;
  [EVENTS.PROJECT_DELETED_V1]: ProjectDeletedPayload;
  [EVENTS.PROJECT_UPDATED_V1]: ProjectUpdatedPayload;
  [EVENTS.TEST_CREATED_V1]: TestCreatedPayload;
  [EVENTS.TEST_DELETED_V1]: TestDeletedPayload;
  [EVENTS.TEST_UPDATED_V1]: TestUpdatedPayload;
  [EVENTS.SCHEDULE_CREATED_V1]: ScheduleCreatedPayload;
  [EVENTS.SCHEDULE_UPDATED_V1]: ScheduleUpdatedPayload;
  [EVENTS.SCHEDULE_DELETED_V1]: ScheduleDeletedPayload;
  [EVENTS.SUITE_CREATED_V1]: SuiteCreatedPayload;
  [EVENTS.SUITE_DELETED_V1]: SuiteDeletedPayload;
  [EVENTS.ENVIRONMENT_CREATED_V1]: EnvironmentCreatedPayload;
  [EVENTS.ENVIRONMENT_DELETED_V1]: EnvironmentDeletedPayload;
  [EVENTS.ENVIRONMENT_VAR_CREATED_V1]: EnvironmentVarCreatedPayload;
  [EVENTS.ENVIRONMENT_VAR_UPDATED_V1]: EnvironmentVarUpdatedPayload;
  [EVENTS.ENVIRONMENT_VAR_DELETED_V1]: EnvironmentVarDeletedPayload;
}
