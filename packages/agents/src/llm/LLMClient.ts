import {
  generateObject,
  generateText,
  tool,
  type CoreMessage,
  type Tool,
} from "ai";
import {
  createOpenRouter,
  type OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import type { z } from "zod";
import { XMLParser } from "fast-xml-parser";
import type {
  AvailableModel,
  ClientOptions,
} from "../browser/types/model.js";
import type { LoggerType } from "../browser/types/logger.js";
import type { LLMTool } from "../browser/types/llm.js";
import type { LLMClientConfig } from "../browser/types/config.js";

// Define the ToolCall type for consistent usage across files
export interface ToolCall {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

// Define our own response type that includes toolCalls
export interface LLMResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolResults?: Array<{
    type: "tool-result";
    toolCallId: string;
    toolName: string;
    args: unknown;
    result: unknown;
  }>;
  toolCalls: ToolCall[];
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: ChatMessageContent;
}

export type ChatMessageContent =
  | string
  | (ChatMessageImageContent | ChatMessageTextContent)[];

export interface ChatMessageImageContent {
  type: "image_url";
  image_url: { url: string };
  text?: string;
}

export interface ChatMessageTextContent {
  type: string;
  text: string;
}

export const modelsWithVision: AvailableModel[] = [
  "anthropic/claude-3.7-sonnet",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3.5-sonnet:beta",
  "openai/o1",
  "openai/o1-preview",
  "openai/o1-mini",
  "deepseek/deepseek-r1",
  "deepseek/deepseek-r1-distill-llama-70b",
  "google/gemini-2.0-flash-001",
  "google/gemini-2.5-pro-preview",
  "google/gemini-2.5-pro-preview-03-25",
  "google/gemini-2.5-pro-preview-05-06",
  "google/gemini-2.5-pro-preview-06-05",
  "google/gemini-2.5-flash-preview",
];

export const AnnotatedScreenshotText =
  "This is a screenshot of the current page state with the elements annotated on it. Each element id is annotated with a number to the top left of it. Duplicate annotations at the same location are under each other vertically.";

export interface ChatCompletionOptions {
  model?: AvailableModel;
  messages: CoreMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: LLMTool[];
  tool_choice?: "none" | "auto";
  requestId: string;
  schema?: z.Schema<unknown>;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  image?: { buffer: Buffer; description: string };
  use_native_tool_calls?: boolean;
}

/**
 * Options for structured object generation
 */
export interface GenerateStructuredObjectOptions<T> {
  /** Model to use for generation */
  model?: AvailableModel;
  /** Messages to be sent to the LLM */
  messages: CoreMessage[];
  /** Zod schema defining the expected output structure */
  schema: z.ZodType<T>;
  /** Temperature for generation (0-1) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Optional image data for vision models */
  image?: { buffer: Buffer; description: string };
  /** Optional request ID for tracking */
  requestId?: string;
  /** Top-p sampling */
  top_p?: number;
  /** Frequency penalty */
  frequency_penalty?: number;
  /** Presence penalty */
  presence_penalty?: number;
}

export class LLMClient {
  public modelName: AvailableModel;
  public hasVision: boolean;
  private client: OpenRouterProvider;
  public logger: LoggerType;
  private cache: Map<string, unknown>;
  private type: string;
  private xmlParser: XMLParser;
  private config: LLMClientConfig;

  constructor(
    logger: LoggerType,
    modelName: AvailableModel,
    config: LLMClientConfig,
    _clientOptions?: ClientOptions,
  ) {
    this.logger = logger;
    this.modelName = modelName;
    this.hasVision = modelsWithVision.includes(modelName);
    this.cache = new Map();
    this.type = "openrouter";
    this.config = config;
    this.xmlParser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: true,
      parseAttributeValue: true,
      trimValues: true,
      isArray: (name) => name === "args",
    });

    // Initialize OpenRouter client - use Cloudflare gateway if all CF fields are configured
    const useCloudflareGateway =
      config.openRouter.cloudflareAccountId &&
      config.openRouter.cloudflareAiGatewayToken &&
      config.openRouter.cloudflareGatewayName;

    if (useCloudflareGateway) {
      this.client = createOpenRouter({
        baseURL: `https://gateway.ai.cloudflare.com/v1/${config.openRouter.cloudflareAccountId}/${config.openRouter.cloudflareGatewayName}/openrouter`,
        apiKey: config.openRouter.apiKey,
        headers: {
          "cf-aig-authorization": `Bearer ${config.openRouter.cloudflareAiGatewayToken}`,
          "cf-aig-skip-cache": "true",
        },
      });
      this.logger.info("Using Cloudflare AI Gateway for OpenRouter");
    } else {
      this.client = createOpenRouter({
        apiKey: config.openRouter.apiKey,
      });
      this.logger.info("Using direct OpenRouter (no Cloudflare gateway)");
    }

    if (!this.client) {
      throw new Error(
        "Failed to initialize OpenRouter client. Please check your API key and configuration.",
      );
    }
  }

  private getCacheKey(options: ChatCompletionOptions): string {
    const relevantOptions = {
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      tools: options.tools,
      tool_choice: options.tool_choice,
    };
    return JSON.stringify(relevantOptions);
  }

  /**
   * Parses the provided XML content to extract the first tool call
   * (doAction, doAssertion, or skipSection) and returns it in the
   * same schema shape as generateText's toolCalls.
   */
  private parseXMLToolCall(content: string): ToolCall[] | null {
    try {
      // Parse the XML content
      let parsed = this.xmlParser.parse(content);

      // Find the first tool call (doAction, doAssertion, skipSection)
      const toolCalls = Object.keys(parsed);
      if (toolCalls.length > 1) {
        this.logger.warn(
          { content, toolCalls },
          "Multiple tool calls found",
        );
      }
      //! sometimes the tool call is wrapped in code tags
      //! so unfurl the code tags and get the tool call
      let toolCall = toolCalls[0];
      if (toolCall === "code") {
        this.logger.warn(
          { content, toolCall },
          "Tool call is wrapped in code tags. Unfurling code tags.",
        );
        if (Object.keys(parsed[toolCall]).length === 1) {
          toolCall = Object.keys(parsed[toolCall])[0];
          parsed = parsed["code"];
        }
      }

      if (!toolCall) {
        this.logger.warn(
          { content, toolCalls },
          "No tool call found",
        );
        return null;
      }

      // Prepare a random or placeholder ID for the tool call
      const toolCallId = `call_${Date.now()}`;

      return [
        {
          type: "tool-call",
          toolCallId,
          toolName: toolCall,
          args: parsed[toolCall] || {},
        },
      ];
    } catch (error) {
      this.logger.error(
        { category: this.type, content, err: error },
        "Error parsing XML tool call",
      );
      return null;
    }
  }

  async createChatCompletion<T = LLMResponse>(
    options: ChatCompletionOptions,
  ): Promise<T & LLMResponse> {
    const model = options.model || this.modelName;
    this.logger.debug(
      { category: this.type, model, options: options.model },
      "Creating chat completion",
    );
    const hasVision = modelsWithVision.includes(model);

    const tools: Record<string, Tool> = {};

    for (const rawTool of options.tools || []) {
      // AI SDK v5 uses inputSchema instead of parameters
      tools[rawTool.name] = tool({
        description: rawTool.description,
        inputSchema: rawTool.parameters,
      }) as unknown as Tool;
    }

    // Create a mutable copy of messages
    const messages: CoreMessage[] = JSON.parse(
      JSON.stringify(options.messages),
    );

    if (options.image && hasVision) {
      const imageContent = {
        type: "image" as const,
        image: options.image.buffer,
      };

      const textContent = {
        type: "text" as const,
        text: options.image.description,
      };

      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "user") {
        if (typeof lastMessage.content === "string") {
          lastMessage.content = [
            { type: "text", text: lastMessage.content },
            textContent,
            imageContent,
          ];
        } else if (Array.isArray(lastMessage.content)) {
          lastMessage.content.push(textContent, imageContent);
        }
      } else {
        messages.push({
          role: "user",
          content: [textContent, imageContent],
        });
      }
    }

    try {
      const response = await generateText({
        model: this.client(model),
        messages: messages,
        temperature: options.temperature || 0,
        maxOutputTokens: options.max_tokens,
        tools: options.use_native_tool_calls ? tools : undefined,
      });
      // Create our response object with the base properties from generateText
      // Map SDK v5 usage format to our expected format
      const usage = {
        promptTokens: response.usage?.inputTokens ?? 0,
        completionTokens: response.usage?.outputTokens ?? 0,
        totalTokens:
          (response.usage?.inputTokens ?? 0) +
          (response.usage?.outputTokens ?? 0),
      };
      const result: LLMResponse = {
        text: response.text,
        usage,
        // AI SDK v5 toolResults may have different structure - map to our expected format
        toolResults: response.steps?.flatMap(
          (step) =>
            step.toolResults?.map((tr) => {
              // In SDK v5, structure might vary - safely access properties
              const toolResult = tr as unknown as {
                toolCallId: string;
                toolName: string;
                args?: unknown;
                result?: unknown;
              };
              return {
                type: "tool-result" as const,
                toolCallId: toolResult.toolCallId,
                toolName: toolResult.toolName,
                args: toolResult.args,
                result: toolResult.result,
              };
            }) ?? [],
        ),
        toolCalls: [],
      };

      // If not using native tool calls and tools are present, parse XML
      if (!options.use_native_tool_calls && options.tools?.length) {
        const parsedToolCall = this.parseXMLToolCall(response.text);
        if (parsedToolCall) {
          result.toolCalls = parsedToolCall;
        }
      } else if (response.toolCalls) {
        // If using native tool calls, copy them over
        // In AI SDK v5, toolCalls come from steps, use type assertion for backwards compat
        result.toolCalls = response.toolCalls.map((tc) => ({
          type: "tool-call",
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: (tc as unknown as { args: Record<string, unknown> }).args,
        }));
      }

      return result as T & LLMResponse;
    } catch (error) {
      this.logger.error({ err: error }, "Error in LLM completion");
      throw error;
    }
  }

  /**
   * Generates a structured object based on the provided schema and messages.
   *
   * @template T - The type of the structured object to generate
   * @param options - Options for generating the structured object
   * @returns Promise resolving to the structured object
   */
  async generateStructuredObject<T>(
    options: GenerateStructuredObjectOptions<T>,
  ): Promise<T> {
    this.logger.debug(
      { category: this.type, model: this.modelName },
      "Generating structured object",
    );

    const model = options.model || this.modelName;
    const hasVision = modelsWithVision.includes(model);

    // Create a mutable copy of messages
    const messages: CoreMessage[] = JSON.parse(
      JSON.stringify(options.messages),
    );

    if (options.image && hasVision) {
      const imageContent = {
        type: "image" as const,
        image: options.image.buffer,
      };

      const textContent = {
        type: "text" as const,
        text: options.image.description,
      };

      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "user") {
        if (typeof lastMessage.content === "string") {
          lastMessage.content = [
            { type: "text", text: lastMessage.content },
            textContent,
            imageContent,
          ];
        } else if (Array.isArray(lastMessage.content)) {
          lastMessage.content.push(textContent, imageContent);
        }
      } else {
        messages.push({
          role: "user",
          content: [textContent, imageContent],
        });
      }
    }

    try {
      // Use generateObject directly from the ai package
      const result = await generateObject({
        model: this.client(this.modelName),
        messages: messages,
        schema: options.schema,
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxTokens,
        mode: "auto",
      });

      this.logger.debug({ result }, "Generated structured object");

      // The result already is the structured object in newer versions of the AI SDK
      return result.object;
    } catch (error) {
      this.logger.error({ err: error }, "Error generating structured object");
      throw error;
    }
  }
}
