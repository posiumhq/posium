import type { StepHandler } from "./types.js";
import type { ExecutableStep, StepResult } from "../types.js";
import type { BrowserAgent } from "../../browser/BrowserAgent.js";
import {
  createStableLocator,
  type SelectorInfo,
} from "../../lib/selectorUtils.js";
import assert from "node:assert";

export class TypeHandler implements StepHandler {
  async execute(
    step: ExecutableStep,
    browserAgent: BrowserAgent,
  ): Promise<StepResult> {
    const startTime = Date.now();
    const { commandDetails } = step;

    assert(commandDetails);

    // Get selector from commandDetails (new) or legacy fields
    const selectorValue = commandDetails.selector;
    const selectorType = commandDetails.selectorType;

    // Get value from named field
    const inputValue = commandDetails.value;

    // Read configuration from commandDetails
    const timeout = (commandDetails.timeout as number) || 5000;
    const clearBefore = (commandDetails.clearBefore as boolean) ?? true; // Default to true for backward compat
    const scrollIntoView = commandDetails.scrollIntoView || false;

    if (!selectorValue) {
      return {
        status: "failed",
        step,
        error: "Selector is required for type action",
      };
    }

    try {
      // Create selector info object for stable locator
      const selectorInfo: SelectorInfo = {
        selector: selectorValue,
        type: selectorType as SelectorInfo["type"],
        reliability: "medium",
      };

      const locator = createStableLocator(browserAgent.page, selectorInfo);

      // Scroll into view if requested
      if (scrollIntoView) {
        await locator.scrollIntoViewIfNeeded({ timeout });
      }

      // Clear field if requested (or by default)
      if (clearBefore) {
        await locator.clear({ timeout });
      }

      // Type the value
      await locator.fill(String(inputValue), { timeout });

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
        error: error instanceof Error ? error.message : "Type action failed",
      };
    }
  }
}
