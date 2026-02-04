/**
 * @posium/run - Run job processor package
 *
 * Handles test execution jobs from the run queue by spawning
 * Docker containers to execute Playwright tests.
 */
export { setupRunSubscriptions } from "./subscriptions.js";
export {
  registerRunWorker,
  type Logger,
  type RunWorkerConfig,
} from "./processor.js";
export {
  executeInDocker,
  type DockerExecutionConfig,
  type DockerExecutionResult,
} from "./docker.js";
export {
  updateRunStatus,
  getRunById,
  type RunStatus,
  type StatusUpdateFields,
} from "./db.js";
