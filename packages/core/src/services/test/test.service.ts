/**
 * TestService - Test management business logic.
 *
 * Handles CRUD operations for tests within projects.
 */

import {
  eq,
  and,
  isNull,
  desc,
  asc,
  inArray,
  ilike,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  normalizePagination,
  buildPaginationMeta,
} from "../../pagination/index.js";
import { schema } from "@posium/db";
import { publish, EVENTS } from "@posium/appevents";
import type { ServiceContext } from "../../context.js";
import { requireActorUserId } from "../../context.js";
import { NotFoundError, ValidationError } from "../../errors.js";
import { requireOrgMembership } from "../../auth/membership.js";
import { withTransaction } from "../../transactions.js";
import type {
  Test,
  TestWithStats,
  TestStep,
  TestStepsResult,
  TestFilters,
  TestSortColumn,
  ListTestsByProjectOptions,
  ListTestsBySuiteOptions,
  ListTestsByProjectResult,
  ListTestsBySuiteResult,
  CreateTestInput,
  UpdateTestInput,
  UpdateTestResult,
  UpdateTestTagsInput,
  RunResult,
  TestStatus,
} from "./test.types.js";

/**
 * Maximum tests to fetch when doing in-memory filtering/sorting.
 * This is a safeguard to prevent memory issues with very large projects.
 */
const MAX_TESTS_PER_PROJECT = 500;

/**
 * TestService interface.
 */
export interface TestService {
  /** List all tests in a project with stats */
  listByProject(ctx: ServiceContext, options: ListTestsByProjectOptions): Promise<ListTestsByProjectResult>;

  /** List all tests in a suite with stats */
  listBySuite(ctx: ServiceContext, options: ListTestsBySuiteOptions): Promise<ListTestsBySuiteResult>;

  /** Get a single test by ID */
  getById(ctx: ServiceContext, id: string): Promise<Test>;

  /** Get test steps from the latest published version */
  getTestSteps(ctx: ServiceContext, testId: string): Promise<TestStepsResult>;

  /** Create a new test */
  create(ctx: ServiceContext, input: CreateTestInput): Promise<Test>;

  /** Update a test (name, description, suite, steps) */
  update(ctx: ServiceContext, id: string, input: UpdateTestInput): Promise<UpdateTestResult>;

  /** Soft delete a test */
  delete(ctx: ServiceContext, id: string): Promise<void>;

