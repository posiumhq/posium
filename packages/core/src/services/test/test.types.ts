/**
 * Type definitions for TestService.
 */

import type { TestStep } from "@posium/types";
import type {
  PaginationOptions,
  SortingOptions,
  DateRangeFilter,
  PaginationMeta,
} from "../../pagination/index.js";

/**
 * Sortable columns for tests.
 */
export type TestSortColumn =
  | "name"
  | "status"
  | "lastRunTime"
  | "createdAt"
  | "duration";

/**
 * Filter options for test listings.
 */
export interface TestFilters {
  /** Filter by status (passing, failed, flaky, running, null) */
  status?: string[];
  /** Filter by name (partial match, case-insensitive) */
  name?: string;
  /** Filter by suite IDs */
  suiteId?: string[];
  /** Filter by tags */
  tags?: string[];
  /** Filter by last run date range */
  lastRun?: DateRangeFilter;
}

/**
 * Test kind - test, setup, or teardown.
 */
export type TestKind = "test" | "setup" | "teardown";

/**
 * Test run status - derived from most recent run.
 */
export type TestStatus = "passing" | "failed" | "flaky" | "running" | null;

/**
 * Run result for display in last5Runs.
 */
export type RunResult = "passed" | "failed" | "flaky";

/**
 * Basic test info.
 */
export interface Test {
  id: string;
  projectId: string;
  suiteId: string | null;
  kind: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

/**
 * Test with statistics for listings.
 */
export interface TestWithStats extends Test {
  suiteName?: string;
  status: TestStatus;
  published: boolean;
  hasDraft: boolean;
  duration?: string;
  last5Runs: RunResult[];
  lastRunId?: string;
  lastRunTime?: Date;
  tags: string[];
}

/**
 * Re-export TestStep as the canonical step type for API boundaries.
 */
export type { TestStep };

/**
 * Test steps from a version.
 */
export interface TestStepsResult {
  versionId?: string;
  version?: number;
  steps: TestStep[];
}

/**
 * Suite info for listings.
 */
export interface SuiteInfo {
  id: string;
  name: string;
}

/**
 * Tag info for listings.
 */
export interface TagInfo {
  id: string;
  name: string;
}

/**
 * Options for listing tests by project.
 */
export interface ListTestsByProjectOptions
  extends PaginationOptions,
    SortingOptions<TestSortColumn> {
  projectId: string;
  filters?: TestFilters;
}

/**
 * Options for listing tests by suite.
 */
export interface ListTestsBySuiteOptions
  extends PaginationOptions,
    SortingOptions<TestSortColumn> {
  suiteId: string;
  filters?: TestFilters;
}

/**
 * Result of listing tests by project.
 */
export interface ListTestsByProjectResult {
  tests: TestWithStats[];
  suites: SuiteInfo[];
  tags: TagInfo[];
  pagination: PaginationMeta;
}

/**
 * Result of listing tests by suite.
 */
export interface ListTestsBySuiteResult {
  tests: TestWithStats[];
  suite: SuiteInfo;
  pagination: PaginationMeta;
}

/**
 * Input for creating a test.
 */
export interface CreateTestInput {
  projectId: string;
  suiteId?: string;
  kind: TestKind;
  name: string;
  description?: string;
}

/**
 * Input for updating a test.
 */
export interface UpdateTestInput {
  name?: string;
  description?: string | null;
  suiteId?: string | null;
  /** If provided, creates a new version with these steps */
  steps?: TestStep[];
}

/**
 * Result of updating a test.
 */
export interface UpdateTestResult {
  test: Test;
  /** Only present if steps were saved */
  version?: {
    versionId: string;
    version: number;
  };
}

/**
 * Input for updating test tags.
 */
export interface UpdateTestTagsInput {
  testId: string;
  tags: string[];
}
