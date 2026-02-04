import { describe, it, expect, beforeEach } from "vitest";
import { createEmailClient } from "../src/client.js";
import { createFakeTransport } from "../src/testing.js";
import type { EmailClientOptions } from "../src/types.js";

describe("createEmailClient", () => {
  let fakeTransport: ReturnType<typeof createFakeTransport>;
  let config: EmailClientOptions;

  beforeEach(() => {
    fakeTransport = createFakeTransport();
    config = {
      smtp: {
        host: "smtp.test.local",
        port: 587,
        user: "testuser",
        pass: "testpass",
      },
      from: {
        default: "noreply@test.local",
        auth: "auth@test.local",
        notifications: "notifications@test.local",
        invites: "invites@test.local",
        name: "Test App",
      },
      transport: fakeTransport.transport,
    };
  });

  describe("sendLoginVerification", () => {
    it("sends email with correct subject and recipient", async () => {
      const client = createEmailClient(config);

      await client.sendLoginVerification("user@example.com", {
        userName: "John",
        verificationUrl: "https://example.com/verify?token=abc123",
        expiresInMinutes: 60,
      });

      const sent = fakeTransport.getSentEmails();
      expect(sent).toHaveLength(1);
      expect(sent[0]?.to).toBe("user@example.com");
      expect(sent[0]?.subject).toBe("Verify your email");
      expect(sent[0]?.from).toBe('"Test App" <auth@test.local>');
    });

    it("renders template with user data", async () => {
      const client = createEmailClient(config);

      await client.sendLoginVerification("user@example.com", {
        userName: "John",
        verificationUrl: "https://example.com/verify?token=abc123",
        expiresInMinutes: 60,
      });

      const sent = fakeTransport.getSentEmails();
      expect(sent[0]?.html).toContain("John");
      expect(sent[0]?.html).toContain("https://example.com/verify?token=abc123");
      // React may inject HTML comments around interpolated values
      expect(sent[0]?.html).toContain("60");
      expect(sent[0]?.html).toContain("minutes");
    });

    it("allows overriding from address", async () => {
      const client = createEmailClient(config);

      await client.sendLoginVerification(
        "user@example.com",
        {
          userName: "John",
          verificationUrl: "https://example.com/verify",
          expiresInMinutes: 60,
        },
        { from: "custom@test.local" }
      );

      const sent = fakeTransport.getSentEmails();
      expect(sent[0]?.from).toBe("custom@test.local");
    });
  });

  describe("sendPasswordReset", () => {
    it("sends email with correct subject", async () => {
      const client = createEmailClient(config);

      await client.sendPasswordReset("user@example.com", {
        userName: "Jane",
        resetUrl: "https://example.com/reset?token=xyz",
        expiresInMinutes: 30,
      });

      const sent = fakeTransport.getSentEmails();
      expect(sent).toHaveLength(1);
      expect(sent[0]?.subject).toBe("Reset your password");
      expect(sent[0]?.from).toBe('"Test App" <auth@test.local>');
    });
  });

  describe("sendDailyStatus", () => {
    it("sends email with date in subject", async () => {
      const client = createEmailClient(config);
      const testDate = new Date("2024-01-15");

      await client.sendDailyStatus("user@example.com", {
        userName: "John",
        generatedAt: testDate,
        orgId: "org_1",
        orgName: "Acme Corp",
        orgSlug: "acme",
        seeMoreUrl: "https://app.posium.ai/orgs/acme",
        totalProjects: 1,
        projects: [
          {
            projectId: "prj_1",
            projectName: "Web App",
            hasRuns: true,
            totalTests: 100,
            failingTests: 5,
            passingTests: 95,
            healthPercent: 95,
          },
        ],
      });

      const sent = fakeTransport.getSentEmails();
      expect(sent).toHaveLength(1);
      expect(sent[0]?.subject).toContain("Daily Status");
      expect(sent[0]?.from).toBe('"Test App" <notifications@test.local>');
    });
  });

  describe("sendWeeklyStatus", () => {
    it("sends email with date in subject", async () => {
      const client = createEmailClient(config);

      await client.sendWeeklyStatus("user@example.com", {
        userName: "John",
        generatedAt: new Date("2024-01-15"),
        orgId: "org_1",
        orgName: "Acme Corp",
        orgSlug: "acme",
        seeMoreUrl: "https://app.posium.ai/orgs/acme",
        totalProjects: 1,
        projects: [
          {
            projectId: "prj_1",
            projectName: "Web App",
            hasRuns: true,
            totalTests: 100,
            failingTests: 5,
            passingTests: 95,
            healthPercent: 95,
          },
        ],
      });

      const sent = fakeTransport.getSentEmails();
      expect(sent).toHaveLength(1);
      expect(sent[0]?.subject).toContain("Weekly Status");
    });
  });

  describe("sendAlert", () => {
    it("sends email with test name in subject", async () => {
      const client = createEmailClient(config);

      await client.sendAlert("user@example.com", {
        userName: "John",
        orgName: "Acme Corp",
        projectName: "Main App",
        runId: "run_123",
        testName: "Login should work",
        errorMessage: "Expected true but got false",
        runUrl: "https://example.com/runs/run_123",
      });

      const sent = fakeTransport.getSentEmails();
      expect(sent).toHaveLength(1);
      expect(sent[0]?.subject).toBe("[Alert] Test failed: Login should work");
      expect(sent[0]?.from).toBe('"Test App" <notifications@test.local>');
    });
  });

  describe("sendOrgInvite", () => {
    it("sends email with inviter and org name in subject", async () => {
      const client = createEmailClient(config);

      await client.sendOrgInvite("newuser@example.com", {
        inviterName: "Alice",
        orgName: "Acme Corp",
        inviteUrl: "https://example.com/invite?code=xyz",
        expiresInDays: 7,
      });

      const sent = fakeTransport.getSentEmails();
      expect(sent).toHaveLength(1);
      expect(sent[0]?.subject).toBe("Alice invited you to join Acme Corp");
      expect(sent[0]?.from).toBe('"Test App" <invites@test.local>');
    });
  });

  describe("sendEmail (low-level)", () => {
    it("sends raw html email", async () => {
      const client = createEmailClient(config);

      await client.sendEmail({
        to: "user@example.com",
        subject: "Custom email",
        html: "<p>Hello world</p>",
      });

      const sent = fakeTransport.getSentEmails();
      expect(sent).toHaveLength(1);
      expect(sent[0]?.html).toBe("<p>Hello world</p>");
      expect(sent[0]?.from).toBe('"Test App" <noreply@test.local>');
    });

    it("supports multiple recipients", async () => {
      const client = createEmailClient(config);

      await client.sendEmail({
        to: ["user1@example.com", "user2@example.com"],
        subject: "Broadcast",
        html: "<p>Message</p>",
      });

      const sent = fakeTransport.getSentEmails();
      expect(sent[0]?.to).toEqual(["user1@example.com", "user2@example.com"]);
    });

    it("supports cc and bcc", async () => {
      const client = createEmailClient(config);

      await client.sendEmail({
        to: "user@example.com",
        subject: "With cc/bcc",
        html: "<p>Message</p>",
        cc: "cc@example.com",
        bcc: ["bcc1@example.com", "bcc2@example.com"],
      });

      const sent = fakeTransport.getSentEmails();
      expect(sent[0]?.cc).toBe("cc@example.com");
      expect(sent[0]?.bcc).toEqual(["bcc1@example.com", "bcc2@example.com"]);
    });
  });

  describe("from address fallback", () => {
    it("uses default from address when specific type not configured", async () => {
      const minimalConfig: EmailClientOptions = {
        smtp: config.smtp,
        from: {
          default: "default@test.local",
          // No auth/notifications/invites configured
        },
        transport: fakeTransport.transport,
      };

      const client = createEmailClient(minimalConfig);

      await client.sendLoginVerification("user@example.com", {
        userName: "John",
        verificationUrl: "https://example.com/verify",
        expiresInMinutes: 60,
      });

      const sent = fakeTransport.getSentEmails();
      expect(sent[0]?.from).toBe('"Posium" <default@test.local>');
    });
  });
});
