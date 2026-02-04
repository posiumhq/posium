/**
 * RunService - Run management business logic.
 *
 * Handles read operations and manual run triggering for test runs within projects.
 */

import { eq, and, isNull, desc, asc, inArray, sql, gte, lte } from "drizzle-orm";
import { schema } from "@posium/db";
import { createId } from "@posium/id";
import { EVENTS, publish } from "@posium/appevents";
import type { ServiceContext } from "../../context.js";
import { NotFoundError, ValidationError } from "../../errors.js";
import { requireOrgMembership } from "../../auth/membership.js";
import { requireActorUserId } from "../../context.js";
import {
  normalizePagination,
  buildPaginationMeta,
} from "../../pagination/index.js";
import type {
  Run,
  RunWithStats,
  RunWithDetails,
  RunStats,
  RunMetadata,
  RunSortColumn,
  SuiteInfo,
  RunTestItem,
  ListRunsByProjectOptions,
  ListRunsBySuiteOptions,
  ListRunsByTestOptions,
  ListRunsByProjectResult,
  ListRunsBySuiteResult,
  ListRunsByTestResult,
  GetTestsForRunResult,
  TriggerRunOptions,
  TriggerRunResult,
  TriggerSuiteRunResult,
} from "./run.types.js";

/**
 * Build ORDER BY clause for run queries.
 */
function buildRunOrderBy(
  sortBy: RunSortColumn | undefined,
  sortOrder: "asc" | "desc" | undefined
) {
  const direction = sortOrder === "asc" ? asc : desc;

  switch (sortBy) {
    case "createdAt":
      return direction(schema.run.createdAt);
    case "status":
      return direction(schema.run.status);
    case "trigger":
      return direction(schema.run.trigger);
    case "duration":
      // Duration requires computation, so fall back to createdAt
      return direction(schema.run.createdAt);
    default:
      return desc(schema.run.createdAt);
  }
}

/**
 * RunService interface.
 */
export interface RunService {
  /** List all runs in a project with stats */
  listByProject(ctx: ServiceContext, options: ListRunsByProjectOptions): Promise<ListRunsByProjectResult>;

  /** List all runs for a suite with stats */
  listBySuite(ctx: ServiceContext, options: ListRunsBySuiteOptions): Promise<ListRunsBySuiteResult>;

  /** List all runs for a test with stats */
  listByTest(ctx: ServiceContext, options: ListRunsByTestOptions): Promise<ListRunsByTestResult>;

  /** Get a single run by ID */
  getById(ctx: ServiceContext, id: string): Promise<Run>;

  /** Get a run with full details for overview page */
  getByIdWithDetails(ctx: ServiceContext, id: string): Promise<RunWithDetails>;

  /** Get all tests for a specific run */
  getTestsForRun(ctx: ServiceContext, runId: string): Promise<GetTestsForRunResult>;

  /** Trigger a manual run for a test or suite */
  triggerRun(ctx: ServiceContext, options: TriggerRunOptions): Promise<TriggerRunResult | TriggerSuiteRunResult>;
}

/**
 * Format duration in milliseconds to human-readable string.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Get project and verify org membership.
 */
