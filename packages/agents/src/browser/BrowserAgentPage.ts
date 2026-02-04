import type {
  Page as PlaywrightPage,
  BrowserContext as PlaywrightContext,
  Frame,
} from "@playwright/test";
import { type LLMClient } from "../llm/LLMClient.js";
import type {
  ActOptions,
  ActResult,
  GotoOptions,
  AssertOptions,
  AssertResult,
  AiCheckOptions,
  AiCheckResult,
} from "./BrowserAgent.js";
import { type BrowserAgent } from "./BrowserAgent.js";
import { BrowserAgentActHandler } from "./handlers/actHandler.js";
import { BrowserAgentContext } from "./BrowserAgentContext.js";
import type { Page } from "./types/page.js";
import type {
  ExtractOptions,
  ExtractResult,
  ObserveOptions,
  ObserveResult,
  PlanOptions,
} from "./types/browserAgent.js";
import { type z } from "zod";
import { BrowserAgentExtractHandler } from "./handlers/extractHandler.js";
import { BrowserAgentObserveHandler } from "./handlers/observeHandler.js";
import { BrowserAgentAssertHandler } from "./handlers/assertHandler.js";
import { BrowserAgentAiCheckHandler } from "./handlers/aiCheckHandler.js";
import { BrowserAgentPlanHandler } from "./handlers/planHandler.js";
import { randomUUID } from "crypto";
import { ScreenshotService } from "../vision/index.js";
import { assert } from "./inference/index.js";
//import { broadcastEvents } from "@/app/api/rrweb-stream/route";
import type {
  PlanStep,
  PlanningConfig,
  ActInferenceResult,
  AssertInferenceResult,
  AiCheckInferenceResult,
} from "./types/plan.js";
import { getRecordConsolePlugin } from "@rrweb/rrweb-plugin-console-record";
import type { CDPSession } from "@playwright/test";

export interface HistoryEntry {
  method: "act" | "extract" | "observe" | "navigate";
  parameters: unknown;
  result: unknown;
  timestamp: string;
}

export class BrowserAgentPage {
  private browserAgent: BrowserAgent;
  private intPage: Page;
  private intContext: BrowserAgentContext;
  private actHandler: BrowserAgentActHandler;
  private extractHandler: BrowserAgentExtractHandler;
  private observeHandler: BrowserAgentObserveHandler;
  private llmClient: LLMClient;
  private assertHandler: BrowserAgentAssertHandler;
  private aiCheckHandler: BrowserAgentAiCheckHandler;
  private planHandler: BrowserAgentPlanHandler;
  private eventFlushInterval?: NodeJS.Timeout;
  private readonly sessionId: string;
  private readonly projectId: string;
  private cdpClient: CDPSession | null = null;
  private initialized: boolean = false;
  private readonly cdpClients = new WeakMap<
    PlaywrightPage | Frame,
    CDPSession
  >();

  private _history: Array<HistoryEntry> = [];

  public get history(): ReadonlyArray<HistoryEntry> {
    return Object.freeze([...this._history]);
  }

  constructor(
    page: PlaywrightPage,
    browserAgent: BrowserAgent,
    context: BrowserAgentContext,
    sessionId: string,
    projectId: string,
    llmClient: LLMClient,
  ) {
    this.llmClient = llmClient;
    this.sessionId = sessionId;
    this.projectId = projectId;
    // Create a proxy to intercept all method calls and property access
    this.intPage = new Proxy(page, {
      get: (target: PlaywrightPage, prop: keyof PlaywrightPage) => {
        // Special handling for our enhanced methods before initialization
        if (
          !this.initialized &&
          (prop === ("act" as keyof Page) ||
            prop === ("assert" as keyof Page) ||
            prop === ("aiCheck" as keyof Page) ||
            prop === ("plan" as keyof Page) ||
            prop === ("discover" as keyof Page))
        ) {
          return () => {
            throw new Error(
              `${String(prop)} is not available before initialization`,
            );
          };
        }

        const value = target[prop];
        // If the property is a function, wrap it to update active page before execution
        if (typeof value === "function" && prop !== "on") {
          return (...args: unknown[]) => {
            // Update active page before executing the method
            this.intContext.setActivePage(this);
            // @ts-expect-error - this is a proxy to the playwright page
            return value.apply(target, args);
          };
        }
        return value;
      },
    }) as Page;

    this.browserAgent = browserAgent;
    this.intContext = context;

    this.planHandler = new BrowserAgentPlanHandler({
      browserAgent: this.browserAgent,
      logger: this.browserAgent.logger,
      agentPage: this,
      llmClient: this.llmClient,
    });

    this.actHandler = new BrowserAgentActHandler({
      verbose: this.browserAgent.verbose,
      enableCaching: this.browserAgent.enableCaching,
      logger: this.browserAgent.logger,
      agentPage: this,
      agentContext: this.intContext,
      llmClient: llmClient,
    });
    this.extractHandler = new BrowserAgentExtractHandler({
      browserAgent: this.browserAgent,
      logger: this.browserAgent.logger,
      agentPage: this,
    });
    this.observeHandler = new BrowserAgentObserveHandler({
      verbose: this.browserAgent.verbose,
      browserAgent: this.browserAgent,
      logger: this.browserAgent.logger,
      agentPage: this,
    });
    this.assertHandler = new BrowserAgentAssertHandler({
      verbose: this.browserAgent.verbose,
      logger: this.browserAgent.logger,
      agentPage: this,
      llmClient: llmClient,
    });
    this.aiCheckHandler = new BrowserAgentAiCheckHandler({
      logger: this.browserAgent.logger,
      agentPage: this,
      llmClient: llmClient,
    });
  }

