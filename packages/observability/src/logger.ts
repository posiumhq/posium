/**
 * Pino logger factory for backend services.
 *
 * Features:
 * - Pretty-prints logs in development
 * - JSON logs to stdout in production
 * - Optional Axiom forwarding when AXIOM_DATASET and AXIOM_TOKEN are set
 * - Caller info for easier debugging (disable with LOG_CALLER=false)
 *
 * Environment variables:
 * - NODE_ENV: "production" for JSON logs, otherwise pretty-print
 * - LOG_LEVEL: Log level (default: "debug" in dev, "info" in prod)
 * - LOG_CALLER: Set to "false" to disable caller info
 * - AXIOM_DATASET: Axiom dataset for log forwarding
 * - AXIOM_TOKEN: Axiom API token for log forwarding
 */

import pino, {
  type Logger,
  type TransportMultiOptions,
  type TransportSingleOptions,
} from "pino";
import pinoCaller from "pino-caller";

export type { Logger } from "pino";

const isDevelopment = process.env.NODE_ENV !== "production";
const isAxiomConfigured = Boolean(
  process.env.AXIOM_DATASET && process.env.AXIOM_TOKEN,
);
const includeCallerInfo = process.env.LOG_CALLER !== "false";
const defaultLogLevel =
  process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info");

function getTransport():
  | TransportSingleOptions
  | TransportMultiOptions
  | undefined {
  if (isDevelopment) {
    return {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
        colorize: true,
      },
    };
  }

  if (isAxiomConfigured) {
    return {
      targets: [
        {
          target: "pino/file",
          options: { destination: 1 },
        },
        {
          target: "@axiomhq/pino",
          options: {
            dataset: process.env.AXIOM_DATASET,
            token: process.env.AXIOM_TOKEN,
          },
        },
      ],
    };
  }

  return undefined;
}

/**
 * Create a configured Pino logger for backend services.
 *
 * @example
 * ```typescript
 * import { createLogger } from "@posium/observability";
 *
 * const logger = createLogger("api");
 * logger.info("Server started");
 * ```
 */
export function createLogger(name: string): Logger {
  const logger = pino({
    name,
    level: defaultLogLevel,
    transport: getTransport(),
  });

  if (includeCallerInfo) {
    const withCaller = (pinoCaller as unknown as (l: Logger) => Logger)(logger);
    return withCaller;
  }

  return logger;
}
