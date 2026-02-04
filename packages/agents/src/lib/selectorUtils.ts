import type { Page, Locator } from "@playwright/test";
import type { Logger } from "@posium/observability";
import { z } from "zod";
import type { SelectorType } from "../shared/index.js";
import type { LLMClient } from "../llm/LLMClient.js";
import type { CoreMessage } from "ai";

/**
 * Escapes a string for use in CSS selectors
 * This replaces the native CSS.escape which isn't available in Node.js
 * Based on the CSS.escape polyfill: https://github.com/mathiasbynens/CSS.escape
 */
function cssEscape(value: string): string {
  if (typeof value !== "string") {
    return value;
  }

  // Handle empty strings
  if (value.length === 0) {
    return "";
  }

  let output = "";
  const length = value.length;

  for (let i = 0; i < length; i++) {
    let character = value.charAt(i);

    // Escape special characters
    if (
      character === "\0" ||
      /[\t\n\f\r]/.test(character) ||
      (i === 0 && /[\d]/.test(character)) ||
      (i === 0 && character === "-" && value.length === 1)
    ) {
      // Replace null character with Unicode Replacement Character
      if (character === "\0") {
        character = "\uFFFD";
      }

      // Add a backslash before the character
      output += "\\" + character;
      continue;
    }

    // Escape other special characters
    if (/[ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/.test(character)) {
      output += "\\" + character;
    } else {
      output += character;
    }
  }

  return output;
}

/**
 * Prompt for the LLM to evaluate or generate selectors
 */
const SELECTOR_EVALUATION_PROMPT = `You are an expert at creating stable selectors for web testing. Your task is to analyze the given element information and candidate selectors, then either:

1. Choose the best selector from the candidates based on stability and reliability
2. Suggest a better selector if none of the candidates are optimal

Prefer Playwright's user-facing selectors in this order:
1. getByTestId (if the element has a test-specific attribute)
2. getByRole with name (for interactive elements with accessible names)
3. getByLabel (for form elements)
4. getByText (for elements with stable text)
5. Other semantic selectors (getByPlaceholder, getByAltText, getByTitle)
6. CSS selectors (only if they target stable attributes)
7. XPath (least preferred)`;

/**
 * Selector priority order (from most to least preferred):
 *
 * 1. getByTestId - Best for elements specifically instrumented for testing
 *    - Uses data-testid, data-test-id, data-qa, data-cy, data-e2e attributes
 *    - Very stable and explicitly intended for testing
 *    - Recommended as the first choice for testing selectors
 *
 * 2. getByRole with name - Accessibility-friendly approach
 *    - Uses ARIA roles (explicit or implicit) with accessible names
 *    - Matches how screen readers and assistive technologies interpret the page
 *    - Resilient to DOM structure changes and visual redesigns
 *
 * 3. Other semantic locators (getByLabel, getByPlaceholder, getByText, etc.)
 *    - Based on visible content or semantically meaningful attributes
 *    - Generally stable but can break if text/labels change
 *
 * 4. CSS selectors based on stable attributes
 *    - More brittle than semantic locators but better than XPath
 *
 * 5. XPath (last resort)
 *    - Most brittle, easily breaks with DOM structure changes
 */

/**
 * Priority order of attributes to check for stable selectors
 */
const SELECTOR_PRIORITY_ATTRIBUTES = [
  "data-testid",
  "data-test-id",
  "data-qa",
  "data-cy",
  "data-e2e",
  "id",
  "name",
  "aria-label",
  "role",
  "aria-role",
  "title",
  "placeholder",
  "alt",
];

/**
 * Type of selector to use
 * Now imported from shared package for consistency
 */
export type { SelectorType } from "../shared/index.js";

/**
 * Interface for selector information
 */
export interface SelectorInfo {
  selector: string;
  type: SelectorType;
  reliability: "high" | "medium" | "low";
}

// Define order of selector type preference
const selectorTypePreference: SelectorType[] = [
  "getByTestId", // Test IDs should be preferred first for testing
  "getByRole",
  "getByLabel",
  "getByPlaceholder",
  "getByAltText",
  "getByTitle",
  "getByText",
  "css",
  "xpath",
];

/**
 * Checks if a selector uniquely identifies exactly one element on the page
 */
async function isSelectorUnique(
  page: Page,
  selector: string,
  selectorType: SelectorType,
): Promise<boolean> {
  try {
    let count = 0;

    switch (selectorType) {
      case "css":
        count = await page.locator(selector).count();
        break;
      case "xpath":
        count = await page.locator(`xpath=${selector}`).count();
        break;
      case "getByRole": {
        // Parse role information from selector string (e.g., "button|Sign up")
        const [role, name] = selector.split("|");
        if (name) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          count = await page.getByRole(role as any, { name }).count();
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          count = await page.getByRole(role as any).count();
        }
        break;
      }
      case "getByText":
        count = await page.getByText(selector).count();
        break;
      case "getByLabel":
        count = await page.getByLabel(selector).count();
        break;
      case "getByTestId":
        count = await page.getByTestId(selector).count();
        break;
      case "getByPlaceholder":
        count = await page.getByPlaceholder(selector).count();
        break;
      case "getByAltText":
        count = await page.getByAltText(selector).count();
        break;
      case "getByTitle":
        count = await page.getByTitle(selector).count();
        break;
      default:
        return false;
    }

    return count === 1;
  } catch (error) {
    // If there's an error evaluating the selector, consider it not unique
    return false;
  }
}

