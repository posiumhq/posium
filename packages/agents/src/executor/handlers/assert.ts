import type { StepHandler } from "./types.js";
import type { ExecutableStep, StepResult } from "../types.js";
import type { BrowserAgent } from "../../browser/BrowserAgent.js";
import {
  createStableLocator,
  type SelectorInfo,
} from "../../lib/selectorUtils.js";

export class AssertHandler implements StepHandler {
  async execute(
    step: ExecutableStep,
    browserAgent: BrowserAgent,
  ): Promise<StepResult> {
    const startTime = Date.now();
    const { commandDetails } = step;

    // Get selector from commandDetails
    const selectorValue = commandDetails?.selector;
    const selectorType = commandDetails?.selectorType || "xpath";

    // Get expected value from commandDetails
    const expectedValue = commandDetails?.value;

    // Read configuration from commandDetails
    const timeout = (commandDetails?.timeout as number) || 5000;
    const partialMatch = commandDetails?.partialMatch || false;
    const caseSensitive = (commandDetails?.caseSensitive as boolean) ?? true;

    // Infer assert type from method or value presence
    const assertType: string =
      step.method === "toContainText" || expectedValue !== undefined ? "hasText" : "visible";

    if (!selectorValue) {
      return {
        status: "failed",
        step,
        error: "Selector is required for assert action",
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

      switch (assertType) {
        case "visible":
          await locator.waitFor({ state: "visible", timeout });
          break;

        case "enabled": {
          const isEnabled = await locator.isEnabled();
          if (!isEnabled) {
            throw new Error("Element is not enabled");
          }
          break;
        }

        case "hasText": {
          if (expectedValue === undefined) {
            throw new Error("Value is required for hasText assertion");
          }
          const text = await locator.textContent({ timeout });
          const expectedStr = String(expectedValue);

          if (partialMatch) {
            const textToCheck = caseSensitive ? text : text?.toLowerCase();
            const valueToCheck = caseSensitive
              ? expectedStr
              : expectedStr.toLowerCase();
            if (!textToCheck?.includes(valueToCheck)) {
              throw new Error(
                `Expected text "${expectedStr}" not found. Got: "${text}"`,
              );
            }
          } else {
            const textToCheck = caseSensitive ? text : text?.toLowerCase();
            const valueToCheck = caseSensitive
              ? expectedStr
              : expectedStr.toLowerCase();
            if (textToCheck !== valueToCheck) {
              throw new Error(
                `Expected exact text "${expectedStr}" but got "${text}"`,
              );
            }
          }
          break;
        }

        case "hasValue": {
          const inputValue = await locator.inputValue({ timeout });
          const expectedStr =
            expectedValue !== undefined ? String(expectedValue) : "";
          if (inputValue !== expectedStr) {
            throw new Error(
              `Expected value "${expectedStr}" but got "${inputValue}"`,
            );
          }
          break;
        }

        default:
          throw new Error(`Unknown assert type: ${assertType}`);
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
        error: error instanceof Error ? error.message : "Assertion failed",
      };
    }
  }
}
