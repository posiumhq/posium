/**
 * SuiteService - Suite management business logic.
 *
 * Handles CRUD operations for test suites within projects.
 */

import { eq, and, isNull, desc, asc, inArray, ilike, sql } from "drizzle-orm";
import { schema } from "@posium/db";
import { publish, EVENTS } from "@posium/appevents";
import type { ServiceContext } from "../../context.js";
import { requireActorUserId } from "../../context.js";
import { NotFoundError, ValidationError } from "../../errors.js";
import { requireOrgMembership } from "../../auth/membership.js";
import {
  normalizePagination,
  buildPaginationMeta,
} from "../../pagination/index.js";
import type {
  Suite,
  SuiteWithStats,
  SuiteStatus,
  SuiteFilters,
  SuiteSortColumn,
  ListSuitesOptions,
  ListSuitesResult,
  CreateSuiteInput,
  UpdateSuiteInput,
  SuiteOverviewStats,
} from "./suite.types.js";

// Query limits to prevent memory issues
const MAX_SUITES_PER_PROJECT = 200;
const MAX_RUN_TESTS_QUERY = 5000;

/**
 * Build SQL filter conditions for suite queries.
 * Only handles filters that can be applied at the SQL level (name).
 * Status and lastRun filters are computed and applied post-enrichment.
 */
function buildSuiteFilterConditions(
  filters: SuiteFilters | undefined,
  projectId: string
) {
  const conditions = [
    eq(schema.suite.projectId, projectId),
    isNull(schema.suite.deletedAt),
  ];

  if (filters?.name) {
    conditions.push(ilike(schema.suite.name, `%${filters.name}%`));
  }

  return conditions;
}

/**
 * Build ORDER BY clause for suite queries.
 * For computed columns (status, testCount, lastRunTime), returns default order.
 */
function buildSuiteOrderBy(
  sortBy: SuiteSortColumn | undefined,
  sortOrder: "asc" | "desc" | undefined
) {
  const direction = sortOrder === "asc" ? asc : desc;

  switch (sortBy) {
    case "name":
      return direction(schema.suite.name);
    case "createdAt":
      return direction(schema.suite.createdAt);
    // status, testCount, lastRunTime are computed - use default order
    default:
      return desc(schema.suite.createdAt);
  }
}

/**
 * Apply post-enrichment filters (status, lastRun) to suite results.
 */
function applyPostEnrichmentFilters(
  suites: SuiteWithStats[],
  filters: SuiteFilters | undefined
): SuiteWithStats[] {
  if (!filters) return suites;

  let result = suites;

  // Filter by status (computed field)
  if (filters.status?.length) {
    result = result.filter((s) => {
      if (s.status === null) {
        return filters.status!.includes("null") || filters.status!.includes("");
      }
      return filters.status!.includes(s.status);
    });
  }

  // Filter by last run date range
  if (filters.lastRun) {
    const { from, to } = filters.lastRun;
    result = result.filter((s) => {
      if (!s.lastRunTime) return false;
      if (from && s.lastRunTime < from) return false;
      if (to && s.lastRunTime > to) return false;
      return true;
    });
  }

  return result;
}

/**
 * Sort suites by computed columns.
 */
function sortSuitesByComputedColumn(
  suites: SuiteWithStats[],
  sortBy: SuiteSortColumn | undefined,
  sortOrder: "asc" | "desc" | undefined
): SuiteWithStats[] {
  if (!sortBy || sortBy === "name" || sortBy === "createdAt") {
    // Already sorted at SQL level
    return suites;
  }

  const direction = sortOrder === "asc" ? 1 : -1;

  return [...suites].sort((a, b) => {
    switch (sortBy) {
      case "status": {
        const statusOrder = { passing: 1, flaky: 2, failed: 3, running: 4 };
        const aOrder = a.status ? statusOrder[a.status] ?? 5 : 5;
        const bOrder = b.status ? statusOrder[b.status] ?? 5 : 5;
        return (aOrder - bOrder) * direction;
      }
      case "testCount":
        return (a.testCount - b.testCount) * direction;
      case "lastRunTime": {
        const aTime = a.lastRunTime?.getTime() ?? 0;
        const bTime = b.lastRunTime?.getTime() ?? 0;
        return (aTime - bTime) * direction;
      }
      default:
        return 0;
    }
  });
}

