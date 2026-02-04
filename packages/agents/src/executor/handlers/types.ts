import type { ExecutableStep, StepResult } from "../types.js";
import type { BrowserAgent } from "../../browser/BrowserAgent.js";

/**
 * Handler interface - each step type implements this
 * Handlers read configuration directly from step.commandDetails
 */
export interface StepHandler {
  execute(step: ExecutableStep, browserAgent: BrowserAgent): Promise<StepResult>;
}
