/**
 * OpenTelemetry route attributes plugin for Fastify.
 *
 * Adds HTTP route, method, and status attributes to the active span
 * for better filtering and grouping in observability backends.
 *
 * Also records custom metrics with route labels:
 * - http.server.request.count - Request count by route/method/status
 * - http.server.request.duration - Request duration histogram by route/method
 */

import {
  trace,
  metrics,
  type Counter,
  type Histogram,
} from "@opentelemetry/api";
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import type { TelemetryInstance } from "../instrumentation.js";

export interface OtelAttributesPluginOptions {
  /**
   * Telemetry instance from createTelemetry()
   */
  telemetry: TelemetryInstance;
  /**
   * Meter name for metrics
   * @default telemetry.prefix.toLowerCase()
   */
  meterName?: string;
}

// Metrics instruments - created lazily per meter name
const meterInstruments = new Map<
  string,
  { counter: Counter; histogram: Histogram }
>();

function getInstruments(meterName: string): {
  counter: Counter;
  histogram: Histogram;
} {
  let instruments = meterInstruments.get(meterName);
  if (!instruments) {
    const meter = metrics.getMeter(meterName);
    instruments = {
      counter: meter.createCounter("http.server.request.count", {
        description: "Count of HTTP requests by route, method, and status",
        unit: "1",
      }),
      histogram: meter.createHistogram("http.server.request.duration", {
        description: "Duration of HTTP requests by route and method",
        unit: "ms",
      }),
    };
    meterInstruments.set(meterName, instruments);
  }
  return instruments;
}

const otelAttributesPlugin: FastifyPluginAsync<
  OtelAttributesPluginOptions
> = async (fastify, options) => {
  const { telemetry, meterName = telemetry.prefix.toLowerCase() } = options;

  if (!telemetry.isTelemetryEnabled) {
    return;
  }

  // Initialize metrics instruments
  const instruments = getInstruments(meterName);

  // Add HTTP method and URL early
  fastify.addHook("onRequest", async (request) => {
    if (request.routeOptions?.config?.otel === false) return;
    const pathname = request.url.split("?")[0] ?? request.url;
    if (telemetry.shouldIgnorePath(pathname)) return;

    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute("http.method", request.method);
      span.setAttribute("http.url", request.url);
    }
  });

  // Add route pattern after routing
  fastify.addHook("preHandler", async (request) => {
    if (request.routeOptions?.config?.otel === false) return;
    const pathname = request.url.split("?")[0] ?? request.url;
    if (telemetry.shouldIgnorePath(pathname)) return;

    const span = trace.getActiveSpan();
    if (span && request.routeOptions?.url) {
      span.setAttribute("http.route", request.routeOptions.url);
      span.updateName(`${request.method} ${request.routeOptions.url}`);
    }
  });

  // Add response status and record metrics
  fastify.addHook("onResponse", async (request, reply) => {
    if (request.routeOptions?.config?.otel === false) return;
    const pathname = request.url.split("?")[0] ?? request.url;
    if (telemetry.shouldIgnorePath(pathname)) return;

    const span = trace.getActiveSpan();
    const route = request.routeOptions?.url ?? "unknown";
    const method = request.method;
    const statusCode = reply.statusCode;
    const duration = reply.elapsedTime;

    if (span) {
      span.setAttribute("http.status_code", statusCode);
      span.setAttribute("http.response_time_ms", duration);
    }

    instruments.counter.add(1, {
      "http.route": route,
      "http.method": method,
      "http.status_code": statusCode,
    });

    instruments.histogram.record(duration, {
      "http.route": route,
      "http.method": method,
    });
  });
};

export default fp(otelAttributesPlugin, {
  name: "otel-attributes",
  fastify: "5.x",
});
