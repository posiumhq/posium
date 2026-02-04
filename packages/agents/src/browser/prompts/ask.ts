import type { CoreMessage } from "./types.js";

const askSystemPrompt = `
you are a simple question answering assistent given the user's question. respond with only the answer.
`;

export function buildAskSystemPrompt(): CoreMessage {
  return {
    role: "system",
    content: askSystemPrompt,
  };
}

export function buildAskUserPrompt(question: string): CoreMessage {
  return {
    role: "user",
    content: `question: ${question}`,
  };
}
