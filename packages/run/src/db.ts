/**
 * Database operations for run status updates.
 */
import { eq, desc, and, isNull, inArray } from "drizzle-orm";
import type { DBType } from "@posium/db";
import { schema } from "@posium/db";

/**
 * Valid run status values.
 */
export type RunStatus =
  | "queued"
  | "running"
  | "passed"
  | "failed"
  | "cancelled"
  | "timed_out";

/**
 * Additional fields that can be updated along with status.
 */
export interface StatusUpdateFields {
  jobId?: string;
  startedAt?: Date;
  finishedAt?: Date;
  summary?: {
    total?: number;
    passed?: number;
    failed?: number;
    skipped?: number;
    durationMs?: number;
  };
}

/**
 * Updates the status of a run in the database.
 *
 * Automatically sets:
 * - `startedAt` when status changes to 'running'
 * - `finishedAt` when status changes to a terminal state
 * - `updatedAt` on every update
 *
 * @param db - Database instance
 * @param runId - ID of the run to update
 * @param status - New status value
 * @param additionalFields - Optional additional fields to update
 *
 * @example
 * ```typescript
 * // Mark run as running
 * await updateRunStatus(db, 'run_abc123', 'running');
 *
 * // Mark run as passed with summary
 * await updateRunStatus(db, 'run_abc123', 'passed', {
 *   summary: { total: 10, passed: 10, failed: 0, skipped: 0 }
 * });
 * ```
 */
export async function updateRunStatus(
  db: DBType,
  runId: string,
  status: RunStatus,
  additionalFields?: StatusUpdateFields
): Promise<void> {
  const now = new Date();

  const updates: Record<string, unknown> = {
    status,
    updatedAt: now,
  };

  // Set jobId if provided (typically when transitioning to running)
  if (additionalFields?.jobId) {
    updates.jobId = additionalFields.jobId;
  }

  // Set startedAt when transitioning to running
  if (status === "running") {
    updates.startedAt = additionalFields?.startedAt ?? now;
  }

  // Set finishedAt when transitioning to a terminal state
  const terminalStatuses: RunStatus[] = [
    "passed",
    "failed",
    "cancelled",
    "timed_out",
  ];
  if (terminalStatuses.includes(status)) {
    updates.finishedAt = additionalFields?.finishedAt ?? now;
  }

  // Add summary if provided
  if (additionalFields?.summary) {
    updates.summary = additionalFields.summary;
  }

  await db.update(schema.run).set(updates).where(eq(schema.run.id, runId));
}

/**
 * Gets a run by ID.
 *
 * @param db - Database instance
 * @param runId - ID of the run to fetch
 * @returns The run record or undefined if not found
 */
export async function getRunById(
  db: DBType,
  runId: string
): Promise<typeof schema.run.$inferSelect | undefined> {
  const [run] = await db
    .select()
    .from(schema.run)
    .where(eq(schema.run.id, runId))
    .limit(1);

  return run;
}

/**
 * Gets the latest test version steps for a test.
 *
 * @param db - Database instance
 * @param testId - ID of the test
 * @returns The steps array or undefined if not found
 */
export async function getTestVersionSteps(
  db: DBType,
  testId: string
): Promise<unknown[] | undefined> {
  const [version] = await db
    .select({ steps: schema.testVersion.steps })
    .from(schema.testVersion)
    .where(eq(schema.testVersion.testId, testId))
    .orderBy(desc(schema.testVersion.version))
    .limit(1);

  if (!version?.steps) {
    return undefined;
  }

  // Steps are stored as { steps: [...] }
  const stepsData = version.steps as { steps?: unknown[] };
  return stepsData.steps;
}

/**
 * Test info with steps for suite runs.
 */
export interface TestWithSteps {
  testId: string;
  name: string;
  steps: unknown[];
}

/**
 * Gets all tests for a suite with their latest version steps.
 *
 * @param db - Database instance
 * @param suiteId - ID of the suite
 * @returns Array of tests with their steps, empty if no tests found
 */
export async function getTestsForSuite(
  db: DBType,
  suiteId: string
): Promise<TestWithSteps[]> {
  // Get all tests in the suite
  const tests = await db
    .select({ id: schema.test.id, name: schema.test.name })
    .from(schema.test)
    .where(and(eq(schema.test.suiteId, suiteId), isNull(schema.test.deletedAt)));

  if (tests.length === 0) {
    return [];
  }

  // Get latest test versions for all tests
  const testIds = tests.map((t) => t.id);
  const versions = await db
    .select({
      testId: schema.testVersion.testId,
      steps: schema.testVersion.steps,
    })
    .from(schema.testVersion)
    .where(inArray(schema.testVersion.testId, testIds))
    .orderBy(desc(schema.testVersion.version));

  // Group by testId, keep latest
  const latestByTestId = new Map<string, unknown[]>();
  for (const v of versions) {
    if (!latestByTestId.has(v.testId)) {
      const stepsData = v.steps as { steps?: unknown[] };
      if (stepsData?.steps && stepsData.steps.length > 0) {
        latestByTestId.set(v.testId, stepsData.steps);
      }
    }
  }

  // Build result - only include tests with steps
  return tests
    .filter((t) => latestByTestId.has(t.id))
    .map((t) => ({
      testId: t.id,
      name: t.name,
      steps: latestByTestId.get(t.id)!,
    }));
}

