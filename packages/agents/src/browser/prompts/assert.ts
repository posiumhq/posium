import { z } from "zod";
import type { CoreMessage, LLMTool } from "./types.js";

const assertSystemPromptBase = `
You are a browser automation assistant. Your job is to help assert conditions about elements on a webpage.

# Input
You will receive:
1. An instruction describing what to assert/verify
2. The DOM elements on the page with their IDs and content

# Your Task
Analyze the instruction and DOM elements to determine which assertion to make.

# Available Assertions
- isVisible: Check if an element is visible
- isHidden: Check if an element is hidden
- hasText: Check if an element has specific text (supports exact match and regex)
- hasValue: Check if an input element has a specific value
- isEnabled: Check if an element is enabled
- isDisabled: Check if an element is disabled
- isChecked: Check if a checkbox/radio is checked
- hasAttribute: Check if an element has a specific attribute value (format: "attr=value")
- hasCSS: Check if an element has a specific CSS property value (format: "property=value")
- exists: Check if an element exists in the DOM
`;

const nativeAssertToolInstructions = `
# Important Notes
1. Use the doAssertion tool to perform assertions
2. Set completed to true if this assertion fully satisfies the instruction
3. Provide clear step descriptions and reasoning
4. Only assert exactly what was asked for, don't make additional assertions
`;

const xmlAssertToolInstructions = `
# Tool Usage
Use XML format to make assertions:

<doAssertion>
<method>The type of assertion to perform</method>
<element>The element ID to assert against. This is the ID of the element in the DOM.</element>
<locator>The playwright locator string used to find the element</locator>
<value>The value to assert (required for hasText, hasValue, hasAttribute, hasCSS)</value>
<step>A description of what was asserted in the past tense</step>
<why>Explanation of why this assertion was chosen</why>
<completed>Whether this assertion completes the instruction</completed>
</doAssertion>

Or skip if assertion is not possible:

<skipSection>
<reason>reason that no assertion is possible</reason>
</skipSection>

# Important Notes
1. Only assert exactly what was asked for
2. Set completed to true if this assertion fully satisfies the instruction
3. Provide clear step descriptions and reasoning
`;

export function buildAssertSystemPrompt(
  useNativeToolCalls: boolean = false,
): CoreMessage {
  const content = useNativeToolCalls
    ? assertSystemPromptBase + nativeAssertToolInstructions
    : assertSystemPromptBase + xmlAssertToolInstructions;

  return {
    role: "system",
    content,
  };
}

export function buildAssertUserPrompt(
  instruction: string,
  domElements: string,
): CoreMessage {
  return {
    role: "user",
    content: `Instruction: ${instruction}\n\nDOM Elements:\n${domElements}`,
  };
}

export const assertTools: LLMTool[] = [
  {
    type: "function",
    name: "doAssertion",
    description: "Execute a Playwright assertion on an element",
    parameters: z.object({
      method: z.string().describe("The type of assertion to perform"),
      element: z
        .number()
        .describe(
          "The element ID to assert against. This is the ID of the element in the DOM.",
        ),
      value: z
        .string()
        .describe(
          "The value to assert (required for hasText, hasValue, hasAttribute, hasCSS)",
        ),
      step: z
        .string()
        .describe("A description of what was asserted in the past tense"),
      why: z.string().describe("Explanation of why this assertion was chosen"),
      completed: z
        .boolean()
        .describe("Whether this assertion completes the instruction"),
    }),
  },
  {
    type: "function",
    name: "skipSection",
    description:
      "skips this area of the webpage because the current assertion cannot be performed here",
    parameters: z.object({
      reason: z.string().describe("reason that no assertion is possible"),
    }),
  },
];
