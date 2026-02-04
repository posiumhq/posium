import { z } from "zod";
import type { LLMClient, LLMResponse } from "../../llm/LLMClient.js";
import {
  buildExtractSystemPrompt,
  buildExtractUserPrompt,
  buildRefineSystemPrompt,
  buildRefineUserPrompt,
  buildMetadataSystemPrompt,
  buildMetadataPrompt,
} from "../prompts/extract.js";

export async function extract({
  instruction,
  previouslyExtractedContent,
  domElements,
  schema,
  llmClient,
  chunksSeen,
  chunksTotal,
  requestId,
  isUsingTextExtract,
}: {
  instruction: string;
  previouslyExtractedContent: object;
  domElements: string;
  schema: z.ZodObject<z.ZodRawShape>;
  llmClient: LLMClient;
  chunksSeen: number;
  chunksTotal: number;
  requestId: string;
  isUsingTextExtract?: boolean;
}) {
  // Define types for our extraction responses
  type ExtractedData = z.infer<typeof schema>;

  // Create a type that combines LLMResponse with our schema inferred type
  type ExtractedResponse = LLMResponse & ExtractedData;

  // Define metadata schema
  const metadataSchema = z.object({
    progress: z
      .string()
      .describe(
        "progress of what has been extracted so far, as concise as possible",
      ),
    completed: z
      .boolean()
      .describe(
        "true if the goal is now accomplished. Use this conservatively, only when you are sure that the goal has been completed.",
      ),
  });

  // Combine LLMResponse with metadata schema type
  type MetadataResponse = LLMResponse & z.infer<typeof metadataSchema>;

  // Check if using Anthropic model by checking the model name instead of accessing private property
  const isUsingAnthropic = llmClient.modelName.startsWith("anthropic/");

  const extractionResponse =
    await llmClient.createChatCompletion<ExtractedResponse>({
      schema,
      messages: [
        buildExtractSystemPrompt(isUsingAnthropic, isUsingTextExtract),
        buildExtractUserPrompt(instruction, domElements, isUsingAnthropic),
      ],
      temperature: 0.1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      requestId,
    });

  const refinedResponse =
    await llmClient.createChatCompletion<ExtractedResponse>({
      schema,
      messages: [
        buildRefineSystemPrompt(),
        buildRefineUserPrompt(
          instruction,
          previouslyExtractedContent,
          extractionResponse,
        ),
      ],
      temperature: 0.1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      requestId,
    });

  const metadataResponse =
    await llmClient.createChatCompletion<MetadataResponse>({
      schema: metadataSchema,
      messages: [
        buildMetadataSystemPrompt(),
        buildMetadataPrompt(
          instruction,
          refinedResponse,
          chunksSeen,
          chunksTotal,
        ),
      ],
      temperature: 0.1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      requestId,
    });

  return {
    ...refinedResponse,
    metadata: metadataResponse,
  };
}
