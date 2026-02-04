import { type LLMClient } from "../../llm/LLMClient.js";
import type { Logger } from "@posium/observability";
import { z } from "zod";

export interface ActParams {
  action: string;
  steps?: string;
  domElements: string;
  llmClient: LLMClient;
  retries?: number;
  logger: Logger;
  requestId: string;
  variables?: Record<string, string>;
}

export const ActSchema = z.object({
  method: z.string(),
  element: z.string(), // Changed to string for EncodedId
  args: z.unknown(),
  completed: z.boolean(),
  step: z.string(),
  why: z.string().optional(),
  xpath: z.string().optional(),
});

export type ActInference = z.infer<typeof ActSchema>;
