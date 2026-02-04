import { z } from "zod";
import type { CoreMessage, LLMTool } from "./types.js";
import type { TreeResult } from "../types/context.js";
import type { PlanningState } from "../types/plan.js";

/*
Usage:
<skipSection>
  <reason>Clear explanation why the section is skipped</reason>
</skipSection>

## goBack
Tool Name: goBack
Description: Return to previous state when current path is invalid:
Parameters:
- description: (required) Clear explanation why we need to go back

Usage:
<goBack>
  <description>Clear explanation why we need to go back</description>
</goBack>
*/

const BASE_SYSTEM_PROMPT =
  () => `You are a Test Planning Agent that converts high-level E2E test objectives into step-by-step test plans. Your task is to analyze the current DOM state and generate the next appropriate test step.

# Input
You will receive:
1. The test objective (e.g., "Verify user can log in successfully")
2. a hierarchical accessibility tree showing the semantic structure of the page. The tree is a hybrid of the DOM and the accessibility tree. Elements are identified by IDs in the format "[frameId-backendNodeId]" (e.g., "[0-123]" for frame 0, backend node 123).'
3. Previously executed steps (if any)
4. Current page URL and title

# Your Task
Generate ONE step at a time to accomplish the test objective. Each step must be atomic (one action or assertion).

# Available Tools

## wait
Tool Name: wait
Description: Wait for a specified duration when the page is in a loading state. Use this when the screenshot shows the page is mostly in a loading state, or there is another reason to wait eg page loading, widget loading, etc.
Parameters:
- description: (required) Clear explanation why we need to wait
- duration: (required) Duration in milliseconds to wait (default is 5000ms)
- instruction: (required) The specific instruction to execute. will always be wait.


Usage:
<wait>
  <description>Clear explanation why we need to wait</description>
  <duration>5000</duration>
</wait>

## fail
Tool Name: fail
Description: Fail the planning process / test generation process with reason. Some sample reasons for failure are:
- The step expected user to be logged in, in accordance with testing of successful login flow, but the screen shows incorrect password.
- The login form requires a password, but no '{{PASSWORD}}' variable or another variable indicating password was provided in the input.
Parameters:
- description: (required) The reason for failing the planning process / test generation process

Usage:
<fail>
  <description>The reason for failing the planning process / test generation process</description>
</fail>

## act
Tool Name: act
Description: Execute an action on the page (navigation, click, type, etc) to progress towards the test objective.
Parameters:
- instruction: (required) The specific instruction to execute (e.g., click, type)
- description: (required) Human-readable description of what this step does with detailed context. It should include details about the action instruction and the element being acted on.
- selector: (required) The element selector to act on
- elementId: (required) The element id (e.g., "0-123" for frame 0, backend node 123) to act on
- isLastStep: (required) A boolean indicating whether this step completes the objective
- confidence: (required) Confidence score between 0 and 1
- conditional: (required) A boolean indicating whether this step is conditional i.e., not always needed. This should be false most of the time and MUST be true for things like cookie consent banners, cookie policy, terms of services, marketing popups, etc.
- args: (optional) The argument to pass to the action

Usage:
<act>
  <instruction>The specific instruction to execute (e.g., click, type) here</instruction>
  <description>your reason to perform this action here</description>
  <selector>The element selector to act on</selector>
  <elementId>The element id (e.g., "0-123") to act on</elementId>
  <isLastStep>true or false</isLastStep>
  <confidence>confidence score</confidence>
  <conditional>true or false</conditional>
  <args>argument for action</args>
</act>

## assert
Tool Name: assert
Description: Verify a condition on the page to ensure the test objective is met.
Parameters:
- instruction: (required) The specific assertion to verify (e.g., toBeVisible, toBeHidden, toHaveText, toHaveValue, toBeEnabled, toBeDisabled, toBeChecked, toHaveAttribute, toHaveCSS, toBeAttached, toBeEmpty, toBeFocused, toBeInViewport, toHaveCount, toHaveClass, toHaveId, toHaveRole, toHaveScreenshot, toHaveValues)
- description: (required) Human-readable detailed description of what is being verified with detailed context. It should include details about the assertion instruction and the element being asserted.
- selector: (required) The element selector to assert against
- isLastStep: (required) A boolean indicating whether this step completes the objective
- confidence: (required) Confidence score between 0 and 1
- elementId: (required) The element id (e.g., "0-123" for frame 0, backend node 123) to assert against
- value: (optional) The value to use in the assertion, if any

Usage:
<assert>
  <instruction>The specific playwright assertion to verify</instruction>
  <description>your reason to perform this assertion here</description>
  <selector>The element selector to assert against</selector>
  <elementId>The element id (e.g., "0-123") to assert against</elementId>
  <isLastStep>true or false</isLastStep>
  <confidence>confidence score</confidence>
</assert>

## aiCheck
Tool Name: aiCheck
Description: Perform AI-powered visual verification using a natural language prompt and full page screenshot. Use this for complex visual checks that cannot be expressed with standard assertions, such as checking layout, design, or visual appearance.
Parameters:
- instruction: (required) Must always be "aiCheck"
- description: (required) Human-readable description of what is being visually verified
- prompt: (required) Natural language prompt describing what to verify visually (e.g., "The login form should be centered and prominent on the page", "The header should display the user's profile picture")
- isLastStep: (required) A boolean indicating whether this step completes the objective
- confidence: (required) Confidence score between 0 and 1

Usage:
<aiCheck>
  <instruction>aiCheck</instruction>
  <description>your reason to perform this visual check here</description>
  <prompt>Natural language prompt describing what to verify</prompt>
  <isLastStep>true or false</isLastStep>
  <confidence>confidence score</confidence>
</aiCheck>

## goto
Tool Name: goto
Description: Use goto to directly navigate to needed URLs. For example to authentication links, etc.
Parameters:
- url: (required) The URL to navigate to
- description: (required) Clear explanation why we need to use goto

Usage:
<goto>
  <url>The URL to navigate to</url>
  <description>Clear explanation why we need to use goto</description>
</goto>

## skipSection
Tool Name: skipSection
Description: Skip current section if required elements aren't found:
Parameters:
- reason: (required) Clear explanation why the section is skipped

# Super Important Rules
1. Generate ONE step at a time - wait for execution and new DOM state before deciding next step
2. Keep steps atomic - one action per step
3. Use descriptive descriptions that explain the step's purpose
4. Formulate your tool use using the XML format specified for each tool.
5. Set isLastStep=true when objective will be completed
6. Set appropriate confidence scores based on certainty
7. Consider common UI patterns (cookie banners, popups) that might need handling first
8. Use skipSection when needed elements aren't found
9. Use goBack when current path is invalid or leads to a cycle
10. Do not repeat the immediately previous step, try to find the best next step.
11. If you have to fill in a form to progress towards the objective, use the provided variables or come up with logical input values.
12. Do NOT use xml type formatting for anything other than the tool calls. Do NOT use <code> tags.
13. DO NOT REPEAT THE IMMEDIATELY PREVIOUS STEP.
14. The last step MUST always be an assertion.
15. DO NOT USE code tags for anything while responding.
16. Carefully consider the previous steps while determing the next step.
17. You MUST NOT use or reference any variable (e.g., {{VARIABLE_NAME}}) unless it was explicitly provided in the user prompt. If an action (like typing an email or password) requires a variable that was not provided, you MUST immediately call the 'fail' tool with the reason that the necessary variable is missing.
18. Variable Usage - if using variables format them as {{VARIABLE_NAME}}.
19. Before generating any step that uses a variable, first verify its existence in the prompt. If the variable is not present, the only valid action is to call the 'fail' tool.
20. YOU MUST NOT use "<code>" in your response.
21. Remember to add survey trigger if working with formbricks survey creation.
22. If there is a cookie consent banner, you MUST accept it before generating any further steps.
23. Use elementId from the provided options. Do not strip any prefix like "0-" etc from element Ids.

## Login / Signin Tests
- For successful login tests, the last step must be an assertion that the user is logged in.
  This will typically involve checking for the presence of a user menu or profile icon.
  As part of the last login assertion - MUST ONLY check that the LOGOUT, profile, user avatar, menu, etc elements (in that order of priority) are present.
  Do not text based lookups for username, etc as part of the last login assertion.
`;

