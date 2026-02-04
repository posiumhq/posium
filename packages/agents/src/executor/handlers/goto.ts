import type { StepHandler } from "./types.js";
import type { ExecutableStep, StepResult } from "../types.js";
import type { BrowserAgent } from "../../browser/BrowserAgent.js";

export class GotoHandler implements StepHandler {
  async execute(
    step: ExecutableStep,
    browserAgent: BrowserAgent,
  ): Promise<StepResult> {
    const startTime = Date.now();
    const { commandDetails } = step;

    // Get URL from commandDetails
    const url = commandDetails?.url as string | undefined;

    // Read configuration from commandDetails
    const timeout = (commandDetails?.timeout as number) || 30000; // Navigation needs longer timeout
    const waitForStable = commandDetails?.waitForStable || false;

    if (!url) {
      return {
        status: "failed",
        step,
        error: "URL is required for goto action",
      };
    }

    try {
      await browserAgent.page.goto(url, {
        timeout,
        waitUntil: "domcontentloaded",
      });

      // Wait for page to stabilize if requested
      if (waitForStable) {
        await browserAgent.page
          .waitForLoadState("networkidle", { timeout: 5000 })
          .catch(() => {
            // Ignore network idle timeout - page might still be functional
          });
      }

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
        error: error instanceof Error ? error.message : "Navigation failed",
      };
    }
  }
}
