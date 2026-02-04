import { chromium } from "@playwright/test";
import type { BrowserAgentConfig, LLMClientConfig } from "./types/config.js";
import fs from "fs";
import os from "os";
import path from "path";
import { type z } from "zod";
import type { BrowserResult } from "./types/browser.js";
import type { GotoOptions } from "./types/playwright.js";
import type { Page, BrowserContext } from "./types/page.js";
import type {
  ActOptions,
  ActResult,
  ConstructorParams,
  ExtractOptions,
  ExtractResult,
  InitFromPageOptions,
  InitFromPageResult,
  InitResult,
  ObserveOptions,
  ObserveResult,
  AssertOptions,
  AiCheckOptions,
  AiCheckResult,
} from "./types/browserAgent.js";
import type { PlanningConfig, PlanResult } from "./types/plan.js";
import { scriptContent } from "./dom/scriptContent.js";
import { LLMClient } from "../llm/LLMClient.js";
import { BrowserAgentPage } from "./BrowserAgentPage.js";
import { BrowserAgentContext } from "./BrowserAgentContext.js";
import { BrowserAgentPlanHandler } from "./handlers/planHandler.js";
import type {
  DiscoveryOptions,
  TestObjective,
} from "./handlers/discoverHandler.js";
import { BrowserAgentDiscoverHandler } from "./handlers/discoverHandler.js";
import type { Logger } from "@posium/observability";
import { runPlaywrightCode, type RunCodeOptions } from "../dynamicRunner.js";
import { randomUUID } from "crypto";
import { setupRRWebRecorder } from "../rrweb-recorder.js";
import { LRUCache } from "lru-cache";
import { env as envConfig } from "../env.js";

const DEFAULT_MODEL_NAME = "google/gemini-3-flash-preview";

/**
 * Clears all browser state from a context including cookies, localStorage, sessionStorage, and IndexedDB
 * @param context - The browser context to clear
 * @param logger - Logger for debugging
 */
async function clearContextState(
  context: BrowserContext,
  logger: Logger,
): Promise<void> {
  try {
    logger.info("Clearing browser state...");

    // Clear storage on all pages before closing them
    const pages = context.pages();

    logger.info(`Current page count ${pages.length}`);
    for (const page of pages) {
      try {
        await page.evaluate(() => {
          // Clear localStorage
          localStorage.clear();

          // Clear sessionStorage
          sessionStorage.clear();

          // Clear IndexedDB
          indexedDB
            .databases()
            .then((dbs: unknown[]) => {
              dbs.forEach((db: unknown) => {
                if (db && typeof db === "object" && "name" in db && db.name) {
                  indexedDB.deleteDatabase(db.name as string);
                }
              });
            })
            .catch(() => {
              // Ignore IndexedDB errors
            });
        });
        logger.info(`Cleared storage for page: ${page.url()}`);
      } catch (error) {
        logger.warn(
          { err: error, url: page.url() },
          "Failed to clear storage for page",
        );
      }
    }

    // Close all pages
    //! at the very last default blank page shouldn't be closed
    /* for (const page of pages) {
      try {
        await page.close();
        logger.info(`Closed page: ${page.url()}`);
      } catch (error) {
        logger.warn(`Failed to close page`, { error });
      }
    } */

    // Clear all cookies after pages are closed
    await context.clearCookies();
    logger.info("Cleared cookies");

    logger.info("Browser state cleared successfully");
  } catch (error) {
    logger.error({ err: error }, "Failed to clear browser state");
    // Don't throw - we want to continue even if clearing fails
  }
}

