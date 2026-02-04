import { expect } from "@playwright/test";
import type { BrowserAgentPage } from "../BrowserAgentPage.js";
import type { LLMClient } from "../../llm/LLMClient.js";
import { generateId } from "../../utils/index.js";
import { assert, fillInVariables } from "../inference/index.js";
import type { Logger } from "@posium/observability";
import type { AssertResult } from "../types/browserAgent.js";
import type { AssertInferenceResult } from "../types/plan.js";
import { getAccessibilityTree } from "../utils/a11y.js";
import type { EncodedId } from "../types/context.js";
import {
  findStableSelector,
  createStableLocator,
  type SelectorInfo,
} from "../../lib/selectorUtils.js";

/**
 * Simplified BrowserAgentAssertHandler that uses only accessibility tree for assertions.
 * No screenshots, no DOM processing, no chunks - just clean accessibility tree based assertions.
 */
export class BrowserAgentAssertHandler {
  private readonly agentPage: BrowserAgentPage;
  private readonly logger: Logger;
  private readonly assertions: {
    [key: string]: { result: boolean; assertion: string };
  };
  private readonly llmClient: LLMClient;

  constructor({
    logger,
    agentPage,
    llmClient,
  }: {
    logger: Logger;
    agentPage: BrowserAgentPage;
    verbose?: 0 | 1 | 2;
    llmClient: LLMClient;
  }) {
    this.logger = logger;
    this.agentPage = agentPage;
    this.assertions = {};
    this.llmClient = llmClient;
  }

  /**
   * Records the outcome of an assertion.
   */
  private async _recordAssertion(
    assertion: string,
    result: boolean,
  ): Promise<string> {
    const id = generateId(assertion);
    this.assertions[id] = { result, assertion };
    return id;
  }

  /**
   * Performs the actual assertion on an element.
   */
  private async _performAssertion(
    method: string,
    xpath: string,
    selectorInfo: SelectorInfo,
    value?: string | number | boolean | RegExp,
    options?: { timeout?: number },
  ): Promise<boolean> {
    // Create a locator using the most stable selector available
    const locator = createStableLocator(this.agentPage.page, selectorInfo);
    const timeout = options?.timeout || 10000;

    try {
      switch (method) {
        case "toBeVisible":
        case "isVisible":
          await expect(locator).toBeVisible({ timeout });
          break;
        case "toBeHidden":
        case "isHidden":
          await expect(locator).toBeHidden({ timeout });
          break;
        case "toHaveText":
        case "hasText":
          if (typeof value === "string" || value instanceof RegExp) {
            await expect(locator).toHaveText(value, { timeout });
          }
          break;
        case "toContainText":
        case "containsText":
          if (typeof value === "string" || value instanceof RegExp) {
            await expect(locator).toContainText(value, { timeout });
          }
          break;
        case "toHaveValue":
        case "hasValue":
          if (typeof value === "string" || value instanceof RegExp) {
            await expect(locator).toHaveValue(value, { timeout });
          }
          break;
        case "toBeEnabled":
        case "isEnabled":
          await expect(locator).toBeEnabled({ timeout });
          break;
        case "toBeDisabled":
        case "isDisabled":
          await expect(locator).toBeDisabled({ timeout });
          break;
        case "toBeChecked":
        case "isChecked":
          await expect(locator).toBeChecked({ timeout });
          break;
        case "toBeAttached":
        case "isAttached":
          await expect(locator).toBeAttached({ timeout });
          break;
        case "toBeEmpty":
        case "isEmpty":
          await expect(locator).toBeEmpty({ timeout });
          break;
        case "toBeFocused":
        case "isFocused":
          await expect(locator).toBeFocused({ timeout });
          break;
        case "toHaveAttribute":
        case "hasAttribute":
          if (typeof value === "string" && value.includes("=")) {
            const [attr, val] = value.split("=", 2);
            await expect(locator).toHaveAttribute(attr!, val ?? "", {
              timeout,
            });
          }
          break;
        case "toHaveCount":
        case "hasCount":
          if (typeof value === "number") {
            await expect(locator).toHaveCount(value, { timeout });
          }
          break;
        default:
          throw new Error(`Unsupported assertion method: ${method}`);
      }
      return true;
    } catch (error) {
      this.logger.debug({ method, xpath, value, err: error }, "Assertion failed");
      return false;
    }
  }

  /**
   * Execute an assertion from a plan result.
   * This is a compatibility method for BrowserAgentPage.
   */
  public async assertFromPlanResult(
    planResult: AssertInferenceResult,
    domSettleTimeoutMs?: number,
    variables?: Record<string, string>,
  ): Promise<AssertResult> {
    // Extract assertion description from plan result
    const assertion =
      planResult.description || `${planResult.instruction} assertion`;

    // Call the main assert method with the plan result
    return this.assert({
      assertion,
      requestId: Math.random().toString(36).substring(7),
      variables: variables || {},
      domSettleTimeoutMs,
      planResult,
    });
  }

