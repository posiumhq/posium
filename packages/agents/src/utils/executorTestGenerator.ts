/**
 * Generator for creating executor-based Playwright test files.
 * This replaces the complex Playwright code generation with a cleaner approach
 * that uses the StepExecutor to handle test execution.
 */

import type { TestStep } from "../shared/index.js";

export interface GenerateExecutorTestOptions {
  /** Name of the test to display in test runner */
  testName: string;
  /** Unique test ID */
  testId: string;
  /** Array of test steps to execute */
  steps: TestStep[];
  /** Organization ID for tracking */
  orgId: string;
  /** Project ID for tracking */
  projectId: string;
  /** URL to navigate to before running test */
  projectUrl: string;
  /** Optional timeout in milliseconds */
  timeout?: number;
}

/**
 * Generates a complete Playwright test file that uses the StepExecutor.
 * The generated file embeds the test steps and uses test.step() for reporting.
 *
 * @param options - Configuration for test generation
 * @returns Complete Playwright test file as a string
 */
export function generateExecutorBasedTest(
  options: GenerateExecutorTestOptions,
): string {
  const { testName, testId, steps, projectUrl, timeout = 30000 } = options;

  // Escape single quotes in test name for safe embedding
  const safeTestName = testName.replace(/'/g, "\\'");

  // Convert steps to JSON string with proper formatting
  const stepsJson = JSON.stringify(steps, null, 2);

  // Generate the complete test file
  return `/**
 * Generated Playwright test using StepExecutor
 * Test ID: ${testId}
 * Generated at: ${new Date().toISOString()}
 */

	import { test, expect } from '@playwright/test';
	import { BrowserAgent, StepExecutor, type StepResult } from '@posium/agents';

// Test configuration
const TEST_TIMEOUT = ${timeout};
const TEST_NAME = '${safeTestName}';
const TEST_ID = '${testId}';

// Test steps embedded in the file
const testSteps = ${stepsJson};

// Helper function to validate required environment variables
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(\`Required environment variable \${name} is not set\`);
  }
  return value;
}

test.describe(TEST_NAME, () => {
  test('Execute test steps', async ({ page }) => {
    // Set test timeout
    test.setTimeout(TEST_TIMEOUT);

    // Validate required environment variables
    const apiKey = getRequiredEnv('OPENROUTER_API_KEY');
    const cloudflareAccountId = getRequiredEnv('CLOUDFLARE_ACCOUNT_ID');
    const cloudflareAiGatewayToken = getRequiredEnv('CLOUDFLARE_AI_GATEWAY_TOKEN');

	    // Initialize BrowserAgent using existing Playwright page
	    const browserAgent = new BrowserAgent({
	      llmConfig: {
	        openRouter: {
	          apiKey,
	          cloudflareAccountId,
	          cloudflareAiGatewayToken,
	        },
	      },
	      verbose: 1,
	      debugDom: true,
	      headless: true,
	    });

	    // Initialize BrowserAgent with the existing page
	    await browserAgent.initFromPage({ page });

	    // Navigate to the test URL using enhanced BrowserAgent navigation
	    await browserAgent.page.goto('${projectUrl}');

	    // Create executor instance
	    const executor = new StepExecutor(browserAgent);

    // Track overall test results
    const results: StepResult[] = [];
    let failedStep: { index: number; error: string } | null = null;

    // Execute each step with proper reporting
    for (const [index, step] of testSteps.entries()) {
      await test.step(\`Step \${index + 1}: \${step.description}\`, async () => {
        try {
          console.log(\`Executing step \${index + 1}/\${testSteps.length}: \${step.description}\`);

          // Execute the step
          const result = await executor.execute(step);
          results.push(result);

          // Check for failure
          if (result.status === 'failed') {
            const errorMessage = result.error || 'Step execution failed';
            failedStep = { index, error: errorMessage };
            throw new Error(errorMessage);
          }

          // Log success with any output
          if (result.status === 'passed') {
            console.log(\`✓ Step \${index + 1} completed successfully\`);
            if (result.output) {
              console.log(\`  Output: \${JSON.stringify(result.output)}\`);
            }
          }
        } catch (error) {
          // Capture error details for reporting
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(\`✗ Step \${index + 1} failed: \${errorMessage}\`);
          throw error;
        }
      });
    }

    // No cleanup needed - Playwright handles page lifecycle

    // Final test summary
    console.log(\`\\n=== Test Summary ===\`);
    console.log(\`Test: \${TEST_NAME}\`);
    console.log(\`Total steps: \${testSteps.length}\`);
    console.log(\`Passed: \${results.filter(r => r.status === 'passed').length}\`);
    console.log(\`Failed: \${results.filter(r => r.status === 'failed').length}\`);

    if (failedStep) {
      console.log(\`\\n✗ Test failed at step \${failedStep.index + 1}: \${failedStep.error}\`);
    } else {
      console.log(\`\\n✓ All steps completed successfully\`);
    }
  });
});
	`;
}

/**
 * Generates a minimal Playwright test file for quick execution.
 * This version has less logging and reporting overhead.
 *
 * @param options - Configuration for test generation
 * @returns Minimal Playwright test file as a string
 */
export function generateMinimalExecutorTest(
  options: GenerateExecutorTestOptions,
): string {
  const { testName, steps, projectUrl } = options;
  const safeTestName = testName.replace(/'/g, "\\'");
  const stepsJson = JSON.stringify(steps, null, 2);

  return `import { test } from '@playwright/test';
	import { BrowserAgent, StepExecutor } from '@posium/agents';

	const testSteps = ${stepsJson};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(\`Required environment variable \${name} is not set\`);
  }
  return value;
}

	test('${safeTestName}', async ({ page }) => {
	  const apiKey = getRequiredEnv('OPENROUTER_API_KEY');
	  const cloudflareAccountId = getRequiredEnv('CLOUDFLARE_ACCOUNT_ID');
	  const cloudflareAiGatewayToken = getRequiredEnv('CLOUDFLARE_AI_GATEWAY_TOKEN');

	  const browserAgent = new BrowserAgent({
	    llmConfig: {
	      openRouter: {
	        apiKey,
	        cloudflareAccountId,
	        cloudflareAiGatewayToken,
	      },
	    },
	    headless: true
	  });
	  await browserAgent.initFromPage({ page });
	  await browserAgent.page.goto('${projectUrl}');
	  const executor = new StepExecutor(browserAgent);

  for (const [index, step] of testSteps.entries()) {
    await test.step(\`Step \${index + 1}: \${step.description}\`, async () => {
      const result = await executor.execute(step);
      if (result.status === 'failed') {
        throw new Error(result.error || 'Step failed');
      }
    });
  }

  // No cleanup needed - Playwright handles page lifecycle
});
`;
}
