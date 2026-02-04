/**
 * Hook job processor.
 *
 * Handles jobs from the project_hooks queue. Processes webhook
 * delivery based on user configuration.
 */
import { type PgBoss, type Job } from "@posium/boss";
import { QUEUES } from "@posium/queues";

/**
 * Payload structure for hook jobs.
 * Contains the original event name and event payload.
 */
export interface HookJobPayload {
  // Event metadata (added by pgboss pub/sub)
  __state__?: string;

  // Original event data
  [key: string]: unknown;
}

/**
 * Logger interface expected by the hook processor.
 */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Registers the hook worker handler.
 *
 * Currently a stub that only logs when a job is received.
 * The actual webhook delivery logic will be implemented later.
 *
 * The processor will:
 * 1. Look up projectHookSub entries for the event type
 * 2. Filter based on project configuration
 * 3. Deliver webhooks to configured URLs
 * 4. Log delivery results to projectHookLog
 *
 * @example
 * ```typescript
 * await setupHookSubscriptions(boss);
 * await registerHookWorker(boss, logger);
 * await boss.start();
 * ```
 */
export async function registerHookWorker(
  boss: PgBoss,
  logger: Logger,
): Promise<void> {
  await boss.work<HookJobPayload>(
    QUEUES.PROJECT_HOOKS,
    { batchSize: 1 },
    async (jobs: Job<HookJobPayload>[]) => {
      for (const job of jobs) {
        logger.info("Processing hook job", {
          jobId: job.id,
          eventData: job.data,
        });

        // TODO: Implement actual webhook delivery logic
        // 1. Extract projectId from event payload
        // 2. Look up projectHookSub entries for this event type
        // 3. For each matching subscription:
        //    a. Build webhook payload
        //    b. Send HTTP POST to webhook URL
        //    c. Log result to projectHookLog
        // 4. Handle retries for failed deliveries

        logger.info("Hook job completed (stub)", {
          jobId: job.id,
        });
      }
    },
  );
}
