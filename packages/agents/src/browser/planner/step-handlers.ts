/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  PlanningState,
  PlanningOptions,
  PlanInferenceResult,
  CommandResult,
  ExecutionResult,
} from "../types/plan.js";
import type { LoggerType } from "../types/logger.js";
import type { EncodedId } from "../types/context.js";
import { fillInVariables } from "../inference/fillInVariables.js";
import assert from "assert";

/**
 * Defines the context required by step handlers to perform their actions.
 * This object provides access to the necessary parts of the main PlanHandler instance
 * without creating circular dependencies.
 */
export interface IStepHandlerContext {
  browserAgent: unknown;
  agentPage: unknown;
  logger: LoggerType;
  variables: Record<string, unknown>;
  xpathMap: Record<EncodedId, string>;
}

/**
 * Defines the contract for all step handlers.
 * Each handler is responsible for parsing the LLM tool call and executing the step.
 */
export interface IStepHandler {
  /**
   * Parses the raw LLM tool call into a structured PlanInferenceResult.
   * This step includes "enhancing" the result, e.g., by resolving element IDs to XPaths.
   * @param toolCall - The raw tool call from the LLM.
   * @param context - The context object providing access to necessary utilities.
   * @param toolName - The name of the tool being parsed.
   * @returns A Promise that resolves to a PlanInferenceResult or null if parsing fails.
   */
  parse(
    toolCall: { args: unknown },
    context: IStepHandlerContext,
    toolName: string,
  ): Promise<PlanInferenceResult | null>;

  /**
   * Executes a planned step and validates its outcome.
   * @param state - The planning state for the current step, containing the inferenceResult.
   * @param options - The overall planning options.
   * @param context - The context object providing access to necessary utilities.
   * @returns A Promise that resolves to a ExecutionResult indicating if the step was successful.
   */
  execute(
    state: PlanningState,
    options: PlanningOptions,
    context: IStepHandlerContext,
  ): Promise<ExecutionResult>;
}

// Handler for the 'goto' tool.
const gotoHandler: IStepHandler = {
  async parse(
    toolCall,
    _context,
    toolName,
  ): Promise<PlanInferenceResult | null> {
    const params = toolCall.args as Record<string, unknown>;
    return {
      type: "goto",
      description: params.description as string,
      isLastStep: false,
      confidence: 1.0,
      conditional: false,
      args: {
        url: params.url as string,
      },
    };
  },
  async execute(state, options, context) {
    if (state.inference.type !== "goto") return { success: false };

    const { logger, browserAgent, variables } = context;
    const { url: urlTemplate } = state.inference.args as { url: string };
    const description = state.inference.description;
    assert(urlTemplate, "URL is required for goto");

    // Substitute variables for execution only, preserve template for storage
    const url = fillInVariables(
      urlTemplate,
      (variables as Record<string, string>) || {},
    );
    logger.info({ template: urlTemplate, resolved: url }, "goto tool call");

    try {
      await (browserAgent as any).page.goto(url);
      await (browserAgent as any).page.waitForLoadState("domcontentloaded");

      state.inference.description = description;
      // Store the TEMPLATE (with {{VAR}}), not the substituted value
      state.command = {
        success: true,
        message: `Successfully navigated to ${url}`,
        action: "goto",
        commandDetails: {
          method: "goto",
          url: urlTemplate, // Store template, not substituted value
          args: [urlTemplate], // Store template, not substituted value
        },
      };
      return { success: true };
    } catch (error) {
      logger.error(
        { template: urlTemplate, resolved: url, err: error },
        "goto navigation failed",
      );
      // Store the TEMPLATE even on failure
      state.command = {
        success: false,
        message: `Failed to navigate to ${url}: ${error instanceof Error ? error.message : "Unknown error"}`,
        action: "goto",
        commandDetails: {
          method: "goto",
          url: urlTemplate, // Store template, not substituted value
          args: [urlTemplate], // Store template, not substituted value
        },
      };
      return { success: false };
    }
  },
};

