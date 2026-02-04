import { type ZodError } from "zod/v3";
const BROWSER_AGENT_VERSION = "v1.0.0";

export class BrowserAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class BrowserAgentDefaultError extends BrowserAgentError {
  constructor(error?: unknown) {
    if (error instanceof Error || error instanceof BrowserAgentError) {
      super(
        `\nHey! We're sorry you ran into an error. \nBrowserAgent version: ${BROWSER_AGENT_VERSION} \n\nFull error:\n${error.message}`,
      );
    }
  }
}

export class BrowserAgentEnvironmentError extends BrowserAgentError {
  constructor(
    currentEnvironment: string,
    requiredEnvironment: string,
    feature: string,
  ) {
    super(
      `You seem to be setting the current environment to ${currentEnvironment}.` +
        `Ensure the environment is set to ${requiredEnvironment} if you want to use ${feature}.`,
    );
  }
}

export class MissingEnvironmentVariableError extends BrowserAgentError {
  constructor(missingEnvironmentVariable: string, feature: string) {
    super(
      `${missingEnvironmentVariable} is required to use ${feature}.` +
        `Please set ${missingEnvironmentVariable} in your environment.`,
    );
  }
}

export class UnsupportedModelError extends BrowserAgentError {
  constructor(supportedModels: string[], feature?: string) {
    super(
      feature
        ? `${feature} requires one of the following models: ${supportedModels}`
        : `please use one of the supported models: ${supportedModels}`,
    );
  }
}

export class UnsupportedModelProviderError extends BrowserAgentError {
  constructor(supportedProviders: string[], feature?: string) {
    super(
      feature
        ? `${feature} requires one of the following model providers: ${supportedProviders}`
        : `please use one of the supported model providers: ${supportedProviders}`,
    );
  }
}

export class UnsupportedAISDKModelProviderError extends BrowserAgentError {
  constructor(provider: string, supportedProviders: string[]) {
    super(
      `${provider} is not currently supported for aiSDK. please use one of the supported model providers: ${supportedProviders}`,
    );
  }
}

export class InvalidAISDKModelFormatError extends BrowserAgentError {
  constructor(modelName: string) {
    super(
      `${modelName} does not follow correct format for specifying aiSDK models. Please define your modelName as 'provider/model-name'. For example: \`modelName: 'openai/gpt-4o-mini'\``,
    );
  }
}

export class BrowserAgentNotInitializedError extends BrowserAgentError {
  constructor(prop: string) {
    super(
      `You seem to be calling \`${prop}\` on a page in an uninitialized \`BrowserAgent\` object. ` +
        `Ensure you are running \`await browserAgent.init()\` on the BrowserAgent object before ` +
        `referencing the \`page\` object.`,
    );
  }
}

export class BrowserbaseSessionNotFoundError extends BrowserAgentError {
  constructor() {
    super("No Browserbase session ID found");
  }
}

export class CaptchaTimeoutError extends BrowserAgentError {
  constructor() {
    super("Captcha timeout");
  }
}

export class MissingLLMConfigurationError extends BrowserAgentError {
  constructor() {
    super(
      "No LLM API key or LLM Client configured. An LLM API key or a custom LLM Client " +
        "is required to use act, extract, or observe.",
    );
  }
}

export class HandlerNotInitializedError extends BrowserAgentError {
  constructor(handlerType: string) {
    super(`${handlerType} handler not initialized`);
  }
}

export class BrowserAgentInvalidArgumentError extends BrowserAgentError {
  constructor(message: string) {
    super(`InvalidArgumentError: ${message}`);
  }
}

export class BrowserAgentElementNotFoundError extends BrowserAgentError {
  constructor(xpaths: string[]) {
    super(`Could not find an element for the given xPath(s): ${xpaths}`);
  }
}

export class AgentScreenshotProviderError extends BrowserAgentError {
  constructor(message: string) {
    super(`ScreenshotProviderError: ${message}`);
  }
}

export class BrowserAgentMissingArgumentError extends BrowserAgentError {
  constructor(message: string) {
    super(`MissingArgumentError: ${message}`);
  }
}