export async function getBrowser(
  headless: boolean = true,
  env: "LOCAL" | "REMOTE",
  logger: Logger,
  sessionId?: string,
  browserManagerHost?: string,
): Promise<BrowserResult> {
  // Check if we should connect to a remote browser
  const useRemoteBrowser = env === "REMOTE";

  if (useRemoteBrowser) {
    try {
      // Connect to the browser using CDP
      // Note: Browser arguments like --enable-webgl need to be applied when launching the remote browser,
      // not during CDP connection. The remote browser at remoteBrowserUrl should be configured with equivalent
      // args to these used in launchPersistentContext:
      // --enable-webgl
      // --use-gl=swiftshader
      // --enable-accelerated-2d-canvas
      // --disable-blink-features=AutomationControlled
      // --disable-web-security
      // TODO: add supp for timeout param
      //! temporarily
      if (!envConfig.BROWSER_MANAGER_HOST_URL) {
        throw new Error(
          "BROWSER_MANAGER_HOST_URL must be set to connect to browser manager",
        );
      }
      const remoteBrowserUrl = `ws://${envConfig.BROWSER_MANAGER_HOST_URL}/sessionManager?sessionId=${sessionId}`;
      logger.info(
        { category: "init", remoteBrowserUrl },
        "connecting to remote browser via CDP",
      );
      const browser = await chromium.connectOverCDP(remoteBrowserUrl, {
        //! browser manager can take like 35s if there are no idle workers
        timeout: 60000,
      });

      const context = browser.contexts()[0]; // Get the default context

      if (!context) {
        throw new Error("Failed to get browser context from remote browser");
      }

      // Clear browser state to ensure clean context
      await clearContextState(context, logger);

      logger.info({ category: "init" }, "connected to remote browser successfully");

      await applyStealthScripts(context);

      return {
        browser,
        context,
        env: "REMOTE",
      };
    } catch (error) {
      logger.error(
        { category: "init", err: error },
        "Failed to connect to remote browser",
      );
      throw error;
    }
  }

  // Original local browser launch logic
  logger.info(
    { category: "init", headless },
    "launching local browser",
  );

  const tmpDirPath = path.join(os.tmpdir(), "browser-agent");
  if (!fs.existsSync(tmpDirPath)) {
    fs.mkdirSync(tmpDirPath, { recursive: true });
  }

  const tmpDir = fs.mkdtempSync(path.join(tmpDirPath, "ctx_"));
  fs.mkdirSync(path.join(tmpDir, "userdir/Default"), { recursive: true });

  const defaultPreferences = {
    plugins: {
      always_open_pdf_externally: true,
    },
  };

  fs.writeFileSync(
    path.join(tmpDir, "userdir/Default/Preferences"),
    JSON.stringify(defaultPreferences),
  );

  const downloadsPath = path.join(process.cwd(), "downloads");
  fs.mkdirSync(downloadsPath, { recursive: true });

  const context = await chromium.launchPersistentContext(
    path.join(tmpDir, "userdir"),
    {
      acceptDownloads: true,
      headless,
      viewport: {
        width: 1250,
        height: 800,
      },
      locale: "en-US",
      timezoneId: "America/New_York",
      deviceScaleFactor: 1,
      args: [
        "--use-mock-keychain",
        "--disable-features=DialMediaRouteProvider",
        "--enable-webgl",
        "--use-gl=swiftshader",
        "--enable-accelerated-2d-canvas",
        "--disable-blink-features=AutomationControlled",
        "--disable-web-security",
      ],
      bypassCSP: false,
    },
  );

  logger.info({ category: "init" }, "local browser started successfully");

  await applyStealthScripts(context);

  return { context, contextPath: tmpDir, env: "LOCAL" };
}

async function applyStealthScripts(context: BrowserContext) {
  await context.addInitScript(() => {
    // Override the navigator.webdriver property
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });

    // Mock languages and plugins to mimic a real browser
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });

    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });

    // Remove Playwright-specific properties
    delete (window as unknown as Record<string, unknown>).__playwright;
    delete (window as unknown as Record<string, unknown>).__pw_manual;
    delete (window as unknown as Record<string, unknown>).__PW_inspect;

    // Redefine the headless property
    Object.defineProperty(navigator, "headless", {
      get: () => false,
    });

    // Override the permissions API
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === "notifications"
        ? Promise.resolve({
            state: Notification.permission,
          } as PermissionStatus)
        : originalQuery(parameters);
  });
}

export class BrowserAgent {
  private static readonly sessionCache = new LRUCache<string, BrowserAgent>({
    max: 20, // Maximum number of sessions to keep
    ttl: 1000 * 60 * 60, // 1 hour TTL
    updateAgeOnGet: true, // Update the age of an item when it is retrieved
    updateAgeOnHas: true, // Update the age of an item when it is checked for existence
  });

