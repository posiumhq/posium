import { EventEmitter } from "events";
import type { eventWithTime } from "@rrweb/types";

export interface RRWebEventData {
  events: eventWithTime[];
  sessionId: string;
}

export interface NetworkEventData {
  event: unknown;
  sessionId: string;
}

export type RRWebEventListener = (data: RRWebEventData) => void;
export type NetworkEventListener = (data: NetworkEventData) => void;

class RRWebEventEmitter extends EventEmitter {
  private static instance: RRWebEventEmitter;

  private constructor() {
    super();
  }

  public static getInstance(): RRWebEventEmitter {
    if (!RRWebEventEmitter.instance) {
      RRWebEventEmitter.instance = new RRWebEventEmitter();
    }
    return RRWebEventEmitter.instance;
  }

  public emitRRWebEvent(data: RRWebEventData) {
    try {
      this.emit("rrweb-event", data);
    } catch (error) {
      console.error("Failed to emit RRWeb event", error);
    }
  }

  public emitNetworkEvent(data: NetworkEventData) {
    try {
      this.emit("network-event", data);
    } catch (error) {
      console.error("Failed to emit network event", error);
    }
  }

  /**
   * Subscribe to RRWeb events for a specific session
   * @param sessionId - The session ID to filter events for
   * @param listener - The callback function to handle events
   * @returns A function to unsubscribe from the events
   */
  public subscribeToSession(
    sessionId: string,
    listener: (data: {
      rrwebEvents?: eventWithTime[];
      networkEvent?: unknown;
    }) => void,
  ): () => void {
    const rrwebHandler: RRWebEventListener = (data) => {
      if (data.sessionId === sessionId) {
        listener({ rrwebEvents: data.events });
      }
    };

    const networkHandler: NetworkEventListener = (data) => {
      if (data.sessionId === sessionId) {
        listener({ networkEvent: data.event });
      }
    };

    this.on("rrweb-event", rrwebHandler);
    this.on("network-event", networkHandler);

    return () => {
      this.off("rrweb-event", rrwebHandler);
      this.off("network-event", networkHandler);
    };
  }
}

export const rrwebEventEmitter = RRWebEventEmitter.getInstance();