/**
 * Gets the accessible name of an element following the same algorithm as Playwright.
 * This is the name that would be announced by screen readers and closely matches
 * how Playwright's own getByRole locator determines element names.
 *
 * The accessible name is determined following this priority:
 * 1. aria-label attribute
 * 2. For buttons/links: text content
 * 3. For form elements: associated label text
 * 4. For images: alt text
 * 5. aria-labelledby referenced elements
 * 6. Visible text content
 */
async function getAccessibleName(
  page: Page,
  xpath: string,
): Promise<string | null> {
  return await page.evaluate((xpath) => {
    const element = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    ).singleNodeValue as HTMLElement;

    if (!element) return null;

    // Try aria-label first
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel.trim();

    // For buttons and links, use textContent
    if (
      element.tagName.toLowerCase() === "button" ||
      element.tagName.toLowerCase() === "a" ||
      element.getAttribute("role") === "button" ||
      element.getAttribute("role") === "link"
    ) {
      return element.textContent?.trim() || null;
    }

    // For inputs with type button, submit, or reset, use value
    if (element.tagName.toLowerCase() === "input") {
      const inputType = (element as HTMLInputElement).type.toLowerCase();
      if (["button", "submit", "reset"].includes(inputType)) {
        return (element as HTMLInputElement).value || null;
      }
    }

    // For form elements, look for associated label
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent?.trim() || null;
    }

    // Check if element is nested inside a label
    let parent = element.parentElement;
    while (parent) {
      if (parent.tagName.toLowerCase() === "label") {
        return parent.textContent?.trim() || null;
      }
      parent = parent.parentElement;
    }

    // For images, use alt text
    if (element.tagName.toLowerCase() === "img") {
      return element.getAttribute("alt") || null;
    }

    // For aria-labelledby, find the referenced elements and combine their text
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      return (
        labelledBy
          .split(" ")
          .map((id) => {
            const labelElement = document.getElementById(id);
            return labelElement ? labelElement.textContent?.trim() || "" : "";
          })
          .filter((text) => text.length > 0)
          .join(" ") || null
      );
    }

    // Fallback to visible text content
    return element.textContent?.trim() || null;
  }, xpath);
}

/**
 * Compares or generates selectors using the LLM
 * @param page The Playwright page
 * @param xpath The original XPath
 * @param candidateSelectors Array of potential selectors already found
 * @param elementInfo Information about the element to help the LLM
 * @param llmClient The LLM client
 * @param logger The logger
 * @returns The best selector according to the LLM
 */
