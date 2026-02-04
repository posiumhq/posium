/**
 * Check if a value is a plain object (not array, null, Date, etc.)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Deep merge multiple objects recursively
 * Later sources override earlier sources at each nested level
 *
 * Merge rules:
 * - Plain objects are merged recursively
 * - Arrays replace entirely (no array merging)
 * - Primitives replace entirely
 * - null/undefined in source replaces target value
 *
 * @param target - Base object to merge into
 * @param sources - Objects to merge from (later takes precedence)
 * @returns New merged object (does not mutate inputs)
 *
 * @example
 * // Nested merge
 * deepMerge(
 *   { api: { timeout: 5000, retries: 3 } },
 *   { api: { timeout: 10000 } }
 * )
 * // Result: { api: { timeout: 10000, retries: 3 } }
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Array<Record<string, unknown>>
): T {
  const result = { ...target } as Record<string, unknown>;

  for (const source of sources) {
    if (!source) continue;

    for (const key of Object.keys(source)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
        // Recursively merge nested objects
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue,
        );
      } else {
        // Replace value (primitives, arrays, null, undefined)
        result[key] = sourceValue;
      }
    }
  }

  return result as T;
}
