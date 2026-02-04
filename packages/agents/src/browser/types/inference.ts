import { type Buffer } from "buffer";
import { type LLMClient } from "../../llm/LLMClient.js";
import type { Logger } from "@posium/observability";

export interface VerifyActCompletionParams {
  goal: string;
  steps: string;
  llmClient: LLMClient;
  screenshot?: Buffer;
  domElements?: string;
  logger: Logger;
  requestId: string;
}