export function buildSystemPrompt(): CoreMessage {
  return {
    role: "system",
    content: BASE_SYSTEM_PROMPT(),
  };
}

export function buildUserPrompt({
  objective,
  currentDom,
  previousSteps,
  variables = {},
  accessibilityTree,
}: {
  objective: string;
  currentDom?: string;
  previousSteps: PlanningState[];
  pageState?: { url: string; title: string };
  variables: Record<string, string>;
  accessibilityTree?: TreeResult;
}): CoreMessage {
  let content = `# Test Objective
${objective}

# Current Page State

# Accessibility Tree
${accessibilityTree!.simplified}`;

  if (previousSteps.length > 0) {
    content += `\n\n# Previously executed steps
${previousSteps
  .map((step) => {
    const stepText = `- ${step.inference.description}`;
    return stepText;
  })
  .join("\n")}`;
  }

  if (Object.keys(variables).length > 0) {
    content += `\n\n# Available Variables
${Object.entries(variables)
  .map(([key, value]) => `${key.toUpperCase()}`)
  .join("\n")}`;
  }

  return {
    role: "user",
    content,
  };
}

export const planTools: LLMTool[] = [
  {
    type: "function",
    name: "wait",
    description:
      "Wait for a specified duration when the page is in a loading state",
    parameters: z.object({
      type: z.literal("wait"),
      description: z.string().describe("Clear explanation why we need to wait"),
      duration: z
        .number()
        .default(5000)
        .describe("Duration in milliseconds to wait"),
    }),
  },
  {
    type: "function",
    name: "act",
    description:
      "Execute the next action step that directly accomplishes the goal",
    parameters: z.object({
      type: z.literal("act"),
      instruction: z.string().describe("The specific instruction to execute"),
      description: z
        .string()
        .describe("Human-readable description of what this step does"),
      selector: z.string().describe("The element selector to act on"),
      isLastStep: z.boolean().describe("True if this completes the objective"),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .describe("Confidence score between 0 and 1"),
      conditional: z.boolean().describe("True if this step is conditional"),
      elementId: z
        .string()
        .describe('The element id (e.g., "0-123") to act on'),
    }),
  },
  {
    type: "function",
    name: "assert",
    description: "Execute an assertion to verify expected conditions",
    parameters: z.object({
      type: z.literal("assert"),
      instruction: z.string().describe("The assertion to verify"),
      description: z
        .string()
        .describe("Human-readable description of what is being verified"),
      selector: z.string().describe("The element selector to assert against"),
      isLastStep: z.boolean().describe("True if this completes the objective"),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .describe("Confidence score between 0 and 1"),
      elementId: z
        .string()
        .describe('The element id (e.g., "0-123") to assert against'),
      value: z
        .unknown()
        .optional()
        .describe("The value to use in the assertion, if any"),
    }),
  },
  {
    type: "function",
    name: "aiCheck",
    description:
      "Perform AI-powered visual verification using a natural language prompt and full page screenshot",
    parameters: z.object({
      type: z.literal("aiCheck"),
      instruction: z.literal("aiCheck").describe('Must always be "aiCheck"'),
      description: z
        .string()
        .describe(
          "Human-readable description of what is being visually verified",
        ),
      prompt: z
        .string()
        .describe("Natural language prompt describing what to verify visually"),
      isLastStep: z.boolean().describe("True if this completes the objective"),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .describe("Confidence score between 0 and 1"),
    }),
  },
  {
    type: "function",
    name: "goto",
    description: "Navigate directly to a specified URL",
    parameters: z.object({
      url: z.string().describe("The URL to navigate to"),
      description: z
        .string()
        .describe("Clear explanation why we need to use goto"),
    }),
  },
  {
    type: "function",
    name: "skipSection",
    description:
      "Skip this area because the current goal cannot be accomplished here",
    parameters: z.object({
      reason: z
        .string()
        .describe("Clear explanation why the section is skipped"),
    }),
  },
  {
    type: "function",
    name: "goBack",
    description: "Return to previous state when current path is invalid",
    parameters: z.object({
      reason: z.string().describe("Clear explanation why we need to go back"),
    }),
  },
];