/**
 * Result of getSuiteWithSetupTeardown.
 */
export interface SuiteTestsResult {
  setupTest: TestWithSteps | null;
  teardownTest: TestWithSteps | null;
  regularTests: TestWithSteps[];
}

/**
 * Gets a suite's setup test, teardown test, and regular tests with their steps.
 *
 * @param db - Database instance
 * @param suiteId - ID of the suite
 * @returns Object containing setup, teardown, and regular tests with steps
 */
export async function getSuiteWithSetupTeardown(
  db: DBType,
  suiteId: string
): Promise<SuiteTestsResult> {
  // Get the suite with setup/teardown test IDs
  const [suite] = await db
    .select({
      id: schema.suite.id,
      setupTestId: schema.suite.setupTestId,
      teardownTestId: schema.suite.teardownTestId,
    })
    .from(schema.suite)
    .where(and(eq(schema.suite.id, suiteId), isNull(schema.suite.deletedAt)))
    .limit(1);

  if (!suite) {
    return { setupTest: null, teardownTest: null, regularTests: [] };
  }

  // Get all tests in the suite
  const tests = await db
    .select({ id: schema.test.id, name: schema.test.name })
    .from(schema.test)
    .where(and(eq(schema.test.suiteId, suiteId), isNull(schema.test.deletedAt)));

  // Also get setup/teardown tests if they exist (they might not be in the suite)
  const setupTeardownIds = [suite.setupTestId, suite.teardownTestId].filter(
    (id): id is string => id !== null
  );

  let setupTeardownTests: { id: string; name: string }[] = [];
  if (setupTeardownIds.length > 0) {
    setupTeardownTests = await db
      .select({ id: schema.test.id, name: schema.test.name })
      .from(schema.test)
      .where(
        and(inArray(schema.test.id, setupTeardownIds), isNull(schema.test.deletedAt))
      );
  }

  // Combine all test IDs we need to fetch versions for
  const allTestIds = new Set([
    ...tests.map((t) => t.id),
    ...setupTeardownTests.map((t) => t.id),
  ]);

  if (allTestIds.size === 0) {
    return { setupTest: null, teardownTest: null, regularTests: [] };
  }

  // Get latest test versions for all tests
  const versions = await db
    .select({
      testId: schema.testVersion.testId,
      steps: schema.testVersion.steps,
    })
    .from(schema.testVersion)
    .where(inArray(schema.testVersion.testId, Array.from(allTestIds)))
    .orderBy(desc(schema.testVersion.version));

  // Group by testId, keep latest with valid steps
  const latestByTestId = new Map<string, unknown[]>();
  for (const v of versions) {
    if (!latestByTestId.has(v.testId)) {
      const stepsData = v.steps as { steps?: unknown[] };
      if (stepsData?.steps && stepsData.steps.length > 0) {
        latestByTestId.set(v.testId, stepsData.steps);
      }
    }
  }

  // Build test name map
  const testNameMap = new Map<string, string>();
  for (const t of tests) {
    testNameMap.set(t.id, t.name);
  }
  for (const t of setupTeardownTests) {
    testNameMap.set(t.id, t.name);
  }

  // Helper to build TestWithSteps
  const buildTestWithSteps = (testId: string | null): TestWithSteps | null => {
    if (!testId) return null;
    const steps = latestByTestId.get(testId);
    const name = testNameMap.get(testId);
    if (!steps || !name) return null;
    return { testId, name, steps };
  };

  // Build setup and teardown tests
  const setupTest = buildTestWithSteps(suite.setupTestId);
  const teardownTest = buildTestWithSteps(suite.teardownTestId);

  // Build regular tests (excluding setup and teardown)
  const regularTests: TestWithSteps[] = tests
    .filter((t) => {
      // Exclude setup and teardown tests from regular tests
      if (suite.setupTestId && t.id === suite.setupTestId) return false;
      if (suite.teardownTestId && t.id === suite.teardownTestId) return false;
      // Only include tests with steps
      return latestByTestId.has(t.id);
    })
    .map((t) => ({
      testId: t.id,
      name: t.name,
      steps: latestByTestId.get(t.id)!,
    }));

  return { setupTest, teardownTest, regularTests };
}
