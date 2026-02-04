import { type BrowserAgent } from "../BrowserAgent.js";

declare global {
  var __browserAgent: BrowserAgent | undefined;
}