  public static getInstance(sessionId: string): BrowserAgent | undefined {
    const currentKeys = [];
    for (const key of BrowserAgent.sessionCache.keys()) {
      currentKeys.push(key);
    }
    return BrowserAgent.sessionCache.get(sessionId);
  }

  public static setInstance(sessionId: string, instance: BrowserAgent): void {
    // If an instance with this sessionId already exists, clean it up first
    const currentKeys = [];
    for (const key of BrowserAgent.sessionCache.keys()) {
      currentKeys.push(key);
    }
    const existingInstance = BrowserAgent.sessionCache.get(sessionId);
    if (existingInstance) {
      existingInstance.close().catch((error) => {
        existingInstance.logger.error(
          { err: error, sessionId },
          "Error cleaning up existing instance",
        );
      });
    }
    BrowserAgent.sessionCache.set(sessionId, instance);
  }

  public static deleteInstance(sessionId: string): void {
    BrowserAgent.sessionCache.delete(sessionId);
  }

  public static clearInstances(): void {
    BrowserAgent.sessionCache.clear();
  }

  public agentPage!: BrowserAgentPage;
  private agentContext!: BrowserAgentContext;
  private intEnv: "LOCAL" | "REMOTE";
  private planHandler!: BrowserAgentPlanHandler;
  private discoverHandler!: BrowserAgentDiscoverHandler;
  public sessionId: string;
  public projectId: string;
  public toolCallId: string;
  public testId: string;
  public readonly domSettleTimeoutMs: number;
  public readonly debugDom: boolean;
  public readonly headless: boolean;
  public verbose: 0 | 1 | 2;
  public enableCaching: boolean;

  private apiKey: string | undefined;
  private externalLogger: Logger;
  private contextPath?: string;
  public llmClient: LLMClient;
  private _resolvedConfig: BrowserAgentConfig;

  protected setActivePage(page: BrowserAgentPage): void {
    this.agentPage = page;
  }

  constructor({
    env,
    verbose,
    debugDom,
    headless,
    logger,
    domSettleTimeoutMs,
    enableCaching = false,
    modelName,
    modelClientOptions,
    sessionId,
    toolCallId,
    projectId,
    config,
    llmConfig,
    testId,
  }: ConstructorParams) {
    this.externalLogger = logger!;

    // Handle configuration - only use injected config with reasonable defaults
    const resolvedConfig: BrowserAgentConfig = config || {
      nodeEnv: "development",
      browserManagerHost: "localhost:3003",
      enableCaching: false,
    };

    this.enableCaching = enableCaching || resolvedConfig.enableCaching || false;
    this.intEnv =
      env || (resolvedConfig.nodeEnv === "production" ? "REMOTE" : "LOCAL");
    this.verbose = verbose ?? 0;
    this.debugDom = debugDom ?? false;
    this.llmClient = new LLMClient(
      this.externalLogger,
      modelName ?? DEFAULT_MODEL_NAME,
      llmConfig,
      modelClientOptions,
    );
    this.domSettleTimeoutMs = domSettleTimeoutMs ?? 30_000;
    this.headless =
      headless ?? (resolvedConfig.nodeEnv === "production" ? false : true);
    this.sessionId = sessionId ?? randomUUID();
    this.toolCallId = toolCallId ?? randomUUID();
    this.projectId = projectId ?? randomUUID();
    this.testId = testId ?? randomUUID();
    // Store the resolved config for later use
    this._resolvedConfig = resolvedConfig;
    // Add this instance to the cache
    BrowserAgent.setInstance(this.sessionId, this);
  }

  public get logger(): Logger {
    return this.externalLogger;
  }

  public get page(): Page {
    // End users should not be able to access the BrowserAgentPage directly
    // This is a proxy to the underlying Playwright Page
    if (!this.agentPage) {
      throw new Error(
        "BrowserAgent not initialized. Make sure to await browserAgent.init() first.",
      );
    }
    return this.agentPage.page;
  }