async function getProjectForRun(
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
 * Get run and verify org membership.
 */
async function getRunWithAuth(
  ctx: ServiceContext,
  runId: string
): Promise<{ run: typeof schema.run.$inferSelect; project: { id: string; orgId: string } }> {
  const [run] = await ctx.db
    .select()
    .from(schema.run)
    .where(and(eq(schema.run.id, runId), isNull(schema.run.deletedAt)))
    .limit(1);

  if (!run) {
    throw new NotFoundError("Run", runId);
  }

  const project = await getProjectForRun(ctx, run.projectId);
  return { run, project };
}

/**
 * Determine if a test result is flaky.
 * A test is flaky if it explicitly has status "flaky" or if it passed on a retry (attempt > 1).
 */
function isFlaky(status: string, attempt: number): boolean {
  return status === "flaky" || (status === "passed" && attempt > 1);
}

/**
 * Calculate run stats from run tests.
 * Dedupes by testId to avoid counting retries multiple times.
 */
function calculateRunStats(
  runTests: Array<{ testId: string; status: string; attempt: number }>
): { stats: RunStats; maxAttempts: number } {
  // First, dedupe by testId - keep the highest attempt for each test
  const testMap = new Map<string, { status: string; attempt: number }>();
  let maxAttempts = 1;

  for (const rt of runTests) {
    if (rt.attempt > maxAttempts) maxAttempts = rt.attempt;

    const existing = testMap.get(rt.testId);
    if (!existing || rt.attempt > existing.attempt) {
      testMap.set(rt.testId, { status: rt.status, attempt: rt.attempt });
    }
  }

  // Now count unique tests by their final status
  let passed = 0;
  let failed = 0;
  let flaky = 0;
  let skipped = 0;
  let running = 0;

  for (const { status, attempt } of testMap.values()) {
    if (isFlaky(status, attempt)) {
      flaky++;
    } else if (status === "passed" && attempt === 1) {
      passed++;
    } else if (status === "failed") {
      failed++;
    } else if (status === "skipped") {
      skipped++;
    } else if (status === "running" || status === "queued") {
      running++;
    }
  }

  return {
    stats: {
      total: passed + failed + flaky + skipped + running,
      passed,
      failed,
      flaky,
      skipped,
      running,
    },
    maxAttempts,
  };
}

/**
 * Build RunWithStats from raw run data.
 */
function buildRunWithStats(
  run: {
    id: string;
    projectId: string;
    testId: string | null;
    suiteId: string | null;
    trigger: string;
    status: string;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdAt: Date;
    metadata: unknown;
  },
  runTests: Array<{ testId: string; status: string; attempt: number }>,
  testsMap: Map<string, { name: string; suiteId: string | null }>,
  suitesMap: Map<string, string>
): RunWithStats {
  const { stats, maxAttempts } = calculateRunStats(runTests);

  // Calculate duration
  let duration: string | undefined;
  if (run.startedAt && run.finishedAt) {
    const durationMs = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
    if (durationMs > 0) {
      duration = formatDuration(durationMs);
    }
  }

  // Get test/suite names
  let testName: string | undefined;
  let suiteName: string | undefined;
  let suiteTestCount: number | undefined;

  if (run.testId) {
    const test = testsMap.get(run.testId);
    testName = test?.name;
    if (test?.suiteId) {
      suiteName = suitesMap.get(test.suiteId);
    }
  }

  if (run.suiteId) {
    suiteName = suitesMap.get(run.suiteId);
    suiteTestCount = stats.total;
  }

  // Parse metadata for commit info
  const metadata = run.metadata as RunMetadata | null;

  return {
    id: run.id,
    projectId: run.projectId,
    testId: run.testId,
    suiteId: run.suiteId,
    testName,
    suiteName,
    suiteTestCount,
    trigger: {
      type: run.trigger,
      commit: metadata?.commit,
    },
    status: run.status,
    stats,
    duration,
    attempts: maxAttempts,
    branch: metadata?.branch ?? "main",
    environment: metadata?.environment ?? "development",
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  };
}

/**
 * Batch load run tests grouped by runId.
 */
async function loadRunTestsByRunId(
  ctx: ServiceContext,
  runIds: string[]
): Promise<Map<string, Array<{ testId: string; status: string; attempt: number }>>> {
  const allRunTests = await ctx.db
    .select({
      runId: schema.runTest.runId,
      testId: schema.runTest.testId,
      status: schema.runTest.status,
      attempt: schema.runTest.attempt,
    })
    .from(schema.runTest)
    .where(and(inArray(schema.runTest.runId, runIds), isNull(schema.runTest.deletedAt)));

  const runTestsByRunId = new Map<string, Array<{ testId: string; status: string; attempt: number }>>();
  for (const rt of allRunTests) {
    const existing = runTestsByRunId.get(rt.runId) ?? [];
    existing.push({ testId: rt.testId, status: rt.status, attempt: rt.attempt });
    runTestsByRunId.set(rt.runId, existing);
  }

  return runTestsByRunId;
}

/**
 * Creates a RunService instance.
 */
export function createRunService(): RunService {
  return {
    async listByProject(ctx, options) {
      const { projectId, page, perPage, sortBy, sortOrder, filters } = options;

      // Verify project exists and user has access
      await getProjectForRun(ctx, projectId);

      // Build filter conditions
      const conditions = [
        eq(schema.run.projectId, projectId),
        isNull(schema.run.deletedAt),
      ];

      if (filters?.status && filters.status.length > 0) {
        conditions.push(inArray(schema.run.status, filters.status));
      }
      if (filters?.trigger && filters.trigger.length > 0) {
        conditions.push(inArray(schema.run.trigger, filters.trigger));
      }
      if (filters?.createdAt) {
        if (filters.createdAt.from) {
          conditions.push(gte(schema.run.createdAt, filters.createdAt.from));
        }
        if (filters.createdAt.to) {
          conditions.push(lte(schema.run.createdAt, filters.createdAt.to));
        }
      }
      // Note: branch filter requires metadata JSONB query, skipped for now

      // Count total matching records
      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.run)
        .where(and(...conditions));

      const total = countResult?.count ?? 0;

      // Normalize pagination
      const { offset, limit, page: normalizedPage, perPage: normalizedPerPage } = normalizePagination({
        page,
        perPage,
      });

      // Get suites for this project
      const suites = await ctx.db
        .select({ id: schema.suite.id, name: schema.suite.name })
        .from(schema.suite)
        .where(and(eq(schema.suite.projectId, projectId), isNull(schema.suite.deletedAt)));

      const suitesMap = new Map(suites.map((s) => [s.id, s.name]));

      // Early return if no runs
      if (total === 0) {
        return {
          runs: [],
          suites: suites.map((s) => ({ id: s.id, name: s.name })),
          pagination: buildPaginationMeta(normalizedPage, normalizedPerPage, 0),
        };
      }

      // Get paginated runs
      const runs = await ctx.db
        .select({
          id: schema.run.id,
          projectId: schema.run.projectId,
          testId: schema.run.testId,
          suiteId: schema.run.suiteId,
          trigger: schema.run.trigger,
          status: schema.run.status,
          startedAt: schema.run.startedAt,
          finishedAt: schema.run.finishedAt,
          metadata: schema.run.metadata,
          createdAt: schema.run.createdAt,
        })
        .from(schema.run)
        .where(and(...conditions))
        .orderBy(buildRunOrderBy(sortBy, sortOrder))
        .offset(offset)
        .limit(limit);

      // Handle edge case where no runs on current page
      if (runs.length === 0) {
        return {
          runs: [],
          suites: suites.map((s) => ({ id: s.id, name: s.name })),
          pagination: buildPaginationMeta(normalizedPage, normalizedPerPage, total),
        };
      }

      const runIds = runs.map((r) => r.id);

      // Get tests for mapping
      const tests = await ctx.db
        .select({
          id: schema.test.id,
          name: schema.test.name,
          suiteId: schema.test.suiteId,
        })
        .from(schema.test)
        .where(and(eq(schema.test.projectId, projectId), isNull(schema.test.deletedAt)));

      const testsMap = new Map(tests.map((t) => [t.id, { name: t.name, suiteId: t.suiteId }]));

      // Batch load run tests
      const runTestsByRunId = await loadRunTestsByRunId(ctx, runIds);

      // Build response using batched data
      const runsWithStats = runs.map((run) =>
        buildRunWithStats(run, runTestsByRunId.get(run.id) ?? [], testsMap, suitesMap)
      );

      return {
        runs: runsWithStats,
        suites: suites.map((s) => ({ id: s.id, name: s.name })),
        pagination: buildPaginationMeta(normalizedPage, normalizedPerPage, total),
      };
    },

    async listBySuite(ctx, options) {
      const { suiteId, page, perPage, sortBy, sortOrder, filters } = options;

      // Get the suite first
      const [suite] = await ctx.db
        .select()
        .from(schema.suite)
        .where(and(eq(schema.suite.id, suiteId), isNull(schema.suite.deletedAt)))
        .limit(1);

      if (!suite) {
        throw new NotFoundError("Suite", suiteId);
      }

      // Verify project exists and user has access
      await getProjectForRun(ctx, suite.projectId);

      // Build filter conditions
      const conditions = [
        eq(schema.run.suiteId, suiteId),
        isNull(schema.run.deletedAt),
      ];

      if (filters?.status && filters.status.length > 0) {
        conditions.push(inArray(schema.run.status, filters.status));
      }
      if (filters?.trigger && filters.trigger.length > 0) {
        conditions.push(inArray(schema.run.trigger, filters.trigger));
      }
      if (filters?.createdAt) {
        if (filters.createdAt.from) {
          conditions.push(gte(schema.run.createdAt, filters.createdAt.from));
        }
        if (filters.createdAt.to) {
          conditions.push(lte(schema.run.createdAt, filters.createdAt.to));
        }
      }

      // Count total matching records
      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.run)
        .where(and(...conditions));

      const total = countResult?.count ?? 0;

      // Normalize pagination
      const { offset, limit, page: normalizedPage, perPage: normalizedPerPage } = normalizePagination({
        page,
        perPage,
      });

      // Early return if no runs
      if (total === 0) {
        return {
          runs: [],
          suite: { id: suite.id, name: suite.name },
          pagination: buildPaginationMeta(normalizedPage, normalizedPerPage, 0),
        };
      }

      // Get paginated runs for this suite
      const runs = await ctx.db
        .select({
          id: schema.run.id,
          projectId: schema.run.projectId,
          testId: schema.run.testId,
          suiteId: schema.run.suiteId,
          trigger: schema.run.trigger,
          status: schema.run.status,
          startedAt: schema.run.startedAt,
          finishedAt: schema.run.finishedAt,
          metadata: schema.run.metadata,
          createdAt: schema.run.createdAt,
        })
        .from(schema.run)
        .where(and(...conditions))
        .orderBy(buildRunOrderBy(sortBy, sortOrder))
        .offset(offset)
        .limit(limit);

      // Handle edge case where no runs on current page
      if (runs.length === 0) {
        return {
          runs: [],
          suite: { id: suite.id, name: suite.name },
          pagination: buildPaginationMeta(normalizedPage, normalizedPerPage, total),
        };
      }

      const runIds = runs.map((r) => r.id);

      // Get tests for mapping
      const tests = await ctx.db
        .select({
          id: schema.test.id,
          name: schema.test.name,
          suiteId: schema.test.suiteId,
        })
        .from(schema.test)
        .where(and(eq(schema.test.suiteId, suiteId), isNull(schema.test.deletedAt)));

      const testsMap = new Map(tests.map((t) => [t.id, { name: t.name, suiteId: t.suiteId }]));
      const suitesMap = new Map([[suite.id, suite.name]]);

      // Batch load run tests
      const runTestsByRunId = await loadRunTestsByRunId(ctx, runIds);

      // Build response using batched data
      const runsWithStats = runs.map((run) =>
        buildRunWithStats(run, runTestsByRunId.get(run.id) ?? [], testsMap, suitesMap)
      );

      return {
        runs: runsWithStats,
        suite: { id: suite.id, name: suite.name },
        pagination: buildPaginationMeta(normalizedPage, normalizedPerPage, total),
      };
    },

    async listByTest(ctx, options) {
      const { testId, page, perPage, sortBy, sortOrder, filters } = options;

      // Get the test first
      const [test] = await ctx.db
        .select()
        .from(schema.test)
        .where(and(eq(schema.test.id, testId), isNull(schema.test.deletedAt)))
        .limit(1);

      if (!test) {
        throw new NotFoundError("Test", testId);
      }

      // Verify project exists and user has access
      await getProjectForRun(ctx, test.projectId);

      // Get the suite if test belongs to one
      let suiteInfo: SuiteInfo | null = null;
      if (test.suiteId) {
        const [suite] = await ctx.db
          .select({ id: schema.suite.id, name: schema.suite.name })
          .from(schema.suite)
          .where(and(eq(schema.suite.id, test.suiteId), isNull(schema.suite.deletedAt)))
          .limit(1);
        suiteInfo = suite ?? null;
      }

      // Build filter conditions
      const conditions = [
        eq(schema.run.testId, testId),
        isNull(schema.run.deletedAt),
      ];

      if (filters?.status && filters.status.length > 0) {
        conditions.push(inArray(schema.run.status, filters.status));
      }
      if (filters?.trigger && filters.trigger.length > 0) {
        conditions.push(inArray(schema.run.trigger, filters.trigger));
      }
      if (filters?.createdAt) {
        if (filters.createdAt.from) {
          conditions.push(gte(schema.run.createdAt, filters.createdAt.from));
        }
        if (filters.createdAt.to) {
          conditions.push(lte(schema.run.createdAt, filters.createdAt.to));
        }
      }

      // Count total matching records
      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.run)
        .where(and(...conditions));

      const total = countResult?.count ?? 0;

      // Normalize pagination
      const { offset, limit, page: normalizedPage, perPage: normalizedPerPage } = normalizePagination({
        page,
        perPage,
      });

      // Early return if no runs
      if (total === 0) {
        return {
          runs: [],
          test: { id: test.id, name: test.name },
          suite: suiteInfo,
          pagination: buildPaginationMeta(normalizedPage, normalizedPerPage, 0),
        };
      }

      // Get paginated runs for this test
      const runs = await ctx.db
        .select({
          id: schema.run.id,
          projectId: schema.run.projectId,
          testId: schema.run.testId,
          suiteId: schema.run.suiteId,
          trigger: schema.run.trigger,
          status: schema.run.status,
          startedAt: schema.run.startedAt,
          finishedAt: schema.run.finishedAt,
          metadata: schema.run.metadata,
          createdAt: schema.run.createdAt,
        })
        .from(schema.run)
        .where(and(...conditions))
        .orderBy(buildRunOrderBy(sortBy, sortOrder))
        .offset(offset)
        .limit(limit);

      // Handle edge case where no runs on current page
      if (runs.length === 0) {
        return {
          runs: [],
          test: { id: test.id, name: test.name },
          suite: suiteInfo,
          pagination: buildPaginationMeta(normalizedPage, normalizedPerPage, total),
        };
      }

      const runIds = runs.map((r) => r.id);

      const testsMap = new Map([[test.id, { name: test.name, suiteId: test.suiteId }]]);
      const suitesMap = suiteInfo ? new Map([[suiteInfo.id, suiteInfo.name]]) : new Map();

      // Batch load run tests
      const runTestsByRunId = await loadRunTestsByRunId(ctx, runIds);

      // Build response using batched data
      const runsWithStats = runs.map((run) =>
        buildRunWithStats(run, runTestsByRunId.get(run.id) ?? [], testsMap, suitesMap)
      );

      return {
        runs: runsWithStats,
        test: { id: test.id, name: test.name },
        suite: suiteInfo,
        pagination: buildPaginationMeta(normalizedPage, normalizedPerPage, total),
      };
    },

    async getById(ctx, id) {
      const { run } = await getRunWithAuth(ctx, id);

      return {
        id: run.id,
        projectId: run.projectId,
        testId: run.testId,
        suiteId: run.suiteId,
        trigger: run.trigger,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        createdAt: run.createdAt,
      };
    },

    async getByIdWithDetails(ctx, id) {
      const { run } = await getRunWithAuth(ctx, id);

      // Get test info if this is a single test run
      let testInfo: { id: string; name: string; suiteId: string | null } | null = null;
      if (run.testId) {
        const [test] = await ctx.db
          .select({ id: schema.test.id, name: schema.test.name, suiteId: schema.test.suiteId })
          .from(schema.test)
          .where(and(eq(schema.test.id, run.testId), isNull(schema.test.deletedAt)))
          .limit(1);
        testInfo = test ?? null;
      }

      // Get suite info
      let suiteInfo: SuiteInfo | null = null;
      const suiteId = run.suiteId ?? testInfo?.suiteId;
      if (suiteId) {
        const [suite] = await ctx.db
          .select({ id: schema.suite.id, name: schema.suite.name })
          .from(schema.suite)
          .where(and(eq(schema.suite.id, suiteId), isNull(schema.suite.deletedAt)))
          .limit(1);
        suiteInfo = suite ?? null;
      }

      // Get all run tests to calculate stats
      const allRunTests = await ctx.db
        .select({
          testId: schema.runTest.testId,
          status: schema.runTest.status,
          attempt: schema.runTest.attempt,
        })
        .from(schema.runTest)
        .where(and(eq(schema.runTest.runId, id), isNull(schema.runTest.deletedAt)));

      // Calculate stats using latest attempt for each test
      const testLatestAttempts = new Map<string, { testId: string; status: string; attempt: number }>();
      for (const rt of allRunTests) {
        const existing = testLatestAttempts.get(rt.testId);
        if (!existing || rt.attempt > existing.attempt) {
          testLatestAttempts.set(rt.testId, { testId: rt.testId, status: rt.status, attempt: rt.attempt });
        }
      }

      const { stats, maxAttempts } = calculateRunStats(
        Array.from(testLatestAttempts.values())
      );

      // Calculate duration
      let duration: string | undefined;
      if (run.startedAt && run.finishedAt) {
        const durationMs = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
        if (durationMs > 0) {
          duration = formatDuration(durationMs);
        }
      }

      // Parse metadata
      const metadata = run.metadata as RunMetadata | null;

      return {
        id: run.id,
        projectId: run.projectId,
        testId: run.testId,
        suiteId: run.suiteId,
        testName: testInfo?.name,
        suiteName: suiteInfo?.name,
        suiteTestCount: run.suiteId ? stats.total : undefined,
        trigger: {
          type: run.trigger,
          commit: metadata?.commit,
        },
        status: run.status,
        stats,
        duration,
        attempts: maxAttempts,
        branch: metadata?.branch ?? "main",
        environment: metadata?.environment ?? "development",
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        summary: run.summary,
        commit: metadata?.commit,
        test: testInfo,
        suite: suiteInfo,
        isSingleTestRun: !!run.testId,
      };
    },

    async getTestsForRun(ctx, runId) {
      // Verify run exists and user has access
      await getRunWithAuth(ctx, runId);

      // Get all runTests for this run with test info (including soft-deleted tests for historical accuracy)
      const runTests = await ctx.db
        .select({
          id: schema.runTest.id,
          testId: schema.runTest.testId,
          status: schema.runTest.status,
          attempt: schema.runTest.attempt,
          durationMs: schema.runTest.durationMs,
          testName: schema.test.name,
        })
        .from(schema.runTest)
        .leftJoin(schema.test, eq(schema.runTest.testId, schema.test.id))
        .where(
          and(
            eq(schema.runTest.runId, runId),
            isNull(schema.runTest.deletedAt)
          )
        );

      // Group by testId, taking the latest attempt for each test
      const testMap = new Map<string, RunTestItem>();

      for (const rt of runTests) {
        const existing = testMap.get(rt.testId);
        if (!existing || rt.attempt > existing.attempt) {
          // Determine runStatus - normalize to "flaky" for flaky tests
          const runStatus = isFlaky(rt.status, rt.attempt) ? "flaky" : rt.status;

          // Use test name if available, otherwise indicate it was deleted
          const testName = rt.testName ?? "[Deleted Test]";

          testMap.set(rt.testId, {
            id: rt.testId,
            testId: rt.testId,
            name: testName,
            status: runStatus,
            attempt: rt.attempt,
            duration: rt.durationMs ? formatDuration(rt.durationMs) : undefined,
          });
        }
      }

      return {
        tests: Array.from(testMap.values()),
      };
    },

    async triggerRun(ctx, options) {
      const { testId, suiteId } = options;

      // Validate: must have exactly one of testId or suiteId
      if ((testId && suiteId) || (!testId && !suiteId)) {
        throw new ValidationError("Must provide exactly one of testId or suiteId");
      }

      // Get the actor user ID for tracking who triggered the run
      const userId = requireActorUserId(ctx.actor);
      const runId = createId("run");
      const now = new Date();

      // Handle single test run
      if (testId) {
        // Get the test and verify it exists
        const [test] = await ctx.db
          .select({
            id: schema.test.id,
            projectId: schema.test.projectId,
          })
          .from(schema.test)
          .where(and(eq(schema.test.id, testId), isNull(schema.test.deletedAt)))
          .limit(1);

        if (!test) {
          throw new NotFoundError("Test", testId);
        }

        // Get project and verify org membership
        const [project] = await ctx.db
          .select({ id: schema.project.id, orgId: schema.project.orgId })
          .from(schema.project)
          .where(and(eq(schema.project.id, test.projectId), isNull(schema.project.deletedAt)))
          .limit(1);

        if (!project) {
          throw new NotFoundError("Project", test.projectId);
        }

        await requireOrgMembership(ctx, project.orgId);

        // Check that the test has at least one version with steps
        const [testVersion] = await ctx.db
          .select({ steps: schema.testVersion.steps })
          .from(schema.testVersion)
          .where(eq(schema.testVersion.testId, testId))
          .orderBy(desc(schema.testVersion.version))
          .limit(1);

        if (!testVersion?.steps) {
          throw new ValidationError("Test has no steps to run. Please add steps to the test first.");
        }

        const stepsData = testVersion.steps as { steps?: unknown[] };
        if (!stepsData.steps || stepsData.steps.length === 0) {
          throw new ValidationError("Test has no steps to run. Please add steps to the test first.");
        }

        // Create the run record for single test
        await ctx.db.insert(schema.run).values({
          id: runId,
          projectId: test.projectId,
          testId,
          trigger: "manual",
          status: "queued",
          triggeredByUserId: userId,
          config: {},
          createdAt: now,
          updatedAt: now,
        });

        // Publish the run.created.v1 event if boss is available
        if (ctx.boss) {
          await publish(
            ctx.boss,
            EVENTS.RUN_CREATED_V1,
            {
              runId,
              projectId: test.projectId,
              triggeredBy: "manual",
              triggeredByUserId: userId,
            },
            { singletonKey: runId }
          );
        }

        return { runId };
      }

      // Handle suite run
      if (suiteId) {
        // Get the suite and verify it exists
        const [suite] = await ctx.db
          .select({
            id: schema.suite.id,
            projectId: schema.suite.projectId,
          })
          .from(schema.suite)
          .where(and(eq(schema.suite.id, suiteId), isNull(schema.suite.deletedAt)))
          .limit(1);

        if (!suite) {
          throw new NotFoundError("Suite", suiteId);
        }

        // Get project and verify org membership
        const [project] = await ctx.db
          .select({ id: schema.project.id, orgId: schema.project.orgId })
          .from(schema.project)
          .where(and(eq(schema.project.id, suite.projectId), isNull(schema.project.deletedAt)))
          .limit(1);

        if (!project) {
          throw new NotFoundError("Project", suite.projectId);
        }

        await requireOrgMembership(ctx, project.orgId);

        // Get all tests in this suite
        const tests = await ctx.db
          .select({ id: schema.test.id })
          .from(schema.test)
          .where(and(eq(schema.test.suiteId, suiteId), isNull(schema.test.deletedAt)));

        if (tests.length === 0) {
          throw new ValidationError("Suite has no tests to run");
        }

        // Verify all tests have at least one version with steps
        const testIds = tests.map((t) => t.id);
        const testVersions = await ctx.db
          .select({
            testId: schema.testVersion.testId,
            steps: schema.testVersion.steps,
            version: schema.testVersion.version,
          })
          .from(schema.testVersion)
          .where(inArray(schema.testVersion.testId, testIds))
          .orderBy(desc(schema.testVersion.version));

        // Group by testId, take latest version
        const latestVersionByTestId = new Map<string, { steps?: unknown[] }>();
        for (const tv of testVersions) {
          if (!latestVersionByTestId.has(tv.testId)) {
            latestVersionByTestId.set(tv.testId, tv.steps as { steps?: unknown[] });
          }
        }

        // Collect tests with valid steps
        const testsWithSteps = testIds.filter((id) => {
          const stepsData = latestVersionByTestId.get(id);
          return stepsData?.steps && stepsData.steps.length > 0;
        });

        if (testsWithSteps.length === 0) {
          throw new ValidationError("No tests in suite have steps to run");
        }

        // Create the run record with suiteId (testId = null)
        await ctx.db.insert(schema.run).values({
          id: runId,
          projectId: suite.projectId,
          suiteId,
          testId: null,
          trigger: "manual",
          status: "queued",
          triggeredByUserId: userId,
          config: {},
          createdAt: now,
          updatedAt: now,
        });

        // Publish the run.created.v1 event if boss is available
        if (ctx.boss) {
          await publish(
            ctx.boss,
            EVENTS.RUN_CREATED_V1,
            {
              runId,
              projectId: suite.projectId,
              triggeredBy: "manual",
              triggeredByUserId: userId,
            },
            { singletonKey: runId }
          );
        }

        return { runId, testCount: testsWithSteps.length };
      }

      // This should never be reached due to validation above
      throw new ValidationError("Must provide exactly one of testId or suiteId");
    },
  };
}
