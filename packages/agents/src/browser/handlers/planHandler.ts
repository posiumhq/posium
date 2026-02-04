/*
 * This module implements the Planning Handler which is responsible for generating a sequence
 * of test steps (act/assert) spanning multiple pages. It uses DFS-based exploration,
 * LLM inference and smart backtracking to produce a valid plan.
 *
 * The planning process involves:
 * 1. Starting from the current page state
 * 2. Using LLM to analyze the page and determine possible next steps
 * 3. Validating proposed steps to ensure they're feasible
 * 4. Handling navigation between pages when needed
 * 5. Backtracking when a path leads to a dead end
 * 6. Managing state to avoid cycles and track progress
 *
 * The handler maintains a planning context that includes:
 * - Visited states to detect cycles
 * - DOM chunks processed for each state
 * - Step history for backtracking
 * - Exploration metrics (tries, depth, backtracks)
 */

import type { BrowserAgent } from "../BrowserAgent.js";
import type {
  PlanStep,
  PlanningState,
  PlanningConfig,
  PlanningOptions,
  PlanResult,
  PlanInferenceResult,
  PlanningSession,
  ExecutionResult,
} from "../types/plan.js";
import type { LLMClient } from "../../llm/LLMClient.js";
import { plan } from "../inference/plan.js";
import type { LoggerType } from "../types/logger.js";
import type { BrowserAgentPage } from "../BrowserAgentPage.js";
import { getAccessibilityTree } from "../utils/a11y.js";
import type { TreeResult } from "../types/context.js";
// import { emitThinking } from '../../thinking/globalEmitter.js'; // Import path for constructing file paths
import {
  stepHandlerRegistry,
  type IStepHandlerContext,
} from "../planner/step-handlers.js";
import {
  getStepTypeFromMethod,
  type StepMethod,
  type StepType,
} from "../../shared/index.js";

/**
 * Map AI inference method strings to StepMethod type.
 * This handles natural language methods from the LLM and converts them
 * to standardized method types that the frontend can understand.
 */
function mapInstructionToStepMethod(instruction: string): StepMethod {
  const lower = instruction.toLowerCase();

  if (lower.includes("click") || lower.includes("tap")) return "click";
  if (
    lower.includes("type") ||
    lower.includes("enter") ||
    lower.includes("input")
  )
    return "type";
  if (
    lower.includes("navigate") ||
    lower.includes("goto") ||
    lower.includes("go to")
  )
    return "goto";
  if (
    lower.includes("assert") ||
    lower.includes("verify") ||
    lower.includes("check")
  ) {
    // Determine specific assertion type based on keywords
    if (lower.includes("text") || lower.includes("contain"))
      return "toContainText";
    return "toBeVisible";
  }
  if (lower.includes("wait") || lower.includes("pause")) return "wait";

  // Default fallback: use type to determine method
  return instruction.includes("verify") || instruction.includes("should")
    ? "toBeVisible"
    : "click";
}

/**
 * Parameters required to initialize the Planning Handler.
 * These provide the core dependencies needed for planning functionality.
 */
export interface BrowserAgentPlanHandlerParams {
  /** Reference to parent BrowserAgent instance for page interactions */
  browserAgent: BrowserAgent;
  /** Logger instance for tracking the planning process */
  logger: LoggerType;
  /** Reference to parent BrowserAgentPage instance for page interactions */
  agentPage: BrowserAgentPage;
  /** LLM client for inferring next steps */
  llmClient: LLMClient;
}

export class BrowserAgentPlanHandler {
  private browserAgent: BrowserAgent;
  private logger: LoggerType;
  private agentPage: BrowserAgentPage;
  private llmClient: LLMClient;
  private stepHandlerContext: IStepHandlerContext;

  constructor(params: BrowserAgentPlanHandlerParams) {
    this.browserAgent = params.browserAgent;
    this.logger = params.logger;
    this.agentPage = params.agentPage;
    this.llmClient = params.llmClient;
    this.stepHandlerContext = {
      browserAgent: this.browserAgent,
      agentPage: this.agentPage,
      logger: this.logger,
      variables: {}, // This will be updated per call
      xpathMap: {}, // This will be updated when tree is generated
    };
  }