async function getLLMSelectorSuggestion(
  page: Page,
  xpath: string,
  candidateSelectors: Array<SelectorInfo>,
  elementInfo: {
    html: string;
    attributes: Record<string, string>;
  },
  llmClient: LLMClient,
  logger: Logger,
): Promise<SelectorInfo | null> {
  try {
    // Create a prompt with all candidate selectors for the LLM to evaluate
    const candidateSelectorsString = candidateSelectors
      .map(
        (selectorInfo) =>
          `- Type: ${selectorInfo.type}, Selector: "${selectorInfo.selector}", Reliability: ${selectorInfo.reliability}`,
      )
      .join("\n");

    logger.debug(
      {
        elementHTML: elementInfo.html,
        elementAttributes: elementInfo.attributes,
        xpath,
        candidateSelectors,
      },
      "candidate and other details",
    );

    // Call LLM to evaluate existing selectors or suggest a new one using generateStructuredObject
    const messages: CoreMessage[] = [
      {
        role: "system",
        content: SELECTOR_EVALUATION_PROMPT,
      },
      {
        role: "user",
        content: `I need to choose or create the most stable selector for an element.

Element HTML: ${elementInfo.html}
Element Attributes: ${JSON.stringify(elementInfo.attributes)}
Original XPath: ${xpath}

Candidate selectors found by automated analysis:
${candidateSelectorsString}

Please evaluate these selectors or suggest a better one.`,
      },
    ];
    const suggestedSelector = await llmClient.generateStructuredObject<{
      type: SelectorType;
      selector: string;
      reliability: "high" | "medium" | "low";
      explanation: string;
    }>({
      messages,
      schema: z.object({
        type: z.enum([
          "getByRole",
          "getByTestId",
          "getByText",
          "getByLabel",
          "getByPlaceholder",
          "getByAltText",
          "getByTitle",
          "css",
          "xpath",
        ]),
        selector: z.string(),
        reliability: z.enum(["high", "medium", "low"]),
        explanation: z.string(),
      }),
      temperature: 0.1,
      requestId: "selector-evaluation",
    });

    if (suggestedSelector && typeof suggestedSelector.selector === "string") {
      // Verify the suggested selector is valid and unique
      const isUnique = await isSelectorUnique(
        page,
        suggestedSelector.selector,
        suggestedSelector.type,
      );

      if (isUnique) {
        logger.debug({
          category: "selector",
          message: "Using LLM-evaluated selector",
          level: 1,
          auxiliary: {
            originalXPath: {
              value: xpath,
              type: "string",
            },
            llmSelector: {
              value: suggestedSelector.selector,
              type: "string",
            },
            llmSelectorType: {
              value: suggestedSelector.type,
              type: "string",
            },
            explanation: {
              value: suggestedSelector.explanation || "No explanation provided",
              type: "string",
            },
          },
        });

        return {
          selector: suggestedSelector.selector,
          type: suggestedSelector.type,
          reliability: suggestedSelector.reliability,
        };
      } else {
        logger.debug({
          category: "selector",
          message: "LLM suggested selector is not unique, rejecting",
          suggestedSelector,
          level: 1,
        });
      }
    }
  } catch (error) {
    logger.error({
      category: "selector",
      message: "Error getting LLM selector suggestion",
      level: 1,
      error,
    });
  }

  return null;
}

/**
 * Attempts to find a stable selector for an element that was originally targeted with XPath.
 * Uses a progressive enhancement approach that tries increasingly more brittle selectors
 * until it finds one that uniquely identifies the element.
 *
 * The approach prioritizes accessibility-first selectors like getByRole which are:
 * - More resilient to UI changes
 * - Better aligned with how real users (including those with assistive technologies) interact with the page
 * - Encourages accessible web development practices
 *
 * Falls back to the original XPath if no better selector can be found.
 */
