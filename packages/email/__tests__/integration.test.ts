import { describe, it, expect } from "vitest";
import nodemailer from "nodemailer";
import { createEmailClient } from "../src/client.js";

/**
 * Integration test using ethereal.email.
 *
 * These tests actually send emails through a test SMTP server.
 * Run with: pnpm test -- --run integration.test.ts
 */
describe("Email Integration", { timeout: 30000 }, () => {
  it("sends email via ethereal.email SMTP", async () => {
    // Create test account on ethereal.email
    const testAccount = await nodemailer.createTestAccount();

    const client = createEmailClient({
      smtp: {
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        user: testAccount.user,
        pass: testAccount.pass,
      },
      from: {
        default: "test@posium.dev",
        name: "Posium Test",
      },
    });

    const result = await client.sendLoginVerification(testAccount.user, {
      userName: "Test User",
      verificationUrl: "https://example.com/verify?token=test",
      expiresInMinutes: 60,
    });

    expect(result.messageId).toBeDefined();
    expect(result.accepted).toContain(testAccount.user);
    expect(result.rejected).toHaveLength(0);

    // Log preview URL for manual inspection
    console.log("Preview URL:", nodemailer.getTestMessageUrl(result as any));

    client.close();
  });

  it("sends multiple email types successfully", async () => {
    const testAccount = await nodemailer.createTestAccount();

    const client = createEmailClient({
      smtp: {
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        user: testAccount.user,
        pass: testAccount.pass,
      },
      from: {
        default: "test@posium.dev",
      },
    });

    // Send password reset
    const resetResult = await client.sendPasswordReset(testAccount.user, {
      userName: "Test User",
      resetUrl: "https://example.com/reset",
      expiresInMinutes: 30,
    });
    expect(resetResult.messageId).toBeDefined();

    // Send org invite
    const inviteResult = await client.sendOrgInvite(testAccount.user, {
      inviterName: "Alice",
      orgName: "Test Org",
      inviteUrl: "https://example.com/invite",
      expiresInDays: 7,
    });
    expect(inviteResult.messageId).toBeDefined();

    // Send alert
    const alertResult = await client.sendAlert(testAccount.user, {
      userName: "Test User",
      orgName: "Test Org",
      projectName: "Main Project",
      runId: "run_123",
      testName: "Login test",
      errorMessage: "Expected success but got failure",
      runUrl: "https://example.com/runs/run_123",
    });
    expect(alertResult.messageId).toBeDefined();

    client.close();
  });
});
