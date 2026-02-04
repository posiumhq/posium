import type { Browser, BrowserContext } from "@playwright/test";

export interface BrowserResult {
  env: "LOCAL" | "REMOTE";
  browser?: Browser;
  context: BrowserContext;
  debugUrl?: string;
  sessionUrl?: string;
  contextPath?: string;
  sessionId?: string;
}
