import type { StepHandler } from "./types.js";
import type { ExecutableStep, StepResult } from "../types.js";
import type { BrowserAgent } from "../../browser/BrowserAgent.js";

export class WaitHandler implements StepHandler {
  async execute(
    step: ExecutableStep,
    browserAgent: BrowserAgent,
  ): Promise<StepResult> {
    const startTime = Date.now();
    const { commandDetails } = step;

    // Get duration in seconds from commandDetails.args[0] or commandDetails.value
    let durationInSeconds: number;
    if (
      commandDetails?.args &&
      Array.isArray(commandDetails.args) &&
      commandDetails.args.length > 0
    ) {
      durationInSeconds = parseFloat(String(commandDetails.args[0]));
    } else if (commandDetails?.value !== undefined) {
      durationInSeconds = parseFloat(String(commandDetails.value));
    } else {
      durationInSeconds = 1; // Default 1 second
    }

    // Validate duration
    if (isNaN(durationInSeconds) || durationInSeconds < 0) {
      return {
        status: "failed",
        step,
        error: "Invalid wait duration",
      };
    }

    // Convert seconds to milliseconds for Playwright
    const durationInMs = Math.round(durationInSeconds * 1000);

    try {
      await browserAgent.page.waitForTimeout(durationInMs);

      return {
        status: "passed",
        step,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: "failed",
        step,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Wait failed",
      };
    }
  }
}
