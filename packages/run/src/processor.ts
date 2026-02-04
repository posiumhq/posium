/**
 * Run job processor.
 *
 * Handles jobs from the run queue by spawning Docker containers
 * to execute Playwright tests.
 */
import { type PgBoss, type Job } from "@posium/boss";
import {
  type RunCreatedPayload,
  EVENTS,
  publish,
  type RunCompletedPayload,
} from "@posium/appevents";
import { QUEUES } from "@posium/queues";
import type { DBType } from "@posium/db";
import { executeInDocker } from "./docker.js";
import { updateRunStatus, getRunById, getTestVersionSteps, getSuiteWithSetupTeardown, type RunStatus, type TestWithSteps } from "./db.js";

/**
 * Logger interface expected by the run processor.
 */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Configuration for the run worker.
 */
export interface RunWorkerConfig {
  /** URL of the reporting API that Docker containers can reach */
  reportingApiUrl: string;
  /** Docker image to use for test execution */
  dockerImage: string;
  /** Server key for authenticating with the reporting API */
  serverKey: string;
  /** Timeout for Docker execution in milliseconds (default: 10 minutes) */
  timeout?: number;
}

/**
 * Registers the run worker handler.
 *
 * When a run job is received:
 * 1. Updates run status to 'running'
 * 2. Spawns a Docker container to execute tests
 * 3. Updates run status based on container exit code
 * 4. Publishes run.completed.v1 event
 *
 * @param boss - pgboss instance
 * @param logger - Logger instance
 * @param db - Database instance
 * @param config - Worker configuration
 *
 * @example
 * ```typescript
 * await setupRunSubscriptions(boss);
 * await registerRunWorker(boss, logger, db, {
 *   reportingApiUrl: 'http://host.docker.internal:3002',
 *   dockerImage: 'posium/test-runner:local',
 * });
 * await boss.start();
 * ```
 */
