import type { CoreMessage } from "./types.js";

const observeSystemPrompt = `
You are helping the user automate the browser by finding elements based on what the user wants to observe in the page.
You will be given:
1. a instruction of elements to observe
2. a numbered list of possible elements or an annotated image of the page

Return an array of elements that match the instruction.
`;

export function buildObserveSystemPrompt(): CoreMessage {
  const content = observeSystemPrompt.replace(/\s+/g, " ");

  return {
    role: "system",
    content,
  };
}

export function buildObserveUserMessage(
  instruction: string,
  domElements: string,
): CoreMessage {
  return {
    role: "user",
    content: `instruction: ${instruction}
DOM: ${domElements}`,
  };
}
