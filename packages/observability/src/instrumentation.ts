/**
 * OpenTelemetry instrumentation factory for Node.js services.
 *
 * Creates a telemetry instance with app-specific environment variable prefix.
 *
 * Features:
 * - Fastify request tracing via `@fastify/otel` (opt-in, default: true)
 * - Outgoing HTTP tracing via `@opentelemetry/instrumentation-http`
 * - Pino log correlation (trace_id/span_id) via `@opentelemetry/instrumentation-pino`
 * - OTLP export (Axiom via OTLP/HTTP + dataset headers)
 *
 * App-specific environment variables (replace PREFIX with your app prefix):
 * - PREFIX_OTEL_ENABLED: "true" to force enable, "false" to disable
 * - PREFIX_OTEL_SERVICE_NAME: service.name resource attribute
 * - PREFIX_OTEL_SERVICE_VERSION: service.version resource attribute
 * - PREFIX_OTEL_METRICS_EXPORT_INTERVAL: metrics export interval in ms
 *
 * Shared Axiom configuration:
 * - AXIOM_TOKEN: Axiom API token
 * - AXIOM_TRACES_DATASET: dataset for traces
 * - AXIOM_METRICS_DATASET: dataset for metrics
 *
 * Standard OTLP (shared):
 * - OTEL_EXPORTER_OTLP_ENDPOINT: endpoint URL (e.g. https://api.axiom.co)
 */

import { FastifyOtelInstrumentation } from "@fastify/otel";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

export interface TelemetryConfig {
  /**
   * Environment variable prefix for this app (e.g., "API" -> API_OTEL_ENABLED)
   */
  prefix: string;
  /**
   * Default service name if env var not set
   * @default "unknown"
   */
  defaultServiceName?: string;
  /**
   * Default service version if env var not set
   * @default "0.0.0"
   */
  defaultServiceVersion?: string;
  /**
   * Default metrics export interval in ms
   * @default 30000
   */
  defaultMetricsInterval?: number;
  /**
   * Enable Fastify instrumentation. Set to false for non-Fastify services (workers, CLI).
   * @default true
   */
  fastify?: boolean;
  /**
   * Paths to ignore for tracing (e.g., health checks). Only used when fastify: true.
   * @default ["/health", "/metrics"]
   */
  ignorePaths?: string[];
  /**
   * Path prefixes to ignore (e.g., "/docs" matches "/docs/json"). Only used when fastify: true.
   * @default ["/docs"]
   */
  ignorePathPrefixes?: string[];
}

export interface TelemetryInstance {
  /**
   * Initialize the telemetry SDK. Call this before importing app code.
   */
  initTelemetry: () => Promise<void>;
  /**
   * Gracefully shutdown the SDK. Call before process exit.
   */
  shutdownTelemetry: () => Promise<void>;
  /**
   * Whether telemetry is enabled based on config.
   */
  isTelemetryEnabled: boolean;
  /**
   * Check if a path should be ignored for tracing.
   */
  shouldIgnorePath: (pathname: string) => boolean;
  /**
   * The environment variable prefix for this instance.
   */
  prefix: string;
}

function hasOtlpEndpointConfigured(): boolean {
  return Boolean(
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
  );
}

function hasAxiomConfigured(): boolean {
  return Boolean(
    process.env.AXIOM_TOKEN &&
    (process.env.AXIOM_TRACES_DATASET || process.env.AXIOM_METRICS_DATASET),
  );
}

function getAxiomHeaders(
  dataset: string | undefined,
): Record<string, string> | undefined {
  const token = process.env.AXIOM_TOKEN;
  if (!token || !dataset) return undefined;
  return {
    Authorization: `Bearer ${token}`,
    "X-Axiom-Dataset": dataset,
  };
}

/**
 * Create a telemetry instance for a Node.js service.
 *
 * @example
 * ```typescript
 * // Fastify app (default)
 * export const { initTelemetry, shutdownTelemetry } = createTelemetry({
 *   prefix: "API",
 *   defaultServiceName: "api",
 * });
 *
 * // Worker/CLI (no Fastify instrumentation)
 * export const { initTelemetry, shutdownTelemetry } = createTelemetry({
 *   prefix: "WORKER",
 *   defaultServiceName: "worker",
 *   fastify: false,
 * });
 * ```
 */
export function createTelemetry(config: TelemetryConfig): TelemetryInstance {
  const {
    prefix,
    defaultServiceName = "unknown",
    defaultServiceVersion = "0.0.0",
    defaultMetricsInterval = 30000,
    fastify: enableFastify = true,
    ignorePaths = ["/health", "/metrics"],
    ignorePathPrefixes = ["/docs"],
  } = config;

  // Read env vars with prefix
  const envEnabled = process.env[`${prefix}_OTEL_ENABLED`];
  const envServiceName = process.env[`${prefix}_OTEL_SERVICE_NAME`];
  const envServiceVersion = process.env[`${prefix}_OTEL_SERVICE_VERSION`];
  const envMetricsInterval =
    process.env[`${prefix}_OTEL_METRICS_EXPORT_INTERVAL`];

  function computeTelemetryEnabled(): boolean {
    if (envEnabled === "false") return false;
    if (envEnabled === "true") return true;
    return hasAxiomConfigured() || hasOtlpEndpointConfigured();
  }

  const isTelemetryEnabled = computeTelemetryEnabled();

  function shouldIgnorePath(pathname: string): boolean {
    if (ignorePaths.includes(pathname)) return true;
    for (const prefix of ignorePathPrefixes) {
      if (pathname.startsWith(prefix)) return true;
    }
    return false;
  }

  let sdk: NodeSDK | undefined;
  let startPromise: Promise<void> | undefined;

  function getOrCreateSdk(): NodeSDK | undefined {
    if (!isTelemetryEnabled) return undefined;
    if (sdk) return sdk;

    const tracesHeaders = getAxiomHeaders(process.env.AXIOM_TRACES_DATASET);
    const metricsHeaders = getAxiomHeaders(process.env.AXIOM_METRICS_DATASET);

    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: envServiceName ?? defaultServiceName,
        [ATTR_SERVICE_VERSION]: envServiceVersion ?? defaultServiceVersion,
      }),
      traceExporter: new OTLPTraceExporter(
        tracesHeaders ? { headers: tracesHeaders } : undefined,
      ),
      metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(
          metricsHeaders ? { headers: metricsHeaders } : undefined,
        ),
        exportIntervalMillis: envMetricsInterval
          ? parseInt(envMetricsInterval, 10)
          : defaultMetricsInterval,
      }),
      instrumentations: [
        new HttpInstrumentation({
          // When Fastify is enabled, it handles incoming requests. Otherwise, trace all.
          ignoreIncomingRequestHook: enableFastify ? () => true : undefined,
        }),
        new PinoInstrumentation({ disableLogSending: true }),
        ...(enableFastify
          ? [
              new FastifyOtelInstrumentation({
                registerOnInitialization: true,
                ignorePaths: ({ url }) =>
                  shouldIgnorePath(url.split("?")[0] ?? url),
              }),
            ]
          : []),
      ],
    });

    return sdk;
  }

  async function initTelemetry(): Promise<void> {
    const activeSdk = getOrCreateSdk();
    if (!activeSdk) return;
    startPromise ??= Promise.resolve(activeSdk.start());
    await startPromise;
  }

  async function shutdownTelemetry(): Promise<void> {
    if (!sdk) return;
    await startPromise;
    await sdk.shutdown();
  }

  return {
    initTelemetry,
    shutdownTelemetry,
    isTelemetryEnabled,
    shouldIgnorePath,
    prefix,
  };
}
