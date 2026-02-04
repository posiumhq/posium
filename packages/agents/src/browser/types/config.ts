export interface AIConfig {
  /** Environment mode */
  nodeEnv?: "development" | "test" | "production";

  /** OpenRouter API configuration */
  openRouter?: {
    apiKey: string;
    cloudflareAccountId: string;
    cloudflareAiGatewayToken: string;
  };

  /** Browser management configuration */
  browser?: {
    managerHost?: string;
    environment?: "LOCAL" | "REMOTE";
    headless?: boolean;
  };

  /** Caching configuration */
  enableCaching?: boolean;

  /** Logging configuration */
  verbose?: 0 | 1 | 2;
}

export interface LLMClientConfig {
  openRouter: {
    apiKey: string;
    /** Optional - if all 3 CF fields provided, routes through Cloudflare AI Gateway */
    cloudflareAccountId?: string;
    cloudflareAiGatewayToken?: string;
    cloudflareGatewayName?: string;
  };
}

export interface SupervisorAgentConfig {
  openRouter: {
    apiKey: string;
    cloudflareAccountId: string;
    cloudflareAiGatewayToken: string;
  };
  nodeEnv?: "development" | "test" | "production";
}

export interface BrowserAgentConfig {
  nodeEnv?: "development" | "test" | "production";
  browserManagerHost?: string;
  enableCaching?: boolean;
}