  public get llm(): LLMClient {
    return this.llmClient;
  }

  public get env(): "LOCAL" | "REMOTE" {
    if (this.intEnv === "REMOTE" && this.apiKey && this.projectId) {
      return "REMOTE";
    }
    return "LOCAL";
  }

  public get context(): BrowserContext {
    if (!this.agentContext) {
      throw new Error(
        "BrowserAgent not initialized. Make sure to await browserAgent.init() first.",
      );
    }
    return this.agentContext.context;
  }

  /**
   * Initialize BrowserAgent and optionally run Playwright code
   *
   * @param playwrightCode - Optional Playwright code to execute after initialization
   * @param codeOptions - Options for code execution
   */
  async init(
    playwrightCode?: string,
    codeOptions: RunCodeOptions = {},
  ): Promise<InitResult> {
    const { context, debugUrl, sessionUrl, contextPath, sessionId, env } =
      await getBrowser(
        this.headless,
        this.intEnv,
        this.logger,
        this.sessionId,
        this.intEnv === "REMOTE"
          ? this._resolvedConfig.browserManagerHost
          : undefined,
      ).catch((e) => {
        this.logger.error({ err: e }, "Error initializing");
        const br: BrowserResult = {
          context: undefined as unknown as BrowserContext,
          debugUrl: undefined,
          sessionUrl: undefined,
          sessionId: undefined,
          env: this.env,
        };
        return br;
      });
    this.intEnv = env;
    this.contextPath = contextPath;
    this.agentContext = await BrowserAgentContext.init(context, this);

    await this.context.addInitScript({
      content: scriptContent,
    });

    this.logger.info("setting up rrweb recorder");
    await setupRRWebRecorder(this.context, this.sessionId, this.logger);
    this.logger.info("rrweb recorder setup complete");

    const defaultPage = this.context.pages()[0]!;

    this.agentPage = await new BrowserAgentPage(
      defaultPage,
      this,
      this.agentContext,
      this.sessionId,
      this.projectId,
      this.llmClient,
    ).init();

    // Set the browser to headless mode if specified
    if (this.headless) {
      await this.page.setViewportSize({ width: 1280, height: 720 });
    }

    // Run provided Playwright code if present
    if (playwrightCode) {
      try {
        this.logger.info({ category: "init" }, "Executing provided Playwright code");

        await this.executePlaywrightCode(playwrightCode, codeOptions);

        this.logger.info(
          { category: "init" },
          "Successfully executed Playwright code during initialization",
        );
      } catch (error) {
        this.logger.error(
          { category: "init", err: error },
          "Failed to execute Playwright code during initialization",
        );
      }
    }

    // Initialize the plan handler
    this.planHandler = new BrowserAgentPlanHandler({
      browserAgent: this,
      logger: this.logger,
      llmClient: this.llmClient,
      agentPage: this.agentPage,
    });

    // Initialize the discover handler
    this.discoverHandler = new BrowserAgentDiscoverHandler({
      browserAgent: this,
      logger: this.logger,
      llmClient: this.llmClient,
      agentPage: this.agentPage,
    });

    return {
      debugUrl: debugUrl ?? "",
      sessionUrl: sessionUrl ?? "",
      sessionId: sessionId ?? "",
    };
  }

  /** @deprecated initFromPage is deprecated and will be removed in the next major version. */
  async initFromPage({
    page,
  }: InitFromPageOptions): Promise<InitFromPageResult> {
    console.warn(
      "initFromPage is deprecated and will be removed in the next major version. To instantiate from a page, use `sessionId` in the constructor.",
    );
    this.agentContext = await BrowserAgentContext.init(page.context(), this);
    this.agentPage = await new BrowserAgentPage(
      page,
      this,
      this.agentContext,
      this.sessionId,
      this.projectId,
      this.llmClient,
    ).init();

    // Set the browser to headless mode if specified
    if (this.headless) {
      await this.page.setViewportSize({ width: 1280, height: 720 });
    }

    // Add initialization scripts
    await this.context.addInitScript({
      content: scriptContent,
    });

    return { context: this.context };
  }

