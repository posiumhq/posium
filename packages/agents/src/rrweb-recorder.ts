import type { BrowserContext } from "@playwright/test";
import type { eventWithTime } from "@rrweb/types";
import type { LoggerType } from "./browser/types/logger.js";
import { rrwebEventEmitter } from "./events.js";

export const setupRRWebRecorder = async (
  context: BrowserContext,
  sessionId: string,
  logger: LoggerType,
) => {
  await context.exposeFunction("__rrwebEmit", async (event: eventWithTime) => {
    try {
      rrwebEventEmitter.emitRRWebEvent({
        events: [event],
        sessionId: sessionId,
      });
    } catch (error) {
      logger.error({ err: error }, "Failed to emit RRWeb event");
    }
  });

  // Setup a separate network event emitter
  await context.exposeFunction(
    "__emitNetworkEvent",
    async (eventData: unknown) => {
      try {
        rrwebEventEmitter.emitNetworkEvent({
          event: eventData,
          sessionId: sessionId,
        });
      } catch (error) {
        logger.error({ err: error }, "Failed to emit network event");
      }
    },
  );

  // to upgrade to alpha 18 - https://chatgpt.com/c/68da6360-8828-832e-aab3-4e8ed28397a0
  // will have to increase a bundle or some shit to use without dynamic import thing
  const rrwebScript = await fetch(
    "https://unpkg.com/rrweb@2.0.0-alpha.4/dist/rrweb.min.js",
  ).then((response) => response.text());

  // Wrap the script so that it executes and then assigns its local variable to window
  const wrappedRrwebScript = `(function(){
    ${rrwebScript}

    // Create a simple console plugin
    const consolePlugin = {
      name: 'console',
      observer(cb) {
        const methods = ['log', 'info', 'warn', 'error'];
        methods.forEach(function(method) {
          const original = console[method];
          console[method] = function(...args) {
            try {
              cb({
                type: 6,
                data: {
                  level: method,
                  payload: args.map(a => String(a)),
                  timestamp: Date.now()
                },
                timestamp: Date.now()
              });
            } catch (e) {
              console.error('Error in console plugin:', e);
            }
            return original.apply(console, args);
          };
        });
      }
    };

        // Create a wrapper for the emit function that checks URL
    const originalEmit = window.__rrwebEmit;
    // const includeList = ['formbricks', 'typeform', 'tremor', 'hatica', 'linear', 'homegate', 'getvymo'];
    window.__rrwebEmit = async function(event) {
      // Check if we're on the target domain
      if (window.top === window) {
        return originalEmit(event);
      }
      // Silently skip events for non-target domains
      return Promise.resolve();
    };

    // Setup rrweb recording
    window.__rrwebStop = rrweb.record({
      emit: window.__rrwebEmit,
      plugins: [consolePlugin],
      recordCanvas: true,
      inlineStylesheet: true,
      collectFonts: true,
    });

    // Add network monitoring
    const originalFetch = window.fetch;
    window.fetch = function() {
      const url = arguments[0]?.url || arguments[0];
      const method = arguments[1]?.method || 'GET';
      const startTime = Date.now();

      // Emit request event
      window.__rrwebEmit({
        type: 7,
        data: {
          type: 'network',
          subtype: 'request',
          url: String(url),
          method,
          timestamp: startTime
        },
        timestamp: startTime
      });

      // Make the actual request
      const promise = originalFetch.apply(this, arguments);

      // Handle response
      promise.then(response => {
        window.__rrwebEmit({
          type: 7,
          data: {
            type: 'network',
            subtype: 'response',
            url: String(url),
            method,
            status: response.status,
            statusText: response.statusText,
            duration: Date.now() - startTime,
            timestamp: Date.now()
          },
          timestamp: Date.now()
        });
      }).catch(error => {
        window.__rrwebEmit({
          type: 7,
          data: {
            type: 'network',
            subtype: 'error',
            url: String(url),
            method,
            error: error.message,
            timestamp: Date.now()
          },
          timestamp: Date.now()
        });
      });

      return promise;
    };
    window.rrweb = rrweb;
  })();`;

  // Inject the script inline – this often bypasses CSP restrictions
  await context.addInitScript({
    content: wrappedRrwebScript,
  });
};
