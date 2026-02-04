#!/usr/bin/env npx tsx
/**
 * Manual E2E check script for email templates.
 *
 * This script sends real emails to verify templates render correctly in email clients.
 * Run with: pnpm manual:e2e:check
 *
 * Requires EMAIL_* environment variables to be set (see .env.example).
 */

import * as p from "@clack/prompts";
import { getEmailClient } from "../src/index.js";

const EMAIL_TYPES = {
  loginVerification: {
    label: "Login Verification",
    description: "Email verification for signup/login",
  },
  passwordReset: {
    label: "Password Reset",
    description: "Password reset request email",
  },
  orgInvite: {
    label: "Organization Invite",
    description: "Invitation to join an organization",
  },
  alert: {
    label: "Test Failure Alert",
    description: "Immediate notification of test failure",
  },
  dailyStatus: {
    label: "Daily Status",
    description: "Daily project health status",
  },
  weeklyStatus: {
    label: "Weekly Status",
    description: "Weekly project health status",
  },
} as const;

type EmailType = keyof typeof EMAIL_TYPES;

async function main() {
  p.intro("📧 Email Manual E2E Check");

  // Check for required environment variables
  const requiredEnvVars = [
    "EMAIL_SMTP_HOST",
    "EMAIL_SMTP_USER",
    "EMAIL_SMTP_PASS",
    "EMAIL_FROM_ADDRESS_DEFAULT",
  ];

  const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
  if (missingVars.length > 0) {
    p.log.error(`Missing required environment variables:\n  ${missingVars.join("\n  ")}`);
    p.log.info("Set these in your .env file or export them before running this script.");
    p.outro("Exiting.");
    process.exit(1);
  }

  // Select email types to send
  const selectedTypes = await p.multiselect({
    message: "Select email types to send (space to toggle, enter to confirm)",
    options: Object.entries(EMAIL_TYPES).map(([value, { label, description }]) => ({
      value: value as EmailType,
      label,
      hint: description,
    })),
    initialValues: ["loginVerification"] as EmailType[],
    required: true,
  });

  if (p.isCancel(selectedTypes)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  // Get destination email address
  const destinationEmail = await p.text({
    message: "Enter the email address to send to:",
    placeholder: "you@example.com",
    validate: (value) => {
      if (!value) return "Email address is required";
      if (!value.includes("@")) return "Please enter a valid email address";
      return undefined;
    },
  });

  if (p.isCancel(destinationEmail)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  // Confirm before sending
  const confirm = await p.confirm({
    message: `Send ${selectedTypes.length} email(s) to ${destinationEmail}?`,
  });

  if (p.isCancel(confirm) || !confirm) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  // Send emails
  const client = getEmailClient();
  const spinner = p.spinner();

  const results: { type: EmailType; success: boolean; error?: string }[] = [];

  for (const emailType of selectedTypes) {
    const { label } = EMAIL_TYPES[emailType];
    spinner.start(`Sending ${label}...`);

    try {
      await sendEmail(client, emailType, destinationEmail);
      spinner.stop(`${label} sent successfully`);
      results.push({ type: emailType, success: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.stop(`${label} failed: ${errorMessage}`);
      results.push({ type: emailType, success: false, error: errorMessage });
    }
  }

  // Show summary
  p.log.info("\n📊 Summary:");
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  for (const result of results) {
    const { label } = EMAIL_TYPES[result.type];
    if (result.success) {
      p.log.success(`  ✓ ${label}`);
    } else {
      p.log.error(`  ✗ ${label}: ${result.error}`);
    }
  }

  p.log.info(`\n  ${successful} succeeded, ${failed} failed`);

  client.close();

  p.outro(
    successful === results.length
      ? "All emails sent! Check your inbox."
      : "Some emails failed. Check the errors above."
  );
}

async function sendEmail(
  client: ReturnType<typeof getEmailClient>,
  type: EmailType,
  to: string
): Promise<void> {
  switch (type) {
    case "loginVerification":
      await client.sendLoginVerification(to, {
        userName: "Test User",
        verificationUrl: "https://posium.dev/verify?token=demo-token-12345",
        expiresInMinutes: 60,
      });
      break;

    case "passwordReset":
      await client.sendPasswordReset(to, {
        userName: "Test User",
        resetUrl: "https://posium.dev/reset?token=demo-reset-token",
        expiresInMinutes: 30,
      });
      break;

    case "orgInvite":
      await client.sendOrgInvite(to, {
        inviterName: "Alice Smith",
        orgName: "Acme Corporation",
        inviteUrl: "https://posium.dev/invite?code=demo-invite-code",
        expiresInDays: 7,
      });
      break;

    case "alert":
      await client.sendAlert(to, {
        userName: "Test User",
        orgName: "Acme Corporation",
        projectName: "Main Application",
        runId: "run_demo_12345",
        testName: "User login flow should redirect to dashboard",
        errorMessage: "AssertionError: Expected URL to be '/dashboard' but got '/login'\n  at LoginTest.spec.ts:45:12",
        runUrl: "https://posium.dev/runs/run_demo_12345",
      });
      break;

    case "dailyStatus":
      await client.sendDailyStatus(to, {
        userName: "Test User",
        generatedAt: new Date(),
        orgId: "org_demo",
        orgName: "Acme Corporation",
        orgSlug: "acme",
        seeMoreUrl: "https://app.posium.ai/orgs/acme",
        totalProjects: 5,
        projects: [
          {
            projectId: "prj_1",
            projectName: "Web Application",
            hasRuns: true,
            totalTests: 150,
            failingTests: 3,
            passingTests: 147,
            healthPercent: 98,
            lastRunAt: new Date().toISOString(),
          },
          {
            projectId: "prj_2",
            projectName: "Mobile API",
            hasRuns: true,
            totalTests: 80,
            failingTests: 12,
            passingTests: 68,
            healthPercent: 85,
            lastRunAt: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            projectId: "prj_3",
            projectName: "Dashboard",
            hasRuns: true,
            totalTests: 45,
            failingTests: 20,
            passingTests: 25,
            healthPercent: 56,
            lastRunAt: new Date(Date.now() - 7200000).toISOString(),
          },
          {
            projectId: "prj_4",
            projectName: "New Project",
            hasRuns: false,
          },
        ],
      });
      break;

    case "weeklyStatus":
      await client.sendWeeklyStatus(to, {
        userName: "Test User",
        generatedAt: new Date(),
        orgId: "org_demo",
        orgName: "Acme Corporation",
        orgSlug: "acme",
        seeMoreUrl: "https://app.posium.ai/orgs/acme",
        totalProjects: 5,
        projects: [
          {
            projectId: "prj_1",
            projectName: "Web Application",
            hasRuns: true,
            totalTests: 150,
            failingTests: 3,
            passingTests: 147,
            healthPercent: 98,
            lastRunAt: new Date().toISOString(),
          },
          {
            projectId: "prj_2",
            projectName: "Mobile API",
            hasRuns: true,
            totalTests: 80,
            failingTests: 12,
            passingTests: 68,
            healthPercent: 85,
            lastRunAt: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            projectId: "prj_3",
            projectName: "Dashboard",
            hasRuns: true,
            totalTests: 45,
            failingTests: 20,
            passingTests: 25,
            healthPercent: 56,
            lastRunAt: new Date(Date.now() - 7200000).toISOString(),
          },
          {
            projectId: "prj_4",
            projectName: "New Project",
            hasRuns: false,
          },
        ],
      });
      break;
  }
}

main().catch((error) => {
  p.log.error(`Unexpected error: ${error.message}`);
  process.exit(1);
});
