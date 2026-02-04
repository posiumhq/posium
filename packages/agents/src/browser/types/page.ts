import type { Page as PlaywrightPage } from "@playwright/test";
import type { BrowserContext as PlaywrightContext } from "@playwright/test";
import type {
  ActOptions,
  ActResult,
  AssertOptions,
  AssertResult,
  ExtractOptions,
  ExtractResult,
  ObserveOptions,
  ObserveResult,
} from "./browserAgent.js";
import type { z } from "zod";
//import type { PlanResult } from './plan';

export interface Page extends PlaywrightPage {
  act: (options: ActOptions) => Promise<ActResult>;
  assert: (options: AssertOptions) => Promise<AssertResult>;
  extract: <T extends z.ZodObject<z.ZodRawShape>>(
    options: ExtractOptions<T>,
  ) => Promise<ExtractResult<T>>;
  observe: (options?: ObserveOptions) => Promise<ObserveResult[]>;
  _waitForSettledDom: (timeoutMs?: number) => Promise<void>;
  //plan: (options: { instruction: string; useVision?: boolean }) => Promise<PlanResult>;
}

// Empty type for now, but will be used in the future
export type BrowserContext = PlaywrightContext;
