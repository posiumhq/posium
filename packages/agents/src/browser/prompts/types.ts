import type { CoreMessage } from "ai";
import type { LLMTool } from "../types/llm.js";

// XML Tool Call Format
export const xmlToolCallFormat = `
Tool use is formatted using XML-style tags. The tool name is enclosed in opening and closing tags, and each parameter is similarly enclosed within its own set of tags. Here's the structure:

<tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</tool_name>
`;

export type { CoreMessage, LLMTool };
