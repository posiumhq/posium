/**
 * Docker execution module for running Playwright tests in containers.
 */
import { spawn } from "node:child_process";
import type { Logger } from "./processor.js";
import type { TestWithSteps } from "./db.js";

/**
 * Configuration for Docker execution.
 */
export interface DockerExecutionConfig {
  /** Unique identifier for this test run */
  runId: string;
  /** Tests to execute, each with testId, name, and steps */
  tests: TestWithSteps[];
  /** URL of the reporting API that the container can reach */
  reportingApiUrl: string;
  /** Docker image to use for test execution */
  dockerImage: string;
  /** Server key for authenticating with the reporting API */
  serverKey: string;
  /** Timeout in milliseconds (default: 10 minutes) */
  timeout?: number;
  /** Logger instance */
  logger: Logger;
}

/**
 * Result of Docker execution.
 */
export interface DockerExecutionResult {
  /** Exit code from the container (0 = success) */
  exitCode: number;
  /** Standard output from the container */
  stdout: string;
  /** Standard error from the container */
  stderr: string;
}

/**
 * Executes Playwright tests in a Docker container.
 *
 * Spawns a Docker container with the specified image and environment variables,
 * waits for it to complete, and returns the result.
 *
 * @param config - Docker execution configuration
 * @returns Promise resolving to execution result
 * @throws Error if Docker execution fails or times out
 *
 * @example
 * ```typescript
 * const result = await executeInDocker({
 *   runId: 'run_abc123',
 *   reportingApiUrl: 'http://host.docker.internal:3002',
 *   dockerImage: 'posium/test-runner:local',
 *   logger,
 * });
 * if (result.exitCode === 0) {
 *   console.log('Tests passed!');
 * }
 * ```
 */
export async function executeInDocker(
  config: DockerExecutionConfig
): Promise<DockerExecutionResult> {
  const {
    runId,
    tests,
    reportingApiUrl,
    dockerImage,
    serverKey,
    logger,
    timeout = 10 * 60 * 1000, // 10 minutes default
  } = config;

  const args = [
    "run",
    "--rm",
    "-e",
    `RUN_ID=${runId}`,
    "-e",
    `REPORTING_API_URL=${reportingApiUrl}`,
    "-e",
    `REPORTING_SERVER_KEY=${serverKey}`,
    "-e",
    `TESTS=${JSON.stringify(tests)}`,
  ];

  args.push(dockerImage);

  logger.info("Spawning Docker container", {
    runId,
    image: dockerImage,
    reportingApiUrl,
    timeout,
  });

  return new Promise((resolve, reject) => {
    const proc = spawn("docker", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timeoutId = setTimeout(() => {
      killed = true;
      proc.kill("SIGKILL");
      reject(
        new Error(
          `Docker execution timed out after ${timeout}ms for run ${runId}`
        )
      );
    }, timeout);

    proc.stdout.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      // Log stdout lines for visibility
      for (const line of chunk.split("\n").filter(Boolean)) {
        logger.debug(`[docker] ${line}`);
      }
    });

    proc.stderr.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      // Log stderr lines for visibility
      for (const line of chunk.split("\n").filter(Boolean)) {
        logger.debug(`[docker:stderr] ${line}`);
      }
    });

    proc.on("close", (code) => {
      clearTimeout(timeoutId);

      if (killed) {
        // Already rejected due to timeout
        return;
      }

      const exitCode = code ?? 1;

      logger.info("Docker container exited", {
        runId,
        exitCode,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
      });

      resolve({ exitCode, stdout, stderr });
    });

    proc.on("error", (error) => {
      clearTimeout(timeoutId);

      if (killed) {
        // Already rejected due to timeout
        return;
      }

      logger.error("Docker execution error", {
        runId,
        error: error.message,
      });

      reject(error);
    });
  });
}
