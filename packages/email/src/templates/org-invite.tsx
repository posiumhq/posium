import { Button, Heading, Section, Text } from "@react-email/components";
import { BaseLayout } from "./base-layout.js";
import type { OrgInviteData } from "../types.js";

export function OrgInviteEmail({
  inviterName,
  orgName,
  inviteUrl,
  expiresInDays,
}: OrgInviteData) {
  return (
    <BaseLayout preview={`${inviterName} invited you to join ${orgName}`}>
      <Section style={styles.content}>
        <Heading style={styles.heading}>You're invited!</Heading>
        <Text style={styles.text}>
          <strong>{inviterName}</strong> has invited you to join{" "}
          <strong>{orgName}</strong> on Posium.
        </Text>
        <Text style={styles.text}>
          Click the button below to accept the invitation and get started.
        </Text>
        <Section style={styles.buttonContainer}>
          <Button style={styles.button} href={inviteUrl}>
            Accept Invitation
          </Button>
        </Section>
        <Text style={styles.note}>
          This invitation will expire in {expiresInDays}{" "}
          {expiresInDays === 1 ? "day" : "days"}. If you don't want to join,
          you can safely ignore this email.
        </Text>
      </Section>
    </BaseLayout>
  );
}

const styles = {
  content: {
    padding: "0 48px",
  },
  heading: {
    color: "#1f2937",
    fontSize: "24px",
    fontWeight: "600",
    lineHeight: "32px",
    margin: "16px 0",
  },
  text: {
    color: "#374151",
    fontSize: "16px",
    lineHeight: "24px",
    margin: "16px 0",
  },
  buttonContainer: {
    textAlign: "center" as const,
    margin: "32px 0",
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: "6px",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "600",
    padding: "12px 24px",
    textDecoration: "none",
    textAlign: "center" as const,
    display: "inline-block",
  },
  note: {
    color: "#6b7280",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "16px 0",
  },
} as const;

// Default export for react-email dev preview
export default function OrgInviteEmailPreview() {
  return (
    <OrgInviteEmail
      inviterName="Alice Smith"
      orgName="Acme Corp"
      inviteUrl="https://posium.dev/invite?code=abc123"
      expiresInDays={7}
    />
  );
}
