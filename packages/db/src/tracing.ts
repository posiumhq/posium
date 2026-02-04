/**
 * Database tracing utilities for OpenTelemetry integration.
 *
 * Provides a Drizzle ORM logger that adds database query information
 * to the active OpenTelemetry span, enabling correlation between
 * HTTP requests and their database operations.
 */

import { trace, SpanStatusCode } from "@opentelemetry/api";
import type { Logger } from "drizzle-orm/logger";

const tracer = trace.getTracer("drizzle-orm");

/**
 * Drizzle ORM logger that adds query events to the active OpenTelemetry span.
 *
 * When a query is executed within an active span (e.g., during an HTTP request),
 * the query details are added as a span event, enabling visibility into
 * database operations in traces.
 *
 * @example
 * ```typescript
 * import { TracingLogger } from "./tracing.js";
 *
 * const db = drizzle(conn, {
 *   schema,
 *   logger: new TracingLogger(),
 * });
 * ```
 */
export class TracingLogger implements Logger {
  logQuery(query: string, params: unknown[]): void {
    const span = trace.getActiveSpan();
    if (span) {
      // Add query info to current span as event
      span.addEvent("db.query", {
        "db.statement": query.slice(0, 1000), // Truncate long queries
        "db.system": "postgresql",
        "db.params.count": params.length,
      });
    }
  }
}

/**
 * Wrap a database operation in its own span for detailed timing.
 *
 * Use this for operations you want to track as separate spans
 * rather than just events on the parent span.
 *
 * @param operation - Name of the operation (e.g., "select", "insert", "transaction")
 * @param fn - Async function containing the database operation
 * @returns The result of the database operation
 *
 * @example
 * ```typescript
 * const users = await withDbSpan("select.users", async () => {
 *   return db.select().from(usersTable).where(eq(usersTable.active, true));
 * });
 * ```
 */
export function withDbSpan<T>(
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(`db.${operation}`, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}