  public async cleanup() {
    // Clear event flush interval
    if (this.eventFlushInterval) {
      clearInterval(this.eventFlushInterval);
    }
  }

  async init(): Promise<BrowserAgentPage> {
    try {
      const page = this.intPage;
      const browserAgent = this.browserAgent;

      // Create a proxy that updates active page on method calls
      const handler = {
        get: (target: PlaywrightPage, prop: string | symbol) => {
          const value = target[prop as keyof PlaywrightPage];

          // Handle enhanced methods
          if (
            prop === "act" ||
            prop === "assert" ||
            prop === "aiCheck" ||
            prop === "plan" ||
            prop === "discover"
          ) {
            if (!this.llmClient) {
              return () => {
                throw new Error("Missing LLM configuration");
              };
            }

            // Use type assertion to safely call the method with proper typing
            type EnhancedMethod = (
              options:
                | ActOptions
                | ExtractOptions<z.ZodObject<z.ZodRawShape>>
                | ObserveOptions,
            ) => Promise<
              | ActResult
              | ExtractResult<z.ZodObject<z.ZodRawShape>>
              | ObserveResult[]
            >;

            const method = this[prop as keyof BrowserAgentPage] as EnhancedMethod;
            return async (options: unknown) => {
              this.intContext.setActivePage(this);
              return method.call(
                this,
                options as
                  | ActOptions
                  | ExtractOptions<z.ZodObject<z.ZodRawShape>>
                  | ObserveOptions,
              );
            };
          }

          // Handle _waitForSettledDom
          if (prop === "_waitForSettledDom") {
            return (timeoutMs?: number) => {
              this.intContext.setActivePage(this);
              return this._waitForSettledDom(timeoutMs);
            };
          }

          // Handle screenshots with CDP
          if (prop === "screenshot" && this.browserAgent.env === "REMOTE") {
            return async (
              options: {
                type?: "png" | "jpeg";
                quality?: number;
                fullPage?: boolean;
                clip?: { x: number; y: number; width: number; height: number };
                omitBackground?: boolean;
              } = {},
            ) => {
              const cdpOptions: Record<string, unknown> = {
                format: options.type === "jpeg" ? "jpeg" : "png",
                quality: options.quality,
                clip: options.clip,
                omitBackground: options.omitBackground,
                fromSurface: true,
              };

              if (options.fullPage) {
                cdpOptions.captureBeyondViewport = true;
              }

              const data = await this.sendCDP<{ data: string }>(
                "Page.captureScreenshot",
                cdpOptions,
              );

              // Convert base64 to buffer
              const buffer = Buffer.from(data.data, "base64");

              return buffer;
            };
          }

          // Handle goto specially
          if (prop === "goto") {
            return async (url: string, options: GotoOptions) => {
              this.intContext.setActivePage(this);
              const result = await target.goto(url, options);

              this.addToHistory("navigate", { url, options }, result);

              if (browserAgent.debugDom) {
                this.browserAgent.logger.warn({
                  category: "deprecation",
                  message:
                    "Warning: debugDom is not supported in this version of BrowserAgent",
                  level: 1,
                });
                await target.waitForLoadState("domcontentloaded");
                await this._waitForSettledDom();
              }
              return result;
            };
          }

          // Handle event listeners
          if (prop === "on") {
            return (
              event: keyof PlaywrightPage["on"],
              listener: Parameters<PlaywrightPage["on"]>[1],
            ) => {
              if (event === "popup") {
                return this.context.on("page", async (page: PlaywrightPage) => {
                  const newContext = await BrowserAgentContext.init(
                    page.context(),
                    browserAgent,
                  );
                  const newAgentPage = new BrowserAgentPage(
                    page,
                    browserAgent,
                    newContext,
                    this.sessionId,
                    this.projectId,
                    this.llmClient,
                  );

                  await newAgentPage.init();
                  listener(newAgentPage.page);
                });
              }
              this.intContext.setActivePage(this);
              return target.on(event, listener);
            };
          }

          // For all other method calls, update active page
          if (typeof value === "function") {
            return (...args: unknown[]) => {
              this.intContext.setActivePage(this);
              // @ts-expect-error - this is a proxy to the playwright page
              return value.apply(target, args);
            };
          }

          return value;
        },
      };

      this.intPage = new Proxy(page, handler) as unknown as Page;
      this.initialized = true;
      return this;
    } catch (err: unknown) {
      this.browserAgent.logger.error({
        category: "init",
        message: "Error initializing BrowserAgentPage",
        level: 1,
        error: err,
      });
      throw err;
    }
  }

