import { Button, Heading, Section, Text } from "@react-email/components";
import { BaseLayout } from "./base-layout.js";
import type { AlertData } from "../types.js";

export function AlertEmail({
  userName,
  orgName,
  projectName,
  runId,
  testName,
  errorMessage,
  runUrl,
}: AlertData) {
  return (
    <BaseLayout preview={`Test failed: ${testName} in ${projectName}`}>
      <Section style={styles.content}>
        <Section style={styles.alertBanner}>
          <Text style={styles.alertText}>Test Failure Alert</Text>
        </Section>
        <Heading style={styles.heading}>{testName}</Heading>
        <Text style={styles.text}>Hi {userName},</Text>
        <Text style={styles.text}>
          A test has failed in <strong>{projectName}</strong> ({orgName}).
        </Text>
        <Section style={styles.errorBox}>
          <Text style={styles.errorLabel}>Error Message</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
        </Section>
        <Text style={styles.detail}>
          <strong>Run ID:</strong> {runId}
        </Text>
        <Section style={styles.buttonContainer}>
          <Button style={styles.button} href={runUrl}>
            View Run Details
          </Button>
        </Section>
      </Section>
    </BaseLayout>
  );
}

const styles = {
  content: {
    padding: "0 48px",
  },
  alertBanner: {
    backgroundColor: "#fef2f2",
    borderRadius: "6px",
    padding: "8px 16px",
    marginBottom: "16px",
  },
  alertText: {
    color: "#dc2626",
    fontSize: "14px",
    fontWeight: "600",
    margin: "0",
  },
  heading: {
    color: "#1f2937",
    fontSize: "20px",
    fontWeight: "600",
    lineHeight: "28px",
    margin: "16px 0",
  },
  text: {
    color: "#374151",
    fontSize: "16px",
    lineHeight: "24px",
    margin: "16px 0",
  },
  errorBox: {
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
    padding: "16px",
    margin: "16px 0",
    border: "1px solid #e5e7eb",
  },
  errorLabel: {
    color: "#6b7280",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "uppercase" as const,
    margin: "0 0 8px 0",
  },
  errorMessage: {
    color: "#dc2626",
    fontSize: "14px",
    fontFamily: "monospace",
    margin: "0",
    whiteSpace: "pre-wrap" as const,
  },
  detail: {
    color: "#6b7280",
    fontSize: "14px",
    margin: "8px 0",
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
} as const;

// Default export for react-email dev preview
export default function AlertEmailPreview() {
  return (
    <AlertEmail
      userName="John Doe"
      orgName="Acme Corp"
      projectName="Main App"
      runId="run_abc123"
      testName="Login should redirect to dashboard"
      errorMessage="Expected URL to be '/dashboard' but got '/login'"
      runUrl="https://posium.dev/runs/run_abc123"
    />
  );
}
