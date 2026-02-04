/*
 * This module implements the Discovery Handler which is responsible for analyzing a web page
 * and identifying potential test objectives or scenarios based on the content.
 *
 * The discovery process involves:
 * 1. Analyzing the current page state (DOM, URL, title)
 * 2. Using LLM to identify potential test scenarios/objectives
 * 3. Categorizing and prioritizing the discovered objectives
 * 4. Providing comprehensive context for each objective
 *
 * The handler uses vision capabilities when available to enhance discovery.
 */

import type { BrowserAgent } from "../BrowserAgent.js";
import type { Logger } from "@posium/observability";
import type { LLMClient } from "../../llm/LLMClient.js";
import { ScreenshotService } from "../../vision/index.js";
import { discover } from "../inference/discover.js";
import type { BrowserAgentPage } from "../BrowserAgentPage.js";

/**
 * Parameters required to initialize the Discovery Handler.
 */
export interface BrowserAgentDiscoverHandlerParams {
  /** Reference to parent BrowserAgent instance for page interactions */
  browserAgent: BrowserAgent;
  /** Logger instance for tracking the discovery process */
  logger: Logger;
  /** LLM client for discovering test objectives */
  llmClient: LLMClient;
  /** Reference to parent BrowserAgentPage instance for page interactions */
  agentPage: BrowserAgentPage;
}

/**
 * Represents a discovered test objective/scenario.
 */
export interface TestObjective {
  /** Short title of the test objective */
  title: string;
  /** Detailed description of what should be tested */
  description: string;
  /** Priority level of this test objective */
  priority: "high" | "medium" | "low";
  /** Category of the test (e.g., 'functionality', 'usability', 'performance') */
  category: string;
  /** Estimated complexity to implement the test */
  complexity: "simple" | "moderate" | "complex";
  /** UI elements relevant to this objective (selectors if available) */
  relevantElements?: string[];
  /** Whether this test is critical for core functionality */
  isCritical?: boolean;
}

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

export class BrowserAgentDiscoverHandler {
  private browserAgent: BrowserAgent;
  private logger: Logger;
  private llmClient: LLMClient;
  private agentPage: BrowserAgentPage;

  constructor({
    browserAgent,
    logger,
    llmClient,
    agentPage,
  }: BrowserAgentDiscoverHandlerParams) {
    this.browserAgent = browserAgent;
    this.logger = logger;
    this.llmClient = llmClient;
    this.agentPage = agentPage;
  }

  /**
   * Discovers potential test objectives/scenarios from the current page.
   *
   * @param config - Optional configuration for the discovery process
   * @returns A Promise that resolves to an array of TestObjective objects
   */
  async discover(config?: Partial<DiscoveryOptions>): Promise<TestObjective[]> {
    const defaultConfig: DiscoveryOptions = {
      useVision: true,
      minObjectives: 3,
      maxObjectives: 10,
      includeLowPriority: true,
      timeout: 60000, // 1 minute timeout
    };

    const options = { ...defaultConfig, ...config };
    const startTime = Date.now();

    try {
      // 1. Analyze current page state
      const pageState = await this.analyzePage();

      // 2. Get DOM content for LLM analysis
      const domResult = (await this.browserAgent.page.evaluate(() => {
        return window.processAllOfDom();
      })) as { outputString: string; selectorMap: Record<number, string[]> };
      const { outputString, selectorMap } = domResult;

      // 3. Get screenshot if vision is enabled
      let annotatedScreenshot: Buffer | undefined;
      if (options.useVision) {
        const screenshotService = new ScreenshotService(
          this.browserAgent.page,
          selectorMap,
          0,
          this.logger,
        );
        annotatedScreenshot =
          await screenshotService.getAnnotatedScreenshot(true);
      }

      // 4. Use discovery inference module to identify test objectives
      const result = await discover(this.llmClient, {
        domContent: outputString,
        pageState,
        screenshot: annotatedScreenshot,
        options,
        logger: this.logger,
      });

      this.logger.info(
        {
          count: result.objectives.length,
          timeSpent: Date.now() - startTime,
        },
        "Discovered test objectives",
      );

      return result.objectives;
    } catch (error) {
      this.logger.error({ err: error }, "Error during test objective discovery");
      throw new Error("Failed to discover test objectives");
    }
  }

  /**
   * Analyzes the current page state to gather information.
   */
  private async analyzePage(): Promise<{ url: string; title: string }> {
    return await this.browserAgent.page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
    }));
  }
}
