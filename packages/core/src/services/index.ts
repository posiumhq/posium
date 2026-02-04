/**
 * Domain services for the core package.
 */

// Organization service
export {
  createOrgService,
  type OrgService,
  type Org,
  type OrgWithRole,
  type OrgWithStats,
  type CreateOrgInput,
  type UpdateOrgInput,
  type OrgMember,
  type ListMembersOptions,
  type AddMemberInput,
  type UpdateMemberRoleInput,
  type RemoveMemberInput,
  type OrgInfo,
  type CreateInvitationInput,
  type PendingInvitation,
  type CancelInvitationInput,
} from "./org/index.js";

// Project service
export {
  createProjectService,
  type ProjectService,
  type Project,
  type ProjectWithStats,
  type ProjectStats,
  type CreateProjectInput,
  type UpdateProjectInput,
  type ListProjectsOptions,
  type ProjectHealth,
  type ProjectSummary,
  type ProjectWithHealth,
} from "./project/index.js";

// Test service
export {
  createTestService,
  type TestService,
  type Test,
  type TestWithStats,
  type TestKind,
  type TestStatus,
  type TestSortColumn,
  type TestFilters,
  type RunResult,
  type TestStep,
  type TestStepsResult,
  type SuiteInfo,
  type ListTestsByProjectOptions,
  type ListTestsBySuiteOptions,
  type ListTestsByProjectResult,
  type ListTestsBySuiteResult,
  type CreateTestInput,
  type UpdateTestInput,
  type UpdateTestTagsInput,
} from "./test/index.js";

// Run service
export {
  createRunService,
  type RunService,
  type Run,
  type RunWithStats,
  type RunWithDetails,
  type RunTrigger,
  type RunStatus,
  type RunStats,
  type RunMetadata,
  type CommitInfo,
  type TriggerInfo,
  type RunTestItem,
  type RunSortColumn,
  type ListRunsByProjectOptions,
  type ListRunsBySuiteOptions,
  type ListRunsByTestOptions,
  type ListRunsByProjectResult,
  type ListRunsBySuiteResult,
  type ListRunsByTestResult,
  type GetTestsForRunResult,
} from "./run/index.js";

// Suite service
export {
  createSuiteService,
  type SuiteService,
  type Suite,
  type SuiteWithStats,
  type SuiteStatus,
  type SuiteTestStats,
  type SuiteSortColumn,
  type SuiteFilters,
  type ListSuitesOptions,
  type ListSuitesResult,
  type CreateSuiteInput,
  type UpdateSuiteInput,
  type SuiteOverviewTestStats,
  type FailingTest,
  type SuiteRecentRun,
  type DailyRunData,
  type SuiteOverviewStats,
} from "./suite/index.js";

// Schedule service
export {
  createScheduleService,
  type ScheduleService,
  type Schedule,
  type ScheduleWithDetails,
  type ScheduleStatus,
  type ScheduleMetadata,
  type ScheduleSortColumn,
  type ScheduleFilters,
  type PlanSummary,
  type ListSchedulesOptions,
  type ListSchedulesResult,
  type CreateScheduleInput,
  type UpdateScheduleInput,
} from "./schedule/index.js";

// Environment service
export {
  createEnvironmentService,
  type EnvironmentService,
  type Environment,
  type EnvironmentConfig,
  type ListEnvironmentsOptions,
  type CreateEnvironmentInput,
  type UpdateEnvironmentInput,
} from "./environment/index.js";

// User service
export {
  createUserService,
  type UserService,
  type UserPreferences,
  type OrgMemberPreferences,
  type UpdateUserPreferencesInput,
  type UpdateOrgMemberPreferencesInput,
  type UserInfo,
} from "./user/index.js";

// Environment variable service
export {
  createEnvironmentVarService,
  type EnvironmentVarService,
  type EnvironmentVar,
  type EnvironmentVarMetadata,
  type ListEnvironmentVarsOptions,
  type CreateEnvironmentVarInput,
  type UpdateEnvironmentVarInput,
} from "./environment-var/index.js";
