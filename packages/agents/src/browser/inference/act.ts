import type { CoreMessage } from "ai";
import type { LLMResponse } from "../../llm/LLMClient.js";
import {
  buildActSystemPrompt,
  buildActUserPrompt,
  actTools,
} from "../prompts/act.js";
import type { ActInference, ActParams } from "../types/act.js";

export async function act({
  action,
  domElements,
  steps,
  llmClient,
  retries = 0,
  logger,
  requestId,
  variables,
}: ActParams): Promise<ActInference | null> {
  const messages: CoreMessage[] = [
    buildActSystemPrompt(),
    buildActUserPrompt(action, steps, domElements, variables),
  ];

  logger.debug({ messages }, "messages are");

  const response = await llmClient.createChatCompletion({
    messages,
    temperature: 0.1,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    tool_choice: "auto" as const,
    tools: actTools,
    requestId,
    use_native_tool_calls: false,
  });

  const toolCalls = response.toolCalls;

  if (toolCalls && toolCalls[0]) {
    if (toolCalls[0].toolName === "skipSection") {
      return null;
    }
    return toolCalls[0].args as ActInference;
  } else {
    if (retries >= 2) {
      logger.info({ category: "Act" }, "No tool calls found in response");
      return null;
    }

    return act({
      action,
      domElements,
      steps,
      llmClient,
      retries: retries + 1,
      logger,
      requestId,
    });
  }
}
