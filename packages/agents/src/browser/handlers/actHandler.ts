import type { PlaywrightCommandMethodNotSupportedException } from "../types/playwright.js";
import { act, fillInVariables } from "../inference/index.js";
import type { LLMClient } from "../../llm/LLMClient.js";
import { generateId } from "../../utils/index.js";
import type { BrowserAgentPage } from "../BrowserAgentPage.js";
import type { BrowserAgentContext } from "../BrowserAgentContext.js";
import type { Logger } from "@posium/observability";
import type { ActResult } from "../types/browserAgent.js";
import type { ActInferenceResult } from "../types/plan.js";
import { getAccessibilityTree } from "../utils/a11y.js";
import type { EncodedId } from "../types/context.js";
import {
  findStableSelector,
  createStableLocator,
  type SelectorInfo,
} from "../../lib/selectorUtils.js";

/**
 * Simplified BrowserAgentActHandler that uses only accessibility tree for actions.
 * No screenshots, no DOM processing, no chunks - just clean accessibility tree based actions.
 */
export class BrowserAgentActHandler {
  private readonly agentPage: BrowserAgentPage;
  private readonly logger: Logger;
  private readonly actions: {
    [key: string]: { result: string; action: string };
  };
  private readonly llmClient: LLMClient;

  constructor({
    logger,
    llmClient,
    agentPage,
  }: {
    verbose?: 0 | 1 | 2;
    enableCaching?: boolean;
    logger: Logger;
    llmClient: LLMClient;
    agentPage: BrowserAgentPage;
    agentContext?: BrowserAgentContext;
  }) {
    this.logger = logger;
    this.actions = {};
    this.agentPage = agentPage;
    this.llmClient = llmClient;
  }

  /**
   * Records an executed action with its corresponding result.
   */
  private async _recordAction(action: string, result: string): Promise<string> {
    const id = generateId(action);
    this.actions[id] = { result, action };
    return id;
  }

  /**
   * Executes a Playwright method on the specified element.
   */
  private async _performPlaywrightMethod(
    method: string,
    args: unknown[],
    xpath: string,
    selectorInfo: SelectorInfo,
    domSettleTimeoutMs?: number,
  ): Promise<void> {
    // Create a locator using the most stable selector available
    const locator = createStableLocator(this.agentPage.page, selectorInfo);

    // Map method names to Playwright locator methods
    const methodHandlerMap: Record<string, () => Promise<void>> = {
      click: async () => {
        await locator.click({ timeout: 10000 });
      },
      fill: async () => {
        const text = String(args[0] || "");
        await locator.fill(text, { timeout: 10000 });
      },
      type: async () => {
        const text = String(args[0] || "");
        await locator.pressSequentially(text, { timeout: 10000 });
      },
      press: async () => {
        const key = String(args[0] || "");
        await locator.press(key, { timeout: 10000 });
      },
      selectOption: async () => {
        const value = String(args[0] || "");
        await locator.selectOption(value, { timeout: 10000 });
      },
      check: async () => {
        await locator.check({ timeout: 10000 });
      },
      uncheck: async () => {
        await locator.uncheck({ timeout: 10000 });
      },
      hover: async () => {
        await locator.hover({ timeout: 10000 });
      },
      focus: async () => {
        await locator.focus({ timeout: 10000 });
      },
      blur: async () => {
        await locator.blur({ timeout: 10000 });
      },
      clear: async () => {
        await locator.clear({ timeout: 10000 });
      },
      dblclick: async () => {
        await locator.dblclick({ timeout: 10000 });
      },
      scrollIntoView: async () => {
        await locator.scrollIntoViewIfNeeded({ timeout: 10000 });
      },
    };

    const handler = methodHandlerMap[method];
    if (!handler) {
      const error: PlaywrightCommandMethodNotSupportedException = new Error(
        `Method ${method} not supported`,
      ) as PlaywrightCommandMethodNotSupportedException;
      error.name = "PlaywrightCommandMethodNotSupportedException";
      throw error;
    }

    await handler();

    // Wait for DOM to settle after action
    await this.agentPage._waitForSettledDom(domSettleTimeoutMs);
  }

