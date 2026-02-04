/**
 * Utility for generating Playwright code from planning agent output
 * This converts act and assert steps into executable Playwright test code
 * using command details returned from the act and assert handlers
 */

import type { PlanStep } from "../browser/types/plan.js";
import type { ActResult, AssertResult } from "../browser/types/browserAgent.js";
import type { SelectorType } from "../shared/index.js";

/**
 * Default timeout in milliseconds for waiting for elements to be present
 */
const DEFAULT_TIMEOUT = 30000;
const CONDITIONAL_TIMEOUT = 10000;

const TIMEOUT_VAR = "POSIUM_LOCATOR_WAIT_TIMEOUT";
const CONDITIONAL_TIMEOUT_VAR = "POSIUM_LOCATOR_WAIT_TIMEOUT_CONDITIONAL";

interface GotoStepCommandDetails {
  method: string;
  url: string;
  args: unknown[];
}

interface GeneratePlaywrightTestOptions {
  /** Array of plan steps to be converted into test steps */
  planSteps: PlanStep[];
  /** Map of act step results indexed by step number */
  actResults: Map<number, ActResult>;
  /** Map of assert step results indexed by step number */
  assertResults: Map<number, AssertResult>;
  /** Name of the test to be displayed in test runner */
  testName?: string;
  /** Timeout in milliseconds for waiting for elements to be present */
  timeout?: number;
  /** Map of variables to be used in the test, keyed by variable name */
  variables?: Record<string, unknown>;
}

interface ConvertPlanExecutionToTestOptions {
  /** Array of plan steps to be converted */
  steps: PlanStep[];
  /** Name of the test to be displayed in test runner */
  testName?: string;
  /** Timeout in milliseconds for waiting for elements to be present */
  timeout?: number;
  /** Map of variables to be used in the test, keyed by variable name */
  variables?: Record<string, unknown>;
}

interface ConvertPlanExecutionToRawCodeOptions {
  /** Array of plan steps to be converted */
  steps: PlanStep[];
  timeout?: number;
  conditionalTimeout?: number;
  variables?: Record<string, unknown>;
}

/**
 * Converts a completed plan into a Playwright test
 * @param options - Options for generating the test
 * @returns Generated Playwright test code
 */
function generatePlaywrightTest({
  planSteps,
  actResults,
  assertResults,
  testName = "Automated Test",
  timeout = DEFAULT_TIMEOUT,
  variables = {},
}: GeneratePlaywrightTestOptions): string {
  let code = `import { test, expect } from '@playwright/test';\n`;

  // Add timeout constants at the top of the test
  code += `// Timeout for waiting for elements to be present (in milliseconds)\n`;
  code += `const ${TIMEOUT_VAR} = ${timeout};\n`;
  code += `const ${CONDITIONAL_TIMEOUT_VAR} = ${CONDITIONAL_TIMEOUT};\n\n`;

  // Add variable declarations
  if (Object.keys(variables).length > 0) {
    code += `// Test variables\n`;
    Object.entries(variables).forEach(([key, value]) => {
      if (typeof value === "string") {
        code += `let ${key} = '${value.replace(/'/g, "\\'")}';\n`;
      } else if (typeof value === "number" || typeof value === "boolean") {
        code += `let ${key} = ${value};\n`;
      } else if (value === null) {
        code += `let ${key} = null;\n`;
      } else if (Array.isArray(value)) {
        code += `let ${key} = ${JSON.stringify(value)};\n`;
      } else if (typeof value === "object") {
        code += `let ${key} = ${JSON.stringify(value)};\n`;
      }
    });
    code += `\n`;
  }

  code += `test('${testName}', async ({ page }) => {\n`;

  planSteps.forEach((step: PlanStep, index: number) => {
    // Add a step block for each plan step
    const stepName = `Step ${index + 1}: ${step.description}`;
    code += `  await test.step('${stepName.replace(/'/g, "\\'")}', async () => {\n`;

    // For conditional steps, wrap in try-catch
    if (step.conditional) {
      code += `    try {\n`;
    }

    if (step.type === "act") {
      const result = actResults.get(index);

      if (result?.success && result.commandDetails) {
        const { method, xpath, args, selector, selectorType } =
          result.commandDetails;

        // Use variable names for timeouts in the test file
        const timeoutVar = step.conditional
          ? CONDITIONAL_TIMEOUT_VAR
          : TIMEOUT_VAR;
        const command = actCommandToPlaywright(
          method,
          xpath,
          args,
          timeoutVar,
          index,
          selector,
          selectorType,
          step.conditional,
        );
        code += `      ${command}\n`;
      } else {
        code += `      // Step ${index + 1}: Action could not be converted to code\n`;
      }
    } else if (step.type === "assert") {
      const result = assertResults.get(index);

      if (result?.success && result.commandDetails) {
        const { method, xpath, value, selector, selectorType } =
          result.commandDetails;
        // Use variable names for timeouts in the test file
        const timeoutVar = step.conditional
          ? CONDITIONAL_TIMEOUT_VAR
          : TIMEOUT_VAR;
        const command = assertCommandToPlaywright(
          method,
          xpath,
          value,
          timeoutVar,
          index,
          selector,
          selectorType,
          step.conditional,
        );
        code += `      ${command}\n`;
      } else {
        code += `      // Step ${index + 1}: Assertion could not be converted to code\n`;
      }
    } else if (step.type === "goto") {
      code += `      // Step ${index + 1}: Navigation - ${step.description}\n`;
      if (step.command && step.command.success && step.command.commandDetails) {
        const commandDetails = step.command
          .commandDetails as unknown as GotoStepCommandDetails;
        const { args } = commandDetails;
        code += `      await page.goto(${formatArgs(args)});\n`;
      } else {
        code += `      // Goto command details not found or step failed\n`;
      }
    }

    // Close try-catch block for conditional steps
    if (step.conditional) {
      code += `    } catch (error) {\n`;
      code += `      // This is a conditional step, so we can continue even if it fails\n`;
      code += `      console.log('Conditional step failed:', error);\n`;
      code += `    }\n`;
    }

    code += `  });\n`;
  });

  code += "});\n";
  return code;
}