  /** Update test tags */
  updateTags(ctx: ServiceContext, input: UpdateTestTagsInput): Promise<void>;
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
 * Get project and verify org membership for a test.
 * Returns the project record.
 */
async function getProjectForTest(
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
 * Get test and verify org membership.
 * Returns the test and project records.
 */
async function getTestWithAuth(
  ctx: ServiceContext,
  testId: string
): Promise<{ test: typeof schema.test.$inferSelect; project: { id: string; orgId: string } }> {
  const [test] = await ctx.db
    .select()
    .from(schema.test)
    .where(and(eq(schema.test.id, testId), isNull(schema.test.deletedAt)))
    .limit(1);

  if (!test) {
    throw new NotFoundError("Test", testId);
  }

  const project = await getProjectForTest(ctx, test.projectId);
  return { test, project };
}

/**
 * Build test stats from batched query results.
 */
function buildTestWithStats(
  test: {
    id: string;
    name: string;
    description: string | null;
    kind: string;
    suiteId: string | null;
    projectId: string;
    createdAt: Date;
    updatedAt: Date | null;
  },
  suitesMap: Map<string, string>,
  runTestsByTestId: Map<string, Array<{ status: string; durationMs: number | null; runId: string; createdAt: Date }>>,
  publishedTestIds: Set<string>,
  draftTestIds: Set<string>,
  tagsByTestId: Map<string, string[]>
): TestWithStats {
  const recentRuns = runTestsByTestId.get(test.id) ?? [];

  // Determine current status from most recent run
  const latestRun = recentRuns[0];
  let status: TestStatus = null;

  if (latestRun) {
    if (latestRun.status === "passed") status = "passing";
    else if (latestRun.status === "failed") status = "failed";
    else if (latestRun.status === "flaky") status = "flaky";
    else if (latestRun.status === "running") status = "running";
  }

  const published = publishedTestIds.has(test.id);
  const hasDraft = draftTestIds.has(test.id);

  // Calculate average duration from recent runs (only count runs with non-null duration)
  const runsWithDuration = recentRuns.filter((r) => r.durationMs != null);
  const avgDuration =
    runsWithDuration.length > 0
      ? Math.round(
          runsWithDuration.reduce((sum, r) => sum + r.durationMs!, 0) / runsWithDuration.length
        )
      : null;

  // Map run statuses to display values (only passed/failed/flaky for the indicator)
  const last5Runs: RunResult[] = recentRuns
    .filter((r) => r.status === "passed" || r.status === "failed" || r.status === "flaky")
    .map((r) => {
      if (r.status === "passed") return "passed";
      if (r.status === "failed") return "failed";
      return "flaky";
    });

  return {
    id: test.id,
    name: test.name,
    description: test.description,
    kind: test.kind,
    suiteId: test.suiteId,
    suiteName: test.suiteId ? suitesMap.get(test.suiteId) : undefined,
    projectId: test.projectId,
    status,
    published,
    hasDraft,
    duration: avgDuration ? formatDuration(avgDuration) : undefined,
    last5Runs,
    lastRunId: latestRun?.runId,
    lastRunTime: latestRun?.createdAt,
    createdAt: test.createdAt,
    updatedAt: test.updatedAt,
    tags: tagsByTestId.get(test.id) ?? [],
  };
}

/**
 * Batch load test statistics data.
 */
async function loadTestStats(
  ctx: ServiceContext,
  testIds: string[]
): Promise<{
  runTestsByTestId: Map<string, Array<{ status: string; durationMs: number | null; runId: string; createdAt: Date }>>;
  publishedTestIds: Set<string>;
  draftTestIds: Set<string>;
  tagsByTestId: Map<string, string[]>;
}> {
  // Batch query: Get all run tests for all tests at once (ordered by createdAt desc)
  // Limit to prevent memory issues with very large datasets
  const runTestLimit = Math.min(testIds.length * 20, 5000);
  const allRunTests = await ctx.db
    .select({
      testId: schema.runTest.testId,
      runId: schema.runTest.runId,
      status: schema.runTest.status,
      durationMs: schema.runTest.durationMs,
      createdAt: schema.runTest.createdAt,
    })
    .from(schema.runTest)
    .where(and(inArray(schema.runTest.testId, testIds), isNull(schema.runTest.deletedAt)))
    .orderBy(desc(schema.runTest.createdAt))
    .limit(runTestLimit);

  // Group run tests by testId and take only the 5 most recent per test
  const runTestsByTestId = new Map<
    string,
    Array<{ status: string; durationMs: number | null; runId: string; createdAt: Date }>
  >();
  for (const rt of allRunTests) {
    const existing = runTestsByTestId.get(rt.testId) ?? [];
    if (existing.length < 5) {
      existing.push({
        status: rt.status,
        durationMs: rt.durationMs,
        runId: rt.runId,
        createdAt: rt.createdAt,
      });
      runTestsByTestId.set(rt.testId, existing);
    }
  }

  // Batch query: Get all published test versions (check soft-delete)
  const publishedVersions = await ctx.db
    .select({ testId: schema.testVersion.testId })
    .from(schema.testVersion)
    .where(and(inArray(schema.testVersion.testId, testIds), isNull(schema.testVersion.deletedAt)));

  const publishedTestIds = new Set(publishedVersions.map((v) => v.testId));

  // Batch query: Get all active drafts (check soft-delete)
  const activeDrafts = await ctx.db
    .select({ testId: schema.testDraft.testId })
    .from(schema.testDraft)
    .where(
      and(
        inArray(schema.testDraft.testId, testIds),
        eq(schema.testDraft.status, "active"),
        isNull(schema.testDraft.deletedAt)
      )
    );

  const draftTestIds = new Set(activeDrafts.map((d) => d.testId));

  // Batch query: Get all tags for all tests at once
  const allTestTags = await ctx.db
    .select({
      testId: schema.testTag.testId,
      tagName: schema.tag.name,
    })
    .from(schema.testTag)
    .innerJoin(schema.tag, eq(schema.testTag.tagId, schema.tag.id))
    .where(
      and(
        inArray(schema.testTag.testId, testIds),
        isNull(schema.testTag.deletedAt),
        isNull(schema.tag.deletedAt)
      )
    );

  // Group tags by testId
  const tagsByTestId = new Map<string, string[]>();
  for (const tt of allTestTags) {
    const existing = tagsByTestId.get(tt.testId) ?? [];
    existing.push(tt.tagName);
    tagsByTestId.set(tt.testId, existing);
  }

  return { runTestsByTestId, publishedTestIds, draftTestIds, tagsByTestId };
}

/**
 * Build filter conditions for test queries.
 */
function buildTestFilterConditions(
  filters: TestFilters | undefined,
  projectId: string
): SQL[] {
  const conditions: SQL[] = [
    eq(schema.test.projectId, projectId),
    isNull(schema.test.deletedAt),
  ];

  if (!filters) return conditions;

  // Name filter (case-insensitive partial match)
  if (filters.name) {
    conditions.push(ilike(schema.test.name, `%${filters.name}%`));
  }

  // Suite filter
  if (filters.suiteId && filters.suiteId.length > 0) {
    conditions.push(inArray(schema.test.suiteId, filters.suiteId));
  }

  // Note: status and tags filters require joining with other tables
  // These are handled post-query for now since they depend on computed values

  return conditions;
}

/**
 * Build order by clause for test queries.
 */
function buildTestOrderBy(
  sortBy: TestSortColumn | undefined,
  sortOrder: "asc" | "desc" | undefined
) {
  const order = sortOrder === "asc" ? asc : desc;
  const column = sortBy ?? "createdAt";

  switch (column) {
    case "name":
      return order(schema.test.name);
    case "createdAt":
      return order(schema.test.createdAt);
    // Note: status, lastRunTime, duration are computed from run data
    // For now, we sort by createdAt for these to avoid complex joins
    case "status":
    case "lastRunTime":
    case "duration":
      return order(schema.test.createdAt);
    default:
      return desc(schema.test.createdAt);
  }
}

/**
 * Apply post-enrichment filters (for computed values like status and tags).
 */
function applyPostEnrichmentFilters(
  tests: TestWithStats[],
  filters: TestFilters | undefined
): TestWithStats[] {
  if (!filters) return tests;

  let result = tests;

  // Status filter
  if (filters.status && filters.status.length > 0) {
    const statusSet = new Set(filters.status);
    result = result.filter((t) => {
      // Handle null status as "no_runs"
      const status = t.status ?? "no_runs";
      return statusSet.has(status);
    });
  }

  // Tags filter
  if (filters.tags && filters.tags.length > 0) {
    const tagSet = new Set(filters.tags);
    result = result.filter((t) =>
      t.tags.some((tag) => tagSet.has(tag))
    );
  }

  return result;
}

/**
 * Sort tests by computed column values (status, lastRunTime, duration).
 */
function sortTestsByComputedColumn(
  tests: TestWithStats[],
  sortBy: TestSortColumn | undefined,
  sortOrder: "asc" | "desc" | undefined
): TestWithStats[] {
  if (!sortBy) return tests;

  const direction = sortOrder === "asc" ? 1 : -1;

  // Status priority for sorting
  const statusPriority: Record<string, number> = {
    failed: 0,
    flaky: 1,
    running: 2,
    passing: 3,
    no_runs: 4,
  };

  switch (sortBy) {
    case "status":
      return [...tests].sort((a, b) => {
        const aStatus = a.status ?? "no_runs";
        const bStatus = b.status ?? "no_runs";
        const aPriority = statusPriority[aStatus] ?? 5;
        const bPriority = statusPriority[bStatus] ?? 5;
        return (aPriority - bPriority) * direction;
      });
    case "lastRunTime":
      return [...tests].sort((a, b) => {
        const aTime = a.lastRunTime?.getTime() ?? 0;
        const bTime = b.lastRunTime?.getTime() ?? 0;
        return (aTime - bTime) * direction;
      });
    case "duration":
      return [...tests].sort((a, b) => {
        // Parse duration strings like "1.5s", "2m 30s", "500ms"
        const parseDuration = (d: string | undefined): number => {
          if (!d) return 0;
          const ms = d.match(/(\d+)ms/);
          if (ms?.[1]) return parseInt(ms[1], 10);
          const sec = d.match(/([\d.]+)s/);
          const min = d.match(/(\d+)m/);
          let total = 0;
          if (min?.[1]) total += parseInt(min[1], 10) * 60000;
          if (sec?.[1]) total += parseFloat(sec[1]) * 1000;
          return total;
        };
        return (parseDuration(a.duration) - parseDuration(b.duration)) * direction;
      });
    default:
      return tests;
  }
}

/**
 * Creates a TestService instance.
 */
export function createTestService(): TestService {
  return {
    async listByProject(ctx, options) {
      const { projectId, page, perPage, sortBy, sortOrder, filters } = options;

      // Verify project exists and user has access
      await getProjectForTest(ctx, projectId);

      // Check if we need post-enrichment filtering or sorting
      const hasComputedFilters = !!(filters?.status?.length || filters?.tags?.length);
      const hasComputedSort = sortBy === "status" || sortBy === "lastRunTime" || sortBy === "duration";

      // Build SQL-level filter conditions (name, suiteId only)
      const conditions = buildTestFilterConditions(filters, projectId);

      // Get suites for this project (needed for filter options and display)
      const suites = await ctx.db
        .select({ id: schema.suite.id, name: schema.suite.name })
        .from(schema.suite)
        .where(and(eq(schema.suite.projectId, projectId), isNull(schema.suite.deletedAt)));

      const suitesMap = new Map(suites.map((s) => [s.id, s.name]));

      // Get all tags for this project (needed for filter options)
      const allTags = await ctx.db
        .select({ id: schema.tag.id, name: schema.tag.name })
        .from(schema.tag)
        .where(and(eq(schema.tag.projectId, projectId), isNull(schema.tag.deletedAt)));

      // If we have computed filters/sorts, we need to fetch all, enrich, then filter/paginate
      // Otherwise, we can do true server-side pagination
      if (hasComputedFilters || hasComputedSort) {
        // Fetch all tests matching SQL filters, then filter/sort/paginate in memory
        const allTests = await ctx.db
          .select({
            id: schema.test.id,
            name: schema.test.name,
            description: schema.test.description,
            kind: schema.test.kind,
            suiteId: schema.test.suiteId,
            projectId: schema.test.projectId,
            createdAt: schema.test.createdAt,
            updatedAt: schema.test.updatedAt,
          })
          .from(schema.test)
          .where(and(...conditions))
          .orderBy(buildTestOrderBy(sortBy, sortOrder))
          .limit(MAX_TESTS_PER_PROJECT);

        if (allTests.length === 0) {
          return {
            tests: [],
            suites: suites.map((s) => ({ id: s.id, name: s.name })),
            tags: allTags.map((t) => ({ id: t.id, name: t.name })),
            pagination: buildPaginationMeta(page ?? 1, perPage ?? 10, 0),
          };
        }

        // Enrich all tests with stats
        const testIds = allTests.map((t) => t.id);
        const { runTestsByTestId, publishedTestIds, draftTestIds, tagsByTestId } =
          await loadTestStats(ctx, testIds);

        const enrichedTests = allTests.map((test) =>
          buildTestWithStats(
            test,
            suitesMap,
            runTestsByTestId,
            publishedTestIds,
            draftTestIds,
            tagsByTestId
          )
        );

        // Apply post-enrichment filters
        let filteredTests = applyPostEnrichmentFilters(enrichedTests, filters);

        // Apply computed column sorting
        filteredTests = sortTestsByComputedColumn(filteredTests, sortBy, sortOrder);

        // Paginate the filtered results
        const { offset, limit, page: p, perPage: pp } = normalizePagination({ page, perPage });
        const total = filteredTests.length;
        const paginatedTests = filteredTests.slice(offset, offset + limit);

        return {
          tests: paginatedTests,
          suites: suites.map((s) => ({ id: s.id, name: s.name })),
          tags: allTags.map((t) => ({ id: t.id, name: t.name })),
          pagination: buildPaginationMeta(p, pp, total),
        };
      }

      // True server-side pagination (no computed filters/sorts)
      // Count query for total
      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.test)
        .where(and(...conditions));

      const total = countResult?.count ?? 0;

      // Normalize pagination
      const { offset, limit, page: normalizedPage, perPage: normalizedPerPage } =
        normalizePagination({ page, perPage });

      // Early return if no tests
      if (total === 0) {
        return {
          tests: [],
          suites: suites.map((s) => ({ id: s.id, name: s.name })),
          tags: allTags.map((t) => ({ id: t.id, name: t.name })),
          pagination: buildPaginationMeta(normalizedPage, normalizedPerPage, 0),
        };
      }

      // Get paginated tests
      const tests = await ctx.db
        .select({
          id: schema.test.id,
          name: schema.test.name,
          description: schema.test.description,
          kind: schema.test.kind,
          suiteId: schema.test.suiteId,
          projectId: schema.test.projectId,
          createdAt: schema.test.createdAt,
          updatedAt: schema.test.updatedAt,
        })
        .from(schema.test)
        .where(and(...conditions))
        .orderBy(buildTestOrderBy(sortBy, sortOrder))
        .offset(offset)
        .limit(limit);

      const testIds = tests.map((t) => t.id);
      const { runTestsByTestId, publishedTestIds, draftTestIds, tagsByTestId } =
        await loadTestStats(ctx, testIds);

      // Build the response using the batched data
      const testsWithStats = tests.map((test) =>
        buildTestWithStats(
          test,
          suitesMap,
          runTestsByTestId,
          publishedTestIds,
          draftTestIds,
          tagsByTestId
        )
      );

      return {
        tests: testsWithStats,
        suites: suites.map((s) => ({ id: s.id, name: s.name })),
        tags: allTags.map((t) => ({ id: t.id, name: t.name })),
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
      await getProjectForTest(ctx, suite.projectId);

      // Check if we need post-enrichment filtering or sorting
      const hasComputedFilters = !!(filters?.status?.length || filters?.tags?.length);
      const hasComputedSort = sortBy === "status" || sortBy === "lastRunTime" || sortBy === "duration";

      // Build base conditions for suite
      const conditions: SQL[] = [
        eq(schema.test.suiteId, suiteId),
        isNull(schema.test.deletedAt),
      ];

      // Apply name filter if provided
      if (filters?.name) {
        conditions.push(ilike(schema.test.name, `%${filters.name}%`));
      }

      const suitesMap = new Map([[suite.id, suite.name]]);

      // If we have computed filters/sorts, we need to fetch all, enrich, then filter/paginate
      if (hasComputedFilters || hasComputedSort) {
        // Fetch all tests matching SQL filters, then filter/sort/paginate in memory
        const allTests = await ctx.db
          .select({
            id: schema.test.id,
            name: schema.test.name,
            description: schema.test.description,
            kind: schema.test.kind,
            suiteId: schema.test.suiteId,
            projectId: schema.test.projectId,
            createdAt: schema.test.createdAt,
            updatedAt: schema.test.updatedAt,
          })
          .from(schema.test)
          .where(and(...conditions))
          .orderBy(buildTestOrderBy(sortBy, sortOrder))
          .limit(MAX_TESTS_PER_PROJECT);

        if (allTests.length === 0) {
          return {
            tests: [],
            suite: { id: suite.id, name: suite.name },
            pagination: buildPaginationMeta(page ?? 1, perPage ?? 10, 0),
          };
        }

        // Enrich all tests with stats
        const testIds = allTests.map((t) => t.id);
        const { runTestsByTestId, publishedTestIds, draftTestIds, tagsByTestId } =
          await loadTestStats(ctx, testIds);

        const enrichedTests = allTests.map((test) =>
          buildTestWithStats(
            test,
            suitesMap,
            runTestsByTestId,
            publishedTestIds,
            draftTestIds,
            tagsByTestId
          )
        );

        // Apply post-enrichment filters
        let filteredTests = applyPostEnrichmentFilters(enrichedTests, filters);

        // Apply computed column sorting
        filteredTests = sortTestsByComputedColumn(filteredTests, sortBy, sortOrder);

        // Paginate the filtered results
        const { offset, limit, page: p, perPage: pp } = normalizePagination({ page, perPage });
        const total = filteredTests.length;
        const paginatedTests = filteredTests.slice(offset, offset + limit);

        return {
          tests: paginatedTests,
          suite: { id: suite.id, name: suite.name },
          pagination: buildPaginationMeta(p, pp, total),
        };
      }

      // True server-side pagination (no computed filters/sorts)
      // Get total count
      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.test)
        .where(and(...conditions));
      const total = countResult?.count ?? 0;

      // Normalize pagination
      const { offset, limit, page: normalizedPage, perPage: normalizedPerPage } =
        normalizePagination({ page, perPage });

      // Early return if no tests
      if (total === 0) {
        return {
          tests: [],
          suite: { id: suite.id, name: suite.name },
          pagination: buildPaginationMeta(normalizedPage, normalizedPerPage, 0),
        };
      }

      // Get paginated tests
      const tests = await ctx.db
        .select({
          id: schema.test.id,
          name: schema.test.name,
          description: schema.test.description,
          kind: schema.test.kind,
          suiteId: schema.test.suiteId,
          projectId: schema.test.projectId,
          createdAt: schema.test.createdAt,
          updatedAt: schema.test.updatedAt,
        })
        .from(schema.test)
        .where(and(...conditions))
        .orderBy(buildTestOrderBy(sortBy, sortOrder))
        .offset(offset)
        .limit(limit);

      const testIds = tests.map((t) => t.id);
      const { runTestsByTestId, publishedTestIds, draftTestIds, tagsByTestId } =
        await loadTestStats(ctx, testIds);

      // Build the response using the batched data
      const testsWithStats = tests.map((test) =>
        buildTestWithStats(
          test,
          suitesMap,
          runTestsByTestId,
          publishedTestIds,
          draftTestIds,
          tagsByTestId
        )
      );

      return {
        tests: testsWithStats,
        suite: { id: suite.id, name: suite.name },
        pagination: buildPaginationMeta(normalizedPage, normalizedPerPage, total),
      };
    },

    async getById(ctx, id) {
      const { test } = await getTestWithAuth(ctx, id);

      return {
        id: test.id,
        projectId: test.projectId,
        suiteId: test.suiteId,
        kind: test.kind,
        name: test.name,
        description: test.description,
        createdAt: test.createdAt,
        updatedAt: test.updatedAt,
      };
    },

    async getTestSteps(ctx, testId) {
      // Verify test exists and user has access
      await getTestWithAuth(ctx, testId);

      // Get the latest test version
      const [latestVersion] = await ctx.db
        .select({
          id: schema.testVersion.id,
          version: schema.testVersion.version,
          steps: schema.testVersion.steps,
        })
        .from(schema.testVersion)
        .where(
          and(eq(schema.testVersion.testId, testId), isNull(schema.testVersion.deletedAt))
        )
        .orderBy(desc(schema.testVersion.version))
        .limit(1);

      if (!latestVersion) {
        return { steps: [] };
      }

      return {
        versionId: latestVersion.id,
        version: latestVersion.version,
        // Cast to TestStep[] - assumes data matches new format (legacy data won't work)
        steps: (latestVersion.steps.steps ?? []) as TestStep[],
      };
    },

    async create(ctx, input) {
      const userId = requireActorUserId(ctx.actor);
      const { projectId, suiteId, kind, name, description } = input;

      // Verify project exists and user has access
      await getProjectForTest(ctx, projectId);

      // If suiteId is provided, verify it exists and belongs to the same project
      if (suiteId) {
        const [suite] = await ctx.db
          .select({ id: schema.suite.id })
          .from(schema.suite)
          .where(
            and(
              eq(schema.suite.id, suiteId),
              eq(schema.suite.projectId, projectId),
              isNull(schema.suite.deletedAt)
            )
          )
          .limit(1);

        if (!suite) {
          throw new ValidationError("Suite not found or does not belong to this project");
        }
      }

      // Create the test
      const [newTest] = await ctx.db
        .insert(schema.test)
        .values({
          projectId,
          suiteId: suiteId ?? null,
          kind,
          name,
          description,
          createdBy: userId,
        })
        .returning();

      if (!newTest) {
        throw new Error("Failed to create test");
      }

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.TEST_CREATED_V1, {
          testId: newTest.id,
          projectId: newTest.projectId,
          name: newTest.name,
          createdByUserId: userId,
        });
      }

      return {
        id: newTest.id,
        projectId: newTest.projectId,
        suiteId: newTest.suiteId,
        kind: newTest.kind,
        name: newTest.name,
        description: newTest.description,
        createdAt: newTest.createdAt,
        updatedAt: newTest.updatedAt,
      };
    },

