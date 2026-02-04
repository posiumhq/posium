import { z } from "zod";
import type { CoreMessage, LLMTool } from "./types.js";

// act
const actSystemPromptBase = `
# Instructions
You are a browser automation assistant. Your job is to accomplish the user's goal across multiple model calls by running playwright commands.

## Input
You will receive:
1. the user's overall goal
2. the steps that you've taken so far
3. a list of active DOM elements in this chunk to consider to get closer to the goal.
4. Optionally, a list of variable names that the user has provided that you may use to accomplish the goal. To use the variables, you must use the special <|VARIABLE_NAME|> syntax.
`;

const nativeToolCallInstructions = `
## Your Goal / Specification
You have 2 tools that you can call: doAction, and skipSection. Do action only performs Playwright actions. Do exactly what the user's goal is. Do not perform any other actions or exceed the scope of the goal.
If the user's goal will be accomplished after running the playwright action, set completed to true. Better to have completed set to true if your are not sure.
`;

const xmlToolCallInstructions = `
## Your Goal / Specification
You have access to two tools that can be called using XML format:

1. doAction - Performs Playwright actions:
<doAction>
<method>The playwright function to call</method>
<element>The element number to act on</element>
<locator>The playwright locator string used to find the element</locator>
<args>The required arguments</args>
<step>A human-readable description of the step, in the past tense, with detailed context</step>
<why>Explanation of why this step is taken and how it advances the goal</why>
<completed>True if the goal should be accomplished after this step</completed>
</doAction>

2. skipSection - Skips this area if the goal cannot be accomplished here:
<skipSection>
<reason>reason that no action is taken</reason>
</skipSection>

Do exactly what the user's goal is. Do not perform any other actions or exceed the scope of the goal.
If the user's goal will be accomplished after running the playwright action, set completed to true. Better to have completed set to true if your are not sure.
`;

const actCommonNotes = `
Note 1: If there is a popup on the page for cookies or advertising that has nothing to do with the goal, try to close it first before proceeding. As this can block the goal from being completed.
Note 2: Sometimes what your are looking for is hidden behind and element you need to interact with. For example, sliders, buttons, etc...

Again, if the user's goal will be accomplished after running the playwright action, set completed to true.
`;

export function buildActSystemPrompt(
  useNativeToolCalls: boolean = false,
): CoreMessage {
  const content = useNativeToolCalls
    ? actSystemPromptBase + nativeToolCallInstructions + actCommonNotes
    : actSystemPromptBase + xmlToolCallInstructions + actCommonNotes;

  return {
    role: "system",
    content,
  };
}

export function buildActUserPrompt(
  action: string,
  steps = "None",
  domElements: string,
  variables?: Record<string, string>,
): CoreMessage {
  let actUserPrompt = `
# My Goal
${action}

# Steps You've Taken So Far
${steps}

# Current Active Dom Elements
${domElements}
`;

  if (variables && Object.keys(variables).length > 0) {
    actUserPrompt += `
# Variables
${Object.keys(variables)
  .map((key) => `<|${key.toUpperCase()}|>`)
  .join("\n")}
`;
  }

  return {
    role: "user",
    content: actUserPrompt,
  };
}

export const actTools: LLMTool[] = [
  {
    type: "function",
    name: "doAction",
    description:
      "execute the next playwright step that directly accomplishes the goal",
    parameters: z.object({
      method: z.string().describe("The playwright function to call."),
      element: z.number().describe("The element number to act on"),
      args: z
        .array(z.string().describe("The argument to pass to the function"))
        .describe("The required arguments"),
      step: z
        .string()
        .describe(
          "A human-readable description of the step, in the past tense, with detailed context.",
        ),
      why: z
        .string()
        .describe(
          "Explanation of why this step is taken and how it advances the goal.",
        ),
      completed: z
        .boolean()
        .describe("True if the goal should be accomplished after this step."),
    }),
  },
  {
    type: "function",
    name: "skipSection",
    description:
      "skips this area of the webpage because the current goal cannot be accomplished here",
    parameters: z.object({
      reason: z.string().describe("reason that no action is taken"),
    }),
  },
];

// verify act completion
const verifyActCompletionSystemPrompt = `
You are a browser automation assistant. The job has given you a goal and a list of steps that have been taken so far. Your job is to determine if the user's goal has been completed based on the provided information.

# Input
You will receive:
1. The user's goal: A clear description of what the user wants to achieve.
2. Steps taken so far: A list of actions that have been performed up to this point.
3. An image of the current page

# Your Task
Analyze the provided information to determine if the user's goal has been fully completed.

# Output
Return a boolean value:
- true: If the goal has been definitively completed based on the steps taken and the current page.
- false: If the goal has not been completed or if there's any uncertainty about its completion.

# Important Considerations
- False positives are okay. False negatives are not okay.
- Look for evidence of errors on the page or something having gone wrong in completing the goal. If one does not exist, return true.
`;

export function buildVerifyActCompletionSystemPrompt(): CoreMessage {
  return {
    role: "system",
    content: verifyActCompletionSystemPrompt,
  };
}

export function buildVerifyActCompletionUserPrompt(
  goal: string,
  steps = "None",
  domElements: string | undefined,
): CoreMessage {
  let actUserPrompt = `
# My Goal
${goal}

# Steps You've Taken So Far
${steps}
`;

  if (domElements) {
    actUserPrompt += `
# Active DOM Elements on the current page
${domElements}
`;
  }

  return {
    role: "user",
    content: actUserPrompt,
  };
}
