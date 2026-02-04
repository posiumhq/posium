/**
 * @posium/appevents - Application event definitions
 *
 * Central place for all application event constants, payload types,
 * and the type-safe publish helper.
 */
import type { PgBoss } from "@posium/boss";
import { EVENTS, type EventName } from "./events.js";
import type { EventPayloads } from "./payloads.js";

// Re-export everything
export { EVENTS, type EventName } from "./events.js";
export * from "./payloads.js";

/**
 * Options for publishing events.
 */
export interface PublishOptions {
  /**
   * Unique key for deduplication. Events with the same singletonKey
   * will only be processed once (subsequent publishes are ignored).
   *
   * Best practice: Use the entity ID (e.g., runId, testId) as the key
   * to ensure exactly-once processing per entity.
   */
  singletonKey?: string;
}

/**
 * Type-safe publish helper for application events.
 *
 * Uses pgboss's pub/sub pattern to publish events that can be
 * subscribed to by multiple queues.
 *
 * @example
 * ```typescript
 * import { publish, EVENTS } from '@posium/appevents';
 *
 * // With deduplication (recommended) - ensures exactly-once processing
 * await publish(boss, EVENTS.RUN_CREATED_V1, {
 *   runId: 'run_123',
 *   projectId: 'prj_456',
 *   triggeredBy: 'manual',
 * }, { singletonKey: 'run_123' });
 * ```
 */
export async function publish<E extends EventName>(
  boss: PgBoss,
  event: E,
  payload: E extends keyof EventPayloads ? EventPayloads[E] : never,
  options?: PublishOptions,
): Promise<void> {
  if (options) {
    await boss.publish(event, payload, options);
  } else {
    await boss.publish(event, payload);
  }
}

/**
 * Get all event names as an array.
 * Useful for subscribing to all events.
 */
export function getAllEventNames(): EventName[] {
  return Object.values(EVENTS);
}

/**
 * Get event names by domain (e.g., 'run', 'org', 'project').
 */
export function getEventNamesByDomain(
  domain: "run" | "org" | "project" | "test" | "schedule",
): EventName[] {
  return Object.values(EVENTS).filter((event) =>
    event.startsWith(`${domain}.`),
  );
}