  public addToHistory(
    method: HistoryEntry["method"],
    parameters:
      | ActOptions
      | ExtractOptions<z.ZodObject<z.ZodRawShape>>
      | ObserveOptions
      | { url: string; options: GotoOptions }
      | string,
    result?: unknown,
  ): void {
    this._history.push({
      method,
      parameters,
      result: result ?? null,
      timestamp: new Date().toISOString(),
    });
  }

  public get page(): Page {
    return this.intPage;
  }

  public get context(): PlaywrightContext {
    return this.intContext.context;
  }

  // Added discover() to extend the BrowserAgentPage type and satisfy TypeScript.
  public discover(options: unknown): Promise<unknown> {
    throw new Error(
      "discover() is a proxy method and should be accessed via browserAgent.page",
    );
  }

  // We can make methods public because BrowserAgentPage is private to the BrowserAgent class.
  // When a user gets browserAgent.page, they are getting a proxy to the Playwright page.
  // We can override the methods on the proxy to add our own behavior
  /**
   * `_waitForSettledDom` waits until the DOM is settled, and therefore is
   * ready for actions to be taken.
   *
   * **Definition of "settled"**
   *   • No in-flight network requests (except WebSocket / Server-Sent-Events).
   *   • That idle state lasts for at least **500 ms** (the "quiet-window").
   *
   * **How it works**
   *   1.  Subscribes to CDP Network and Page events for the main target and all
   *       out-of-process iframes (via `Target.setAutoAttach { flatten:true }`).
   *   2.  Every time `Network.requestWillBeSent` fires, the request ID is added
   *       to an **`inflight`** `Set`.
   *   3.  When the request finishes—`loadingFinished`, `loadingFailed`,
   *       `requestServedFromCache`, or a *data:* response—the request ID is
   *       removed.
   *   4.  *Document* requests are also mapped **frameId → requestId**; when
   *       `Page.frameStoppedLoading` fires the corresponding Document request is
   *       removed immediately (covers iframes whose network events never close).
   *   5.  A **stalled-request sweep timer** runs every 500 ms.  If a *Document*
   *       request has been open for ≥ 2 s it is forcibly removed; this prevents
   *       ad/analytics iframes from blocking the wait forever.
   *   6.  When `inflight` becomes empty the helper starts a 500 ms timer.
   *       If no new request appears before the timer fires, the promise
   *       resolves → **DOM is considered settled**.
   *   7.  A global guard (`timeoutMs` or `browserAgent.domSettleTimeoutMs`,
   *       default ≈ 30 s) ensures we always resolve; if it fires we log how many
   *       requests were still outstanding.
   *
   * @param timeoutMs – Optional hard cap (ms).  Defaults to
   *                    `this.browserAgent.domSettleTimeoutMs`.
   */
  public async _waitForSettledDom(timeoutMs?: number): Promise<void> {
    const timeout = timeoutMs ?? this.browserAgent.domSettleTimeoutMs;
    const client = await this.getCDPClient();

    const hasDoc = !!(await this.page.title().catch(() => false));
    if (!hasDoc) await this.page.waitForLoadState("domcontentloaded");

    await client.send("Network.enable");
    await client.send("Page.enable");
    await client.send("Target.setAutoAttach", {
      autoAttach: true,
      waitForDebuggerOnStart: false,
      flatten: true,
      filter: [
        { type: "worker", exclude: true },
        { type: "shared_worker", exclude: true },
      ],
    });

    return new Promise<void>((resolve) => {
      const inflight = new Set<string>();
      const meta = new Map<string, { url: string; start: number }>();
      const docByFrame = new Map<string, string>();

      let quietTimer: NodeJS.Timeout | null = null;
      let stalledRequestSweepTimer: NodeJS.Timeout | null = null;

      const clearQuiet = () => {
        if (quietTimer) {
          clearTimeout(quietTimer);
          quietTimer = null;
        }
      };

      const maybeQuiet = () => {
        if (inflight.size === 0 && !quietTimer)
          quietTimer = setTimeout(() => resolveDone(), 500);
      };

      const finishReq = (id: string) => {
        if (!inflight.delete(id)) return;
        meta.delete(id);
        for (const [fid, rid] of docByFrame)
          if (rid === id) docByFrame.delete(fid);
        clearQuiet();
        maybeQuiet();
      };

      const onRequest = (p: {
        requestId: string;
        type?: string;
        request: { url: string };
        frameId?: string;
      }) => {
        if (p.type === "WebSocket" || p.type === "EventSource") return;

        inflight.add(p.requestId);
        meta.set(p.requestId, { url: p.request.url, start: Date.now() });

        if (p.type === "Document" && p.frameId)
          docByFrame.set(p.frameId, p.requestId);

        clearQuiet();
      };

      const onFinish = (p: { requestId: string }) => finishReq(p.requestId);
      const onCached = (p: { requestId: string }) => finishReq(p.requestId);
      const onDataUrl = (p: { requestId: string; response: { url: string } }) =>
        p.response.url.startsWith("data:") && finishReq(p.requestId);

      const onFrameStop = (f: { frameId: string }) => {
        const id = docByFrame.get(f.frameId);
        if (id) finishReq(id);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.on("Network.requestWillBeSent", onRequest as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.on("Network.loadingFinished", onFinish as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.on("Network.loadingFailed", onFinish as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.on("Network.requestServedFromCache", onCached as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.on("Network.responseReceived", onDataUrl as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.on("Page.frameStoppedLoading", onFrameStop as any);

      stalledRequestSweepTimer = setInterval(() => {
        const now = Date.now();
        for (const [id, m] of meta) {
          if (now - m.start > 2_000) {
            inflight.delete(id);
            meta.delete(id);
            this.browserAgent.logger.debug({
              category: "dom",
              message: "⏳ forcing completion of stalled iframe document",
              level: 2,
              auxiliary: {
                url: {
                  value: m.url.slice(0, 120),
                  type: "string",
                },
              },
            });
          }
        }
        maybeQuiet();
      }, 500);

      maybeQuiet();

      const guard = setTimeout(() => {
        if (inflight.size)
          this.browserAgent.logger.debug({
            category: "dom",
            message:
              "⚠️ DOM-settle timeout reached – network requests still pending",
            level: 2,
            auxiliary: {
              count: {
                value: inflight.size.toString(),
                type: "integer",
              },
            },
          });
        resolveDone();
      }, timeout);

      const resolveDone = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client.off("Network.requestWillBeSent", onRequest as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client.off("Network.loadingFinished", onFinish as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client.off("Network.loadingFailed", onFinish as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client.off("Network.requestServedFromCache", onCached as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client.off("Network.responseReceived", onDataUrl as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client.off("Page.frameStoppedLoading", onFrameStop as any);
        if (quietTimer) clearTimeout(quietTimer);
        if (stalledRequestSweepTimer) clearInterval(stalledRequestSweepTimer);
        clearTimeout(guard);
        resolve();
      };
    });
  }

  public async startDomDebug() {
    if (this.browserAgent.debugDom) {
      await this.page
        .evaluate(() => {
          // @ts-expect-error - window.debugDom is not defined in the global scope
          if (typeof window.debugDom === "function") {
            // @ts-expect-error - window.debugDom is not defined in the global scope
            window.debugDom();
          } else {
            console.warn("debugDom is not defined");
          }
        })
        .catch(() => {});
    }
  }

  public async cleanupDomDebug() {
    if (this.browserAgent.debugDom) {
      // @ts-expect-error - window.cleanupDebug is not defined in the global scope
      await this.page.evaluate(() => window.cleanupDebug()).catch(() => {});
    }
  }

  async plan(
    objective: string,
    config?: Partial<PlanningConfig> & { startingUrl: string },
  ): Promise<{
    steps: PlanStep[];
    success: boolean;
    message: string;
  }> {
    if (!this.planHandler) {
      throw new Error("Plan handler not initialized");
    }
    return this.planHandler.plan(objective, config);
  }

  async act({
    action,
    modelName,
    modelClientOptions,
    useVision = "fallback",
    variables = {},
    domSettleTimeoutMs,
    planResult,
  }: ActOptions): Promise<ActResult> {
    if (!this.actHandler) {
      throw new Error("Act handler not initialized");
    }

    if (planResult) {
      if (planResult.type !== "act") {
        return {
          success: false,
          message:
            'Plan result type must be "act" to be handled by `act` method',
          action: action,
        };
      }
      const result = await this.actHandler
        .actFromPlanResult(
          planResult as ActInferenceResult,
          domSettleTimeoutMs,
          variables,
        )
        .catch((error: Error) => {
          this.browserAgent.logger.debug({
            category: "act",
            message: "error acting",
            level: 1,
            auxiliary: {
              error: {
                value: error.message,
                type: "string",
              },
              trace: {
                value: error.stack || "",
                type: "string",
              },
            },
          });

          return {
            success: false as const,
            message: `Internal error: Error acting: ${error.message}`,
            action: action,
          };
        });
      return result;
    }

    useVision = useVision ?? "fallback";
    const requestId = Math.random().toString(36).substring(2);
    const llmClient = this.llmClient;

    const result = await this.actHandler
      .act({
        action,
        llmClient,
        requestId,
        variables,
        domSettleTimeoutMs,
      })
      .catch((error: Error) => {
        this.browserAgent.logger.debug({
          category: "act",
          message: "error acting",
          level: 1,
          auxiliary: {
            error: {
              value: error.message,
              type: "string",
            },
            trace: {
              value: error.stack || "",
              type: "string",
            },
          },
        });

        return {
          success: false as const,
          message: `Internal error: Error acting: ${error.message}`,
          action: action,
        };
      });

    return result;
  }

  async extract<T extends z.ZodObject<z.ZodRawShape>>({
    instruction,
    schema,
    modelName,
    modelClientOptions,
    domSettleTimeoutMs,
    useTextExtract,
  }: ExtractOptions<T>): Promise<ExtractResult<T>> {
    if (!this.extractHandler) {
      throw new Error("Extract handler not initialized");
    }

    const requestId = Math.random().toString(36).substring(2);
    const llmClient = this.llmClient;

    return this.extractHandler
      .extract({
        instruction,
        schema,
        llmClient,
        requestId,
        domSettleTimeoutMs,
        useTextExtract,
      })
      .catch((e) => {
        throw e;
      });
  }

  async observe(options?: ObserveOptions): Promise<ObserveResult[]> {
    if (!this.observeHandler) {
      throw new Error("Observe handler not initialized");
    }

    const requestId = Math.random().toString(36).substring(2);
    const llmClient = this.llmClient;

    return this.observeHandler
      .observe({
        instruction:
          options?.instruction ??
          "Find actions that can be performed on this page.",
        llmClient,
        useVision: options?.useVision ?? false,
        fullPage: false,
        requestId,
        domSettleTimeoutMs: options?.domSettleTimeoutMs,
      })
      .catch((e) => {
        throw e;
      });
  }

  async assert({
    assertion,
    useVision = false,
    domSettleTimeoutMs,
    planResult,
    variables,
  }: AssertOptions): Promise<AssertResult> {
    if (!this.assertHandler) {
      throw new Error("Assert handler not initialized");
    }

    if (planResult) {
      if (planResult.type !== "assert") {
        return {
          success: false,
          message:
            'Plan result type must be "assert" to be handled by `assert` method',
          action: assertion,
        };
      }
      const result = await this.assertHandler
        .assertFromPlanResult(
          planResult as AssertInferenceResult,
          domSettleTimeoutMs,
          variables,
        )
        .catch((error: Error) => {
          return {
            success: false as const,
            message: `Error asserting: ${error.message}`,
            action: assertion,
          };
        });

      return result;
    }

    const requestId = Math.random().toString(36).substring(2);
    const llmClient = this.llmClient;

    const result = await this.assertHandler
      .assert({
        assertion,
        llmClient,
        requestId,
        variables: variables || {},
        domSettleTimeoutMs,
      })
      .catch((error: Error) => {
        return {
          success: false as const,
          message: `Error asserting: ${error.message}`,
          action: assertion,
        };
      });

    return result;
  }

  async aiCheck({
    prompt,
    domSettleTimeoutMs,
    planResult,
  }: AiCheckOptions): Promise<AiCheckResult> {
    if (!this.aiCheckHandler) {
      throw new Error("AI Check handler not initialized");
    }

    if (planResult) {
      if (planResult.type !== "aiCheck") {
        return {
          success: false,
          message:
            'Plan result type must be "aiCheck" to be handled by `aiCheck` method',
          action: prompt,
        };
      }
      const result = await this.aiCheckHandler
        .aiCheckFromPlanResult(
          planResult as AiCheckInferenceResult,
          domSettleTimeoutMs,
        )
        .catch((error: Error) => {
          return {
            success: false as const,
            message: `Error performing AI check: ${error.message}`,
            action: prompt,
          };
        });

      return result;
    }

    const requestId = Math.random().toString(36).substring(2);

    const result = await this.aiCheckHandler
      .aiCheck({
        prompt,
        requestId,
        domSettleTimeoutMs,
      })
      .catch((error: Error) => {
        return {
          success: false as const,
          message: `Error performing AI check: ${error.message}`,
          action: prompt,
        };
      });

    return result;
  }

  /**
   * Get or create a CDP session for the given target.
   * @param target  The Page or (OOPIF) Frame you want to talk to.
   */
  async getCDPClient(
    target: PlaywrightPage | Frame = this.page,
  ): Promise<CDPSession> {
    const cached = this.cdpClients.get(target);
    if (cached) return cached;

    try {
      const session = await this.context.newCDPSession(target);
      this.cdpClients.set(target, session);
      return session;
    } catch (err) {
      // Fallback for same-process iframes
      const msg = (err as Error).message ?? "";
      if (msg.includes("does not have a separate CDP session")) {
        // Re-use / create the top-level session instead
        const rootSession = await this.getCDPClient(this.page);
        // cache the alias so we don't try again for this frame
        this.cdpClients.set(target, rootSession);
        return rootSession;
      }
      throw err;
    }
  }

  /**
   * Send a CDP command to the chosen DevTools target.
   *
   * @param method  Any valid CDP method, e.g. `"DOM.getDocument"`.
   * @param params  Command parameters (optional).
   * @param target  A `Page` or OOPIF `Frame`. Defaults to the main page.
   *
   * @typeParam T  Expected result shape (defaults to `unknown`).
   */
  async sendCDP<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    target?: PlaywrightPage | Frame,
  ): Promise<T> {
    const client = await this.getCDPClient(target ?? this.page);

    return client.send(
      method as Parameters<CDPSession["send"]>[0],
      params as Parameters<CDPSession["send"]>[1],
    ) as Promise<T>;
  }

  /** Enable a CDP domain (e.g. `"Network"` or `"DOM"`) on the chosen target. */
  async enableCDP(
    domain: string,
    target?: PlaywrightPage | Frame,
  ): Promise<void> {
    await this.sendCDP<void>(`${domain}.enable`, {}, target);
  }

  /** Disable a CDP domain on the chosen target. */
  async disableCDP(
    domain: string,
    target?: PlaywrightPage | Frame,
  ): Promise<void> {
    await this.sendCDP<void>(`${domain}.disable`, {}, target);
  }

  /**
   * Encodes a backend node ID with a frame ID to create an EncodedId.
   * @param frameId - The frame ID (undefined for main frame, which becomes 0)
   * @param backendNodeId - The backend node ID
   * @returns An EncodedId in the format "frameId-backendNodeId"
   */
  public encodeWithFrameId(
    frameId: string | undefined,
    backendNodeId: number,
  ): `${number}-${number}` {
    const fid = frameId ? parseInt(frameId, 10) : 0;
    return `${fid}-${backendNodeId}`;
  }
}
