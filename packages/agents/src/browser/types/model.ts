import { z } from "zod";
import type { LoggerType } from "./logger.js";

export const AvailableModelSchema = z.enum([
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3.5-sonnet:beta",
  "anthropic/claude-3.7-sonnet",
  "openai/o1",
  "openai/o1-preview",
  "openai/o1-mini",
  "openai/o3-mini",
  "openai/o3-mini-high",
  "openai/gpt-4.1-mini",
  "openai/gpt-4.1",
  "deepseek/deepseek-r1",
  "deepseek/deepseek-r1-distill-llama-70b",
  "deepseek/deepseek-chat",
  "google/gemini-2.0-flash-001",
  "google/gemini-2.0-flash-lite-preview-02-05:free",
  "google/gemini-2.0-pro-exp-02-05:free",
  "google/gemini-2.5-flash-preview",
  "google/gemini-2.5-pro-preview",
  "google/gemini-2.5-pro-preview-03-25",
  "google/gemini-2.5-pro-preview-05-06",
  "google/gemini-2.5-pro-preview-06-05",
  "google/gemini-3-flash-preview",
]);

export type AvailableModel = z.infer<typeof AvailableModelSchema>;

export type ModelProvider = "openai" | "anthropic";

export interface ClientOptions {
  modelName: AvailableModel;
  apiKey: string;
  logger: LoggerType;
}