  /**
   * Main method to perform an assertion on the page using accessibility tree.
   */
  public async assert({
    assertion,
    llmClient,
    requestId,
    variables = {},
    domSettleTimeoutMs,
    planResult,
  }: {
    assertion: string;
    llmClient?: LLMClient;
    requestId: string;
    variables?: Record<string, string>;
    domSettleTimeoutMs?: number;
    planResult?: AssertInferenceResult;
  }): Promise<AssertResult> {
    const effectiveLLMClient = llmClient || this.llmClient;

    try {
      // Wait for DOM to settle before starting
      await this.agentPage._waitForSettledDom(domSettleTimeoutMs);

      // If we have a plan result with xpath, use it directly
      if (planResult?.args?.xpath) {
        this.logger.debug(
          {
            xpath: planResult.args.xpath,
            instruction: planResult.instruction,
          },
          "Using xpath from plan result",
        );

        // Get stable selector info before the assertion
        const selectorInfo = await findStableSelector(
          this.agentPage.page,
          planResult.args.xpath,
          this.logger,
          this.llmClient,
        );

        const rawValue = planResult.args.value as
          | string
          | number
          | boolean
          | undefined;
        const filledValue = rawValue
          ? typeof rawValue === "string"
            ? fillInVariables(rawValue, variables)
            : rawValue
          : undefined;

        const result = await this._performAssertion(
          planResult.instruction,
          planResult.args.xpath,
          selectorInfo,
          filledValue,
        );

        await this._recordAssertion(assertion, result);

        if (result) {
          return {
            success: true,
            message: `Assertion passed: ${assertion}`,
            action: assertion,
            commandDetails: {
              method: planResult.instruction,
              xpath: planResult.args.xpath,
              value: rawValue, // Store original template, not resolved value
              selector: selectorInfo.selector,
              selectorType: selectorInfo.type,
              selectorReliability: selectorInfo.reliability,
            },
          };
        } else {
          return {
            success: false,
            message: `Assertion failed: ${assertion}`,
            action: assertion,
          };
        }
      }

      // Get accessibility tree for the page
      this.logger.debug("Getting accessibility tree for assertion");
      const { simplified, xpathMap } = await getAccessibilityTree(
        false, // experimental
        this.agentPage,
        (log) => {
          if (log.level === 0) {
            this.logger.debug(log.auxiliary ?? {}, log.message);
          } else if (log.level === 1) {
            this.logger.info(log.auxiliary ?? {}, log.message);
          } else {
            this.logger.warn(log.auxiliary ?? {}, log.message);
          }
        },
      );

      if (!simplified) {
        return {
          success: false,
          message: "Could not get accessibility tree",
          action: assertion,
        };
      }

      // Use LLM to determine the assertion to perform
      const response = await assert({
        instruction: assertion,
        domElements: simplified,
        llmClient: effectiveLLMClient,
        logger: this.logger,
        requestId,
        variables,
      });

      if (!response) {
        return {
          success: false,
          message: "No valid assertion response from LLM",
          action: assertion,
        };
      }

      // Get the xpath for the element
      const elementId = response.element as EncodedId;
      const xpath = xpathMap[elementId];

      if (!xpath) {
        this.logger.error({ elementId }, "No xpath found for element");
        return {
          success: false,
          message: `Could not find xpath for element ${elementId}`,
          action: assertion,
        };
      }

      // Get stable selector info before the assertion
      const selectorInfo = await findStableSelector(
        this.agentPage.page,
        xpath,
        this.logger,
        this.llmClient,
      );

      // Fill in variables in value
      const filledValue = response.value
        ? typeof response.value === "string"
          ? fillInVariables(response.value, variables)
          : response.value
        : undefined;

      // Perform the assertion
      const result = await this._performAssertion(
        response.method,
        xpath,
        selectorInfo,
        filledValue,
      );

      await this._recordAssertion(assertion, result);

      if (result) {
        return {
          success: true,
          message: `Assertion passed: ${assertion}`,
          action: assertion,
          commandDetails: {
            method: response.method,
            xpath: xpath,
            value: response.value, // Store original template, not resolved value
            selector: selectorInfo.selector,
            selectorType: selectorInfo.type,
            selectorReliability: selectorInfo.reliability,
          },
        };
      } else {
        return {
          success: false,
          message: `Assertion failed: ${assertion}`,
          action: assertion,
        };
      }
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        {
          assertion,
          error: err.message,
          stack: err.stack,
        },
        "Assertion execution failed",
      );

      return {
        success: false,
        message: `Failed to execute assertion: ${err.message}`,
        action: assertion,
      };
    }
  }
}