/**
 * Converts a stable selector and type to a Playwright locator creation code
 * @param selector - The selector string
 * @param selectorType - The type of selector (getByRole, css, xpath, etc.)
 * @returns Playwright selector code
 */
export function stableSelectorToPlaywright(
  selector: string,
  selectorType: SelectorType = "xpath",
): string {
  switch (selectorType) {
    case "getByRole": {
      // For getByRole, we use the format 'role|name' which needs to be parsed
      const [role, name] = selector.split("|");
      if (name && name.length > 0) {
        return `page.getByRole('${role}', { name: '${name.replace(/'/g, "\\'")}' })`;
      } else {
        return `page.getByRole('${role}')`;
      }
    }
    case "getByText":
      return `page.getByText('${selector.replace(/'/g, "\\'")}')`;
    case "getByLabel":
      return `page.getByLabel('${selector.replace(/'/g, "\\'")}')`;
    case "getByPlaceholder":
      return `page.getByPlaceholder('${selector.replace(/'/g, "\\'")}')`;
    case "getByAltText":
      return `page.getByAltText('${selector.replace(/'/g, "\\'")}')`;
    case "getByTitle":
      return `page.getByTitle('${selector.replace(/'/g, "\\'")}')`;
    case "getByTestId":
      return `page.getByTestId('${selector.replace(/'/g, "\\'")}')`;
    case "css":
      return `page.locator('${selector.replace(/'/g, "\\'")}')`;
    case "xpath":
    default:
      return `page.locator('xpath=${selector.replace(/'/g, "\\'")}')`;
  }
}

/**
 * Wraps code in a try-catch block for conditional steps
 * @param code - The code to wrap
 * @param isConditional - Whether this is a conditional step
 * @returns Wrapped code string
 */
function wrapConditionalStep(code: string, isConditional: boolean): string {
  if (!isConditional) {
    return code;
  }
  return `try {\n${code}\n} catch (error) {\n  // Element not found, skipping conditional step\n}`;
}

/**
 * Converts an act command to Playwright code
 * @param method - Method name
 * @param xpath - Element selector (XPath)
 * @param args - Method arguments
 * @param timeout - Timeout value in milliseconds or variable name
 * @param stepNumber - Step number in the plan (for variable naming)
 * @param selector - Optional stable selector
 * @param selectorType - Optional stable selector type
 * @param isConditional - Whether this is a conditional step
 * @returns Playwright code string
 */
