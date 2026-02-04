import { render } from "@react-email/render";
import type { Transporter } from "nodemailer";
import { createTransport } from "./transport.js";
import {
  LoginVerificationEmail,
  PasswordResetEmail,
  DailyStatusEmail,
  WeeklyStatusEmail,
  OrgInviteEmail,
  AlertEmail,
  TestFailureEmail,
} from "./templates/index.js";
import type {
  EmailClient,
  EmailClientOptions,
  EmailRecipient,
  LoginVerificationData,
  PasswordResetData,
  DailyStatusData,
  WeeklyStatusData,
  OrgInviteData,
  AlertData,
  TestFailureData,
  SendEmailOptions,
  SendEmailResult,
  SendOptions,
  EmailAddress,
} from "./types.js";

/**
 * Formats an email address for nodemailer.
 */
function formatAddress(addr: EmailAddress): string {
  if (typeof addr === "string") {
    return addr;
  }
  return addr.name ? `"${addr.name}" <${addr.address}>` : addr.address;
}

/**
 * Formats email recipients for nodemailer (handles single or array).
 */
function formatRecipients(recipients: EmailRecipient): string | string[] {
  if (Array.isArray(recipients)) {
    return recipients.map(formatAddress);
  }
  return formatAddress(recipients);
}

/**
 * Creates an email client with the given configuration.
 *
 * @param opts - Configuration options including SMTP settings and from addresses
 * @returns An email client with methods for sending various email types
 *
 * @example
 * ```ts
 * const client = createEmailClient({
 *   smtp: { host: "smtp.example.com", user: "...", pass: "..." },
 *   from: { default: "noreply@example.com" },
 * });
 *
 * await client.sendLoginVerification("user@example.com", {
 *   userName: "John",
 *   verificationUrl: "https://...",
 *   expiresInMinutes: 60,
 * });
 * ```
 */
export function createEmailClient(opts: EmailClientOptions): EmailClient {
  const transport: Transporter = opts.transport ?? createTransport(opts.smtp);
  const fromName = opts.from.name ?? "Posium";

  // Resolve from address for different email types
  const getFromAddress = (type: "auth" | "notifications" | "invites"): string => {
    const address = opts.from[type] ?? opts.from.default;
    return `"${fromName}" <${address}>`;
  };

  // Low-level send function
  const sendEmail = async (options: SendEmailOptions): Promise<SendEmailResult> => {
    const from = options.from
      ? formatAddress(options.from)
      : `"${fromName}" <${opts.from.default}>`;

    const result = await transport.sendMail({
      from,
      to: formatRecipients(options.to),
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo ? formatAddress(options.replyTo) : undefined,
      cc: options.cc ? formatRecipients(options.cc) : undefined,
      bcc: options.bcc ? formatRecipients(options.bcc) : undefined,
    });

    return {
      messageId: result.messageId,
      accepted: Array.isArray(result.accepted)
        ? result.accepted.map(String)
        : [],
      rejected: Array.isArray(result.rejected)
        ? result.rejected.map(String)
        : [],
    };
  };

  // Auth emails
  const sendLoginVerification = async (
    to: EmailRecipient,
    data: LoginVerificationData,
    sendOpts?: SendOptions
  ): Promise<SendEmailResult> => {
    const html = await render(LoginVerificationEmail(data));
    return sendEmail({
      to,
      subject: "Verify your email",
      html,
      from: sendOpts?.from ?? getFromAddress("auth"),
      replyTo: sendOpts?.replyTo,
      cc: sendOpts?.cc,
      bcc: sendOpts?.bcc,
    });
  };

  const sendPasswordReset = async (
    to: EmailRecipient,
    data: PasswordResetData,
    sendOpts?: SendOptions
  ): Promise<SendEmailResult> => {
    const html = await render(PasswordResetEmail(data));
    return sendEmail({
      to,
      subject: "Reset your password",
      html,
      from: sendOpts?.from ?? getFromAddress("auth"),
      replyTo: sendOpts?.replyTo,
      cc: sendOpts?.cc,
      bcc: sendOpts?.bcc,
    });
  };

  // Notification emails
  const sendDailyStatus = async (
    to: EmailRecipient,
    data: DailyStatusData,
    sendOpts?: SendOptions
  ): Promise<SendEmailResult> => {
    const html = await render(DailyStatusEmail(data));
    const dateStr = data.generatedAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return sendEmail({
      to,
      subject: `Daily Status - ${dateStr}`,
      html,
      from: sendOpts?.from ?? getFromAddress("notifications"),
      replyTo: sendOpts?.replyTo,
      cc: sendOpts?.cc,
      bcc: sendOpts?.bcc,
    });
  };

  const sendWeeklyStatus = async (
    to: EmailRecipient,
    data: WeeklyStatusData,
    sendOpts?: SendOptions
  ): Promise<SendEmailResult> => {
    const html = await render(WeeklyStatusEmail(data));
    const dateStr = data.generatedAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return sendEmail({
      to,
      subject: `Weekly Status - ${dateStr}`,
      html,
      from: sendOpts?.from ?? getFromAddress("notifications"),
      replyTo: sendOpts?.replyTo,
      cc: sendOpts?.cc,
      bcc: sendOpts?.bcc,
    });
  };

  const sendAlert = async (
    to: EmailRecipient,
    data: AlertData,
    sendOpts?: SendOptions
  ): Promise<SendEmailResult> => {
    const html = await render(AlertEmail(data));
    return sendEmail({
      to,
      subject: `[Alert] Test failed: ${data.testName}`,
      html,
      from: sendOpts?.from ?? getFromAddress("notifications"),
      replyTo: sendOpts?.replyTo,
      cc: sendOpts?.cc,
      bcc: sendOpts?.bcc,
    });
  };

  const sendTestFailure = async (
    to: EmailRecipient,
    data: TestFailureData,
    sendOpts?: SendOptions
  ): Promise<SendEmailResult> => {
    const html = await render(TestFailureEmail(data));
    const failedCount = data.stats.totalFailed;
    const subject =
      failedCount === 1
        ? `[Alert] 1 test failed in ${data.orgName}`
        : `[Alert] ${failedCount} tests failed in ${data.orgName}`;
    return sendEmail({
      to,
      subject,
      html,
      from: sendOpts?.from ?? getFromAddress("notifications"),
      replyTo: sendOpts?.replyTo,
      cc: sendOpts?.cc,
      bcc: sendOpts?.bcc,
    });
  };

  // Invite emails
  const sendOrgInvite = async (
    to: EmailRecipient,
    data: OrgInviteData,
    sendOpts?: SendOptions
  ): Promise<SendEmailResult> => {
    const html = await render(OrgInviteEmail(data));
    return sendEmail({
      to,
      subject: `${data.inviterName} invited you to join ${data.orgName}`,
      html,
      from: sendOpts?.from ?? getFromAddress("invites"),
      replyTo: sendOpts?.replyTo,
      cc: sendOpts?.cc,
      bcc: sendOpts?.bcc,
    });
  };

  // Cleanup (no-op if not pooled)
  const close = () => transport.close?.();

  return {
    sendEmail,
    sendLoginVerification,
    sendPasswordReset,
    sendDailyStatus,
    sendWeeklyStatus,
    sendAlert,
    sendTestFailure,
    sendOrgInvite,
    close,
  };
}