// Handler for the 'act' tool.
const actHandler: IStepHandler = {
  async parse(
    toolCall,
    context,
    toolName,
  ): Promise<PlanInferenceResult | null> {
    const params = toolCall.args as Record<string, unknown>;
    const { logger, xpathMap } = context;

    // Look up XPath directly from the map using the EncodedId
    const xpath = xpathMap[params.elementId as EncodedId];

    if (!xpath) {
      logger.error(
        { category: "plan", elementId: params.elementId },
        "No xpath found for element",
      );
      return null;
    }

    return {
      type: "act",
      instruction: params.instruction as string,
      description: params.description as string,
      isLastStep: params.isLastStep as boolean,
      confidence: params.confidence as number,
      conditional: params.conditional as boolean,
      args: {
        elementId: params.elementId as string,
        xpath: xpath,
        actionArgs: params.args
          ? Array.isArray(params.args)
            ? params.args
            : [params.args]
          : undefined,
      },
    };
  },
  async execute(state, options, context) {
    if (state.inference.type !== "act") return { success: false };

    const { logger, agentPage, variables } = context;
    const actResult = await (agentPage as any).act({
      action: state.inference.description!,
      planResult: state.inference,
      variables: variables,
    });

    state.command = actResult as CommandResult;

    if (!actResult.success) {
      logger.warn(
        { description: state.inference.description, message: actResult.message },
        "Act validation failed",
      );
      return { success: false };
    }

    logger.info(
      {
        description: state.inference.description,
        action: actResult.action,
        commandDetails: actResult.commandDetails
          ? { method: actResult.commandDetails.method }
          : "No command details",
      },
      "Act validation succeeded",
    );

    return { success: true };
  },
};

// Handler for the 'assert' tool.
const assertHandler: IStepHandler = {
  async parse(
    toolCall,
    context,
    toolName,
  ): Promise<PlanInferenceResult | null> {
    const params = toolCall.args as Record<string, unknown>;
    const { logger, xpathMap } = context;

    // Look up XPath directly from the map using the EncodedId
    const xpath = xpathMap[params.elementId as EncodedId];

    if (!xpath) {
      logger.error(
        { category: "plan", elementId: params.elementId },
        "No xpath found for element",
      );
      return null;
    }

    return {
      type: "assert",
      instruction: params.instruction as string,
      description: params.description as string,
      isLastStep: params.isLastStep as boolean,
      confidence: params.confidence as number,
      conditional: params.conditional as boolean,
      args: {
        elementId: params.elementId as string,
        xpath: xpath,
        value: params.value as string,
      },
    };
  },
  async execute(state, _options, context) {
    if (state.inference.type !== "assert") return { success: false };

    const { logger, agentPage, variables } = context;
    const assertResult = await (agentPage as any).assert({
      assertion: state.inference.description!,
      planResult: state.inference,
      variables: variables,
    });

    state.command = assertResult as CommandResult;

    if (!assertResult.success) {
      logger.warn(
        { description: state.inference.description, message: assertResult.message },
        "Assert validation failed",
      );
      return { success: false };
    }

    logger.info(
      {
        description: state.inference.description,
        action: assertResult.action,
        commandDetails: assertResult.commandDetails
          ? { method: assertResult.commandDetails.method }
          : "No command details",
      },
      "Assert validation succeeded",
    );

    return { success: true };
  },
};

// Handler for simple state-changing tools that don't execute directly.
const stateChangeHandler: IStepHandler = {
  async parse(
    toolCall,
    _context,
    toolName,
  ): Promise<PlanInferenceResult | null> {
    const { args } = toolCall;
    return {
      type: toolName as "goBack" | "skipSection",
      args: { reason: (args as Record<string, unknown>).reason as string },
    };
  },
  async execute(state, _options, context) {
    if (
      state.inference.type !== "goBack" &&
      state.inference.type !== "skipSection"
    ) {
      return { success: false };
    }
    // These steps are handled by the main exploration loop based on their type.
    // They don't have a direct execution action.
    context.logger.info(
      { reason: (state.inference.args as { reason: string }).reason },
      `Executing a state change step: ${state.inference.type}`,
    );
    return { success: false }; // Return false as no direct action was taken.
  },
};

