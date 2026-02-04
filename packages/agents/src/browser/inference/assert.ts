import {
  buildAssertSystemPrompt,
  buildAssertUserPrompt,
  assertTools,
} from "../prompts/assert.js";
import type { AssertParams, AssertInference } from "../types/assert.js";

export async function assert({
  instruction,
  domElements,
  llmClient,
  logger,
  requestId,
  variables,
}: AssertParams): Promise<AssertInference | null> {
  const response = await llmClient.createChatCompletion({
    messages: [
      buildAssertSystemPrompt(),
      buildAssertUserPrompt(instruction, domElements),
    ],
    temperature: 0.1,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    tool_choice: "auto" as const,
    tools: assertTools,
    requestId,
    use_native_tool_calls: false,
  });

  const toolCalls = response.toolCalls;

  if (toolCalls && toolCalls[0]) {
    if (toolCalls[0].toolName === "skipSection") {
      return null;
    }
    return toolCalls[0].args as AssertInference;
  } else {
    logger.info({
      category: "Assert",
      message: "No tool calls found in response",
    });
    return null;
  }
}
