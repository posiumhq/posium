/* Added interface to fix unexpected any lint error */
import { z } from "zod";
import type { LLMClient, LLMResponse } from "../../llm/LLMClient.js";
import { buildAskSystemPrompt, buildAskUserPrompt } from "../prompts/ask.js";

// Define our specific response shape for ask function
interface AskResponseData {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export async function ask({
  question,
  llmClient,
  requestId,
}: {
  question: string;
  llmClient: LLMClient;
  requestId: string;
}) {
  // Combine LLMResponse with our specific response data
  type CombinedResponse = LLMResponse & AskResponseData;

  const response = await llmClient.createChatCompletion<CombinedResponse>({
    schema: z.unknown(),
    messages: [buildAskSystemPrompt(), buildAskUserPrompt(question)],
    temperature: 0.1,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    requestId,
  });

  // Use optional chaining and provide a default value
  const content = response.choices?.[0]?.message?.content;

  if (content === undefined) {
    throw new Error("No valid response content received from LLM");
  }

  return content;
}
