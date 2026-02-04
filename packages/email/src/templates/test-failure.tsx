import { Button, Heading, Section, Text, Link, Hr } from "@react-email/components";
import { BaseLayout } from "./base-layout.js";
import type { TestFailureData, FailedTestSummary } from "../types.js";

export function TestFailureEmail({
  userName,
  generatedAt,
  orgName,
  failedTests,
  stats,
  seeMoreUrl,
}: TestFailureData) {
  const dateStr = generatedAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const summaryText =
    stats.totalFailed === 1
      ? "1 test failed"
      : `${stats.totalFailed} tests failed`;

  const runsText =
    stats.totalRuns === 1 ? "in 1 run" : `across ${stats.totalRuns} runs`;

  return (
    <BaseLayout preview={`${summaryText} in ${orgName}`}>
      <Section style={styles.content}>
        <Section style={styles.alertBanner}>
          <Text style={styles.alertText}>Test Failure Alert</Text>
        </Section>
        <Heading style={styles.heading}>
          {summaryText} {runsText}
        </Heading>
        <Text style={styles.text}>Hi {userName},</Text>
        <Text style={styles.text}>
          Tests have failed in <strong>{orgName}</strong>. Here are the most
          recent failures:
        </Text>

        {failedTests.map((test, index) => (
          <FailedTestRow key={index} test={test} />
        ))}

        {stats.totalFailed > failedTests.length && (
          <Text style={styles.moreText}>
            ... and {stats.totalFailed - failedTests.length} more failed tests
          </Text>
        )}

        <Section style={styles.buttonContainer}>
          <Button style={styles.button} href={seeMoreUrl}>
            View All Results
          </Button>
        </Section>

        <Hr style={styles.divider} />
        <Text style={styles.footer}>
          Generated at {dateStr}
          {stats.batchWindowMinutes > 0 && (
            <> (last {stats.batchWindowMinutes} min)</>
          )}
        </Text>
      </Section>
    </BaseLayout>
  );
}

function FailedTestRow({ test }: { test: FailedTestSummary }) {
  return (
    <Section style={styles.testRow}>
      <Text style={styles.testName}>
        <Link href={test.testUrl} style={styles.testLink}>
          {test.testName}
        </Link>
      </Text>
      <Text style={styles.projectName}>
        in <strong>{test.projectName}</strong>
      </Text>
    </Section>
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
  testRow: {
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
    padding: "12px 16px",
    margin: "8px 0",
    border: "1px solid #e5e7eb",
  },
  testName: {
    color: "#1f2937",
    fontSize: "14px",
    fontWeight: "500",
    margin: "0 0 4px 0",
  },
  testLink: {
    color: "#2563eb",
    textDecoration: "none",
  },
  projectName: {
    color: "#6b7280",
    fontSize: "12px",
    margin: "0",
  },
  moreText: {
    color: "#6b7280",
    fontSize: "14px",
    fontStyle: "italic",
    margin: "12px 0",
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
  divider: {
    borderColor: "#e5e7eb",
    margin: "24px 0",
  },
  footer: {
    color: "#9ca3af",
    fontSize: "12px",
    margin: "0",
    textAlign: "center" as const,
  },
} as const;

// Default export for react-email dev preview
export default function TestFailureEmailPreview() {
  return (
    <TestFailureEmail
      userName="John Doe"
      generatedAt={new Date()}
      orgName="Acme Corp"
      orgSlug="acme-corp"
      failedTests={[
        {
          testName: "Login should redirect to dashboard",
          projectName: "Main App",
          runUrl: "https://app.posium.ai/orgs/acme/projects/prj_1/runs/run_1",
          testUrl: "https://app.posium.ai/orgs/acme/projects/prj_1/runs/run_1/tests/test_1",
          failedAt: new Date(),
        },
        {
          testName: "User can update profile settings",
          projectName: "Main App",
          runUrl: "https://app.posium.ai/orgs/acme/projects/prj_1/runs/run_1",
          testUrl: "https://app.posium.ai/orgs/acme/projects/prj_1/runs/run_1/tests/test_2",
          failedAt: new Date(),
        },
        {
          testName: "Cart checkout flow completes successfully",
          projectName: "E-commerce",
          runUrl: "https://app.posium.ai/orgs/acme/projects/prj_2/runs/run_2",
          testUrl: "https://app.posium.ai/orgs/acme/projects/prj_2/runs/run_2/tests/test_3",
          failedAt: new Date(),
        },
      ]}
      stats={{
        totalFailed: 8,
        totalRuns: 3,
        batchWindowMinutes: 1,
      }}
      seeMoreUrl="https://app.posium.ai/orgs/acme"
    />
  );
}
