import { z } from "zod";
import { type LLMClient } from "../../llm/LLMClient.js";
import type { Logger } from "@posium/observability";

export interface AssertParams {
  instruction: string;
  domElements: string;
  llmClient: LLMClient;
  logger: Logger;
  requestId: string;
  variables?: Record<string, string>;
}

export const AssertSchema = z.object({
  method: z.string(),
  element: z.string(), // Changed to string for EncodedId
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  completed: z.boolean(),
  step: z.string(),
  why: z.string().optional(),
  xpath: z.string().optional(),
});

export type AssertInference = z.infer<typeof AssertSchema>;
