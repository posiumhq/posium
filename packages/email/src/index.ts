// Re-export types
export type {
  EmailAddress,
  EmailRecipient,
  SmtpConfig,
  FromAddresses,
  EmailClientOptions,
  SendEmailOptions,
  SendOptions,
  SendEmailResult,
  LoginVerificationData,
  PasswordResetData,
  ProjectStatus,
  StatusEmailData,
  DailyStatusData,
  WeeklyStatusData,
  OrgInviteData,
  AlertData,
  FailedTestSummary,
  TestFailureData,
  EmailClient,
} from "./types.js";

// Re-export factory
export { createEmailClient } from "./client.js";

// Re-export templates (for customization/testing)
export {
  BaseLayout,
  LoginVerificationEmail,
  PasswordResetEmail,
  DailyStatusEmail,
  WeeklyStatusEmail,
  OrgInviteEmail,
  AlertEmail,
  TestFailureEmail,
} from "./templates/index.js";

import { createEmailClient } from "./client.js";
import type { EmailClient } from "./types.js";

// Lazy singleton for convenience (reads env vars directly)
let defaultClient: EmailClient | null = null;

/**
 * Returns a singleton email client configured from environment variables.
 *
 * Required env vars:
 * - EMAIL_SMTP_HOST
 * - EMAIL_SMTP_USER
 * - EMAIL_SMTP_PASS
 * - EMAIL_FROM_ADDRESS_DEFAULT
 *
 * Optional env vars:
 * - EMAIL_SMTP_PORT (default: 587)
 * - EMAIL_SMTP_SECURE (default: false)
 * - EMAIL_FROM_AUTH
 * - EMAIL_FROM_NOTIFICATIONS
 * - EMAIL_FROM_INVITES
 * - EMAIL_FROM_NAME (default: "Posium")
 */
export function getEmailClient(): EmailClient {
  if (!defaultClient) {
    const host = process.env.EMAIL_SMTP_HOST;
    const user = process.env.EMAIL_SMTP_USER;
    const pass = process.env.EMAIL_SMTP_PASS;
    const fromDefault = process.env.EMAIL_FROM_ADDRESS_DEFAULT;

    if (!host || !user || !pass || !fromDefault) {
      throw new Error(
        "Missing required email configuration. " +
          "Set EMAIL_SMTP_HOST, EMAIL_SMTP_USER, EMAIL_SMTP_PASS, and EMAIL_FROM_ADDRESS_DEFAULT."
      );
    }

    defaultClient = createEmailClient({
      smtp: {
        host,
        port: parseInt(process.env.EMAIL_SMTP_PORT || "587", 10),
        secure: process.env.EMAIL_SMTP_SECURE === "true",
        user,
        pass,
      },
      from: {
        default: fromDefault,
        auth: process.env.EMAIL_FROM_AUTH,
        notifications: process.env.EMAIL_FROM_NOTIFICATIONS,
        invites: process.env.EMAIL_FROM_INVITES,
        name: process.env.EMAIL_FROM_NAME || "Posium",
      },
    });
  }
  return defaultClient;
}

/**
 * Resets the singleton client (useful for testing).
 */
export function resetEmailClient(): void {
  if (defaultClient) {
    defaultClient.close();
    defaultClient = null;
  }
}
