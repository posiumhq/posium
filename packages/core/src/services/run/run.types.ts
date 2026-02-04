/**
 * Type definitions for RunService.
 */

import type {
  PaginationOptions,
  SortingOptions,
  DateRangeFilter,
  PaginationMeta,
} from "../../pagination/index.js";

/**
 * Run trigger type.
 */
export type RunTrigger = "manual" | "schedule" | "api" | "webhook";

/**
 * Sortable columns for runs.
 */
export type RunSortColumn = "createdAt" | "status" | "duration" | "trigger";

/**
 * Filter options for run listings.
 */
export interface RunFilters {
  /** Filter by status (passed, failed, flaky, etc.) */
  status?: string[];
  /** Filter by trigger (manual, schedule, api, webhook) */
  trigger?: string[];
  /** Filter by branch */
  branch?: string;
  /** Filter by creation date range */
  createdAt?: DateRangeFilter;
}

/**
 * Run status.
 */
export type RunStatus = "queued" | "running" | "passed" | "failed" | "flaky" | "cancelled" | "timed_out";

/**
 * Run statistics.
 */
export interface RunStats {
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  running: number;
}

/**
 * Commit info from run metadata.
 */
export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
}

/**
 * Run trigger info.
 */
export interface TriggerInfo {
  type: string;
  commit?: CommitInfo;
}

/**
 * Run metadata parsed from DB.
 */
export interface RunMetadata {
  branch?: string;
  environment?: string;
  commit?: CommitInfo;
}

/**
 * Basic run info.
 */
export interface Run {
  id: string;
  projectId: string;
  testId: string | null;
  suiteId: string | null;
  trigger: string;
  status: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}

/**
 * Run with stats for listings.
 */
export interface RunWithStats {
  id: string;
  projectId: string;
  testId: string | null;
  suiteId: string | null;
  testName?: string;
  suiteName?: string;
  suiteTestCount?: number;
  trigger: TriggerInfo;
  status: string;
  stats: RunStats;
  duration?: string;
  attempts: number;
  branch: string;
  environment: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

/**
 * Run with full details.
 */
export interface RunWithDetails extends RunWithStats {
  summary: unknown;
  commit?: CommitInfo;
  test: { id: string; name: string; suiteId: string | null } | null;
  suite: { id: string; name: string } | null;
  isSingleTestRun: boolean;
}

/**
 * Suite info for listings.
 */
export interface SuiteInfo {
  id: string;
  name: string;
}

/**
 * Test info for listings.
 */
export interface TestInfo {
  id: string;
  name: string;
}

/**
 * RunTest item for run detail.
 */
export interface RunTestItem {
  id: string;
  testId: string;
  name: string;
  status: string;
  attempt: number;
  duration?: string;
}

/**
 * Options for listing runs by project.
 */
export interface ListRunsByProjectOptions
  extends PaginationOptions,
    SortingOptions<RunSortColumn> {
  projectId: string;
  filters?: RunFilters;
}

/**
 * Options for listing runs by suite.
 */
export interface ListRunsBySuiteOptions
  extends PaginationOptions,
    SortingOptions<RunSortColumn> {
  suiteId: string;
  filters?: RunFilters;
}

/**
 * Options for listing runs by test.
 */
export interface ListRunsByTestOptions
  extends PaginationOptions,
    SortingOptions<RunSortColumn> {
  testId: string;
  filters?: RunFilters;
}

/**
 * Result of listing runs by project.
 */
export interface ListRunsByProjectResult {
  runs: RunWithStats[];
  suites: SuiteInfo[];
  pagination: PaginationMeta;
}

/**
 * Result of listing runs by suite.
 */
export interface ListRunsBySuiteResult {
  runs: RunWithStats[];
  suite: SuiteInfo;
  pagination: PaginationMeta;
}

/**
 * Result of listing runs by test.
 */
export interface ListRunsByTestResult {
  runs: RunWithStats[];
  test: TestInfo;
  suite: SuiteInfo | null;
  pagination: PaginationMeta;
}

/**
 * Result of getting tests for a run.
 */
export interface GetTestsForRunResult {
  tests: RunTestItem[];
}

/**
 * Options for triggering a manual run.
 * Must provide exactly one of testId or suiteId.
 */
export interface TriggerRunOptions {
  /** ID of the test to run (mutually exclusive with suiteId) */
  testId?: string;
  /** ID of the suite to run (mutually exclusive with testId) */
  suiteId?: string;
}

/**
 * Result of triggering a single test run.
 */
export interface TriggerRunResult {
  /** ID of the created run */
  runId: string;
}

/**
 * Result of triggering a suite run.
 */
export interface TriggerSuiteRunResult {
  /** ID of the created run */
  runId: string;
  /** Number of tests that will be executed */
  testCount: number;
}