function actCommandToPlaywright(
  method: string,
  xpath: string,
  args: unknown,
  timeout: number | string,
  stepNumber = 0,
  selector?: string,
  selectorType?: SelectorType,
  isConditional = false,
): string {
  // Handle navigation
  if (method === "goto") {
    return `await page.goto(${formatArgs(args)});`;
  }

  // Determine which locator approach to use - prefer stable selectors if available
  const useStableSelector =
    selector && selectorType && selectorType !== "xpath";

  // Create a locator with the wait-for-element functionality for element interactions
  let locatorCode;
  if (useStableSelector) {
    locatorCode = `const locator_step${stepNumber}_${method.replace(/\./g, "_")} = ${stableSelectorToPlaywright(selector, selectorType)};`;
  } else if (xpath) {
    locatorCode = `const locator_step${stepNumber}_${method.replace(/\./g, "_")} = page.locator(${formatSelector(xpath)});`;
  } else {
    locatorCode = "";
  }

  // Add visibility check
  locatorCode += `\n    await locator_step${stepNumber}_${method.replace(/\./g, "_")}.waitFor({ state: 'visible', timeout: ${timeout} });`;

  // Handle click
  if (method === "click") {
    return `${locatorCode}\n    await locator_step${stepNumber}_${method.replace(/\./g, "_")}.click();`;
  }

  // Handle type/fill
  if (method === "type" || method === "fill") {
    return `${locatorCode}\n    await locator_step${stepNumber}_${method.replace(/\./g, "_")}.fill(${formatArgs(args)});`;
  }

  // Handle select options
  if (method === "selectOption") {
    return `${locatorCode}\n    await locator_step${stepNumber}_${method.replace(/\./g, "_")}.selectOption(${formatArgs(args)});`;
  }

  // Handle check/uncheck
  if (method === "check") {
    return `${locatorCode}\n    await locator_step${stepNumber}_${method.replace(/\./g, "_")}.check();`;
  }

  if (method === "uncheck") {
    return `${locatorCode}\n    await locator_step${stepNumber}_${method.replace(/\./g, "_")}.uncheck();`;
  }

  // Default for other methods
  return `${locatorCode}\n    await locator_step${stepNumber}_${method.replace(/\./g, "_")}.${method}(${formatArgs(args)});`;
}

/**
 * Converts an assert command to Playwright code
 * @param method - Assertion method name
 * @param xpath - Element selector
 * @param value - Expected value
 * @param timeout - Timeout value in milliseconds or variable name
 * @param stepNumber - Step number in the plan (for variable naming)
 * @param selector - Optional stable selector
 * @param selectorType - Optional stable selector type
 * @param isConditional - Whether this is a conditional step
 * @returns Playwright code string
 */
