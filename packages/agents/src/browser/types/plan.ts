/**
 * Type definitions for the planning functionality.
 * These types are used by the planning handler to generate and manage test plans.
 */

import type { AvailableModel } from "./model.js";
import type {
  TestStep,
  CommandDetails,
  SelectorType,
} from "../../shared/index.js";

export type GotoResult = {
  success: boolean;
  message: string;
  action: string;
  commandDetails: {
    method: string;
    url: string;
    args: unknown[];
  };
};

/**
 * Represents a command result for a step in the plan.
 * This can be either an ActResult, AssertResult, or GotoResult.
 */
export type CommandResult = {
  success: boolean;
  message: string;
  action:
    | "act"
    | "assert"
    | "goto"
    | "fail"
    | "wait"
    | "aiCheck"
    | "extract"
    | "unsupported";
  commandDetails?: CommandDetails;
};

/**
 * A union of all valid tool names that can be used in a plan.
 */
export type ToolType =
  | "act"
  | "assert"
  | "aiCheck"
  | "goto"
  | "fail"
  | "goBack"
  | "skipSection"
  | "wait"
  | "aiExtract";

// Represents the final step that will be executed (either an action or an assertion)
// Extends TestStep with AI-specific planning fields
export interface PlanStep extends TestStep {
  // type and method are inherited from TestStep
  // type: 'act' | 'assert' | 'goto' | 'wait'
  // method: 'click' | 'input' | 'navigate' | etc.
  isLastStep: boolean; // Whether this is the final step in the plan
  command?: CommandResult; // Command executed for this step
  conditional: boolean; // Whether this step is conditional i..e, always needed or not
  newVariables?: Record<string, unknown>; // New variables discovered during execution
}

// Base interface for all inference results, containing common properties
interface BasePlanInferenceResult {
  type: ToolType;
  description?: string;
  isLastStep?: boolean;
  confidence?: number;
  conditional?: boolean;
}

// Specific inference result types for each tool
export interface GotoInferenceResult extends BasePlanInferenceResult {
  type: "goto";
  args: {
    url: string;
  };
}

export interface ActInferenceResult extends BasePlanInferenceResult {
  type: "act";
  instruction: string;
  args: {
    elementId: string;
    xpath: string;
    actionArgs?: unknown[];
  };
}

export interface AssertInferenceResult extends BasePlanInferenceResult {
  type: "assert";
  instruction: string;
  args: {
    elementId: string;
    xpath: string;
    value?: unknown;
  };
}

export interface AiCheckInferenceResult extends BasePlanInferenceResult {
  type: "aiCheck";
  instruction: "aiCheck";
  args: {
    prompt: string;
  };
}

export interface FailInferenceResult extends BasePlanInferenceResult {
  type: "fail";
  args: {
    reason: string;
  };
}

export interface StateChangeInferenceResult extends BasePlanInferenceResult {
  type: "goBack" | "skipSection";
  args: {
    reason: string;
  };
}

/**
 * Result from the plan inference process using a discriminated union.
 * Represents the LLM's decision about what action to take next.
 */
export type PlanInferenceResult = {
  type: ToolType;
  description?: string;
  isLastStep?: boolean;
  confidence?: number;
  conditional?: boolean;
  instruction?: string;
  args?: unknown;
};

// Configuration limits for the planning exploration process
export interface PlanningConfig {
  useVision: boolean; // Whether to enable vision-based processing
  model: AvailableModel; // The model to use for planning
  maxTries: number; // Maximum number of exploration attempts
  maxDepth: number; // Maximum depth to explore
  maxBacktracks: number; // Maximum number of allowed backtracks
  timeout?: number; // Optional timeout in milliseconds
  variables?: Record<string, string>; // Optional dataset variables
  startingUrl: string; // starting URL for the planning
  mode?: "full" | "step-add"; // The planning mode
  initialSteps?: PlanStep[]; // Initial steps to start with
}

// Extended planning options including vision support and test objective
export interface PlanningOptions extends PlanningConfig {
  verifierUseVision: boolean; // Flag to use vision for verification of steps
  objective: string; // High-level test objective guiding the planning
  variables?: Record<string, string>; // Optional dataset variables
}

/**
 * Holds the state for a single, stateful planning session.
 * This could be persisted and rehydrated for long-running agentic tasks.
 */
export interface PlanningSession {
  // A complete history of every internal state the planner went through.
  stateHistory: PlanningState[];

  // Variables discovered and accumulated during the session (e.g., from an email).
  variables: Record<string, unknown>;
}

/**
 * Represents the outcome of a step's execution.
 */
export interface ExecutionResult {
  success: boolean;
  newVariables?: Record<string, unknown>; // Optional: for new variables discovered
}

export type PlanResult =
  | {
      steps: PlanStep[];
      success: true;
      message: string;
    }
  | {
      steps: PlanStep[];
      success: false;
      message: string;
    };

/**
 * Represents the internal state for a single step in the planner's history.
 * It contains the planner's decision ('inference') and the result of
 * executing that decision ('command').
 */
export interface PlanningState {
  // The decision made by the planner for this step.
  inference: PlanInferenceResult;
  // New variables discovered during execution
  newVariables?: Record<string, unknown>;
  // The result of executing the decision. Populated after validation.
  command?: CommandResult;
}

// Re-export SelectorType for convenience
export type { SelectorType };
