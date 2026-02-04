import type { BrowserContext, Page } from "@playwright/test";
import { type z } from "zod";
import type { AvailableModel, ClientOptions } from "./model.js";
import type { Logger } from "@posium/observability";
import type { SelectorType } from "../../shared/index.js";
import type { PlanInferenceResult } from "./plan.js";
import type { BrowserAgentConfig, LLMClientConfig } from "./config.js";

export interface ConstructorParams {
  env?: "LOCAL" | "REMOTE";
  apiKey?: string;
  projectId?: string;
  verbose?: 0 | 1 | 2;
  debugDom?: boolean;
  headless?: boolean;
  logger?: Logger;
  domSettleTimeoutMs?: number;
  enableCaching?: boolean;
  sessionId?: string;
  toolCallId?: string;
  testId?: string;
  modelName?: AvailableModel;
  modelClientOptions?: ClientOptions;
  config?: BrowserAgentConfig;
  llmConfig: LLMClientConfig;
}

export interface InitOptions {
  /** @deprecated Pass this into the BrowserAgent constructor instead. This will be removed in the next major version. */
  modelName?: AvailableModel;
  /** @deprecated Pass this into the BrowserAgent constructor instead. This will be removed in the next major version. */
  modelClientOptions?: ClientOptions;
  /** @deprecated Pass this into the BrowserAgent constructor instead. This will be removed in the next major version. */
  domSettleTimeoutMs?: number;
}

export interface InitResult {
  debugUrl: string;
  sessionUrl: string;
  sessionId: string;
}

export interface InitFromPageOptions {
  page: Page;
  /** @deprecated Pass this into the BrowserAgent constructor instead. This will be removed in the next major version. */
  modelName?: AvailableModel;
  /** @deprecated Pass this into the BrowserAgent constructor instead. This will be removed in the next major version. */
  modelClientOptions?: ClientOptions;
}

export interface InitFromPageResult {
  context: BrowserContext;
}

export interface ActOptions {
  action: string;
  modelName?: AvailableModel;
  modelClientOptions?: ClientOptions;
  useVision?: "fallback" | boolean;
  variables?: Record<string, string>;
  domSettleTimeoutMs?: number;
  planResult?: PlanInferenceResult;
}

export interface PlanOptions {
  objective: string;
  modelName?: AvailableModel;
  modelClientOptions?: ClientOptions;
  useVision?: "fallback" | boolean;
  variables?: Record<string, string>;
  domSettleTimeoutMs?: number;
}

export interface AssertOptions {
  assertion: string;
  useVision?: boolean;
  domSettleTimeoutMs?: number;
  planResult?: PlanInferenceResult;
  variables?: Record<string, string>;
}

export interface AiCheckOptions {
  prompt: string;
  domSettleTimeoutMs?: number;
  planResult?: PlanInferenceResult;
}

export type AiCheckResult =
  | {
      success: true;
      message: string;
      action: string;
      commandDetails: {
        method: "aiCheck";
        prompt: string;
        reasoning: string;
      };
    }
  | {
      success: false;
      message: string;
      action: string;
      commandDetails?: {
        method: "aiCheck";
        prompt: string;
        reasoning?: string;
      };
    };

export type AssertResult =
  | {
      success: true;
      message: string;
      action: string;
      commandDetails: {
        method: string;
        xpath: string;
        value?: string | number | boolean | RegExp;
        selector?: string;
        selectorType?: SelectorType;
        selectorReliability?: "high" | "medium" | "low";
      };
    }
  | {
      success: false;
      message: string;
      action: string;
      commandDetails?: {
        method: string;
        xpath: string;
        value?: string | number | boolean | RegExp;
        selector?: string;
        selectorType?: SelectorType;
        selectorReliability?: "high" | "medium" | "low";
      };
    };

export type ActResult =
  | {
      success: true;
      message: string;
      action: string;
      commandDetails: {
        method: string;
        xpath: string;
        args: unknown;
        selector?: string;
        selectorType?: SelectorType;
        selectorReliability?: "high" | "medium" | "low";
      };
    }
  | {
      success: false;
      message: string;
      action: string;
    };

export interface ExtractOptions<T extends z.ZodObject<z.ZodRawShape>> {
  instruction: string;
  schema: T;
  modelName?: AvailableModel;
  modelClientOptions?: ClientOptions;
  domSettleTimeoutMs?: number;
  useTextExtract?: boolean;
}

export type ExtractResult<T extends z.ZodObject<z.ZodRawShape>> = z.infer<T>;

export interface ObserveOptions {
  instruction?: string;
  modelName?: AvailableModel;
  modelClientOptions?: ClientOptions;
  useVision?: boolean;
  domSettleTimeoutMs?: number;
}

export interface ObserveResult {
  selector: string;
  description: string;
}
