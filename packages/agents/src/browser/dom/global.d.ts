export interface BrowserAgentBackdoor {
  /** Closed shadow-root accessors */
  getClosedRoot(host: Element): ShadowRoot | undefined;
  queryClosed(host: Element, selector: string): Element[];
  xpathClosed(host: Element, xpath: string): Node[];
}
declare global {
  interface Window {
    __browserAgentInjected?: boolean;
    __playwright?: unknown;
    __pw_manual?: unknown;
    __PW_inspect?: unknown;
    getScrollableElementXpaths: (topN?: number) => Promise<string[]>;
    getNodeFromXpath: (xpath: string) => Node | null;
    waitForElementScrollEnd: (element: HTMLElement) => Promise<void>;
    waitForDomSettle: () => Promise<void>;
    processDom: (domSnapshot?: unknown) => unknown;
    processAllOfDom: () => unknown;
    storeDOM: () => unknown;
    restoreDOM: (domSnapshot: unknown) => void;
    createTextBoundingBoxes: (texts: string[]) => unknown;
    getElementBoundingBoxes: (selectors: string[]) => unknown;
    createBrowserAgentContainer: () => HTMLElement;
    readonly __browserAgent__?: BrowserAgentBackdoor;
  }
}
