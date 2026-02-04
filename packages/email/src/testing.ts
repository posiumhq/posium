import type { Transporter } from "nodemailer";

export interface SentEmail {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  messageId: string;
}

export interface FakeTransport {
  /** The fake transport to pass to createEmailClient */
  transport: Transporter;
  /** Returns all emails that have been "sent" */
  getSentEmails: () => SentEmail[];
  /** Clears the sent emails list */
  clearSentEmails: () => void;
}

/**
 * Creates a fake nodemailer transport for testing.
 *
 * @example
 * ```ts
 * import { createEmailClient } from "@posium/email";
 * import { createFakeTransport } from "@posium/email/testing";
 *
 * const { transport, getSentEmails } = createFakeTransport();
 * const client = createEmailClient({ ...config, transport });
 *
 * await client.sendLoginVerification("user@example.com", {...});
 *
 * expect(getSentEmails()).toHaveLength(1);
 * expect(getSentEmails()[0].to).toBe("user@example.com");
 * ```
 */
export function createFakeTransport(): FakeTransport {
  const sentEmails: SentEmail[] = [];
  let messageCounter = 0;

  const transport = {
    sendMail: async (options: {
      from: string;
      to: string | string[];
      subject: string;
      html: string;
      text?: string;
      replyTo?: string;
      cc?: string | string[];
      bcc?: string | string[];
    }) => {
      const messageId = `<test-${++messageCounter}@fake.local>`;

      sentEmails.push({
        from: options.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        cc: options.cc,
        bcc: options.bcc,
        messageId,
      });

      return {
        messageId,
        accepted: Array.isArray(options.to) ? options.to : [options.to],
        rejected: [],
      };
    },
    close: () => {
      // no-op for fake transport
    },
  } as unknown as Transporter;

  return {
    transport,
    getSentEmails: () => [...sentEmails],
    clearSentEmails: () => {
      sentEmails.length = 0;
    },
  };
}