export async function registerRunWorker(
  boss: PgBoss,
  logger: Logger,
  db: DBType,
  config: RunWorkerConfig
): Promise<void> {
  await boss.work<RunCreatedPayload>(
    QUEUES.RUN,
    { batchSize: 1 },
    async (jobs: Job<RunCreatedPayload>[]) => {
      for (const job of jobs) {
        const { runId, projectId } = job.data;

        logger.info("Processing run job", {
          jobId: job.id,
          runId,
          projectId,
          triggeredBy: job.data.triggeredBy,
        });

        let finalStatus: RunStatus = "failed";

        try {
          // 1. Fetch run to get testId or suiteId
          const run = await getRunById(db, runId);
          if (!run) {
            throw new Error(`Run not found: ${runId}`);
          }

          // 2. Fetch tests to run - either single test or all tests in suite
          let testsToRun: TestWithSteps[] = [];

          if (run.testId) {
            // Single test run
            const steps = await getTestVersionSteps(db, run.testId);
            if (!steps || steps.length === 0) {
              throw new Error(`No test version steps found for test ${run.testId}`);
            }
            testsToRun = [{ testId: run.testId, name: "Test", steps }];
            logger.info("Fetched test steps", { runId, testId: run.testId, stepCount: steps.length });

            // Update run status to 'running' and record the pgboss job ID
            await updateRunStatus(db, runId, "running", { jobId: job.id });
            logger.info("Updated run status to running", { runId, jobId: job.id });

            // Execute tests in Docker container
            const result = await executeInDocker({
              runId,
              tests: testsToRun,
              reportingApiUrl: config.reportingApiUrl,
              dockerImage: config.dockerImage,
              serverKey: config.serverKey,
              timeout: config.timeout,
              logger,
            });

            // Determine final status based on exit code
            finalStatus = result.exitCode === 0 ? "passed" : "failed";
            logger.info("Docker execution completed", {
              runId,
              exitCode: result.exitCode,
              status: finalStatus,
            });

            // Update run status
            await updateRunStatus(db, runId, finalStatus);
            logger.info("Updated run status", { runId, status: finalStatus });

          } else if (run.suiteId) {
            // Suite run - get setup, teardown, and regular tests
            const { setupTest, teardownTest, regularTests } = await getSuiteWithSetupTeardown(db, run.suiteId);

            // Must have at least setup, teardown, or regular tests
            if (!setupTest && !teardownTest && regularTests.length === 0) {
              throw new Error(`No tests with steps found for suite ${run.suiteId}`);
            }

            const totalRegularSteps = regularTests.reduce((sum, t) => sum + t.steps.length, 0);
            logger.info("Fetched suite tests", {
              runId,
              suiteId: run.suiteId,
              hasSetup: !!setupTest,
              hasTeardown: !!teardownTest,
              regularTestCount: regularTests.length,
              totalRegularSteps,
            });

            // Update run status to 'running' and record the pgboss job ID
            await updateRunStatus(db, runId, "running", { jobId: job.id });
            logger.info("Updated run status to running", { runId, jobId: job.id });

            let setupPassed = true;

            // 1. Run setup test first (if exists)
            if (setupTest) {
              logger.info("Running setup test", { runId, setupTestId: setupTest.testId });
              const setupResult = await executeInDocker({
                runId,
                tests: [setupTest],
                reportingApiUrl: config.reportingApiUrl,
                dockerImage: config.dockerImage,
                serverKey: config.serverKey,
                timeout: config.timeout,
                logger,
              });

              setupPassed = setupResult.exitCode === 0;
              logger.info("Setup test completed", {
                runId,
                setupTestId: setupTest.testId,
                exitCode: setupResult.exitCode,
                passed: setupPassed,
              });

              if (!setupPassed) {
                finalStatus = "failed";
                logger.info("Setup failed, skipping regular tests", { runId });
              }
            }

            // 2. Run regular tests in parallel (if setup passed)
            if (setupPassed && regularTests.length > 0) {
              logger.info("Running regular tests", { runId, testCount: regularTests.length });
              const testsResult = await executeInDocker({
                runId,
                tests: regularTests,
                reportingApiUrl: config.reportingApiUrl,
                dockerImage: config.dockerImage,
                serverKey: config.serverKey,
                timeout: config.timeout,
                logger,
              });

              finalStatus = testsResult.exitCode === 0 ? "passed" : "failed";
              logger.info("Regular tests completed", {
                runId,
                exitCode: testsResult.exitCode,
                status: finalStatus,
              });
            } else if (setupPassed && regularTests.length === 0) {
              // No regular tests but setup passed (e.g., only setup + teardown)
              finalStatus = "passed";
            }

            // 3. Run teardown test last (if exists) - runs regardless of previous results
            if (teardownTest) {
              logger.info("Running teardown test", { runId, teardownTestId: teardownTest.testId });
              const teardownResult = await executeInDocker({
                runId,
                tests: [teardownTest],
                reportingApiUrl: config.reportingApiUrl,
                dockerImage: config.dockerImage,
                serverKey: config.serverKey,
                timeout: config.timeout,
                logger,
              });

              // Log teardown result but don't affect final status
              logger.info("Teardown test completed", {
                runId,
                teardownTestId: teardownTest.testId,
                exitCode: teardownResult.exitCode,
                passed: teardownResult.exitCode === 0,
                note: "Teardown result does not affect suite status",
              });
            }

            // Update run status (based on setup + regular tests, not teardown)
            await updateRunStatus(db, runId, finalStatus);
            logger.info("Updated run status", { runId, status: finalStatus });

          } else {
            throw new Error(`Run ${runId} has neither testId nor suiteId`);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          // Check if it was a timeout
          if (errorMessage.includes("timed out")) {
            finalStatus = "timed_out";
          }

          logger.error("Run job failed", {
            runId,
            error: errorMessage,
            status: finalStatus,
          });

          await updateRunStatus(db, runId, finalStatus);
        }

        // 7. Publish run.completed.v1 event
        const completedPayload: RunCompletedPayload = {
          runId,
          projectId,
          status: finalStatus as "passed" | "failed" | "cancelled" | "timed_out",
        };

        await publish(boss, EVENTS.RUN_COMPLETED_V1, completedPayload, {
          singletonKey: runId,
        });
        logger.info("Published run.completed event", { runId, status: finalStatus });
      }
    }
  );
}
