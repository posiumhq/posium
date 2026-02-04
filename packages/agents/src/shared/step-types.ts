/**
 * Step Type Re-exports
 *
 * Re-exports all step types from @posium/types for backward compatibility.
 * @posium/types is the single source of truth for step definitions.
 */

export {
  // TypeScript types
  type StepType,
  type StepMethod,
  type SelectorType,
  type CommandDetails,
  type StepStatus,
  type TestStep,

  // Zod schemas
  stepTypeSchema,
  stepMethodSchema,
  selectorTypeSchema,
  commandDetailsSchema,
  stepStatusSchema,
  testStepSchema,

  // Helper functions
  getStepTypeFromMethod,
  isModuleRef,
  generateStepId,
} from "@posium/types";