/**
 * Type for run test query result used in latest run tracking.
 */
interface RunTestResult {
  testId: string;
  runId: string;
  status: string;
  attempt: number;
  createdAt: Date;
}

/**
 * Build map of testId -> latest run result from run test query results.
 * Results should be ordered by createdAt desc.
 * For retry attempts within the same run, keeps the highest attempt number.
 * For different runs with the same timestamp, prefers higher runId (newer run due to ULID ordering).
 */
function buildLatestRunByTestId(
  runTests: RunTestResult[]
): Map<string, RunTestResult> {
  const latestRunByTestId = new Map<string, RunTestResult>();

  for (const rt of runTests) {
    const existing = latestRunByTestId.get(rt.testId);
    if (!existing) {
      latestRunByTestId.set(rt.testId, rt);
    } else if (existing.runId === rt.runId && rt.attempt > existing.attempt) {
      // Same run, higher attempt - update to use final retry result
      latestRunByTestId.set(rt.testId, rt);
    } else if (
      existing.runId !== rt.runId &&
      rt.createdAt.getTime() === existing.createdAt.getTime() &&
      rt.runId > existing.runId
    ) {
      // Different run but same timestamp - prefer newer run (higher runId due to ULID ordering)
      latestRunByTestId.set(rt.testId, rt);
    }
    // Otherwise keep existing (it's from a more recent test execution)
  }

  return latestRunByTestId;
}

/**
 * Determine if a test is flaky based on its latest run result.
 */
function isTestFlaky(latestRun: RunTestResult): boolean {
  return latestRun.status === "flaky" || (latestRun.status === "passed" && latestRun.attempt > 1);
}

/**
 * SuiteService interface.
 */
export interface SuiteService {
  /** List all suites in a project with stats */
  list(ctx: ServiceContext, options: ListSuitesOptions): Promise<ListSuitesResult>;

  /** Get a single suite by ID */
  getById(ctx: ServiceContext, id: string): Promise<Suite>;

  /** Get overview statistics for a suite (test stats, run history, failing tests, recent runs) */
  getOverviewStats(ctx: ServiceContext, suiteId: string): Promise<SuiteOverviewStats>;

  /** Create a new suite */
  create(ctx: ServiceContext, input: CreateSuiteInput): Promise<Suite>;

  /** Update a suite */
  update(ctx: ServiceContext, id: string, input: UpdateSuiteInput): Promise<Suite>;

  /** Soft delete a suite */
  delete(ctx: ServiceContext, id: string): Promise<void>;

  /** Enrich suites with test counts, stats, and last run info (internal helper) */
  enrichSuitesWithStats(
    ctx: ServiceContext,
    suites: Array<{
      id: string;
      name: string;
      description: string | null;
      projectId: string;
      parentSuiteId: string | null;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date | null;
    }>
  ): Promise<SuiteWithStats[]>;
}

/**
 * Get project and verify org membership.
 */
async function getProjectForSuite(
  ctx: ServiceContext,
  projectId: string
): Promise<{ id: string; orgId: string }> {
  const [project] = await ctx.db
    .select({ id: schema.project.id, orgId: schema.project.orgId })
    .from(schema.project)
    .where(and(eq(schema.project.id, projectId), isNull(schema.project.deletedAt)))
    .limit(1);

  if (!project) {
    throw new NotFoundError("Project", projectId);
  }

  await requireOrgMembership(ctx, project.orgId);
  return project;
}

/**
 * Get suite and verify org membership.
 */
