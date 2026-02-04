import { type z } from "zod";

export interface LLMTool {
  type: "function";
  name: string;
  description: string;
  parameters: z.ZodTypeAny;
}