export class CreateChatCompletionResponseError extends BrowserAgentError {
  constructor(message: string) {
    super(`CreateChatCompletionResponseError: ${message}`);
  }
}

export class BrowserAgentEvalError extends BrowserAgentError {
  constructor(message: string) {
    super(`BrowserAgentEvalError: ${message}`);
  }
}

export class BrowserAgentDomProcessError extends BrowserAgentError {
  constructor(message: string) {
    super(`Error Processing Dom: ${message}`);
  }
}

export class BrowserAgentClickError extends BrowserAgentError {
  constructor(message: string, selector: string) {
    super(
      `Error Clicking Element with selector: ${selector} Reason: ${message}`,
    );
  }
}

export class LLMResponseError extends BrowserAgentError {
  constructor(primitive: string, message: string) {
    super(`${primitive} LLM response error: ${message}`);
  }
}

export class BrowserAgentIframeError extends BrowserAgentError {
  constructor(frameUrl: string, message: string) {
    super(
      `Unable to resolve frameId for iframe with URL: ${frameUrl} Full error: ${message}`,
    );
  }
}

export class ContentFrameNotFoundError extends BrowserAgentError {
  constructor(selector: string) {
    super(`Unable to obtain a content frame for selector: ${selector}`);
  }
}

export class XPathResolutionError extends BrowserAgentError {
  constructor(xpath: string) {
    super(`XPath "${xpath}" does not resolve in the current page or frames`);
  }
}

export class ExperimentalApiConflictError extends BrowserAgentError {
  constructor() {
    super(
      "`experimental` mode cannot be used together with the BrowserAgent API. " +
        "To use experimental features, set experimental: true, and useApi: false in the browserAgent constructor. " +
        "To use the BrowserAgent API, set experimental: false and useApi: true in the browserAgent constructor. ",
    );
  }
}

export class ExperimentalNotConfiguredError extends BrowserAgentError {
  constructor(featureName: string) {
    super(`Feature "${featureName}" is an experimental feature, and cannot be configured when useAPI: true.
    Please set experimental: true and useAPI: false in the browserAgent constructor to use this feature.
    If you wish to use the BrowserAgent API, please ensure ${featureName} is not defined in your function call,
    and set experimental: false, useAPI: true in the BrowserAgent constructor. `);
  }
}

export class ZodSchemaValidationError extends Error {
  constructor(
    public readonly received: unknown,
    public readonly issues: ReturnType<ZodError["format"]>,
  ) {
    super(`Zod schema validation failed

— Received —
${JSON.stringify(received, null, 2)}

— Issues —
${JSON.stringify(issues, null, 2)}`);
    this.name = "ZodSchemaValidationError";
  }
}

export class BrowserAgentInitError extends BrowserAgentError {
  constructor(message: string) {
    super(message);
  }
}

export class MCPConnectionError extends BrowserAgentError {
  public readonly serverUrl: string;
  public readonly originalError: unknown;

  constructor(serverUrl: string, originalError: unknown) {
    const errorMessage =
      originalError instanceof Error
        ? originalError.message
        : String(originalError);

    super(
      `Failed to connect to MCP server at "${serverUrl}". ${errorMessage}. ` +
        `Please verify the server URL is correct and the server is running.`,
    );

    this.serverUrl = serverUrl;
    this.originalError = originalError;
  }
}

export class BrowserAgentShadowRootMissingError extends BrowserAgentError {
  constructor(detail?: string) {
    super(
      `No shadow root present on the resolved host` +
        (detail ? `: ${detail}` : ""),
    );
  }
}

export class BrowserAgentShadowSegmentEmptyError extends BrowserAgentError {
  constructor() {
    super(`Empty selector segment after shadow-DOM hop ("//")`);
  }
}

export class BrowserAgentShadowSegmentNotFoundError extends BrowserAgentError {
  constructor(segment: string, hint?: string) {
    super(
      `Shadow segment '${segment}' matched no element inside shadow root` +
        (hint ? ` ${hint}` : ""),
    );
  }
}