  /** @deprecated Use `browserAgent.page.act()` instead. This will be removed in the next major release. */
  async act(options: ActOptions): Promise<ActResult> {
    return await this.agentPage.act(options);
  }

  /** @deprecated Use `browserAgent.page.extract()` instead. This will be removed in the next major release. */
  async extract<T extends z.ZodObject<z.ZodRawShape>>(
    options: ExtractOptions<T>,
  ): Promise<ExtractResult<T>> {
    return await this.agentPage.extract(options);
  }

  /** @deprecated Use `browserAgent.page.observe()` instead. This will be removed in the next major release. */
  async observe(options?: ObserveOptions): Promise<ObserveResult[]> {
    return await this.agentPage.observe(options);
  }

  /** @deprecated Use `browserAgent.page.assert()` instead. This will be removed in the next major release. */
  async assert(
    options: AssertOptions,
  ): Promise<{ success: boolean; message: string }> {
    return await this.agentPage.assert(options);
  }

  /**
   * Generates a test plan for a given objective.
   * The plan consists of a sequence of act/assert steps that will achieve the objective.
   *
   * @param objective - The high-level test objective to plan for
   * @param config - Optional configuration for the planning process
   * @returns A Promise that resolves to an array of PlanStep objects
   */
  async plan(
    objective: string,
    config?: Partial<PlanningConfig> & { startingUrl?: string },
  ): Promise<PlanResult> {
    if (!this.planHandler) {
      throw new Error(
        "BrowserAgent not initialized. Make sure to await browserAgent.init() first.",
      );
    }

    return await this.planHandler.plan(objective, config);
  }

  /**
   * Generates a test plan for a given objective.
   * The plan consists of a sequence of act/assert steps that will achieve the objective.
   *
   * @param config - Optional configuration for the discovery process
   * @returns A Promise that resolves to an array of TestObjective objects
   */
  async discover(config?: Partial<DiscoveryOptions>): Promise<TestObjective[]> {
    if (!this.discoverHandler) {
      throw new Error(
        "BrowserAgent not initialized. Make sure to await browserAgent.init() first.",
      );
    }

    return await this.discoverHandler.discover(config);
  }

  /**
   * Run Playwright code directly
   *
   * @param code - String containing Playwright commands to execute
   * @param options - Options for execution
   * @returns Promise resolving to any result returned by the code
   */
  async executePlaywrightCode(
    code: string,
    options: RunCodeOptions = {},
  ): Promise<void> {
    if (!this.agentPage) {
      throw new Error(
        "BrowserAgent not initialized. Make sure to await browserAgent.init() first.",
      );
    }

    this.logger.info(
      { category: "direct-execution" },
      "Executing provided Playwright code directly",
    );

    await runPlaywrightCode(
      this.page,
      this.context,
      code,
      options,
      this.logger,
    );
    return;
  }

  async close(): Promise<void> {
    this.logger.info(
      { sessionId: this.sessionId },
      "closing browser context",
    );

    // Clear browser state before closing
    await clearContextState(this.context, this.logger);

    await this.context.close();

    if (this.contextPath) {
      try {
        fs.rmSync(this.contextPath, { recursive: true, force: true });
      } catch (e: unknown) {
        this.logger.error(
          { err: e, path: this.contextPath },
          "Error deleting context directory",
        );
      }
    }

    // Remove this instance from the cache
    BrowserAgent.deleteInstance(this.sessionId);
  }
}

export * from "./types/browser.js";
export * from "./types/log.js";
export * from "./types/model.js";
export * from "./types/playwright.js";
export * from "./types/browserAgent.js";
export * from "./types/page.js";
export * from "./types/plan.js";

// Export specific types that other modules need
export type {
  ActOptions,
  ActResult,
  AssertOptions,
  AiCheckOptions,
  AiCheckResult,
  ConstructorParams,
  ExtractOptions,
  ExtractResult,
  InitFromPageOptions,
  InitFromPageResult,
  InitResult,
  ObserveOptions,
  ObserveResult,
} from "./types/browserAgent.js";

export type { GotoOptions } from "./types/playwright.js";

// Export configuration types and utilities
export * from "./types/config.js";
export * from "../config.js";