  /**
   * Generates a test plan for a given objective.
   * The plan consists of a sequence of act/assert steps that will achieve the objective.
   * This is the main entry point for planning functionality.
   *
   * @param objective - The high-level test objective to plan for
   * @param config - Optional configuration for the planning process
   * @returns A Promise that resolves to an array of PlanStep objects
   * @throws Error if planning fails to generate a valid plan
   */
  async plan(
    objective: string,
    config?: Partial<PlanningConfig> & { startingUrl?: string },
  ): Promise<PlanResult> {
    const defaultConfig: Partial<PlanningConfig> = {
      useVision: true,
      maxTries: 50,
      maxDepth: 40,
      maxBacktracks: 20,
      timeout: 3600000, // 1 hour timeout
      mode: "full",
    };

    const planningConfig = { ...defaultConfig, ...config } as PlanningConfig;

    // Create a new planning session for this run.
    // In an agentic future, this could be passed in.
    const session: PlanningSession = {
      stateHistory: [],
      variables: planningConfig.variables || {},
    };

    let explorationSuccess = false;
    let explorationMessage =
      "Exploration finished without reaching the objective.";

    // Ephemeral execution state for the loop
    let numTries = 0;
    const startTime = Date.now();

    this.logger.info("Starting exploration loop");
    // Main exploration loop
    while (true) {
      // 1. Check limits
      if (
        planningConfig.mode === "full" &&
        (numTries >= planningConfig.maxTries ||
          session.stateHistory.length >= planningConfig.maxDepth ||
          Date.now() - startTime > (planningConfig.timeout || 60000))
      ) {
        this.logger.warn(
          {
            tries: numTries,
            depth: session.stateHistory.length,
            elapsed: Date.now() - startTime,
          },
          "Exploration limits reached",
        );
        explorationMessage = "Exploration limits reached.";
        break;
      }

      numTries++;

      // Update the context with the latest variables for this iteration
      // Convert unknown values to strings for variable substitution
      const stringVariables = Object.fromEntries(
        Object.entries(session.variables).map(([k, v]) => [k, String(v)]),
      );
      this.stepHandlerContext.variables = stringVariables;
      const currentOptions: PlanningOptions = {
        ...planningConfig,
        objective,
        verifierUseVision: false,
        variables: stringVariables, // Pass the most up-to-date variables
      };

      const inferenceResult = await this.getNextInference(
        session,
        currentOptions,
      );

      if (!inferenceResult || inferenceResult.type === "fail") {
        const failArgs = inferenceResult?.args as
          | { reason?: string }
          | undefined;
        this.logger.error(
          { reason: failArgs?.reason },
          "Failed to determine a valid next step. Stopping exploration.",
        );
        explorationMessage =
          failArgs?.reason || "Failed to determine a valid next step.";
        break;
      }

      // Create the PlanningState for this iteration
      if (inferenceResult.description) {
        //emitThinking(this.browserAgent.toolCallId, 'PlanHandler', inferenceResult.description);
      }
      const nextState: PlanningState = {
        inference: inferenceResult,
      };

      // 3. Perform and validate the step
      const result = await this.performAndValidateStep(
        currentOptions,
        nextState,
      );
      if (!result.success) {
        this.logger.warn("Step validation failed. Stopping exploration.");
        explorationMessage = "Step validation failed.";
        break;
      }

      // Merge any new variables discovered during execution
      if (result.newVariables) {
        session.variables = { ...session.variables, ...result.newVariables };
        nextState.newVariables = result.newVariables;
      }

      // 4. Update context and check for completion
      session.stateHistory.push(nextState);

      if (
        nextState.inference.isLastStep &&
        (nextState.inference.confidence ?? 0) >= 0.8
      ) {
        this.logger.info("Objective achieved. Ending exploration.");
        explorationSuccess = true;
        explorationMessage = "Objective achieved.";
        break;
      }

      if (planningConfig.mode === "step-add") {
        this.logger.info("Step-add mode: ending exploration after one step.");
        explorationSuccess = true;
        explorationMessage = "Step added successfully.";
        break;
      }
    }

    // Clean up the steps we have so far, regardless of whether the plan was fully successful
    const steps = this.cleanupPath(session.stateHistory);

    if (!explorationSuccess) {
      // Return partial results even when the planning process fails
      this.logger.info(
        {
          numSteps: steps.length,
          reason: explorationMessage,
          steps,
        },
        "Planning did not fully complete, returning partial steps",
      );

      // For partial results (failure case), playwrightCode is not included in type
      return {
        steps,
        success: false,
        message:
          steps.length > 1
            ? `Partial plan generated with ${steps.length} steps. ${explorationMessage}`
            : `Failed to generate any valid plan steps. ${explorationMessage}`,
      };
    }

    return {
      steps,
      success: true,
      message: explorationMessage,
    };
  }

