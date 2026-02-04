import { z } from "zod";
import type { CoreMessage, LLMTool } from "./types.js";

/**
 * Options for configuring the discovery process.
 */
export interface DiscoveryOptions {
  /** Whether to use vision capabilities */
  useVision?: boolean;
  /** Specific areas of focus for the discovery (e.g., 'forms', 'navigation') */
  focusAreas?: string[];
  /** Minimum number of objectives to discover */
  minObjectives?: number;
  /** Maximum number of objectives to discover */
  maxObjectives?: number;
  /** Whether to include low-priority objectives */
  includeLowPriority?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Returns the system prompt for the test discovery process.
 * This prompt provides context and instructions for identifying test objectives.
 * @param options Configuration options that affect the prompt
 * @returns The system prompt string.
 */
export function buildDiscoverySystemPrompt(
  options: Partial<DiscoveryOptions> = {},
): CoreMessage {
  const content = `You are a Test Discovery Agent responsible for analyzing web pages to identify potential test objectives and scenarios. Your goal is to thoroughly understand the page's structure, elements, and functionality to suggest a comprehensive yet actionable set of test objectives that ensure the quality and reliability of the web application.

# Your Task
Examine the provided DOM and page information to identify key test objectives. These objectives should reflect user-centric scenarios, focus primarily on the expected (happy path) behavior, and include consideration of potential failure modes when relevant.

# Guidelines for Discovering Test Objectives

1. **User-Centric Scenarios:**
   Identify test objectives that mirror how real users interact with the application.

2. **Focus on Happy Paths:**
   Emphasize scenarios where the system is expected to work as intended. While the primary focus is on happy paths, note any obvious potential edge cases or common failure modes that could impact critical features.

3. **Prioritization by Criticality:**
   Prioritize objectives based on business impact and the criticality of features.

4. **Testing Category:**
   Limit your analysis to functionality testing. Aim for multi step test cases that cover the happy path user flows.

5. **Actionable Specificity:**
   Clearly specify what should be verified for each test objective and explain why it matters in ensuring a robust user experience.

6. **Consideration of Failure Modes:**
   Identify common failure points or misbehaviors for each feature (e.g., missing elements, incorrect responses) to enhance test coverage.

7. **Optional Focus Areas:**
   If additional focus areas are provided (via options.focusAreas), pay special attention to those. For example:
   - If options.focusAreas includes "search functionality, user authentication," ensure these areas receive extra scrutiny.

8. **SUPER IMPORTANT - MUST INFER BROADER FLOWS:**
   Deeply analyze the purpose of the page and infer potential subsequent steps or flows initiated by the page. eg - if the page looks like a login page, and only shows email field but no password field, you should still plan for successful login flow.

9. **SUPER IMPORTANT:**
   You must return the tests in the order of importance from user-centric perspective.

10. **SUPER IMPORTANT:**
   If the page indicates a login page, then the MOST important test is always the successful login flow. The final assertion should be against presence of logout element, or user avatar element, or dashboard element, or home element, etc in that order of priority.

The test objectives you identify should be both comprehensive to provide broad coverage and detailed enough to be directly actionable.

# Examples
 ## Example 1
  - Context: The dom and screenshot indicate a login page.
  - Output cases:
    - Verify that the user can log in successfully.

 ## Example 2
  - Context: The dom and screenshot indicate a search page.
  - Output cases:
    - Verify that the search box works.

 ## Example 3
  - Context: The dom and screenshot indicate a button with "+ Goal".
  You will infer based on the context that the button is for adding a new goal.
  - Output cases:
    - Create a new goal.
`;

  return {
    role: "system",
    content,
  };
}

/**
 * Returns the user prompt for discovering test objectives based on the provided DOM content.
 * @param domContent The DOM content from the page.
 * @param pageState Information about the page state (URL, title).
 * @param options Configuration options that affect the prompt.
 * @returns The user prompt string.
 */
export function buildDiscoveryUserPrompt(
  domContent: string,
  pageState: { url: string; title: string },
  options: Partial<DiscoveryOptions> = {},
): CoreMessage {
  const content = `# Current Page for Test Discovery
URL: ${pageState.url}
Title: ${pageState.title}

# Current DOM State
${domContent}

Please analyze this page and identify ${options.minObjectives || 3}-${options.maxObjectives || 10} potential test objectives or scenarios that would ensure quality and reliability of this web application.

For each objective, provide:
1. A concise title
2. A detailed description
3. Priority level (high/medium/low)
4. Testing category
5. Implementation complexity
6. Relevant UI elements if applicable
7. Whether it's critical for core functionality`;

  return {
    role: "user",
    content,
  };
}

/**
 * The tool definition for suggesting test objectives.
 */
export const discoveryTools: LLMTool[] = [
  {
    type: "function",
    name: "suggestTestObjectives",
    description: "Suggest test objectives and scenarios based on page analysis",
    parameters: z.object({
      objectives: z
        .array(
          z.object({
            title: z.string().describe("Concise title of the test objective"),
            description: z
              .string()
              .describe("Detailed description of what should be tested"),
            priority: z
              .enum(["high", "medium", "low"])
              .describe("Priority level"),
            category: z
              .string()
              .describe("Testing category (e.g., functionality, usability)"),
            complexity: z
              .enum(["simple", "moderate", "complex"])
              .describe("Implementation complexity"),
            relevantElements: z
              .array(z.string())
              .optional()
              .describe("Relevant UI elements or selectors"),
            isCritical: z
              .boolean()
              .optional()
              .describe("Whether this test is critical for core functionality"),
          }),
        )
        .describe("List of discovered test objectives"),
      pageInsights: z
        .string()
        .optional()
        .describe("General insights about the page from a testing perspective"),
    }),
  },
];
