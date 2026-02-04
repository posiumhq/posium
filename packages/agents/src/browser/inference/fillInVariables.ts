/**
 * Validates that a variable name contains only safe characters
 * @param name - The variable name to validate
 * @returns true if valid (alphanumeric + underscore only)
 */
function isValidVariableName(name: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/i.test(name);
}

/**
 * Escapes special regex characters in a string
 * @param str - The string to escape
 * @returns Escaped string safe for use in RegExp
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Substitutes variable placeholders with actual values.
 * Supports both {{VARIABLE}} and ${VARIABLE} syntax.
 *
 * Security features:
 * - Validates variable names to prevent injection
 * - Escapes special characters in variable values
 * - Uses global replace to handle multiple occurrences
 *
 * @param text - The text containing variable placeholders
 * @param variables - Record of variable names to values
 * @returns Text with variables substituted
 */
export function fillInVariables(
  text: string,
  variables: Record<string, string>,
): string {
  let processedText = text;

  Object.entries(variables).forEach(([key, value]) => {
    // Validate variable name for security
    if (!isValidVariableName(key)) {
      console.warn(`Skipping invalid variable name: ${key}`);
      return;
    }

    // Escape the key for safe regex usage
    const escapedKey = escapeRegExp(key);

    // Support both {{VAR}} and ${VAR} syntax
    const doubleBracePattern = new RegExp(`\\{\\{${escapedKey}\\}\\}`, "g");
    const dollarBracePattern = new RegExp(`\\$\\{${escapedKey}\\}`, "g");

    // Replace both patterns with the value
    processedText = processedText.replace(doubleBracePattern, value);
    processedText = processedText.replace(dollarBracePattern, value);
  });

  return processedText;
}
