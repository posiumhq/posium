/**
 * Application event constants.
 *
 * All events follow the pattern: {domain}.{action}.v{version}
 * Example: run.created.v1, org.deleted.v1
 */
export const EVENTS = {
  // Run events
  RUN_CREATED_V1: "run.created.v1",
  RUN_COMPLETED_V1: "run.completed.v1",

  // Organization events
  ORG_CREATED_V1: "org.created.v1",
  ORG_DELETED_V1: "org.deleted.v1",
  ORG_MEMBER_ADDED_V1: "org.member.added.v1",
  ORG_MEMBER_INVITED_V1: "org.member.invited.v1",
  ORG_MEMBER_REMOVED_V1: "org.member.removed.v1",

  // Project events
  PROJECT_CREATED_V1: "project.created.v1",
  PROJECT_DELETED_V1: "project.deleted.v1",
  PROJECT_UPDATED_V1: "project.updated.v1",

  // Test events
  TEST_CREATED_V1: "test.created.v1",
  TEST_DELETED_V1: "test.deleted.v1",
  TEST_UPDATED_V1: "test.updated.v1",

  // Schedule events
  SCHEDULE_CREATED_V1: "schedule.created.v1",
  SCHEDULE_UPDATED_V1: "schedule.updated.v1",
  SCHEDULE_DELETED_V1: "schedule.deleted.v1",

  // Suite events
  SUITE_CREATED_V1: "suite.created.v1",
  SUITE_DELETED_V1: "suite.deleted.v1",

  // Environment events
  ENVIRONMENT_CREATED_V1: "environment.created.v1",
  ENVIRONMENT_DELETED_V1: "environment.deleted.v1",

  // Environment variable events
  ENVIRONMENT_VAR_CREATED_V1: "environment.var.created.v1",
  ENVIRONMENT_VAR_UPDATED_V1: "environment.var.updated.v1",
  ENVIRONMENT_VAR_DELETED_V1: "environment.var.deleted.v1",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
