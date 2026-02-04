import type { BrowserAgentPage } from "../BrowserAgentPage.js";
import type { LLMClient } from "../../llm/LLMClient.js";
import type { Logger } from "@posium/observability";
import type { AiCheckInferenceResult } from "../types/plan.js";
import { z } from "zod";

export interface AiCheckOptions {
  prompt: string;
  llmClient?: LLMClient;
  requestId: string;
  domSettleTimeoutMs?: number;
  planResult?: AiCheckInferenceResult;
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

/**
 * Handler for AI-powered visual checks using full page screenshots and LLM analysis.
 * This handler provides freeform validation using natural language prompts without
 * requiring specific element selection or structured assertions.
 */
export class BrowserAgentAiCheckHandler {
  private readonly agentPage: BrowserAgentPage;
  private readonly logger: Logger;
  private readonly llmClient: LLMClient;

  constructor({
    logger,
    agentPage,
    llmClient,
  }: {
    logger: Logger;
    agentPage: BrowserAgentPage;
    llmClient: LLMClient;
  }) {
    this.logger = logger;
    this.agentPage = agentPage;
    this.llmClient = llmClient;
  }

  /**
   * Execute an AI check from a plan result.
   * This is a compatibility method for BrowserAgentPage.
   */
  public async aiCheckFromPlanResult(
    planResult: AiCheckInferenceResult,
    domSettleTimeoutMs?: number,
  ): Promise<AiCheckResult> {
    const prompt = planResult.description || planResult.args.prompt;

    return this.aiCheck({
      prompt,
      requestId: Math.random().toString(36).substring(7),
      domSettleTimeoutMs,
      planResult,
    });
  }

  /**
   * Main method to perform an AI-powered visual check on the page.
   * Takes a full page screenshot and uses LLM with vision to validate against the prompt.
   */
  public async aiCheck({
    prompt,
    llmClient,
    requestId,
    domSettleTimeoutMs,
    planResult,
  }: AiCheckOptions): Promise<AiCheckResult> {
    const effectiveLLMClient = llmClient || this.llmClient;

    try {
      // Wait for DOM to settle before taking screenshot
      await this.agentPage._waitForSettledDom(domSettleTimeoutMs);

      this.logger.debug(
        { prompt, requestId },
        "Taking full page screenshot for AI check",
      );

      // Take a full page screenshot
      const screenshot = await this.agentPage.page.screenshot({
        fullPage: true,
        type: "jpeg",
        quality: 80,
      });

      this.logger.debug(
        { prompt, requestId },
        "Calling LLM for AI check analysis",
      );

      // Define the response schema
      const responseSchema = z.object({
        result: z.boolean(),
        reasoning: z.string(),
      });

      // Call LLM with vision capabilities using generateStructuredObject
      const aiResponse = await effectiveLLMClient.generateStructuredObject({
        messages: [
          {
            role: "user",
            content: `You are a visual QA assistant. Analyze the provided screenshot and determine if the following condition is met:

"${prompt}"

Respond with:
- result: true or false
- reasoning: Brief explanation of why the check passed or failed

Be thorough but concise in your reasoning.`,
          },
        ],
        schema: responseSchema,
        temperature: 0.1,
        image: {
          buffer: screenshot,
          description: "Full page screenshot for AI visual check",
        },
        requestId,
      });

      this.logger.info(
        {
          prompt,
          result: aiResponse.result,
          reasoning: aiResponse.reasoning,
        },
        "AI check completed",
      );

      if (aiResponse.result) {
        return {
          success: true,
          message: `AI check passed: ${prompt}`,
          action: prompt,
          commandDetails: {
            method: "aiCheck",
            prompt: prompt,
            reasoning: aiResponse.reasoning,
          },
        };
      } else {
        return {
          success: false,
          message: `AI check failed: ${prompt}`,
          action: prompt,
          commandDetails: {
            method: "aiCheck",
            prompt: prompt,
            reasoning: aiResponse.reasoning,
          },
        };
      }
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        {
          prompt,
          error: err.message,
          stack: err.stack,
        },
        "AI check execution failed",
      );

      return {
        success: false,
        message: `Failed to execute AI check: ${err.message}`,
        action: prompt,
      };
    }
  }
}
