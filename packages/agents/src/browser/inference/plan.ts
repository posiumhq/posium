/*
 * This module handles the LLM-based inference for planning steps.
 * It builds prompts from the current planning context and options and sends them to the LLM.
 */

import type { TreeResult } from "../types/context.js";
import type { LLMClient } from "../../llm/LLMClient.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
  planTools,
} from "../prompts/plan.js";
import type { Logger } from "@posium/observability";
import type { PlanningState } from "../types/plan.js";
/* import path from 'path';
import os from 'os';
import fs from 'fs';
import { randomUUID } from 'crypto'; */
/**
 * Options for the plan inference process.
 */
export interface PlanInferenceOptions {
  /** The high-level test objective to achieve */
  objective: string;
  /** The current DOM content to analyze */
  domContent?: string;
  /** Description of steps taken so far */
  previousSteps: PlanningState[];
  /** Current page state information */
  pageState?: { url: string; title: string };
  /** Optional variables that can be used in the plan */
  variables?: Record<string, string>;
  /** Whether to use vision capabilities - deprecated, always false */
  useVision?: boolean | "fallback";
  /** Logger instance for debugging and tracking */
  logger: Logger;
  /** Optional accessibility tree data */
  accessibilityTree?: TreeResult;
}

/**
 * Uses LLM to determine the next step in the plan based on current state and objective.
 *
 * @param llmClient - The LLM client instance to use for inference
 * @param options - Configuration options for the inference process
 * @returns Promise resolving to the LLM response
 */
export async function plan(
  llmClient: LLMClient,
  options: PlanInferenceOptions,
) {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({
    objective: options.objective,
    currentDom: options.domContent,
    previousSteps: options.previousSteps,
    variables: options.variables || {},
    accessibilityTree: options.accessibilityTree,
  });

  const response = await llmClient.createChatCompletion<unknown>({
    model: "google/gemini-3-flash-preview",
    messages: [systemPrompt, userPrompt],
    temperature: 0.1,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    tool_choice: "auto" as const,
    tools: planTools,
    requestId: Math.random().toString(36).substring(2, 15),
    use_native_tool_calls: false,
  });

  // Handle wait tool response
  if (response.toolCalls?.[0]?.toolName === "wait") {
    const args = response.toolCalls[0].args as { duration?: number };
    await new Promise((resolve) => setTimeout(resolve, args.duration || 5000));
  }

  return response;
}
