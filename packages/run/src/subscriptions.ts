/**
 * Run queue subscriptions setup.
 *
 * Creates the run queue and subscribes it to the run.created.v1 event.
 */
import type { PgBoss } from "@posium/boss";
import { EVENTS } from "@posium/appevents";
import { QUEUES, QUEUE_OPTIONS } from "@posium/queues";

/**
 * Sets up the run queue and event subscriptions.
 *
 * This should be called once when the worker starts, before
 * registering the worker handler.
 *
 * @example
 * ```typescript
 * await setupRunSubscriptions(boss);
 * await registerRunWorker(boss, logger);
 * await boss.start();
 * ```
 */
export async function setupRunSubscriptions(boss: PgBoss): Promise<void> {
  const dlqOptions = QUEUE_OPTIONS[QUEUES.RUN_DLQ];
  const mainOptions = QUEUE_OPTIONS[QUEUES.RUN];

  // Create the DLQ first (required before main queue)
  await boss.createQueue(QUEUES.RUN_DLQ, dlqOptions);

  // Create the main run queue
  await boss.createQueue(QUEUES.RUN, mainOptions);

  // Subscribe the run queue to the run.created.v1 event
  await boss.subscribe(EVENTS.RUN_CREATED_V1, QUEUES.RUN);
}