  /**
   * Execute an action from a plan result.
   * This is a compatibility method for BrowserAgentPage.
   */
  public async actFromPlanResult(
    planResult: ActInferenceResult,
    domSettleTimeoutMs?: number,
    variables?: Record<string, string>,
  ): Promise<ActResult> {
    // Extract action description from plan result
    const action = planResult.description || `${planResult.instruction} action`;

    // Call the main act method with the plan result
    return this.act({
      action,
      requestId: Math.random().toString(36).substring(7),
      variables: variables || {},
      domSettleTimeoutMs,
      planResult,
    });
  }

  /**
   * Main method to execute an action on the page using accessibility tree.
   */
  public async act({
    action,
    llmClient,
    requestId,
    variables = {},
    domSettleTimeoutMs,
    planResult,
  }: {
    action: string;
    llmClient?: LLMClient;
    requestId: string;
    variables?: Record<string, string>;
    domSettleTimeoutMs?: number;
    planResult?: ActInferenceResult;
  }): Promise<ActResult> {
    const effectiveLLMClient = llmClient || this.llmClient;
    console.error("act params are ", {
      action,
      variables,
      planResult,
    });

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

        // Get stable selector info before the action
        const selectorInfo = await findStableSelector(
          this.agentPage.page,
          planResult.args.xpath,
          this.logger,
          this.llmClient,
        );

        // Fill in any variables in the action arguments
        const filledArgs = planResult.args.actionArgs
          ? planResult.args.actionArgs.map((arg) =>
              typeof arg === "string" ? fillInVariables(arg, variables) : arg,
            )
          : [];

        await this._performPlaywrightMethod(
          planResult.instruction,
          filledArgs,
          planResult.args.xpath,
          selectorInfo,
          domSettleTimeoutMs,
        );

        await this._recordAction(
          action,
          `Executed ${planResult.instruction} on element`,
        );

        return {
          success: true,
          message: `Successfully executed action: ${action}`,
          action: action,
          commandDetails: {
            method: planResult.instruction,
            xpath: planResult.args.xpath,
            args: planResult.args.actionArgs, // Store original templates, not resolved values
            selector: selectorInfo.selector,
            selectorType: selectorInfo.type,
            selectorReliability: selectorInfo.reliability,
          },
        };
      }

      // Get accessibility tree for the page
      this.logger.debug("Getting accessibility tree for action");
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
          action: action,
        };
      }

      // Use LLM to determine the action to take
      const response = await act({
        action,
        domElements: simplified,
        steps: "", // No previous steps in simplified version
        llmClient: effectiveLLMClient,
        logger: this.logger,
        requestId,
        variables,
      });

      if (!response) {
        return {
          success: false,
          message: "No valid action response from LLM",
          action: action,
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
          action: action,
        };
      }

      // Get stable selector info before the action
      const selectorInfo = await findStableSelector(
        this.agentPage.page,
        xpath,
        this.logger,
        this.llmClient,
      );

      // Fill in variables in arguments
      const filledArgs = response.args
        ? Array.isArray(response.args)
          ? response.args.map((arg: unknown) =>
              typeof arg === "string" ? fillInVariables(arg, variables) : arg,
            )
          : [response.args]
        : [];

      // Execute the action
      await this._performPlaywrightMethod(
        response.method,
        filledArgs,
        xpath,
        selectorInfo,
        domSettleTimeoutMs,
      );

      await this._recordAction(
        action,
        `Executed ${response.method} on element`,
      );

      return {
        success: true,
        message: `Successfully executed action: ${action}`,
        action: action,
        commandDetails: {
          method: response.method,
          xpath: xpath,
          args: response.args, // Store original templates, not resolved values
          selector: selectorInfo.selector,
          selectorType: selectorInfo.type,
          selectorReliability: selectorInfo.reliability,
        },
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        {
          action,
          error: err.message,
          stack: err.stack,
        },
        "Action execution failed",
      );

      return {
        success: false,
        message: `Failed to execute action: ${err.message}`,
        action: action,
      };
    }
  }
}
