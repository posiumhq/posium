import type { StepHandler } from "./types.js";
import type { ExecutableStep, StepResult } from "../types.js";
import type { BrowserAgent } from "../../browser/BrowserAgent.js";

export class AiCheckHandler implements StepHandler {
  async execute(
    step: ExecutableStep,
    browserAgent: BrowserAgent,
  ): Promise<StepResult> {
    const startTime = Date.now();
    const { commandDetails, description } = step;

    // Get prompt from commandDetails (new) or description (fallback)
    const prompt = (commandDetails?.prompt as string) || description;

    if (!prompt) {
      return {
        status: "failed",
        step,
        error: "Prompt is required for AI check",
      };
    }

    try {
      // Perform AI check using the BrowserAgentPage helper
      const result = await browserAgent.agentPage.aiCheck({
        prompt,
        domSettleTimeoutMs: commandDetails?.timeout as number | undefined,
      });

      if (result.success) {
        return {
          status: "passed",
          step,
          duration: Date.now() - startTime,
        };
      } else {
        return {
          status: "failed",
          step,
          duration: Date.now() - startTime,
          error: result.message,
        };
      }
    } catch (error) {
      return {
        status: "failed",
        step,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : "AI check failed",
      };
    }
  }
}
