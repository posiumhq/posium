/**
 * Type definitions for SuiteService.
 */

import type {
  PaginationOptions,
  SortingOptions,
  DateRangeFilter,
  PaginationMeta,
} from "../../pagination/index.js";

/**
 * Sortable columns for suites.
 */
export type SuiteSortColumn =
  | "name"
  | "status"
  | "testCount"
  | "lastRunTime"
  | "createdAt";

/**
 * Filter options for suite listings.
 */
export interface SuiteFilters {
  /** Filter by status (passing, failed, flaky, running, null) */
  status?: string[];
  /** Filter by name (partial match, case-insensitive) */
  name?: string;
  /** Filter by last run date range */
  lastRun?: DateRangeFilter;
}

/**
 * Suite status derived from last run or test stats.
 */
export type SuiteStatus = "passing" | "failed" | "flaky" | "running" | null;

/**
 * Test stats for a suite.
 */
export interface SuiteTestStats {
  total: number;
  passing: number;
  failed: number;
  flaky: number;
}

/**
 * Basic suite info.
 */
export interface Suite {
  id: string;
  projectId: string;
  parentSuiteId: string | null;
  name: string;
  description: string | null;
  sortOrder: number;
  setupTestId: string | null;
  teardownTestId: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

/**
 * Suite with statistics for listings.
 */
export interface SuiteWithStats extends Suite {
  status: SuiteStatus;
  testCount: number;
  tests: Array<{ id: string; name: string }>;
  testStats: SuiteTestStats;
  lastRunId?: string;
  lastRunTime?: Date;
  setupTest?: { id: string; name: string } | null;
  teardownTest?: { id: string; name: string } | null;
}

/**
 * Options for listing suites.
 */
export interface ListSuitesOptions
  extends PaginationOptions,
    SortingOptions<SuiteSortColumn> {
  projectId: string;
  filters?: SuiteFilters;
}

/**
 * Result of listing suites.
 */
export interface ListSuitesResult {
  suites: SuiteWithStats[];
  pagination: PaginationMeta;
}

/**
 * Input for creating a suite.
 */
export interface CreateSuiteInput {
  projectId: string;
  name: string;
  description?: string;
  testIds?: string[];
}

/**
 * Input for updating a suite.
 */
export interface UpdateSuiteInput {
  name?: string;
  description?: string | null;
  sortOrder?: number;
  setupTestId?: string | null;
  teardownTestId?: string | null;
}

/**
 * Extended test stats with percentages for overview.
 */
export interface SuiteOverviewTestStats {
  total: number;
  passing: number;
  failed: number;
  flaky: number;
  passingPercent: number;
  failedPercent: number;
  flakyPercent: number;
}

/**
 * A failing test in the suite overview.
 */
export interface FailingTest {
  id: string;
  name: string;
  status: "failed" | "flaky";
}

/**
 * A recent run in the suite overview.
 */
export interface SuiteRecentRun {
  id: string;
  status: string;
  createdAt: Date;
  stats: { total: number; passed: number };
  duration?: string;
  branch: string;
}

/**
 * Daily run data for charts.
 */
export interface DailyRunData {
  date: string;
  passed: number;
  failed: number;
  flaky: number;
}

/**
 * Result of getOverviewStats.
 */
export interface SuiteOverviewStats {
  suite: { id: string; name: string };
  testStats: SuiteOverviewTestStats;
  failingTests: FailingTest[];
  recentRuns: SuiteRecentRun[];
  dailyRunsData: DailyRunData[];
}
