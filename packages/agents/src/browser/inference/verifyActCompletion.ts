import { z } from "zod";
import {
  buildVerifyActCompletionSystemPrompt,
  buildVerifyActCompletionUserPrompt,
} from "../prompts/index.js";
import type { VerifyActCompletionParams } from "../types/inference.js";
import type { LLMResponse } from "../../llm/LLMClient.js";

export async function verifyActCompletion({
  goal,
  steps,
  llmClient,
  screenshot,
  domElements,
  logger,
  requestId,
}: VerifyActCompletionParams): Promise<boolean> {
  const verificationSchema = z.object({
    completed: z.boolean().describe("true if the goal is accomplished"),
  });

  // Create types to represent the verification data from schema
  type VerificationData = z.infer<typeof verificationSchema>;

  // Combine LLMResponse with our verification data
  type CombinedVerificationResponse = LLMResponse & VerificationData;

  const response =
    await llmClient.createChatCompletion<CombinedVerificationResponse>({
      schema: verificationSchema,
      messages: [
        buildVerifyActCompletionSystemPrompt(),
        buildVerifyActCompletionUserPrompt(goal, steps, domElements),
      ],
      temperature: 0.1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      image: screenshot
        ? {
            buffer: screenshot,
            description: "This is a screenshot of the whole visible page.",
          }
        : undefined,
      requestId,
    });

  if (!response || typeof response !== "object") {
    logger.info({
      category: "VerifyAct",
      message: "Unexpected response format: " + JSON.stringify(response),
    });
    return false;
  }

  if (response.completed === undefined) {
    logger.info({
      category: "VerifyAct",
      message: "Missing 'completed' field in response",
    });
    return false;
  }

  return response.completed;
}
