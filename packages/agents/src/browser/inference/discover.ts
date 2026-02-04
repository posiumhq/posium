/*
 * This module handles the LLM-based inference for discovering test objectives.
 * It uses the discovery prompts and tools to analyze page content and identify test scenarios.
 */

import type { LLMClient } from "../../llm/LLMClient.js";
import { AnnotatedScreenshotText } from "../../llm/LLMClient.js";
import {
  buildDiscoverySystemPrompt,
  buildDiscoveryUserPrompt,
} from "../prompts/discovery.js";
import type { Logger } from "@posium/observability";
import { z } from "zod";

/**
 * Represents a discovered test objective/scenario.
 */
export interface TestObjective {
  /** Short title of the test objective */
  title: string;
  /** Detailed description of what should be tested */
  description: string;
  /** Priority level of this test objective */
  priority: "high" | "medium" | "low";
  /** Category of the test (e.g., 'functionality', 'usability', 'performance') */
  category: string;
  /** Estimated complexity to implement the test */
  complexity: "simple" | "moderate" | "complex";
  /** UI elements relevant to this objective (selectors if available) */
  relevantElements?: string[];
  /** Whether this test is critical for core functionality */
  isCritical?: boolean;
}

/**
 * Options for configuring the discovery process.
 */
export interface DiscoveryOptions {
  /** Whether to use vision capabilities */
  useVision?: boolean;
  /** Specific areas of focus for the discovery (e.g., 'forms', 'navigation') */
  focusAreas?: string[];
  /** Minimum number of objectives to discover */
  minObjectives?: number;
  /** Maximum number of objectives to discover */
  maxObjectives?: number;
  /** Whether to include low-priority objectives */
  includeLowPriority?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Options for the discovery inference process.
 */
export interface DiscoveryInferenceOptions {
  /** The DOM content to analyze */
  domContent: string;
  /** Current page state information */
  pageState: { url: string; title: string };
  /** Optional screenshot data when vision is enabled */
  screenshot?: Buffer;
  /** Configuration options for discovery */
  options: Partial<DiscoveryOptions>;
  /** Logger instance for debugging and tracking */
  logger: Logger;
}

/**
 * Result from the discovery inference process.
 */
export interface DiscoveryInferenceResult {
  /** List of discovered test objectives */
  objectives: TestObjective[];
  /** General insights about the page from a testing perspective */
  pageInsights?: string;
}

/**
 * Schema for the test objectives output
 */
export const TestObjectiveSchema = z.object({
  objectives: z
    .array(
      z.object({
        title: z
          .string()
          .min(3)
          .max(100)
          .describe("Concise title of the test objective"),
        description: z
          .string()
          .min(10)
          .describe("Detailed description of what should be tested"),
        priority: z.enum(["high", "medium", "low"]).describe("Priority level"),
        category: z
          .string()
          .min(3)
          .describe("Testing category (e.g., functionality, usability)"),
        complexity: z
          .enum(["simple", "moderate", "complex"])
          .describe("Implementation complexity"),
        relevantElements: z
          .array(z.string())
          .optional()
          .describe("Relevant UI elements or selectors"),
        isCritical: z
          .boolean()
          .optional()
          .describe("Whether this test is critical for core functionality"),
      }),
    )
    .min(1)
    .describe("List of discovered test objectives"),
  pageInsights: z
    .string()
    .optional()
    .describe("General insights about the page from a testing perspective"),
});

// Type for the result of TestObjectiveSchema
export type TestObjectiveType = z.infer<typeof TestObjectiveSchema>;

/**
 * Uses LLM to discover potential test objectives based on page content.
 *
 * @param llmClient - The LLM client instance to use for inference
 * @param options - Configuration options for the inference process
 * @returns Promise resolving to the discovery result containing test objectives
 */
export async function discover(
  llmClient: LLMClient,
  options: DiscoveryInferenceOptions,
): Promise<DiscoveryInferenceResult> {
  try {
    // Use the generateStructuredObject method to get properly validated output
    const result = await llmClient.generateStructuredObject<TestObjectiveType>({
      messages: [
        buildDiscoverySystemPrompt(options.options),
        buildDiscoveryUserPrompt(
          options.domContent,
          options.pageState,
          options.options,
        ),
      ],
      schema: TestObjectiveSchema,
      temperature: 0.7,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      image: options.screenshot
        ? {
            buffer: options.screenshot,
            description: AnnotatedScreenshotText,
          }
        : undefined,
      requestId: Math.random().toString(36).substring(2, 15),
      model: "anthropic/claude-3.7-sonnet",
    });

    // Return the validated structured result
    return {
      objectives: result.objectives,
      pageInsights: result.pageInsights,
    };
  } catch (error) {
    options.logger.error({ err: error }, "Error during discovery inference");
    return { objectives: [] };
  }
}
