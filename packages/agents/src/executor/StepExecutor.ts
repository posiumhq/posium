import type { BrowserAgent } from "../browser/BrowserAgent.js";
import type { ExecutableStep, StepConfig, StepResult } from "./types.js";
import type { StepHandler } from "./handlers/types.js";
import { ClickHandler } from "./handlers/click.js";
import { TypeHandler } from "./handlers/type.js";
import { GotoHandler } from "./handlers/goto.js";
import { AssertHandler } from "./handlers/assert.js";
import { AiCheckHandler } from "./handlers/aiCheck.js";
import { WaitHandler } from "./handlers/wait.js";
import { fillInVariables } from "../browser/inference/fillInVariables.js";
import type { StepMethod } from "../shared/index.js";

export class StepExecutor {
  private handlers: Map<StepMethod, StepHandler>;
  private variables: Record<string, string>;

  constructor(
    private browserAgent: BrowserAgent,
    private defaultConfig: StepConfig = {},
    variables: Record<string, string> = {},
  ) {
    // Initialize handlers
    this.handlers = new Map();
    this.variables = variables;

    const clickHandler = new ClickHandler();
    const assertHandler = new AssertHandler();
    const aiCheckHandler = new AiCheckHandler();

    this.handlers.set("click", clickHandler);
    this.handlers.set("type", new TypeHandler());
    this.handlers.set("goto", new GotoHandler());
    this.handlers.set("toBeVisible", assertHandler);
    this.handlers.set("toContainText", assertHandler);
    this.handlers.set("aiCheck", aiCheckHandler);
    this.handlers.set("wait", new WaitHandler());
  }

  async execute(step: ExecutableStep): Promise<StepResult> {
    const startTime = Date.now();

    await this.smartWait();

    // Handle skip
    if (step.skip) {
      return {
        status: "skipped",
        step,
      };
    }

    // Simple routing logic based on commandDetails presence
    if (step.commandDetails) {
      // Has commandDetails - use direct handlers
      return await this.executeWithCommandDetails(step, startTime);
    } else {
      // No commandDetails - use BrowserAgent act/assert for natural language
      return await this.executeWithNaturalLanguage(step, startTime);
    }
  }

  private async executeWithCommandDetails(
    step: ExecutableStep,
    startTime: number,
  ): Promise<StepResult> {
    // Check for natural language selector that needs resolution
    if (step.commandDetails?.selectorType === "natural") {
      // Construct natural language action based on step method
      let action = "";
      const selector = step.commandDetails.selector || "";

      // Handle actions
      if (
        step.type === "act" ||
        step.method === "click" ||
        step.method === "type"
      ) {
        switch (step.method) {
          case "click": {
            action = `click on "${selector}"`;
            break;
          }
          case "type": {
            const value =
              step.commandDetails.args?.[0] || step.commandDetails.value || "";
            action = `type "${value}" in "${selector}"`;
            break;
          }
          default:
            return {
              status: "failed",
              step,
              error: `Natural language selector resolution not supported for method: ${step.method}`,
              duration: Date.now() - startTime,
            };
        }

        // Use BrowserAgent act to resolve and execute the natural language instruction
        try {
          const result = await this.browserAgent.act({ action });

          if (!result.success) {
            return {
              status: "failed",
              step,
              error: result.message || "Natural language action failed",
              usedAI: true,
              duration: Date.now() - startTime,
            };
          }

          return {
            status: "passed",
            step,
            usedAI: true,
            duration: Date.now() - startTime,
          };
        } catch (error) {
          return {
            status: "failed",
            step,
            error:
              error instanceof Error
                ? error.message
                : "Natural language action failed",
            usedAI: true,
            duration: Date.now() - startTime,
          };
        }
      }

      // Handle assertions
      if (
        step.type === "assert" ||
        step.method === "toBeVisible" ||
        step.method === "toContainText"
      ) {
        let assertion = "";

        switch (step.method) {
          case "toBeVisible": {
            assertion = `"${selector}" is visible`;
            break;
          }
          case "toContainText": {
            const expectedText =
              step.commandDetails.args?.[0] || step.commandDetails.value || "";
            assertion = `"${selector}" contains "${expectedText}"`;
            break;
          }
          default:
            return {
              status: "failed",
              step,
              error: `Natural language selector resolution not supported for assertion method: ${step.method}`,
              duration: Date.now() - startTime,
            };
        }

        // Use BrowserAgent assert to resolve and verify the natural language assertion
        try {
          const result = await this.browserAgent.assert({ assertion });

          if (!result.success) {
            return {
              status: "failed",
              step,
              error: result.message || "Natural language assertion failed",
              usedAI: true,
              duration: Date.now() - startTime,
            };
          }

          return {
            status: "passed",
            step,
            usedAI: true,
            duration: Date.now() - startTime,
          };
        } catch (error) {
          return {
            status: "failed",
            step,
            error:
              error instanceof Error
                ? error.message
                : "Natural language assertion failed",
            usedAI: true,
            duration: Date.now() - startTime,
          };
        }
      }

      // Unknown step type/method combination
      return {
        status: "failed",
        step,
        error: `Natural language selector resolution not supported for step type '${step.type}' with method '${step.method}'`,
        duration: Date.now() - startTime,
      };
    }

    // Check for natural language value that needs resolution (TODO)
    if (step.commandDetails?.valueType === "natural") {
      // TODO: Implement natural language value resolution
      return {
        status: "failed",
        step,
        error: "Natural language value resolution not yet implemented",
        duration: Date.now() - startTime,
      };
    }

    // Substitute variables in commandDetails before execution
    const stepWithSubstitutedVars = this.substituteVariablesInStep(step);

    // Get handler for step method
    const handler = this.handlers.get(step.method);

    if (!handler) {
      return {
        status: "failed",
        step,
        error: `No handler found for step method: ${step.method}`,
        duration: Date.now() - startTime,
      };
    }

    // Execute with handler (handler will read from commandDetails)
    try {
      // Apply any wait before configuration
      if (stepWithSubstitutedVars.commandDetails?.waitBefore) {
        await this.browserAgent.page.waitForTimeout(
          stepWithSubstitutedVars.commandDetails.waitBefore as number,
        );
      }

      const result = await handler.execute(
        stepWithSubstitutedVars,
        this.browserAgent,
      );

      // Apply any wait after configuration
      if (stepWithSubstitutedVars.commandDetails?.waitAfter) {
        await this.browserAgent.page.waitForTimeout(
          stepWithSubstitutedVars.commandDetails.waitAfter as number,
        );
      }

      return {
        ...result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: "failed",
        step,
        error: error instanceof Error ? error.message : "Execution failed",
        duration: Date.now() - startTime,
      };
    }
  }

