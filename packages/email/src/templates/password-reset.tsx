import { Button, Heading, Section, Text } from "@react-email/components";
import { BaseLayout } from "./base-layout.js";
import type { PasswordResetData } from "../types.js";

export function PasswordResetEmail({
  userName,
  resetUrl,
  expiresInMinutes,
}: PasswordResetData) {
  return (
    <BaseLayout preview={`Reset your Posium password`}>
      <Section style={styles.content}>
        <Heading style={styles.heading}>Reset your password</Heading>
        <Text style={styles.text}>Hi {userName},</Text>
        <Text style={styles.text}>
          We received a request to reset your password. Click the button below
          to choose a new password.
        </Text>
        <Section style={styles.buttonContainer}>
          <Button style={styles.button} href={resetUrl}>
            Reset Password
          </Button>
        </Section>
        <Text style={styles.note}>
          This link will expire in {expiresInMinutes} minutes. If you didn't
          request a password reset, you can safely ignore this email.
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
export default function PasswordResetEmailPreview() {
  return (
    <PasswordResetEmail
      userName="John Doe"
      resetUrl="https://posium.dev/reset?token=xyz789"
      expiresInMinutes={30}
    />
  );
}
