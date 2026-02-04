import type { StepHandler } from "./types.js";
import type { ExecutableStep, StepResult } from "../types.js";
import type { BrowserAgent } from "../../browser/BrowserAgent.js";
import {
  createStableLocator,
  type SelectorInfo,
} from "../../lib/selectorUtils.js";

export class ClickHandler implements StepHandler {
  async execute(
    step: ExecutableStep,
    browserAgent: BrowserAgent,
  ): Promise<StepResult> {
    const startTime = Date.now();
    const { commandDetails, description } = step;

    // Get selector from commandDetails
    const selectorValue = commandDetails?.selector;
    const selectorType = commandDetails?.selectorType || "xpath";

    // Read configuration from commandDetails
    const timeout = commandDetails?.timeout || 5000;
    const forceClick = commandDetails?.forceClick || false;
    const scrollIntoView = commandDetails?.scrollIntoView || false;
    const screenshotBefore = commandDetails?.screenshotBefore || false;
    const screenshotAfter = commandDetails?.screenshotAfter || false;

    if (!selectorValue) {
      return {
        status: "failed",
        step,
        error: "Selector is required for click action",
      };
    }

    try {
      // Take screenshot before if requested
      let screenshotBeforeBase64: string | undefined;
      if (screenshotBefore) {
        const buffer = await browserAgent.page.screenshot();
        screenshotBeforeBase64 = buffer.toString("base64");
      }

      // Create selector info object for stable locator
      const selectorInfo: SelectorInfo = {
        selector: selectorValue,
        type: selectorType as SelectorInfo["type"],
        reliability: "medium",
      };

      // Use createStableLocator to handle all selector types properly
      const locator = createStableLocator(browserAgent.page, selectorInfo);

      // Scroll into view if requested
      if (scrollIntoView) {
        await locator.scrollIntoViewIfNeeded({ timeout });
      }

      // Perform click action
      const clickOptions = {
        timeout,
        force: forceClick,
      };

      if (description.toLowerCase().includes("doubleclick") || description.toLowerCase().includes("double click")) {
        await locator.dblclick(clickOptions);
      } else {
        await locator.click(clickOptions);
      }

      // Take screenshot after if requested
      let screenshotAfterBase64: string | undefined;
      if (screenshotAfter) {
        const buffer = await browserAgent.page.screenshot();
        screenshotAfterBase64 = buffer.toString("base64");
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
        error: error instanceof Error ? error.message : "Click failed",
      };
    }
  }
}
