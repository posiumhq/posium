/**
 * Shared Step Type Definitions
 *
 * This package is the single source of truth for step-related types used across:
 * - Database storage (@posium/db)
 * - Step execution (@posium/agents)
 * - API boundaries (@posium/core)
 * - UI components (apps/console)
 */

import { z } from "zod";

// Step type represents the category/kind of step
export type StepType =
  | "act"
  | "assert"
  | "goto"
  | "wait"
  | "moduleRef";

// Step method represents the specific action to perform (Playwright-aligned)
export type StepMethod =
  | "click"
  | "type" // Renamed from 'input' to match Playwright
  | "goto" // Renamed from 'navigate' to match Playwright
  | "toBeVisible" // Specific assertion - replaces generic 'assert'
  | "toContainText" // Specific assertion - replaces generic 'assert'
  | "aiCheck" // AI-powered visual check with natural language prompt
  | "wait"
  | "moduleRef" // Reference to a reusable module
  | "aiExtract"; // AI-powered extraction from page or text

/**
 * Type of selector to use for element identification
 */
export type SelectorType =
  | "xpath"
  | "css"
  | "natural"
  | "getByRole"
  | "getByText"
  | "getByLabel"
  | "getByPlaceholder"
  | "getByTestId"
  | "getByAltText"
  | "getByTitle";

/**
 * Command execution details - contains all information needed to execute a step.
 * This structure is used by the executor and AI planning, keeping execution logic
 * decoupled from UI representation.
 */
export interface CommandDetails {
  // Selector information
  selector?: string; // Can be xpath, css, or natural language description
  xpath?: string; // XPath selector (from AI generation)
  selectorType?: SelectorType;

  // Value information
  value?: unknown; // Input value, assertion expected value, etc.
  valueType?: "literal" | "natural" | "variable"; // How to interpret the value

  // Navigation
  url?: string; // For navigate steps

  // Generic arguments (for complex commands)
  args?: unknown[]; // Additional arguments like wait duration, role options, etc.

  // Execution configuration - stored directly in commandDetails
  timeout?: number; // Custom timeout for this step
  waitBefore?: number; // Wait X ms before executing
  waitAfter?: number; // Wait X ms after executing
  waitForStable?: boolean; // Wait for DOM to stabilize before executing
  clearBefore?: boolean; // Clear input field before typing (for input steps)
  forceClick?: boolean; // Force click even if element is covered
  screenshotBefore?: boolean; // Take screenshot before execution
  screenshotAfter?: boolean; // Take screenshot after execution
  scrollIntoView?: boolean; // Scroll element into view before interaction
  partialMatch?: boolean; // For assertions - partial vs exact match
  caseSensitive?: boolean; // For assertions - case sensitive comparison
  disableCaching?: boolean; // Disable caching for natural language selector resolution

  // Module reference information
  moduleId?: string; // For moduleRef steps - ID of the module to execute
  moduleName?: string; // For moduleRef steps - Name of the module for display

  // Extensible for future needs
  [key: string]: unknown;
}

/**
 * Unified status vocabulary for step execution results.
 * Used consistently across executor results, editor UI, and run display.
 */
export type StepStatus = "pending" | "running" | "passed" | "failed" | "skipped";

/**
 * Base step definition - what gets STORED in the database.
 * Contains no status field (status is a result, not part of the definition).
 * UI types (EditorStep, RunStep) extend this with their specific needs.
 *
 * Used by: Test Editor, Step Executor, AI Planning, DB Storage
 */
export interface TestStep {
  id: string;
  type?: StepType; // Optional - can be derived from method via getStepTypeFromMethod()
  method: StepMethod; // Specific action: click, type, goto, etc.
  description: string;

  // Instruction control
  methodLocked?: boolean; // When true, instruction cannot be changed by AI (user-defined)

  // Execution control
  skip?: boolean;

  // Execution details - contains all info needed to run the step
  commandDetails?: CommandDetails;
}

// Zod enums matching TypeScript types
export const stepTypeSchema = z.enum([
  "act",
  "assert",
  "goto",
  "wait",
  "moduleRef",
]);

export const stepMethodSchema = z.enum([
  "click",
  "type",
  "goto",
  "toBeVisible",
  "toContainText",
  "aiCheck",
  "wait",
  "moduleRef",
  "aiExtract",
]);

export const selectorTypeSchema = z.enum([
  "xpath",
  "css",
  "natural",
  "getByRole",
  "getByText",
  "getByLabel",
  "getByPlaceholder",
  "getByTestId",
  "getByAltText",
  "getByTitle",
]);

// Zod schema for CommandDetails
export const commandDetailsSchema = z
  .object({
    // Selector information
    selector: z.string().optional(),
    xpath: z.string().optional(),
    selectorType: selectorTypeSchema.optional(),

    // Value information
    value: z.any().optional(),
    valueType: z.enum(["literal", "natural", "variable"]).optional(),

    // Navigation
    url: z.string().optional(),

    // Arguments
    args: z.array(z.any()).optional(),

    // Execution configuration
    timeout: z.number().optional(),
    waitBefore: z.number().optional(),
    waitAfter: z.number().optional(),
    waitForStable: z.boolean().optional(),
    clearBefore: z.boolean().optional(),
    forceClick: z.boolean().optional(),
    screenshotBefore: z.boolean().optional(),
    screenshotAfter: z.boolean().optional(),
    scrollIntoView: z.boolean().optional(),
    partialMatch: z.boolean().optional(),
    caseSensitive: z.boolean().optional(),
    disableCaching: z.boolean().optional(),

    // Module reference information
    moduleId: z.string().optional(),
    moduleName: z.string().optional(),
  })
  .passthrough(); // Allow additional fields

// Zod schema for StepStatus
export const stepStatusSchema = z.enum([
  "pending",
  "running",
  "passed",
  "failed",
  "skipped",
]);

// Zod schema for TestStep - the base step definition (no status)
export const testStepSchema = z.object({
  id: z.string(),
  type: stepTypeSchema.optional(), // Optional - derived from method
  method: stepMethodSchema,
  description: z.string(),
  methodLocked: z.boolean().optional(),
  skip: z.boolean().optional(),
  commandDetails: commandDetailsSchema.optional(),
});

/**
 * Helper function to determine step type category from method
 * Maps specific methods to their corresponding type categories
 */
export function getStepTypeFromMethod(method: StepMethod): StepType {
  if (
    method === "toBeVisible" ||
    method === "toContainText" ||
    method === "aiCheck"
  )
    return "assert";
  if (method === "wait") return "wait";
  if (method === "goto") return "goto";
  if (method === "moduleRef") return "moduleRef";
  // All interaction methods map to 'act'
  return "act"; // click, type
}

/**
 * Helper function to check if a step type is a module reference
 */
export function isModuleRef(type: string): boolean {
  return type === "moduleRef";
}

/**
 * Generate a unique step ID
 */
export function generateStepId(): string {
  return `step_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
