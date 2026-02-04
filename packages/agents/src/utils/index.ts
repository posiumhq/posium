import type { TextAnnotation } from "../browser/types/textannotation.js";

// generateId function uses crypto.randomUUID for compatibility
export function generateId(_text: string): string {
  return crypto.randomUUID();
}

/**
 * `formatText` converts a list of text annotations into a formatted text representation.
 * Each annotation represents a piece of text at a certain position on a webpage.
 * The formatting attempts to reconstruct a textual "screenshot" of the page by:
 * - Grouping annotations into lines based on their vertical positions.
 * - Adjusting spacing to reflect line gaps.
 * - Attempting to preserve relative positions and formatting.
 *
 * The output is a text block, optionally surrounded by lines of dashes, that aims
 * to closely mirror the visual layout of the text on the page.
 *
 * @param textAnnotations - An array of TextAnnotations describing text and their positions.
 * @param pageWidth - The width of the page in pixels, used to normalize positions.
 * @returns A string representing the text layout of the page.
 */
export function formatText(
  _textAnnotations: TextAnnotation[],
  _pageWidth: number,
): string {
  // TODO: Implement full text formatting logic
  return "formatted text";
}

export * from "./playwrightGenerator.js";
export * from "./executorTestGenerator.js";
