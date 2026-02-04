import type { TestStep } from "../shared/index.js";

/**
 * What the executor accepts
 */
export type ExecutableStep = TestStep;

/**
 * Configuration for step execution
 */
export interface StepConfig {
  timeout?: number;
  [key: string]: unknown;
}

/**
 * Result of executing a single step
 */
export interface StepResult {
  status: "passed" | "failed" | "skipped";
  step: ExecutableStep;
  duration?: number;
  error?: string;
  usedAI?: boolean;
  usedCache?: boolean;
  generatedCommandDetails?: unknown;
  screenshot?: string;
  variables?: Record<string, unknown>;
}
