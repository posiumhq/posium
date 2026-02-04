/**
 * Dynamic Playwright Code Runner
 *
 * @module dynamicRunner
 *
 * ⚠️ SECURITY NOTICE ⚠️
 *
 * This module uses `new Function()` to execute dynamically generated Playwright
 * test code. This is intentional and required for the following use cases:
 *
 * 1. Executing AI-generated test code on Posium's infrastructure
 * 2. Running customer tests that are generated from natural language descriptions
 * 3. Enabling dynamic test execution without requiring file system access
 *
 * SECURITY IMPLICATIONS:
 * - This function can execute arbitrary JavaScript code
 * - The code has access to the browser page and context
 * - The code runs with the same permissions as the calling process
 *
 * REQUIRED SAFEGUARDS (implemented by Posium infrastructure):
 * - Code MUST only come from trusted, internal sources (Posium's AI pipeline)
 * - Tests run in isolated container environments with limited permissions
 * - Network access is restricted to approved endpoints
 * - File system access is sandboxed
 * - Execution timeout prevents infinite loops
 *
 * DO NOT USE THIS FUNCTION:
 * - With user-provided code
 * - With code from untrusted external sources
 * - In contexts where arbitrary code execution would be dangerous
 *
 * This is an internal API. The StepExecutor provides a safer interface for
 * test execution that doesn't require raw code evaluation.
 */

import type { BrowserContext, Page } from "./browser/types/page.js";
import { expect } from "@playwright/test";
import type { Logger } from "@posium/observability";

/**
 * Options for running dynamic code
 */
export interface RunCodeOptions {
  timeout?: number;
  parameters?: Record<string, unknown>;
  screenshotOnError?: boolean;
  screenshotPath?: string;
}

/**
 * Executes a string of Playwright code dynamically.
 *
 * ⚠️ SECURITY: This function uses `new Function()` for code execution.
 * See module-level documentation for security considerations.
 *
 * @param page - Playwright Page instance
 * @param context - Playwright BrowserContext instance
 * @param code - The Playwright code to execute (MUST be from trusted source)
 * @param options - Execution options
 * @param logger - Winston logger instance
 * @returns Promise resolving to any result returned by the code
 * @throws Error if code execution fails or times out
 *
 * @internal This is an internal API. Use StepExecutor for a safer interface.
 */
export async function runPlaywrightCode(
  page: Page,
  context: BrowserContext,
  code: string,
  options: RunCodeOptions = {},
  logger?: Logger,
): Promise<unknown> {
  const timeout = options.timeout || 60000;
  const parameters = options.parameters || {};

  if (logger) {
    logger.info(
      { category: "dynamic-execution" },
      "Executing dynamic Playwright code",
    );
  }

  try {
    // Create a function that takes page, context, expect, test, and params
    const executeCode = new Function(
      "page",
      "context",
      "expect",
      "test",
      "params",
      `
      // Timeout for waiting for elements to be present (in milliseconds)
      const POSIUM_LOCATOR_WAIT_TIMEOUT = ${timeout};

      // Define test.step function for structured execution
      const step = async (name, fn) => {
        console.log(\`Executing step: \${name}\`);
        return await fn();
      };

      // Execute the code
      return (async () => {
        ${code}
      })();
      `,
    );

    // Create a lightweight test object with a step method
    const testObj = {
      step: async (name: string, fn: () => Promise<void>) => {
        if (logger) {
          logger.info(
            { category: "dynamic-step", stepName: name },
            "Executing step",
          );
        }
        console.log(`Executing step: ${name}`);
        return await fn();
      },
    };

    // Execute the code with a timeout
    const result = await Promise.race([
      executeCode(page, context, expect, testObj, parameters),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Execution timed out after ${timeout}ms`)),
          timeout,
        ),
      ),
    ]);

    if (logger) {
      logger.info(
        { category: "dynamic-execution" },
        "Successfully executed Playwright code",
      );
    }

    return result;
  } catch (error) {
    if (logger) {
      logger.error({ err: error }, "Failed to execute Playwright code");
    }

    // Take screenshot on error if option enabled
    if (options.screenshotOnError && page) {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const screenshotPath =
          options.screenshotPath || `./screenshots/error-${timestamp}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });

        if (logger) {
          logger.info(
            { category: "dynamic-execution", screenshotPath },
            "Error screenshot saved",
          );
        }
      } catch (screenshotError) {
        if (logger) {
          logger.error(
            { category: "dynamic-execution", err: screenshotError },
            "Failed to capture error screenshot",
          );
        }
      }
    }

    throw error;
  }
}