  private async executeWithNaturalLanguage(
    step: ExecutableStep,
    startTime: number,
  ): Promise<StepResult> {
    // Use BrowserAgent's act or assert methods for natural language execution
    try {
      if (
        step.type === "assert" ||
        step.method === "toBeVisible" ||
        step.method === "toContainText"
      ) {
        // Use BrowserAgent assert for natural language assertions
        await this.browserAgent.assert({
          assertion: step.description,
        });
      } else if (step.type === "act" || step.type === "goto") {
        // Use BrowserAgent act for natural language actions
        const result = await this.browserAgent.act({
          action: step.description,
        });

        // TODO: Caching can be implemented via commandDetails.disableCaching flag
        // When caching is enabled:
        // 1. Convert BrowserAgent result to our CommandDetails format
        // 2. Store in cache with step description as key
        // 3. On next run, check cache before calling BrowserAgent
      } else {
        return {
          status: "failed",
          step,
          error: `Cannot execute step type '${step.type}' without commandDetails`,
          duration: Date.now() - startTime,
        };
      }

      return {
        status: "passed",
        step,
        usedAI: true, // Mark that AI was used
        duration: Date.now() - startTime,
        // TODO: Add generatedCommandDetails if caching is enabled
      };
    } catch (error) {
      return {
        status: "failed",
        step,
        error:
          error instanceof Error
            ? error.message
            : "Natural language execution failed",
        usedAI: true,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Substitutes variables in step commandDetails at execution time.
   * This preserves the original template in storage while using actual values during execution.
   * @param step - The step with potential variable placeholders
   * @returns A new step with variables substituted in commandDetails
   */
  private substituteVariablesInStep(step: ExecutableStep): ExecutableStep {
    // Deep clone the step to avoid mutating original
    const clonedStep = JSON.parse(JSON.stringify(step)) as ExecutableStep;

    if (!clonedStep.commandDetails) {
      return clonedStep;
    }

    // Substitute in url field
    if (clonedStep.commandDetails.url) {
      clonedStep.commandDetails.url = fillInVariables(
        clonedStep.commandDetails.url as string,
        this.variables,
      );
    }

    // Substitute in value field
    if (clonedStep.commandDetails.value) {
      clonedStep.commandDetails.value = fillInVariables(
        String(clonedStep.commandDetails.value),
        this.variables,
      );
    }

    // Substitute in selector field
    if (clonedStep.commandDetails.selector) {
      clonedStep.commandDetails.selector = fillInVariables(
        clonedStep.commandDetails.selector,
        this.variables,
      );
    }

    // Substitute in args array
    if (
      clonedStep.commandDetails.args &&
      Array.isArray(clonedStep.commandDetails.args)
    ) {
      clonedStep.commandDetails.args = clonedStep.commandDetails.args.map(
        (arg) =>
          typeof arg === "string" ? fillInVariables(arg, this.variables) : arg,
      );
    }

    return clonedStep;
  }

  /**
   * Smart wait function to intelligently wait for DOM to settle between step executions.
   * Uses CDP-based network monitoring to detect when the page is truly ready.
   */
  private async smartWait(): Promise<void> {
    await this.browserAgent.page._waitForSettledDom();
  }

  async executeMany(steps: ExecutableStep[]): Promise<StepResult[]> {
    const results: StepResult[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step) continue;

      const result = await this.execute(step);
      results.push(result);

      // Stop on first failure
      if (result.status === "failed") {
        break;
      }
    }

    return results;
  }
}
