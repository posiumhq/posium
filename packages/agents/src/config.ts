import type {
  AIConfig,
  LLMClientConfig,
  SupervisorAgentConfig,
  BrowserAgentConfig,
} from "./browser/types/config.js";

/**
 * Creates an AI configuration object from environment variables
 */
export function createConfigFromEnv(): AIConfig {
  return {
    nodeEnv:
      (process.env["NODE_ENV"] as "development" | "test" | "production") ||
      "development",
    openRouter: process.env["OPENROUTER_API_KEY"]
      ? {
          apiKey: process.env["OPENROUTER_API_KEY"],
          cloudflareAccountId: process.env["CLOUDFLARE_ACCOUNT_ID"] || "",
          cloudflareAiGatewayToken:
            process.env["CLOUDFLARE_AI_GATEWAY_TOKEN"] || "",
        }
      : undefined,
    browser: {
      managerHost: process.env["BROWSER_MANAGER_HOST"] || "localhost:3003",
      environment: (process.env["NODE_ENV"] === "production"
        ? "REMOTE"
        : "LOCAL") as "LOCAL" | "REMOTE",
    },
    enableCaching: process.env["ENABLE_CACHING"] === "true",
  };
}

/**
 * Creates LLM client configuration from environment variables
 */
export function createLLMConfigFromEnv(): LLMClientConfig {
  return {
    openRouter: {
      apiKey: process.env["OPENROUTER_API_KEY"] || "",
      // Optional Cloudflare fields - only set if env vars exist
      cloudflareAccountId: process.env["CLOUDFLARE_ACCOUNT_ID"] || undefined,
      cloudflareAiGatewayToken:
        process.env["CLOUDFLARE_AI_GATEWAY_TOKEN"] || undefined,
      cloudflareGatewayName:
        process.env["CLOUDFLARE_GATEWAY_NAME"] || undefined,
    },
  };
}

/**
 * Creates supervisor agent configuration from environment variables
 */
export function createSupervisorConfigFromEnv(): SupervisorAgentConfig {
  return {
    openRouter: {
      apiKey: process.env["OPENROUTER_API_KEY"] || "",
      cloudflareAccountId: process.env["CLOUDFLARE_ACCOUNT_ID"] || "",
      cloudflareAiGatewayToken:
        process.env["CLOUDFLARE_AI_GATEWAY_TOKEN"] || "",
    },
    nodeEnv:
      (process.env["NODE_ENV"] as "development" | "test" | "production") ||
      "development",
  };
}

/**
 * Creates BrowserAgent configuration from environment variables
 */
export function createBrowserAgentConfigFromEnv(): BrowserAgentConfig {
  return {
    nodeEnv:
      (process.env["NODE_ENV"] as "development" | "test" | "production") ||
      "development",
    browserManagerHost: process.env["BROWSER_MANAGER_HOST"] || "localhost:3003",
    enableCaching: process.env["ENABLE_CACHING"] === "true",
  };
}