  /**
   * Uses LLM to determine the next step in the plan based on current state and objective.
   *
   * This method:
   * 1. Gets a screenshot if vision is enabled
   * 2. Calls the plan inference module to get LLM response
   * 3. Parses the response into a structured format
   *
   * The process involves:
   * - Analyzing the current DOM state
   * - Considering previous steps and context
   * - Using vision capabilities when enabled
   * - Handling selector mappings for elements
   *
   * @param session - Current planning session with history and state
   * @param options - Planning options including objective and vision settings
   * @returns Promise resolving to the next planning state or null if no valid step found
   */
  private async getNextInference(
    session: PlanningSession,
    options: PlanningOptions,
  ): Promise<PlanInferenceResult | null> {
    const MAX_RETRIES = 3;
    let retryCount = 0;
    // this.stepHandlerContext.variables = options.variables || {}; // This is now set in the main loop

    while (retryCount < MAX_RETRIES) {
      try {
        await this.agentPage._waitForSettledDom();
        const accessibilityTree: TreeResult | undefined =
          await getAccessibilityTree(false, this.agentPage, (log) => {
            if (log.level === 0) {
              this.logger.debug(log.auxiliary ?? {}, log.message);
            } else {
              this.logger.info(log.auxiliary ?? {}, log.message);
            }
          });

        // Update the xpath map in context
        if (accessibilityTree?.xpathMap) {
          this.stepHandlerContext.xpathMap = accessibilityTree.xpathMap;
        }

        // Convert unknown values to strings for variable substitution
        const planVariables = Object.fromEntries(
          Object.entries(session.variables).map(([k, v]) => [k, String(v)]),
        );
        const response = await plan(this.llmClient, {
          objective: options.objective,
          previousSteps: session.stateHistory,
          variables: planVariables,
          useVision: false, // Vision no longer supported
          logger: this.logger,
          accessibilityTree,
        });

        // Parse the LLM response
        const toolCalls = response.toolCalls;
        if (!toolCalls || toolCalls.length === 0) {
          this.logger.error("No tool calls found in response");
          retryCount++;
          continue;
        }

        const toolCall = toolCalls[0];
        if (!toolCall) {
          this.logger.error("First tool call is undefined");
          retryCount++;
          continue;
        }
        const handler = stepHandlerRegistry[toolCall.toolName];

        let result: PlanInferenceResult | null;

        if (handler) {
          result = await handler.parse(
            toolCall,
            this.stepHandlerContext,
            toolCall.toolName,
          );
        } else {
          // Fallback for any unhandled tools
          this.logger.error({ toolCall }, "Unsupported tool call");
          result = null;
        }

        if (!result) {
          retryCount++;
          this.logger.warn(
            `Retrying after unsupported tool call. Attempt ${retryCount} of ${MAX_RETRIES}`,
          );
          continue;
        }

        // Return the raw inference result
        return result;
      } catch (error) {
        this.logger.error({ err: error }, "Error determining next step");
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          this.logger.warn(
            `Retrying after error. Attempt ${retryCount} of ${MAX_RETRIES}`,
          );
          continue;
        }
      }
    }

    this.logger.error(
      `Failed to determine next step after ${MAX_RETRIES} attempts`,
    );
    return null;
  }

  /**
   * Executes a proposed step to ensure it's feasible
   * @param options - Planning options including objective and vision settings
   * @param state - The planning state to validate
   * @returns Promise resolving to boolean indicating if step is valid
   */
  private async performAndValidateStep(
    options: PlanningOptions,
    state: PlanningState,
  ): Promise<ExecutionResult> {
    if (!state.inference) {
      this.logger.error(
        "performAndValidateStep called with invalid state (no inference)",
      );
      return { success: false };
    }

    const handler = stepHandlerRegistry[state.inference.type];

    if (handler) {
      const res = await handler.execute(
        state,
        options,
        this.stepHandlerContext,
      );
      return res;
    }

    // Fallback for unhandled step types
    this.logger.warn({ type: state.inference.type }, "Unsupported step type");
    return { success: false };
  }

  /**
   * Cleans up the internal planning states to produce a final sequence of steps.
   * Removes internal planning states and normalizes the step format.
   *
   * Derives both type and instruction fields:
   * - instruction: The specific action (click, input, navigate, etc.)
   * - type: The category derived from instruction (act, assert, wait)
   * - id: Generated using crypto.randomUUID() for frontend compatibility
   *
   * @param steps - Array of planning states to clean up
   * @returns Array of clean PlanStep objects ready for execution
   */
  private cleanupPath(steps: PlanningState[]): PlanStep[] {
    // Remove any internal planning states and convert to PlanStep format
    return steps
      .filter(
        (state) =>
          state.inference.type !== "goBack" &&
          state.inference.type !== "skipSection" &&
          state.inference.type !== "fail" &&
          state.inference.type !== "wait",
      )
      .map((state) => {
        // Get the raw instruction from AI inference
        const rawInstruction =
          "instruction" in state.inference && state.inference.instruction
            ? state.inference.instruction
            : state.inference.type;

        // Map to StepMethod type
        const method = rawInstruction as StepMethod;

        // Derive type from method
        const type = getStepTypeFromMethod(method);

        return {
          id: crypto.randomUUID(), // Required by TestStep interface
          type,
          method,
          methodLocked: false, // AI-generated steps are not locked
          description: state.inference.description ?? "",
          isLastStep: state.inference.isLastStep ?? false,
          command: state.command,
          conditional: state.inference.conditional ?? false,
          newVariables: state.newVariables,
        };
      });
  }
}
