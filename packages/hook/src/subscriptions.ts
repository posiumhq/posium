/**
 * Hook queue subscriptions setup.
 *
 * Creates the project_hooks queue and subscribes it to all relevant events
 * that can trigger webhooks.
 */
import type { PgBoss } from "@posium/boss";
import { EVENTS } from "@posium/appevents";
import { QUEUES, QUEUE_OPTIONS } from "@posium/queues";

/**
 * Events that can trigger project webhooks.
 *
 * These are all events that users can configure to trigger
 * webhook notifications for their projects.
 */
const HOOK_EVENTS = [
  // Run events - most commonly used for CI/CD integration
  EVENTS.RUN_CREATED_V1,
  EVENTS.RUN_COMPLETED_V1,

  // Test events
  EVENTS.TEST_CREATED_V1,
  EVENTS.TEST_UPDATED_V1,
  EVENTS.TEST_DELETED_V1,

  // Schedule events
  EVENTS.SCHEDULE_CREATED_V1,
  EVENTS.SCHEDULE_UPDATED_V1,
  EVENTS.SCHEDULE_DELETED_V1,

  // Project events
  EVENTS.PROJECT_UPDATED_V1,
] as const;

/**
 * Sets up the project_hooks queue and event subscriptions.
 *
 * Subscribes to all events that can trigger webhooks. The processor
 * will filter based on user configuration (projectHookSub table).
 *
 * @example
 * ```typescript
 * await setupHookSubscriptions(boss);
 * await registerHookWorker(boss, logger);
 * await boss.start();
 * ```
 */
export async function setupHookSubscriptions(boss: PgBoss): Promise<void> {
  const dlqOptions = QUEUE_OPTIONS[QUEUES.PROJECT_HOOKS_DLQ];
  const mainOptions = QUEUE_OPTIONS[QUEUES.PROJECT_HOOKS];

  // Create the DLQ first
  await boss.createQueue(QUEUES.PROJECT_HOOKS_DLQ, dlqOptions);

  // Create the main project hooks queue
  await boss.createQueue(QUEUES.PROJECT_HOOKS, mainOptions);

  // Subscribe to all events that can trigger webhooks
  for (const event of HOOK_EVENTS) {
    await boss.subscribe(event, QUEUES.PROJECT_HOOKS);
  }
}

/**
 * Returns the list of events that the hook processor subscribes to.
 */
export function getHookEvents(): readonly string[] {
  return HOOK_EVENTS;
}
