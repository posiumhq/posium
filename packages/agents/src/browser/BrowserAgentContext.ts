import type {
  BrowserContext as PlaywrightContext,
  Page as PlaywrightPage,
} from "@playwright/test";
import { type BrowserAgent } from "./BrowserAgent.js";
import { BrowserAgentPage } from "./BrowserAgentPage.js";
import type { Page } from "./types/page.js";
import type { EnhancedContext } from "./types/context.js";

export class BrowserAgentContext {
  private readonly browserAgent: BrowserAgent;
  private readonly intContext: EnhancedContext;
  private pageMap: WeakMap<PlaywrightPage, BrowserAgentPage>;
  private activePage: BrowserAgentPage | null = null;

  private constructor(context: PlaywrightContext, browserAgent: BrowserAgent) {
    this.browserAgent = browserAgent;
    this.pageMap = new WeakMap();

    // Create proxy around the context
    this.intContext = new Proxy(context, {
      get: (target, prop) => {
        if (prop === "newPage") {
          return async (): Promise<Page> => {
            const pwPage = await target.newPage();
            const agentPage = await this.createBrowserAgentPage(pwPage);
            // Set as active page when created
            this.setActivePage(agentPage);
            return agentPage.page;
          };
        }
        if (prop === "pages") {
          return (): Page[] => {
            const pwPages = target.pages();
            // Convert all pages to BrowserAgentPages synchronously
            return pwPages.map((pwPage: PlaywrightPage) => {
              let agentPage = this.pageMap.get(pwPage);
              if (!agentPage) {
                // Create a new BrowserAgentPage and store it in the map
                agentPage = new BrowserAgentPage(
                  pwPage,
                  this.browserAgent,
                  this,
                  this.browserAgent.sessionId,
                  this.browserAgent.projectId,
                  this.browserAgent.llmClient,
                );
                this.pageMap.set(pwPage, agentPage);
              }
              return agentPage.page;
            });
          };
        }
        return target[prop as keyof PlaywrightContext];
      },
    }) as unknown as EnhancedContext;
  }

  private async createBrowserAgentPage(
    page: PlaywrightPage,
  ): Promise<BrowserAgentPage> {
    const agentPage = await new BrowserAgentPage(
      page,
      this.browserAgent,
      this,
      this.browserAgent.sessionId,
      this.browserAgent.projectId,
      this.browserAgent.llmClient,
    ).init();
    this.pageMap.set(page, agentPage);
    return agentPage;
  }

  static async init(
    context: PlaywrightContext,
    browserAgent: BrowserAgent,
  ): Promise<BrowserAgentContext> {
    const instance = new BrowserAgentContext(context, browserAgent);

    // Initialize existing pages
    const existingPages = context.pages();
    for (const page of existingPages) {
      const agentPage = await instance.createBrowserAgentPage(page);
      // Set the first page as active
      if (!instance.activePage) {
        instance.setActivePage(agentPage);
      }
    }

    return instance;
  }

  public get context(): EnhancedContext {
    return this.intContext;
  }

  public async getAgentPage(page: PlaywrightPage): Promise<BrowserAgentPage> {
    let agentPage = this.pageMap.get(page);
    if (!agentPage) {
      agentPage = await this.createBrowserAgentPage(page);
    }
    // Update active page when getting a page
    this.setActivePage(agentPage);
    return agentPage;
  }

  public async getAgentPages(): Promise<BrowserAgentPage[]> {
    const pwPages = this.intContext.pages();
    return Promise.all(
      pwPages.map((page: PlaywrightPage) => this.getAgentPage(page)),
    );
  }

  public setActivePage(page: BrowserAgentPage): void {
    this.activePage = page;
    // Update the BrowserAgent's active page reference
    this.browserAgent["setActivePage"](page);
  }

  public getActivePage(): BrowserAgentPage | null {
    return this.activePage;
  }
}