    async update(ctx, id, input) {
      const userId = requireActorUserId(ctx.actor);
      const { test } = await getTestWithAuth(ctx, id);

      // If suiteId is being changed, verify new suite exists and belongs to the same project
      if (input.suiteId !== undefined && input.suiteId !== null && input.suiteId !== test.suiteId) {
        const [suite] = await ctx.db
          .select({ id: schema.suite.id })
          .from(schema.suite)
          .where(
            and(
              eq(schema.suite.id, input.suiteId),
              eq(schema.suite.projectId, test.projectId),
              isNull(schema.suite.deletedAt)
            )
          )
          .limit(1);

        if (!suite) {
          throw new ValidationError("Suite not found or does not belong to this project");
        }
      }

      // Build update object for test metadata
      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.suiteId !== undefined) updates.suiteId = input.suiteId;

      const [updated] = await ctx.db
        .update(schema.test)
        .set(updates)
        .where(eq(schema.test.id, id))
        .returning();

      if (!updated) {
        throw new Error("Failed to update test");
      }

      // If steps are provided, create a new version
      let versionInfo: { versionId: string; version: number } | undefined;
      if (input.steps !== undefined) {
        // Get the current highest version number
        const [latestVersion] = await ctx.db
          .select({ version: schema.testVersion.version })
          .from(schema.testVersion)
          .where(
            and(eq(schema.testVersion.testId, id), isNull(schema.testVersion.deletedAt))
          )
          .orderBy(desc(schema.testVersion.version))
          .limit(1);

        const nextVersion = (latestVersion?.version ?? 0) + 1;

        // Create the new test version
        const [newVersion] = await ctx.db
          .insert(schema.testVersion)
          .values({
            testId: id,
            version: nextVersion,
            steps: { steps: input.steps },
            createdBy: userId,
          })
          .returning({ id: schema.testVersion.id, version: schema.testVersion.version });

        if (!newVersion) {
          throw new Error("Failed to create test version");
        }

        versionInfo = {
          versionId: newVersion.id,
          version: newVersion.version,
        };
      }

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.TEST_UPDATED_V1, {
          testId: updated.id,
          projectId: updated.projectId,
          updatedByUserId: userId,
          changes: input as Record<string, unknown>,
        });
      }

      return {
        test: {
          id: updated.id,
          projectId: updated.projectId,
          suiteId: updated.suiteId,
          kind: updated.kind,
          name: updated.name,
          description: updated.description,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
        version: versionInfo,
      };
    },

    async delete(ctx, id) {
      const userId = requireActorUserId(ctx.actor);
      const { test } = await getTestWithAuth(ctx, id);

      // Soft delete
      await ctx.db
        .update(schema.test)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.test.id, id));

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.TEST_DELETED_V1, {
          testId: id,
          projectId: test.projectId,
          deletedByUserId: userId,
        });
      }
    },

    async updateTags(ctx, input) {
      const { testId, tags } = input;
      const { test } = await getTestWithAuth(ctx, testId);

      // Wrap in transaction to ensure atomicity
      await withTransaction(ctx, async (txCtx) => {
        // Get existing tags for this project
        const existingTags = await txCtx.db
          .select({ id: schema.tag.id, name: schema.tag.name })
          .from(schema.tag)
          .where(
            and(eq(schema.tag.projectId, test.projectId), isNull(schema.tag.deletedAt))
          );

        const existingTagMap = new Map(existingTags.map((t) => [t.name, t.id]));

        // Find or create tags
        const tagIds: string[] = [];
        for (const tagName of tags) {
          const trimmedName = tagName.trim();
          if (!trimmedName) continue;

          let tagId = existingTagMap.get(trimmedName);
          if (!tagId) {
            // Create new tag
            const [newTag] = await txCtx.db
              .insert(schema.tag)
              .values({
                projectId: test.projectId,
                name: trimmedName,
              })
              .returning();

            if (!newTag) {
              throw new Error("Failed to create tag");
            }
            tagId = newTag.id;
          }
          tagIds.push(tagId);
        }

        // Dedupe tagIds to prevent duplicate inserts
        const uniqueTagIds = [...new Set(tagIds)];

        // Get current test tags
        const currentTestTags = await txCtx.db
          .select({ id: schema.testTag.id, tagId: schema.testTag.tagId })
          .from(schema.testTag)
          .where(
            and(eq(schema.testTag.testId, testId), isNull(schema.testTag.deletedAt))
          );

        const currentTagIds = new Set(currentTestTags.map((t) => t.tagId));
        const newTagIds = new Set(uniqueTagIds);

        // Tags to remove (soft delete) - batch operation
        const tagsToRemove = currentTestTags.filter((t) => !newTagIds.has(t.tagId));
        if (tagsToRemove.length > 0) {
          const idsToRemove = tagsToRemove.map((t) => t.id);
          await txCtx.db
            .update(schema.testTag)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(inArray(schema.testTag.id, idsToRemove));
        }

        // Tags to add - batch operation
        const tagsToAdd = uniqueTagIds.filter((id) => !currentTagIds.has(id));
        if (tagsToAdd.length > 0) {
          await txCtx.db.insert(schema.testTag).values(
            tagsToAdd.map((tagId) => ({ testId, tagId }))
          );
        }
      });
    },
  };
}
