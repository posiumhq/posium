import { nanoid } from "nanoid";

interface GenerateIdOptions {
  length?: number;
}

/**
 * Generate a unique ID for data table filters
 */
export function generateId(options?: GenerateIdOptions | number): string {
  const length = typeof options === "number" ? options : options?.length ?? 8;
  return nanoid(length);
}
