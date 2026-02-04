import type { Transporter } from "nodemailer";

// ============================================================================
// Address Types
// ============================================================================

export type EmailAddress = string | { name?: string; address: string };
export type EmailRecipient = EmailAddress | EmailAddress[];

// ============================================================================
// Configuration
// ============================================================================

export interface SmtpConfig {
  host: string;
  port?: number;
  secure?: boolean;
  user: string;
  pass: string;
}

export interface FromAddresses {
  /** Required fallback for all emails */
  default: string;
  /** Override for auth emails (verification, password reset) */
  auth?: string;
  /** Override for notification emails (digests, alerts) */
  notifications?: string;
  /** Override for invite emails */
  invites?: string;
  /** Display name for all emails (default: "Posium") */
  name?: string;
}

export interface EmailClientOptions {
  smtp: SmtpConfig;
  from: FromAddresses;
  /** Optional: inject custom transport (useful for testing) */
  transport?: Transporter;
}

// ============================================================================
// Send Options
// ============================================================================

/** Low-level send options (html/text, not React elements) */
export interface SendEmailOptions {
  to: EmailRecipient;
  subject: string;
  html: string;
  text?: string;
  from?: EmailAddress;
  replyTo?: EmailAddress;
  cc?: EmailRecipient;
  bcc?: EmailRecipient;
}

/** Override options for typed senders */
export interface SendOptions {
  from?: EmailAddress;
  replyTo?: EmailAddress;
  cc?: EmailRecipient;
  bcc?: EmailRecipient;
}

/** Result from sending an email */
export interface SendEmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

// ============================================================================
// Email Data Types
// ============================================================================

/** Login verification email data (for BetterAuth) */
export interface LoginVerificationData {
  userName: string;
  verificationUrl: string;
  expiresInMinutes: number;
}

/** Password reset email data (for BetterAuth) */
export interface PasswordResetData {
  userName: string;
  resetUrl: string;
  expiresInMinutes: number;
}

/** Current health status of a single project */
export interface ProjectStatus {
  projectId: string;
  projectName: string;
  /** Whether this project has any completed runs */
  hasRuns: boolean;
  /** Only set if hasRuns is true */
  totalTests?: number;
  failingTests?: number;
  passingTests?: number;
  healthPercent?: number;
  /** ISO timestamp of the most recent run (for sorting) */
  lastRunAt?: string;
}

/** Daily/Weekly status email data (single org, up to 10 projects) */
export interface StatusEmailData {
  userName: string;
  generatedAt: Date;
  orgId: string;
  orgName: string;
  orgSlug: string;
  /** Projects sorted by most recent run, max 10 */
  projects: ProjectStatus[];
  /** Total projects in org (may be > 10) */
  totalProjects: number;
  /** Link to org dashboard */
  seeMoreUrl: string;
}

/** Daily status email data */
export type DailyStatusData = StatusEmailData;

/** Weekly status email data */
export type WeeklyStatusData = StatusEmailData;

/** Organization invite email data */
export interface OrgInviteData {
  inviterName: string;
  orgName: string;
  inviteUrl: string;
  expiresInDays: number;
}

/** Alert email data (immediate failure notification) */
export interface AlertData {
  userName: string;
  orgName: string;
  projectName: string;
  runId: string;
  testName: string;
  errorMessage: string;
  runUrl: string;
}

/** Failed test summary for batched failure notifications */
export interface FailedTestSummary {
  testName: string;
  projectName: string;
  runUrl: string;
  testUrl: string;
  failedAt: Date;
}

/** Batched test failure notification data */
export interface TestFailureData {
  userName: string;
  generatedAt: Date;
  orgName: string;
  orgSlug: string;
  failedTests: FailedTestSummary[];
  stats: {
    totalFailed: number;
    totalRuns: number;
    batchWindowMinutes: number;
  };
  seeMoreUrl: string;
}

// ============================================================================
// Email Client Interface
// ============================================================================

export interface EmailClient {
  /** Low-level: accepts final html/text (no templates) */
  sendEmail: (options: SendEmailOptions) => Promise<SendEmailResult>;

  /** Auth: Login verification email */
  sendLoginVerification: (
    to: EmailRecipient,
    data: LoginVerificationData,
    opts?: SendOptions
  ) => Promise<SendEmailResult>;

  /** Auth: Password reset email */
  sendPasswordReset: (
    to: EmailRecipient,
    data: PasswordResetData,
    opts?: SendOptions
  ) => Promise<SendEmailResult>;

  /** Notification: Daily status email */
  sendDailyStatus: (
    to: EmailRecipient,
    data: DailyStatusData,
    opts?: SendOptions
  ) => Promise<SendEmailResult>;

  /** Notification: Weekly status email */
  sendWeeklyStatus: (
    to: EmailRecipient,
    data: WeeklyStatusData,
    opts?: SendOptions
  ) => Promise<SendEmailResult>;

  /** Notification: Immediate alert email */
  sendAlert: (
    to: EmailRecipient,
    data: AlertData,
    opts?: SendOptions
  ) => Promise<SendEmailResult>;

  /** Notification: Batched test failure email */
  sendTestFailure: (
    to: EmailRecipient,
    data: TestFailureData,
    opts?: SendOptions
  ) => Promise<SendEmailResult>;

  /** Invite: Organization invitation email */
  sendOrgInvite: (
    to: EmailRecipient,
    data: OrgInviteData,
    opts?: SendOptions
  ) => Promise<SendEmailResult>;

  /** Optional cleanup (no-op if not pooled) */
  close: () => void | Promise<void>;
}