async function getSuiteWithAuth(
  ctx: ServiceContext,
  suiteId: string
): Promise<{ suite: typeof schema.suite.$inferSelect; project: { id: string; orgId: string } }> {
  const [suite] = await ctx.db
    .select()
    .from(schema.suite)
    .where(and(eq(schema.suite.id, suiteId), isNull(schema.suite.deletedAt)))
    .limit(1);

  if (!suite) {
    throw new NotFoundError("Suite", suiteId);
  }

  const project = await getProjectForSuite(ctx, suite.projectId);
  return { suite, project };
}

/**
 * Creates a SuiteService instance.
 */
export function createSuiteService(): SuiteService {
  return {
    async list(ctx, options) {
      const { projectId, page, perPage, sortBy, sortOrder, filters } = options;

      // Verify project exists and user has access
      await getProjectForSuite(ctx, projectId);

      // Check if we need post-enrichment filtering or sorting
      const hasComputedFilters = !!(filters?.status?.length || filters?.lastRun);
      const hasComputedSort = sortBy === "status" || sortBy === "testCount" || sortBy === "lastRunTime";

      // Build SQL-level filter conditions (name only)
      const conditions = buildSuiteFilterConditions(filters, projectId);

      // If we have computed filters/sorts, we need to fetch all, enrich, then filter/paginate
      // Otherwise, we can do true server-side pagination
      if (hasComputedFilters || hasComputedSort) {
        // Fetch all suites matching SQL filters, then filter/sort/paginate in memory
        const allSuites = await ctx.db
          .select({
            id: schema.suite.id,
            name: schema.suite.name,
            description: schema.suite.description,
            projectId: schema.suite.projectId,
            parentSuiteId: schema.suite.parentSuiteId,
            sortOrder: schema.suite.sortOrder,
            setupTestId: schema.suite.setupTestId,
            teardownTestId: schema.suite.teardownTestId,
            createdAt: schema.suite.createdAt,
            updatedAt: schema.suite.updatedAt,
          })
          .from(schema.suite)
          .where(and(...conditions))
          .orderBy(buildSuiteOrderBy(sortBy, sortOrder))
          .limit(MAX_SUITES_PER_PROJECT);

        if (allSuites.length === 0) {
          return {
            suites: [],
            pagination: buildPaginationMeta(page ?? 1, perPage ?? 10, 0),
          };
        }

        // Enrich all suites with stats (using existing batch logic)
        const enrichedSuites = await this.enrichSuitesWithStats(ctx, allSuites);

        // Apply post-enrichment filters
        let filteredSuites = applyPostEnrichmentFilters(enrichedSuites, filters);

        // Apply computed column sorting
        filteredSuites = sortSuitesByComputedColumn(filteredSuites, sortBy, sortOrder);

        // Paginate the filtered results
        const { offset, limit, page: p, perPage: pp } = normalizePagination({ page, perPage });
        const total = filteredSuites.length;
        const paginatedSuites = filteredSuites.slice(offset, offset + limit);

        return {
          suites: paginatedSuites,
          pagination: buildPaginationMeta(p, pp, total),
        };
      }

      // True server-side pagination (no computed filters/sorts)
      // Count query for total
      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.suite)
        .where(and(...conditions));

      const total = countResult?.count ?? 0;

      if (total === 0) {
        return {
          suites: [],
          pagination: buildPaginationMeta(page ?? 1, perPage ?? 10, 0),
        };
      }

      // Paginated data query
      const { offset, limit, page: p, perPage: pp } = normalizePagination({ page, perPage });

      const suites = await ctx.db
        .select({
          id: schema.suite.id,
          name: schema.suite.name,
          description: schema.suite.description,
          projectId: schema.suite.projectId,
          parentSuiteId: schema.suite.parentSuiteId,
          sortOrder: schema.suite.sortOrder,
          setupTestId: schema.suite.setupTestId,
          teardownTestId: schema.suite.teardownTestId,
          createdAt: schema.suite.createdAt,
          updatedAt: schema.suite.updatedAt,
        })
        .from(schema.suite)
        .where(and(...conditions))
        .orderBy(buildSuiteOrderBy(sortBy, sortOrder))
        .offset(offset)
        .limit(limit);

      // Early return if no suites
      if (suites.length === 0) {
        return {
          suites: [],
          pagination: buildPaginationMeta(p, pp, total),
        };
      }

      // Enrich suites with stats
      const suitesWithStats = await this.enrichSuitesWithStats(ctx, suites);

      return {
        suites: suitesWithStats,
        pagination: buildPaginationMeta(p, pp, total),
      };
    },

    /**
     * Enrich suites with test counts, stats, and last run info.
     */
    async enrichSuitesWithStats(
      ctx: ServiceContext,
      suites: Array<{
        id: string;
        name: string;
        description: string | null;
        projectId: string;
        parentSuiteId: string | null;
        sortOrder: number;
        setupTestId?: string | null;
        teardownTestId?: string | null;
        createdAt: Date;
        updatedAt: Date | null;
      }>
    ): Promise<SuiteWithStats[]> {

      const suiteIds = suites.map((s) => s.id);

      // Collect all setup/teardown test IDs for batch query
      const setupTeardownTestIds = new Set<string>();
      for (const suite of suites) {
        if (suite.setupTestId) setupTeardownTestIds.add(suite.setupTestId);
        if (suite.teardownTestId) setupTeardownTestIds.add(suite.teardownTestId);
      }

      // Batch query: Get setup/teardown test names
      const setupTeardownTests = setupTeardownTestIds.size > 0
        ? await ctx.db
            .select({ id: schema.test.id, name: schema.test.name })
            .from(schema.test)
            .where(
              and(
                inArray(schema.test.id, Array.from(setupTeardownTestIds)),
                isNull(schema.test.deletedAt)
              )
            )
        : [];

      const setupTeardownTestMap = new Map<string, { id: string; name: string }>();
      for (const test of setupTeardownTests) {
        setupTeardownTestMap.set(test.id, { id: test.id, name: test.name });
      }

      // Batch query: Get all tests for these suites
      const tests = await ctx.db
        .select({
          id: schema.test.id,
          name: schema.test.name,
          suiteId: schema.test.suiteId,
        })
        .from(schema.test)
        .where(
          and(
            inArray(schema.test.suiteId, suiteIds),
            isNull(schema.test.deletedAt)
          )
        );

      // Group tests by suiteId
      const testsBySuiteId = new Map<string, { id: string; name: string }[]>();
      for (const test of tests) {
        if (test.suiteId) {
          const existing = testsBySuiteId.get(test.suiteId) ?? [];
          existing.push({ id: test.id, name: test.name });
          testsBySuiteId.set(test.suiteId, existing);
        }
      }

      // Get all test IDs for fetching run stats
      const allTestIds = tests.map((t) => t.id);

      // Batch query: Get all published test versions
      const publishedVersions = allTestIds.length > 0
        ? await ctx.db
            .select({ testId: schema.testVersion.testId })
            .from(schema.testVersion)
            .where(and(inArray(schema.testVersion.testId, allTestIds), isNull(schema.testVersion.deletedAt)))
        : [];

      const publishedTestIds = new Set(publishedVersions.map((v) => v.testId));

      // Batch query: Get most recent run tests for each test (including attempt for flaky detection)
      const recentRunTests = allTestIds.length > 0
        ? await ctx.db
            .select({
              testId: schema.runTest.testId,
              runId: schema.runTest.runId,
              status: schema.runTest.status,
              attempt: schema.runTest.attempt,
              createdAt: schema.runTest.createdAt,
            })
            .from(schema.runTest)
            .where(and(inArray(schema.runTest.testId, allTestIds), isNull(schema.runTest.deletedAt)))
            .orderBy(desc(schema.runTest.createdAt))
            .limit(Math.min(allTestIds.length * 5, MAX_RUN_TESTS_QUERY))
        : [];

      // Build map of testId -> latest run result
      const latestRunByTestId = buildLatestRunByTestId(recentRunTests);

      // Batch query: Get all runs for these suites (for last run info)
      const suiteRuns = await ctx.db
        .select({
          id: schema.run.id,
          suiteId: schema.run.suiteId,
          status: schema.run.status,
          createdAt: schema.run.createdAt,
        })
        .from(schema.run)
        .where(
          and(
            inArray(schema.run.suiteId, suiteIds),
            isNull(schema.run.deletedAt)
          )
        )
        .orderBy(desc(schema.run.createdAt))
        .limit(suiteIds.length * 5);

      // Get the most recent run for each suite
      const lastRunBySuiteId = new Map<string, { id: string; status: string; createdAt: Date }>();
      for (const run of suiteRuns) {
        if (run.suiteId && !lastRunBySuiteId.has(run.suiteId)) {
          lastRunBySuiteId.set(run.suiteId, { id: run.id, status: run.status, createdAt: run.createdAt });
        }
      }

      // Build the response with stats
      const suitesWithStats: SuiteWithStats[] = suites.map((suite) => {
        const suiteTests = testsBySuiteId.get(suite.id) ?? [];
        const testCount = suiteTests.length;

        // Calculate test stats from published tests with runs
        let passing = 0;
        let failed = 0;
        let flaky = 0;

        for (const test of suiteTests) {
          if (publishedTestIds.has(test.id)) {
            const latestRun = latestRunByTestId.get(test.id);
            if (latestRun) {
              // A test that passed on retry is flaky
              const isTestFlaky = latestRun.status === "flaky" ||
                (latestRun.status === "passed" && latestRun.attempt > 1);

              if (isTestFlaky) {
                flaky++;
              } else if (latestRun.status === "passed" && latestRun.attempt === 1) {
                passing++;
              } else if (latestRun.status === "failed") {
                failed++;
              }
            }
          }
        }

        // Determine suite status from last run or from test stats
        const lastRun = lastRunBySuiteId.get(suite.id);
        let status: SuiteStatus = null;

        if (lastRun) {
          if (lastRun.status === "passed") status = "passing";
          else if (lastRun.status === "failed") status = "failed";
          else if (lastRun.status === "flaky") status = "flaky";
          else if (lastRun.status === "running") status = "running";
        } else if (testCount > 0) {
          // Derive status from test stats if no suite runs exist
          if (failed > 0) status = "failed";
          else if (flaky > 0) status = "flaky";
          else if (passing > 0) status = "passing";
        }

        return {
          id: suite.id,
          name: suite.name,
          description: suite.description,
          projectId: suite.projectId,
          parentSuiteId: suite.parentSuiteId,
          sortOrder: suite.sortOrder,
          setupTestId: suite.setupTestId ?? null,
          teardownTestId: suite.teardownTestId ?? null,
          createdAt: suite.createdAt,
          updatedAt: suite.updatedAt,
          status,
          testCount,
          tests: suiteTests.slice(0, 5), // First 5 test names for display
          testStats: {
            passing,
            failed,
            flaky,
            total: passing + failed + flaky,
          },
          lastRunId: lastRun?.id,
          lastRunTime: lastRun?.createdAt,
          setupTest: suite.setupTestId ? setupTeardownTestMap.get(suite.setupTestId) ?? null : null,
          teardownTest: suite.teardownTestId ? setupTeardownTestMap.get(suite.teardownTestId) ?? null : null,
        };
      });

      return suitesWithStats;
    },

    async getById(ctx, id) {
      const { suite } = await getSuiteWithAuth(ctx, id);

      return {
        id: suite.id,
        projectId: suite.projectId,
        parentSuiteId: suite.parentSuiteId,
        name: suite.name,
        description: suite.description,
        sortOrder: suite.sortOrder,
        setupTestId: suite.setupTestId,
        teardownTestId: suite.teardownTestId,
        createdAt: suite.createdAt,
        updatedAt: suite.updatedAt,
      };
    },

    async getOverviewStats(ctx, suiteId) {
      const { suite } = await getSuiteWithAuth(ctx, suiteId);

      // Get all tests in this suite
      const tests = await ctx.db
        .select({
          id: schema.test.id,
          name: schema.test.name,
        })
        .from(schema.test)
        .where(and(eq(schema.test.suiteId, suiteId), isNull(schema.test.deletedAt)));

      const testIds = tests.map((t) => t.id);

      // Get published test versions to determine which tests are published
      const publishedVersions = testIds.length > 0
        ? await ctx.db
            .select({ testId: schema.testVersion.testId })
            .from(schema.testVersion)
            .where(and(inArray(schema.testVersion.testId, testIds), isNull(schema.testVersion.deletedAt)))
        : [];

      const publishedTestIds = new Set(publishedVersions.map((v) => v.testId));

      // Get most recent run test for each test to determine status (including attempt for flaky detection)
      const recentRunTests = testIds.length > 0
        ? await ctx.db
            .select({
              testId: schema.runTest.testId,
              runId: schema.runTest.runId,
              status: schema.runTest.status,
              attempt: schema.runTest.attempt,
              createdAt: schema.runTest.createdAt,
            })
            .from(schema.runTest)
            .where(and(inArray(schema.runTest.testId, testIds), isNull(schema.runTest.deletedAt)))
            .orderBy(desc(schema.runTest.createdAt))
            .limit(testIds.length * 5)
        : [];

      // Build map of testId -> latest run result
      const latestRunByTestId = buildLatestRunByTestId(recentRunTests);

      // Calculate test stats - only count published tests with valid status
      let passing = 0;
      let failed = 0;
      let flaky = 0;

      for (const test of tests) {
        if (!publishedTestIds.has(test.id)) continue;

        const latestRun = latestRunByTestId.get(test.id);
        if (!latestRun) continue;

        if (isTestFlaky(latestRun)) flaky++;
        else if (latestRun.status === "passed") passing++;
        else if (latestRun.status === "failed") failed++;
      }

      // Total only includes tests with results
      const total = passing + failed + flaky;
      const testStats = {
        total,
        passing,
        failed,
        flaky,
        passingPercent: total > 0 ? (passing / total) * 100 : 0,
        failedPercent: total > 0 ? (failed / total) * 100 : 0,
        flakyPercent: total > 0 ? (flaky / total) * 100 : 0,
      };

      // Get failing tests (failed or flaky) - only published tests
      const failingTests = tests
        .filter((test) => {
          if (!publishedTestIds.has(test.id)) return false;
          const latestRun = latestRunByTestId.get(test.id);
          if (!latestRun) return false;
          return latestRun.status === "failed" || isTestFlaky(latestRun);
        })
        .slice(0, 5)
        .map((test) => {
          const latestRun = latestRunByTestId.get(test.id)!;
          return {
            id: test.id,
            name: test.name,
            status: (isTestFlaky(latestRun) ? "flaky" : "failed") as "failed" | "flaky",
          };
        });

      // Get recent runs for this suite
      const recentRuns = await ctx.db
        .select({
          id: schema.run.id,
          status: schema.run.status,
          createdAt: schema.run.createdAt,
          startedAt: schema.run.startedAt,
          finishedAt: schema.run.finishedAt,
          metadata: schema.run.metadata,
        })
        .from(schema.run)
        .where(and(eq(schema.run.suiteId, suiteId), isNull(schema.run.deletedAt)))
        .orderBy(desc(schema.run.createdAt))
        .limit(20);

      const runIds = recentRuns.map((r) => r.id);

      // Get run tests for stats
      const allRunTests = runIds.length > 0
        ? await ctx.db
            .select({
              runId: schema.runTest.runId,
              status: schema.runTest.status,
            })
            .from(schema.runTest)
            .where(and(inArray(schema.runTest.runId, runIds), isNull(schema.runTest.deletedAt)))
        : [];

      // Group by runId
      const runTestsByRunId = new Map<string, typeof allRunTests>();
      for (const rt of allRunTests) {
        const existing = runTestsByRunId.get(rt.runId) ?? [];
        existing.push(rt);
        runTestsByRunId.set(rt.runId, existing);
      }

      // Build recent runs with stats
      const recentRunsWithStats = recentRuns.slice(0, 5).map((run) => {
        const runTests = runTestsByRunId.get(run.id) ?? [];
        let passed = 0;
        const runTotal = runTests.length;

        for (const rt of runTests) {
          if (rt.status === "passed") passed++;
        }

        // Calculate duration
        let duration: string | undefined;
        if (run.startedAt && run.finishedAt) {
          const durationMs = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
          if (durationMs > 0) {
            if (durationMs < 1000) duration = `${durationMs}ms`;
            else if (durationMs < 60000) duration = `${(durationMs / 1000).toFixed(1)}s`;
            else {
              const mins = Math.floor(durationMs / 60000);
              const secs = Math.floor((durationMs % 60000) / 1000);
              duration = `${mins}m ${secs}s`;
            }
          }
        }

        const metadata = run.metadata as { branch?: string } | null;

        return {
          id: run.id,
          status: run.status,
          createdAt: run.createdAt,
          stats: { total: runTotal, passed },
          duration,
          branch: metadata?.branch ?? "main",
        };
      });

      // Build daily runs data for chart (last 14 days)
      const dailyRunsData: { date: string; passed: number; failed: number; flaky: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

        // Count runs for this day
        let dayPassed = 0;
        let dayFailed = 0;
        let dayFlaky = 0;

        for (const run of recentRuns) {
          const runDate = new Date(run.createdAt);
          if (runDate >= date && runDate < nextDate) {
            if (run.status === "passed") dayPassed++;
            else if (run.status === "failed") dayFailed++;
            else if (run.status === "flaky") dayFlaky++;
          }
        }

        dailyRunsData.push({ date: dateStr, passed: dayPassed, failed: dayFailed, flaky: dayFlaky });
      }

      return {
        suite: {
          id: suite.id,
          name: suite.name,
        },
        testStats,
        failingTests,
        recentRuns: recentRunsWithStats,
        dailyRunsData,
      };
    },

    async create(ctx, input) {
      const userId = requireActorUserId(ctx.actor);
      const { projectId, name, description, testIds } = input;

      // Verify project exists and user has access
      await getProjectForSuite(ctx, projectId);

      // Get the max sort order for existing suites
      const [existingSuite] = await ctx.db
        .select({ sortOrder: schema.suite.sortOrder })
        .from(schema.suite)
        .where(and(eq(schema.suite.projectId, projectId), isNull(schema.suite.deletedAt)))
        .orderBy(desc(schema.suite.sortOrder))
        .limit(1);

      const nextSortOrder = (existingSuite?.sortOrder ?? 0) + 1;

      // Create the suite
      const [newSuite] = await ctx.db
        .insert(schema.suite)
        .values({
          projectId,
          name,
          description,
          sortOrder: nextSortOrder,
          createdBy: userId,
        })
        .returning();

      if (!newSuite) {
        throw new Error("Failed to create suite");
      }

      // Update tests to belong to this suite if testIds provided
      if (testIds && testIds.length > 0) {
        await ctx.db
          .update(schema.test)
          .set({ suiteId: newSuite.id, updatedAt: new Date() })
          .where(
            and(
              inArray(schema.test.id, testIds),
              eq(schema.test.projectId, projectId),
              isNull(schema.test.deletedAt)
            )
          );
      }

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.SUITE_CREATED_V1, {
          suiteId: newSuite.id,
          projectId,
          name,
          createdByUserId: userId,
        });
      }

      return {
        id: newSuite.id,
        projectId: newSuite.projectId,
        parentSuiteId: newSuite.parentSuiteId,
        name: newSuite.name,
        description: newSuite.description,
        sortOrder: newSuite.sortOrder,
        setupTestId: newSuite.setupTestId,
        teardownTestId: newSuite.teardownTestId,
        createdAt: newSuite.createdAt,
        updatedAt: newSuite.updatedAt,
      };
    },

    async update(ctx, id, input) {
      requireActorUserId(ctx.actor);
      const { suite } = await getSuiteWithAuth(ctx, id);

      // Validate setupTestId if provided
      if (input.setupTestId !== undefined && input.setupTestId !== null) {
        const [setupTest] = await ctx.db
          .select({ id: schema.test.id, projectId: schema.test.projectId })
          .from(schema.test)
          .where(and(eq(schema.test.id, input.setupTestId), isNull(schema.test.deletedAt)))
          .limit(1);

        if (!setupTest) {
          throw new NotFoundError("Test", input.setupTestId);
        }
        if (setupTest.projectId !== suite.projectId) {
          throw new ValidationError("Setup test must belong to the same project as the suite");
        }
      }

      // Validate teardownTestId if provided
      if (input.teardownTestId !== undefined && input.teardownTestId !== null) {
        const [teardownTest] = await ctx.db
          .select({ id: schema.test.id, projectId: schema.test.projectId })
          .from(schema.test)
          .where(and(eq(schema.test.id, input.teardownTestId), isNull(schema.test.deletedAt)))
          .limit(1);

        if (!teardownTest) {
          throw new NotFoundError("Test", input.teardownTestId);
        }
        if (teardownTest.projectId !== suite.projectId) {
          throw new ValidationError("Teardown test must belong to the same project as the suite");
        }
      }

      // Prevent same test being both setup and teardown
      const finalSetupId = input.setupTestId !== undefined ? input.setupTestId : suite.setupTestId;
      const finalTeardownId = input.teardownTestId !== undefined ? input.teardownTestId : suite.teardownTestId;
      if (finalSetupId && finalTeardownId && finalSetupId === finalTeardownId) {
        throw new ValidationError("Setup and teardown cannot be the same test");
      }

      // Build update object
      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
      if (input.setupTestId !== undefined) updates.setupTestId = input.setupTestId;
      if (input.teardownTestId !== undefined) updates.teardownTestId = input.teardownTestId;

      const [updated] = await ctx.db
        .update(schema.suite)
        .set(updates)
        .where(eq(schema.suite.id, id))
        .returning();

      if (!updated) {
        throw new Error("Failed to update suite");
      }

      return {
        id: updated.id,
        projectId: updated.projectId,
        parentSuiteId: updated.parentSuiteId,
        name: updated.name,
        description: updated.description,
        sortOrder: updated.sortOrder,
        setupTestId: updated.setupTestId,
        teardownTestId: updated.teardownTestId,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    },

    async delete(ctx, id) {
      const userId = requireActorUserId(ctx.actor);
      const { suite } = await getSuiteWithAuth(ctx, id);

      // Soft delete
      await ctx.db
        .update(schema.suite)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.suite.id, id));

      // Optionally: Remove suite association from tests (set suiteId to null)
      await ctx.db
        .update(schema.test)
        .set({ suiteId: null, updatedAt: new Date() })
        .where(
          and(
            eq(schema.test.suiteId, id),
            isNull(schema.test.deletedAt)
          )
        );

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.SUITE_DELETED_V1, {
          suiteId: id,
          projectId: suite.projectId,
          deletedByUserId: userId,
        });
      }
    },
  };
}
