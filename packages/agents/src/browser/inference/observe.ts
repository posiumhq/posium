import { z } from "zod";
import type { LLMClient, LLMResponse } from "../../llm/LLMClient.js";
import { AnnotatedScreenshotText } from "../../llm/LLMClient.js";
import {
  buildObserveSystemPrompt,
  buildObserveUserMessage,
} from "../prompts/observe.js";

export async function observe({
  instruction,
  domElements,
  llmClient,
  image,
  requestId,
}: {
  instruction: string;
  domElements: string;
  llmClient: LLMClient;
  image?: Buffer;
  requestId: string;
}): Promise<{
  elements: { elementId: number; description: string }[];
}> {
  const observeSchema = z.object({
    elements: z
      .array(
        z.object({
          elementId: z.number().describe("the number of the element"),
          description: z
            .string()
            .describe(
              "a description of the element and what it is relevant for",
            ),
        }),
      )
      .describe("an array of elements that match the instruction"),
  });

  // Define the data shape from our schema
  type ObserveData = z.infer<typeof observeSchema>;

  // Combine LLMResponse with our schema-specific data
  type CombinedObserveResponse = LLMResponse & ObserveData;

  console.error("observe", instruction, domElements);

  const observationResponse =
    await llmClient.createChatCompletion<CombinedObserveResponse>({
      schema: observeSchema,
      messages: [
        buildObserveSystemPrompt(),
        buildObserveUserMessage(instruction, domElements),
      ],
      image: image
        ? { buffer: image, description: AnnotatedScreenshotText }
        : undefined,
      temperature: 0.1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      requestId,
    });
  console.error("observationResponse", observationResponse);

  const parsedResponse = {
    elements:
      observationResponse.elements?.map((el) => ({
        elementId: Number(el.elementId),
        description: String(el.description),
      })) ?? [],
  } satisfies { elements: { elementId: number; description: string }[] };

  return parsedResponse;
}
