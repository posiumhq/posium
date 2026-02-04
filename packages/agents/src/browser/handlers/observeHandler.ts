import type { BrowserAgent } from "../BrowserAgent.js";
import { observe } from "../inference/index.js";
import type { LLMClient } from "../../llm/LLMClient.js";
import { generateId } from "../../utils/index.js";
import { ScreenshotService } from "../../vision/index.js";
import type { BrowserAgentPage } from "../BrowserAgentPage.js";
import type { Logger } from "@posium/observability";

export class BrowserAgentObserveHandler {
  private readonly browserAgent: BrowserAgent;
  private readonly logger: Logger;
  private readonly agentPage: BrowserAgentPage;
  private readonly verbose: 0 | 1 | 2;
  private observations: {
    [key: string]: {
      result: { selector: string; description: string }[];
      instruction: string;
    };
  };

  constructor({
    browserAgent,
    logger,
    agentPage,
    verbose,
  }: {
    browserAgent: BrowserAgent;
    logger: Logger;
    agentPage: BrowserAgentPage;
    verbose: 0 | 1 | 2;
  }) {
    this.browserAgent = browserAgent;
    this.logger = logger;
    this.agentPage = agentPage;
    this.observations = {};
    this.verbose = verbose;
  }

  private async _recordObservation(
    instruction: string,
    result: { selector: string; description: string }[],
  ): Promise<string> {
    const id = generateId(instruction);

    this.observations[id] = { result, instruction };

    return id;
  }

  public async observe({
    instruction,
    useVision,
    fullPage,
    llmClient,
    requestId,
    domSettleTimeoutMs,
  }: {
    instruction: string;
    useVision: boolean;
    fullPage: boolean;
    llmClient: LLMClient;
    requestId: string;
    domSettleTimeoutMs?: number;
  }): Promise<{ selector: string; description: string }[]> {
    if (!instruction) {
      instruction = `Find elements that can be used for any future actions in the page. These may be navigation links, related pages, section/subsection links, buttons, or other interactive elements. Be comprehensive: if there are multiple elements that may be relevant for future actions, return all of them.`;
    }
    this.logger.debug(
      {
        category: "observation",
        instruction,
      },
      "starting observation",
    );

    await this.agentPage._waitForSettledDom(domSettleTimeoutMs);
    await this.agentPage.startDomDebug();
    const evalResult = (await this.browserAgent.page.evaluate(
      (fullPage: boolean) =>
        fullPage ? window.processAllOfDom() : window.processDom([]),
      fullPage,
    )) as { selectorMap: Record<number, string[]>; outputString: string };

    const { selectorMap } = evalResult;
    // has to be like this atm because of the re-assignment
    let { outputString } = evalResult;

    let annotatedScreenshot: Buffer | undefined;
    if (useVision === true) {
      if (!llmClient.hasVision) {
        this.logger.debug(
          {
            category: "observation",
            model: llmClient.modelName,
          },
          "Model does not support vision. Skipping vision processing.",
        );
      } else {
        const screenshotService = new ScreenshotService(
          this.browserAgent.page,
          selectorMap,
          this.verbose,
          this.logger,
        );

        annotatedScreenshot =
          await screenshotService.getAnnotatedScreenshot(fullPage);
        outputString = "n/a. use the image to find the elements.";
      }
    }

    const observationResponse = await observe({
      instruction,
      domElements: outputString,
      llmClient,
      image: annotatedScreenshot,
      requestId,
    });

    const elementsWithSelectors = observationResponse.elements.map(
      (element) => {
        const { elementId, ...rest } = element;

        return {
          ...rest,
          selector: `xpath=${selectorMap[elementId]![0]}`,
        };
      },
    );

    await this.agentPage.cleanupDomDebug();

    this.logger.debug(
      {
        category: "observation",
        elements: elementsWithSelectors,
      },
      "found elements",
    );

    await this._recordObservation(instruction, elementsWithSelectors);
    return elementsWithSelectors;
  }
}