function assertCommandToPlaywright(
  method: string,
  xpath: string | null,
  value: unknown,
  timeout: number | string,
  stepNumber = 0,
  selector?: string,
  selectorType?: SelectorType,
  isConditional = false,
): string {
  // For assertions that don't require an element
  if (!xpath) {
    if (method === "url") {
      return `await expect(page).toHaveURL(${formatArgs(value)});`;
    }
    if (method === "title") {
      return `await expect(page).toHaveTitle(${formatArgs(value)});`;
    }
    return `// Unsupported assertion: ${method}`;
  }

  // Determine which locator approach to use - prefer stable selectors if available
  const useStableSelector =
    selector && selectorType && selectorType !== "xpath";

  // Create a locator
  let locatorCode;
  if (useStableSelector) {
    locatorCode = `const locator_step${stepNumber}_assert = ${stableSelectorToPlaywright(selector, selectorType)};`;
  } else {
    locatorCode = `const locator_step${stepNumber}_assert = page.locator(${formatSelector(xpath)});`;
  }

  // Add visibility check
  locatorCode += `\n    await locator_step${stepNumber}_assert.waitFor({ state: 'visible', timeout: ${timeout} });`;

  // Handle all the new assertion methods
  switch (method) {
    case "toBeVisible":
      return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toBeVisible({ timeout: ${timeout} });`;

    case "toBeHidden":
      return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toBeHidden({ timeout: ${timeout} });`;

    case "toHaveText":
      if (value instanceof RegExp) {
        return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toHaveText(${value}, { timeout: ${timeout} });`;
      }
      return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toHaveText(${formatArgs(value)}, { timeout: ${timeout} });`;

    case "toHaveValue":
      return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toHaveValue(${formatArgs(value)}, { timeout: ${timeout} });`;

    case "toBeEnabled":
      return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toBeEnabled({ timeout: ${timeout} });`;

    case "toBeDisabled":
      return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toBeDisabled({ timeout: ${timeout} });`;

    case "toBeChecked":
      return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toBeChecked({ timeout: ${timeout} });`;

    case "toHaveAttribute": {
      const [attr, attrValue] = value?.toString().split("=") || [];
      if (attr && attrValue) {
        return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toHaveAttribute('${attr}', ${formatArgs(attrValue)}, { timeout: ${timeout} });`;
      }
      break;
    }

    case "toHaveCSS": {
      const [property, cssValue] = value?.toString().split("=") || [];
      if (property && cssValue) {
        return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toHaveCSS('${property}', ${formatArgs(cssValue)}, { timeout: ${timeout} });`;
      }
      break;
    }

    case "toBeAttached":
      return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toBeAttached({ timeout: ${timeout} });`;

    case "toBeEmpty":
      return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toBeEmpty({ timeout: ${timeout} });`;

    case "toBeFocused":
      return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toBeFocused({ timeout: ${timeout} });`;

    case "toBeInViewport":
      return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toBeInViewport({ timeout: ${timeout} });`;

    case "toHaveCount":
      return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toHaveCount(${Number(value)}, { timeout: ${timeout} });`;

    case "toHaveClass":
      return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toHaveClass(${formatArgs(value)}, { timeout: ${timeout} });`;

    case "toHaveId":
      return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toHaveId(${formatArgs(value)}, { timeout: ${timeout} });`;

    case "toHaveRole":
      return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toHaveRole(${formatArgs(value)}, { timeout: ${timeout} });`;

    case "toHaveScreenshot":
      return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toHaveScreenshot(${formatArgs(value)}, { timeout: ${timeout} });`;

    case "toHaveValues": {
      const values = Array.isArray(value) ? value : [value];
      return `${locatorCode}\n    await expect(locator_step${stepNumber}_assert).toHaveValues(${formatArgs(values)}, { timeout: ${timeout} })`;
    }

    default:
      return `// Unsupported assertion: ${method}`;
  }

  return `// Invalid assertion parameters for: ${method}`;
}

/**
 * Formats method arguments for Playwright code
 * @param args - Arguments to format
 * @returns Formatted arguments string
 */
function formatArgs(args: unknown): string {
  if (typeof args === "string") {
    // Check if the string is wrapped with {{...}}
    if (args.startsWith("{{") && args.endsWith("}}")) {
      // Extract the variable name and return it directly
      return args.substring(2, args.length - 2);
    }
    return `'${args.replace(/'/g, "\\'")}'`;
  }

  if (typeof args === "number" || typeof args === "boolean") {
    return args.toString();
  }

  if (args === null || args === undefined) {
    return "null";
  }

  if (Array.isArray(args)) {
    // If array has only one element, just use that element directly
    if (args.length === 1) {
      return formatArgs(args[0]);
    }
    return `[${args.map((arg) => formatArgs(arg)).join(", ")}]`;
  }

  if (typeof args === "object" && args !== null) {
    // Convert object to JSON string
    const serialized = JSON.stringify(args)
      .replace(/"/g, "'")
      .replace(/'([^']+)':/g, "$1:");
    return serialized;
  }

  return `'${String(args)}'`;
}

/**
 * Formats a selector string for Playwright
 * @param selector - Element selector
 * @param selectorType - Type of selector (getByRole, css, xpath, etc.)
 * @returns Formatted selector string
 */
function formatSelector(
  selector: string,
  selectorType: SelectorType = "xpath",
): string {
  if (selectorType === "xpath") {
    return `\`${xpathToPlaywrightSelector(selector)}\``;
  }
  // For other selector types, we'll handle them directly in the stableSelectorToPlaywright function
  return "";
}

/**
 * Converts XPath to a Playwright selector
 * @param xpath - XPath selector
 * @returns Playwright selector string
 * @deprecated Use stableSelectorToPlaywright instead
 */
function xpathToPlaywrightSelector(xpath: string): string {
  // For simplicity, we're using xpath directly in this version
  // Playwright supports xpath with the xpath= prefix
  return `xpath=${xpath}`;
}

/**
 * Converts plan execution results into a Playwright test
 * @param options - Options for converting the plan to a test
 * @returns Complete Playwright test code
 */
export function convertPlanExecutionToTest({
  steps,
  testName = "Automated Test",
  timeout = DEFAULT_TIMEOUT,
  variables = {},
}: ConvertPlanExecutionToTestOptions): string {
  // Create maps for act and assert results directly from the steps
  const actResults = new Map<number, ActResult>();
  const assertResults = new Map<number, AssertResult>();

  // Extract command results directly from the steps
  steps.forEach((step, index) => {
    if (!step.command) return;

    if (step.type === "act" && "action" in step.command) {
      actResults.set(index, step.command as ActResult);
    } else if (step.type === "assert" && "action" in step.command) {
      assertResults.set(index, step.command as AssertResult);
    }
  });

  return generatePlaywrightTest({
    planSteps: steps,
    actResults,
    assertResults,
    testName,
    timeout,
    variables,
  });
}

/**
 * Converts plan execution results into raw Playwright commands
 * @param options - Options for converting the plan to raw code
 * @returns Only the raw Playwright commands without test wrapper or imports
 */
function convertPlanExecutionToRawCode({
  steps,
  timeout = DEFAULT_TIMEOUT,
  conditionalTimeout = CONDITIONAL_TIMEOUT,
  variables = {},
}: ConvertPlanExecutionToRawCodeOptions): string {
  let code = "";

  // Add variable declarations
  if (Object.keys(variables).length > 0) {
    code += `// Test variables\n`;
    Object.entries(variables).forEach(([key, value]) => {
      if (typeof value === "string") {
        code += `let ${key} = '${value.replace(/'/g, "\\'")}';\n`;
      } else if (typeof value === "number" || typeof value === "boolean") {
        code += `let ${key} = ${value};\n`;
      } else if (value === null) {
        code += `let ${key} = null;\n`;
      } else if (Array.isArray(value)) {
        code += `let ${key} = ${JSON.stringify(value)};\n`;
      } else if (typeof value === "object") {
        code += `let ${key} = ${JSON.stringify(value)};\n`;
      }
    });
    code += `\n`;
  }

  // Create maps for act and assert results directly from the steps
  const actResults = new Map<number, ActResult>();
  const assertResults = new Map<number, AssertResult>();

  // Extract command results directly from the steps
  steps.forEach((step, index) => {
    if (!step.command) return;

    if (step.type === "act" && "action" in step.command) {
      actResults.set(index, step.command as ActResult);
    } else if (step.type === "assert" && "action" in step.command) {
      assertResults.set(index, step.command as AssertResult);
    }
  });

  // Remove timeout variable and directly embed values

  // Generate raw code for each step
  steps.forEach((step: PlanStep, index: number) => {
    // Add a comment for each step
    const stepName = `Step ${index + 1}: ${step.description}`;
    code += `// ${stepName}\n`;

    // For conditional steps, wrap in try-catch
    if (step.conditional) {
      code += `try {\n`;
    }

    if (step.type === "act") {
      const result = actResults.get(index);

      if (result?.success && result.commandDetails) {
        const { method, xpath, args, selector, selectorType } =
          result.commandDetails;
        // Use actual timeout values in raw code
        const timeoutValue = step.conditional ? conditionalTimeout : timeout;
        const rawCommand = actCommandToPlaywright(
          method,
          xpath,
          args,
          timeoutValue,
          index,
          selector,
          selectorType,
          step.conditional,
        );
        code += `${rawCommand}\n\n`;
      } else {
        code += `// Action could not be converted to code\n\n`;
      }
    } else if (step.type === "assert") {
      const result = assertResults.get(index);

      if (result?.success && result.commandDetails) {
        const { method, xpath, value, selector, selectorType } =
          result.commandDetails;
        // Use actual timeout values in raw code
        const timeoutValue = step.conditional ? conditionalTimeout : timeout;
        const rawCommand = assertCommandToPlaywright(
          method,
          xpath,
          value,
          timeoutValue,
          index,
          selector,
          selectorType,
          step.conditional,
        );
        code += `${rawCommand}\n\n`;
      } else {
        code += `// Assertion could not be converted to code\n\n`;
      }
    } else if (step.type === "goto") {
      code += `// Navigation command - ${step.description}\n`;
      if (step.command && step.command.success && step.command.commandDetails) {
        const commandDetails = step.command
          .commandDetails as unknown as GotoStepCommandDetails;
        const { args } = commandDetails;
        code += `await page.goto(${formatArgs(args)});\n`;
      } else {
        code += `// Goto command details not found or step failed\n`;
      }
      code += `\n`;
    }

    // Close try-catch block for conditional steps
    if (step.conditional) {
      code += `} catch (error) {\n`;
      code += `  // This is a conditional step, so we can continue even if it fails\n`;
      code += `  console.log('Conditional step failed:', error);\n`;
      code += `}\n\n`;
    }
  });

  return code;
}

/**
 * Helper function to replace timeout variable references with the actual value
 * @param code - The code string containing timeout variable references
 * @param timeout - The timeout value to embed
 * @returns Code with timeout values directly embedded
 */
function replaceTimeoutVar(code: string, timeout: number): string {
  return code.replace(new RegExp(`${TIMEOUT_VAR}`, "g"), timeout.toString());
}

// Export other functions that might be useful externally
export {
  generatePlaywrightTest,
  actCommandToPlaywright,
  assertCommandToPlaywright,
  xpathToPlaywrightSelector,
  formatArgs,
  formatSelector,
  DEFAULT_TIMEOUT,
  convertPlanExecutionToRawCode,
};