// Handler for the 'fail' tool.
const failHandler: IStepHandler = {
  async parse(toolCall, _context): Promise<PlanInferenceResult | null> {
    const args = toolCall.args as Record<string, unknown>;
    return {
      type: "fail",
      description: args.description as string,
      args: {
        reason: args.description as string,
      },
    };
  },
  async execute(state, _options, context) {
    if (state.inference.type !== "fail") return { success: false };
    // The 'fail' tool is a terminal action handled by the main exploration loop.
    // It doesn't have a direct execution, so we log it and return false.
    context.logger.error(
      { reason: (state.inference.args as { reason: string }).reason },
      'Executing a "fail" step',
    );
    return { success: false };
  },
};

// Handler for the 'wait' tool.
const waitHandler: IStepHandler = {
  async parse(
    toolCall,
    _context,
    toolName,
  ): Promise<PlanInferenceResult | null> {
    const params = toolCall.args as Record<string, unknown>;
    return {
      type: "wait",
      instruction: "wait",
      description: params.description as string,
      isLastStep: false,
      confidence: 1.0,
      conditional: false,
      args: {
        duration: params.duration as number,
      },
    };
  },
  async execute(state, options, context) {
    if (state.inference.type !== "wait") return { success: false };

    const { logger } = context;
    const { duration } = state.inference.args as { duration: number };
    const waitDuration = duration || 5000;

    logger.info(
      { duration: waitDuration, description: state.inference.description },
      "wait tool call",
    );

    await new Promise((resolve) => setTimeout(resolve, waitDuration));

    state.command = {
      success: true,
      message: `Successfully waited for ${waitDuration}ms`,
      action: "wait",
      commandDetails: {
        method: "wait",
        args: [waitDuration],
      },
    };
    return { success: true };
  },
};

// Handler for the 'aiCheck' tool.
const aiCheckHandler: IStepHandler = {
  async parse(
    toolCall,
    context,
    toolName,
  ): Promise<PlanInferenceResult | null> {
    const params = toolCall.args as Record<string, unknown>;
    return {
      type: "aiCheck",
      instruction: "aiCheck",
      description: params.description as string,
      isLastStep: params.isLastStep as boolean,
      confidence: params.confidence as number,
      conditional: false,
      args: {
        prompt: params.prompt as string,
      },
    };
  },
  async execute(state, _options, context) {
    if (state.inference.type !== "aiCheck") return { success: false };

    const { logger, agentPage } = context;
    const aiCheckResult = await (agentPage as any).aiCheck({
      prompt: (state.inference.args as { prompt: string }).prompt,
    });

    state.command = {
      success: aiCheckResult.success,
      message: aiCheckResult.message,
      action: "aiCheck",
      commandDetails: {
        method: "aiCheck",
        prompt: (state.inference.args as { prompt: string }).prompt,
        ...(aiCheckResult.commandDetails || {}),
      },
    };

    if (!aiCheckResult.success) {
      logger.warn(
        { description: state.inference.description, message: aiCheckResult.message },
        "AI check validation failed",
      );
      return { success: false };
    }

    logger.info(
      { description: state.inference.description, action: aiCheckResult.action },
      "AI check validation succeeded",
    );

    return { success: true };
  },
};

/**
 * A registry mapping tool names to their corresponding handler implementations.
 * This allows the main PlanHandler to delegate parsing and execution tasks
 * to specialized handlers for each tool type.
 */
export const stepHandlerRegistry: Record<string, IStepHandler> = {
  goto: gotoHandler,
  fail: failHandler,
  act: actHandler,
  assert: assertHandler,
  aiCheck: aiCheckHandler,
  goBack: stateChangeHandler,
  skipSection: stateChangeHandler,
  wait: waitHandler,
};