export async function findStableSelector(
  page: Page,
  xpath: string,
  logger: Logger,
  llmClient?: LLMClient,
): Promise<SelectorInfo> {
  try {
    const cleanedXpath = xpath.replace(/^xpath=/, "").trim();

    // First, try to locate the element with the provided XPath
    const xpathLocator = page.locator(`xpath=${cleanedXpath}`).first();

    // Check if the original XPath is valid
    try {
      await xpathLocator.waitFor({ state: "attached", timeout: 1000 });
    } catch (error) {
      logger.warn({
        category: "selector",
        message: "Original XPath is invalid, returning as is",
        level: 1,
        auxiliary: {
          xpath: {
            value: xpath,
            type: "string",
          },
        },
      });
      return { selector: xpath, type: "xpath", reliability: "low" };
    }

    // Array to store all candidate selectors we find
    const candidateSelectors: SelectorInfo[] = [];

    // --- Priority 1: getByTestId (highest priority for testing) ---
    const testIdInfo = await xpathLocator.evaluate((el) => {
      const testAttrs = [
        { attr: "data-testid", value: el.getAttribute("data-testid") },
        { attr: "data-test-id", value: el.getAttribute("data-test-id") },
        { attr: "data-qa", value: el.getAttribute("data-qa") },
        { attr: "data-cy", value: el.getAttribute("data-cy") },
        { attr: "data-e2e", value: el.getAttribute("data-e2e") },
      ];
      const found = testAttrs.find((item) => item.value);
      return found ? { attr: found.attr, value: found.value } : null;
    });

    if (testIdInfo) {
      logger.debug({
        category: "selector",
        message: "Found data test attribute",
        level: 1,
        auxiliary: {
          testIdInfo: {
            value: testIdInfo,
            type: "object",
          },
          xpath: {
            value: xpath,
            type: "string",
          },
        },
      });

      const testId = testIdInfo.value;
      const testAttr = testIdInfo.attr;

      // For standard data-testid, still use getByTestId for better readability in test code
      if (testAttr === "data-testid" && testId) {
        const isUnique = await isSelectorUnique(page, testId, "getByTestId");

        if (isUnique) {
          logger.debug({
            category: "selector",
            message: "Found getByTestId selector",
            level: 1,
            auxiliary: {
              originalXPath: {
                value: xpath,
                type: "string",
              },
              selector: {
                value: testId,
                type: "string",
              },
            },
          });
          return {
            selector: testId,
            type: "getByTestId",
            reliability: "high",
          };
        }

        candidateSelectors.push({
          selector: testId,
          type: "getByTestId",
          reliability: "medium",
        });
      } else if (testId) {
        // For other test attributes, use CSS attribute selector
        const cssSelector = `[${testAttr}="${testId}"]`;
        const isUnique = await isSelectorUnique(page, cssSelector, "css");

        if (isUnique) {
          logger.debug({
            category: "selector",
            message: "Found CSS attribute selector",
            level: 1,
            auxiliary: {
              originalXPath: {
                value: xpath,
                type: "string",
              },
              selector: {
                value: cssSelector,
                type: "string",
              },
            },
          });
          return {
            selector: cssSelector,
            type: "css",
            reliability: "high",
          };
        }

        candidateSelectors.push({
          selector: cssSelector,
          type: "css",
          reliability: "medium",
        });
      }
    }

    // --- Priority 2: getByLabel for form elements ---
    const tagName = await xpathLocator.evaluate((el) =>
      el.tagName.toLowerCase(),
    );
    // Define labelElement here so it can be accessed throughout the function
    let labelElement: string | null = null;
    if (["input", "select", "textarea"].includes(tagName)) {
      const rawLabelElement = await page.evaluate((xpath) => {
        const element = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null,
        ).singleNodeValue as HTMLElement;

        if (!element) return null;

        // Check if element has an ID that might be referenced by a label
        const id = element.id;
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          return label ? label.textContent?.trim() : null;
        }

        // Check if element is nested inside a label
        let parent = element.parentElement;
        while (parent) {
          if (parent.tagName.toLowerCase() === "label") {
            return parent.textContent?.trim();
          }
          parent = parent.parentElement;
        }

        return null;
      }, xpath);

      // Ensure labelElement is always string | null
      labelElement = rawLabelElement || null;

      if (labelElement) {
        const isUnique = await isSelectorUnique(
          page,
          labelElement,
          "getByLabel",
        );

        if (isUnique) {
          // For labeled form elements, return immediately as this is a good selector
          logger.debug({
            category: "selector",
            message: "Found getByLabel selector",
            level: 1,
            auxiliary: {
              originalXPath: {
                value: xpath,
                type: "string",
              },
              selector: {
                value: labelElement,
                type: "string",
              },
            },
          });
          return {
            selector: labelElement,
            type: "getByLabel",
            reliability: "high",
          };
        }
      }
    }

    // --- Priority 3: getByRole with accessible name ---
    // First determine if the element has a role (explicit or implicit)
    const explicitRole = await xpathLocator.evaluate((el) =>
      el.getAttribute("role"),
    );

    // Map common elements to their implicit ARIA roles
    let implicitRole: string | null = null;
    if (
      [
        "button",
        "a",
        "input",
        "select",
        "textarea",
        "img",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
      ].includes(tagName)
    ) {
      switch (tagName) {
        case "button":
          implicitRole = "button";
          break;
        case "a":
          implicitRole = "link";
          break;
        case "input": {
          const type = await xpathLocator.evaluate(
            (el) => (el as HTMLInputElement).type,
          );
          if (type === "checkbox") implicitRole = "checkbox";
          else if (type === "radio") implicitRole = "radio";
          else if (type === "button" || type === "submit" || type === "reset")
            implicitRole = "button";
          else implicitRole = "textbox";
          break;
        }
        case "select":
          implicitRole = "combobox";
          break;
        case "textarea":
          implicitRole = "textbox";
          break;
        case "img":
          implicitRole = "img";
          break;
        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6":
          implicitRole = "heading";
          break;
      }
    }

    // Get the role (explicit takes precedence over implicit)
    const role = explicitRole || implicitRole;

    if (role) {
      // Get accessible name following the same algorithm as Playwright
      const accessibleName = await getAccessibleName(page, xpath);

      if (accessibleName) {
        const roleSelector = `${role}|${accessibleName}`;
        const isUnique = await isSelectorUnique(
          page,
          roleSelector,
          "getByRole",
        );

        if (isUnique) {
          candidateSelectors.push({
            selector: roleSelector,
            type: "getByRole",
            reliability: "high",
          });
        }
      } else {
        // Try just the role without a name
        const isUnique = await isSelectorUnique(page, role, "getByRole");

        if (isUnique) {
          candidateSelectors.push({
            selector: role,
            type: "getByRole",
            reliability: "medium",
          });
        }
      }
    }

    // Try to get role information
    const ariaLabel = await xpathLocator.evaluate((el) =>
      el.getAttribute("aria-label"),
    );

    // If we have both role and a name (aria-label), try getByRole
    if (role && ariaLabel) {
      const roleSelector = `${role}|${ariaLabel}`;
      const isUnique = await isSelectorUnique(page, roleSelector, "getByRole");

      if (isUnique) {
        candidateSelectors.push({
          selector: roleSelector,
          type: "getByRole",
          reliability: "high",
        });
      }
    }

    // Try getByText for elements with visible text
    const textContent = await xpathLocator.evaluate((el) => {
      return (
        (el as HTMLElement).innerText?.trim() ||
        (el as HTMLElement).textContent?.trim() ||
        ""
      );
    });

    if (textContent && textContent.length > 0 && textContent.length < 100) {
      const isUnique = await isSelectorUnique(page, textContent, "getByText");

      if (isUnique) {
        candidateSelectors.push({
          selector: textContent,
          type: "getByText",
          reliability: "medium",
        });
      }
    }

    // Try getByPlaceholder for form elements
    const placeholder = await xpathLocator.evaluate((el) =>
      el.getAttribute("placeholder"),
    );

    if (placeholder) {
      const isUnique = await isSelectorUnique(
        page,
        placeholder,
        "getByPlaceholder",
      );

      if (isUnique) {
        candidateSelectors.push({
          selector: placeholder,
          type: "getByPlaceholder",
          reliability: "high",
        });
      }
    }

    // Try getByAltText for images
    const altText = await xpathLocator.evaluate((el) => el.getAttribute("alt"));

    if (altText) {
      const isUnique = await isSelectorUnique(page, altText, "getByAltText");

      if (isUnique) {
        candidateSelectors.push({
          selector: altText,
          type: "getByAltText",
          reliability: "high",
        });
      }
    }

    // Try getByTitle for elements with title attributes
    const title = await xpathLocator.evaluate((el) => el.getAttribute("title"));

    if (title) {
      const isUnique = await isSelectorUnique(page, title, "getByTitle");

      if (isUnique) {
        candidateSelectors.push({
          selector: title,
          type: "getByTitle",
          reliability: "high",
        });
      }
    }

    // Try CSS selectors based on attributes as a fallback
    for (const attr of SELECTOR_PRIORITY_ATTRIBUTES) {
      const attrValue = await xpathLocator.evaluate(
        (el, attr) => el.getAttribute(attr),
        attr,
      );

      if (attrValue) {
        // Construct CSS selector based on the attribute
        let cssSelector: string;

        if (attr === "id") {
          cssSelector = `#${cssEscape(attrValue)}`;
        } else {
          cssSelector = `[${attr}="${attrValue.replace(/"/g, '\\"')}"]`;
        }

        // Check if this selector uniquely identifies the element
        const isUnique = await isSelectorUnique(page, cssSelector, "css");

        if (isUnique) {
          candidateSelectors.push({
            selector: cssSelector,
            type: "css",
            reliability:
              attr.startsWith("data-test") || attr === "id" ? "high" : "medium",
          });
        }
      }
    }

    // Always add the original XPath as the final fallback
    candidateSelectors.push({
      selector: xpath,
      type: "xpath",
      reliability: "low",
    });

    // Gather element information for LLM evaluation
    const elementHtml = await xpathLocator.evaluate((el) => el.outerHTML);
    const elementAttrs = await xpathLocator.evaluate((el) => {
      const attrs: Record<string, string> = {};
      for (const attr of el.attributes) {
        attrs[attr.name] = attr.value;
      }
      return attrs;
    });

    // If LLM client is provided, always use it to evaluate or suggest selectors
    if (llmClient) {
      const llmSelector = await getLLMSelectorSuggestion(
        page,
        xpath,
        candidateSelectors,
        {
          html: elementHtml,
          attributes: elementAttrs,
        },
        llmClient,
        logger,
      );

      if (llmSelector) {
        return llmSelector;
      }
    }

    // If the LLM didn't provide a selector or wasn't available, use our best candidate
    // Sort by reliability (high > medium > low) and then by selector type preference
    if (candidateSelectors.length > 0) {
      // Sort candidateSelectors by reliability and preference
      candidateSelectors.sort((a, b) => {
        // First sort by reliability
        const reliabilityOrder = { high: 0, medium: 1, low: 2 };
        const reliabilityComparison =
          reliabilityOrder[a.reliability] - reliabilityOrder[b.reliability];

        if (reliabilityComparison !== 0) {
          return reliabilityComparison;
        }

        // If reliability is the same, sort by selector type preference
        return (
          selectorTypePreference.indexOf(a.type) -
          selectorTypePreference.indexOf(b.type)
        );
      });

      // Log all candidate selectors for debugging
      logger.warn({
        category: "selector",
        message: "Candidate selectors found",
        level: 1,
        auxiliary: {
          originalXPath: {
            value: xpath,
            type: "string",
          },
          candidateSelectors: candidateSelectors,
        },
      });

      // We've checked candidateSelectors.length > 0, so this will exist
      // Use as SelectorInfo to tell TypeScript this is never undefined
      const bestSelector = candidateSelectors[0] as SelectorInfo;

      logger.warn({
        category: "selector",
        message: `Selected ${bestSelector.type} selector with ${bestSelector.reliability} reliability`,
        level: 1,
        auxiliary: {
          originalXPath: {
            value: xpath,
            type: "string",
          },
          selector: {
            value: bestSelector.selector,
            type: "string",
          },
        },
      });

      return bestSelector;
    }

    // Fallback to original XPath if no better selectors found
    logger.warn({
      category: "selector",
      message: "No stable selector found, using original XPath",
      level: 1,
      auxiliary: {
        xpath: {
          value: xpath,
          type: "string",
        },
      },
    });

    return { selector: xpath, type: "xpath", reliability: "low" };
  } catch (error) {
    logger.warn({
      category: "selector",
      message: "Error finding stable selector",
      level: 1,
      error,
      auxiliary: {
        xpath: {
          value: xpath,
          type: "string",
        },
      },
    });

    // Fallback to original XPath on error
    return { selector: xpath, type: "xpath", reliability: "low" };
  }
}

/**
 * Creates a Playwright locator using the most stable selector available
 */
export function createStableLocator(
  page: Page,
  selectorInfo: SelectorInfo,
): Locator {
  const { selector, type } = selectorInfo;

  switch (type) {
    case "css":
      return page.locator(selector).first();
    case "xpath":
      return page.locator(`xpath=${selector}`).first();
    case "getByRole": {
      // Parse role|name format
      const [role, name] = selector.split("|");

      /* eslint-disable @typescript-eslint/no-explicit-any */
      return name
        ? page.getByRole(role as any, { name }).first()
        : page.getByRole(role as any).first();
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }
    case "getByText":
      return page.getByText(selector).first();
    case "getByLabel":
      return page.getByLabel(selector).first();
    case "getByTestId":
      return page.getByTestId(selector).first();
    case "getByPlaceholder":
      return page.getByPlaceholder(selector).first();
    case "getByAltText":
      return page.getByAltText(selector).first();
    case "getByTitle":
      return page.getByTitle(selector).first();
    default:
      return page.locator(selector).first();
  }
}
