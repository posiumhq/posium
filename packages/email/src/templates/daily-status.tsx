import { Heading, Link, Section, Text } from "@react-email/components";
import { BaseLayout } from "./base-layout.js";
import type { DailyStatusData } from "../types.js";

export function DailyStatusEmail({
  userName,
  generatedAt,
  orgName,
  projects,
  totalProjects,
  seeMoreUrl,
}: DailyStatusData) {
  const formattedDate = generatedAt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <BaseLayout preview={`Daily Status - ${orgName} - ${formattedDate}`}>
      <Section style={styles.content}>
        <Heading style={styles.heading}>Daily Status</Heading>
        <Text style={styles.date}>{formattedDate}</Text>

        <Text style={styles.text}>Hi {userName},</Text>
        <Text style={styles.text}>
          Here&apos;s the current health of your projects in <strong>{orgName}</strong>:
        </Text>

        {projects.length === 0 ? (
          <Text style={styles.emptyState}>
            No projects to display. Add some projects to get started!
          </Text>
        ) : (
          <Section style={styles.projectsTable}>
            <Section style={styles.tableHeader}>
              <Text style={styles.headerProject}>Project</Text>
              <Text style={styles.headerStats}>Tests</Text>
              <Text style={styles.headerHealth}>Health</Text>
            </Section>
            {projects.map((project) => (
              <Section key={project.projectId} style={styles.projectRow}>
                <Text style={styles.projectName}>{project.projectName}</Text>
                {project.hasRuns ? (
                  <>
                    <Text style={styles.projectStats}>
                      <span style={{ color: "#dc2626" }}>{project.failingTests}</span>
                      {" / "}
                      {project.totalTests}
                    </Text>
                    <Text
                      style={{
                        ...styles.projectHealth,
                        color: getHealthColor(project.healthPercent!),
                      }}
                    >
                      {project.healthPercent}%
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.projectStats}>—</Text>
                    <Text style={styles.noRuns}>No runs</Text>
                  </>
                )}
              </Section>
            ))}
          </Section>
        )}

        {totalProjects > projects.length && (
          <Text style={styles.moreProjects}>
            +{totalProjects - projects.length} more projects
          </Text>
        )}

        <Link href={seeMoreUrl} style={styles.seeMoreLink}>
          See all projects →
        </Link>
      </Section>
    </BaseLayout>
  );
}

function getHealthColor(healthPercent: number): string {
  if (healthPercent >= 90) return "#16a34a"; // Green
  if (healthPercent >= 70) return "#f59e0b"; // Amber
  return "#dc2626"; // Red
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
    margin: "0 0 8px 0",
  },
  date: {
    color: "#6b7280",
    fontSize: "14px",
    margin: "0 0 24px 0",
  },
  text: {
    color: "#374151",
    fontSize: "16px",
    lineHeight: "24px",
    margin: "16px 0",
  },
  emptyState: {
    color: "#6b7280",
    fontSize: "14px",
    fontStyle: "italic" as const,
    textAlign: "center" as const,
    margin: "32px 0",
  },
  projectsTable: {
    borderRadius: "6px",
    border: "1px solid #e5e7eb",
    overflow: "hidden",
    margin: "16px 0",
  },
  tableHeader: {
    backgroundColor: "#f9fafb",
    padding: "12px 16px",
    borderBottom: "1px solid #e5e7eb",
  },
  headerProject: {
    display: "inline-block",
    width: "50%",
    color: "#6b7280",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "uppercase" as const,
    margin: "0",
  },
  headerStats: {
    display: "inline-block",
    width: "25%",
    color: "#6b7280",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "uppercase" as const,
    textAlign: "center" as const,
    margin: "0",
  },
  headerHealth: {
    display: "inline-block",
    width: "25%",
    color: "#6b7280",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "uppercase" as const,
    textAlign: "right" as const,
    margin: "0",
  },
  projectRow: {
    padding: "12px 16px",
    borderBottom: "1px solid #e5e7eb",
  },
  projectName: {
    display: "inline-block",
    width: "50%",
    color: "#1f2937",
    fontSize: "14px",
    fontWeight: "500",
    margin: "0",
  },
  projectStats: {
    display: "inline-block",
    width: "25%",
    color: "#374151",
    fontSize: "14px",
    textAlign: "center" as const,
    margin: "0",
  },
  projectHealth: {
    display: "inline-block",
    width: "25%",
    fontSize: "14px",
    fontWeight: "600",
    textAlign: "right" as const,
    margin: "0",
  },
  noRuns: {
    display: "inline-block",
    width: "25%",
    fontSize: "14px",
    color: "#9ca3af",
    fontStyle: "italic" as const,
    textAlign: "right" as const,
    margin: "0",
  },
  moreProjects: {
    color: "#6b7280",
    fontSize: "12px",
    margin: "8px 0 0 0",
  },
  seeMoreLink: {
    color: "#4f46e5",
    fontSize: "14px",
    fontWeight: "500",
    textDecoration: "none",
    display: "inline-block",
    marginTop: "12px",
  },
} as const;

// Default export for react-email dev preview
export default function DailyStatusEmailPreview() {
  return (
    <DailyStatusEmail
      userName="John Doe"
      generatedAt={new Date("2024-01-15T09:00:00")}
      orgId="org_1"
      orgName="Acme Corporation"
      orgSlug="acme"
      seeMoreUrl="https://app.posium.ai/orgs/acme"
      totalProjects={12}
      projects={[
        {
          projectId: "prj_1",
          projectName: "Web Application",
          hasRuns: true,
          totalTests: 150,
          failingTests: 3,
          passingTests: 147,
          healthPercent: 98,
          lastRunAt: "2024-01-15T08:00:00Z",
        },
        {
          projectId: "prj_2",
          projectName: "Mobile API",
          hasRuns: true,
          totalTests: 80,
          failingTests: 12,
          passingTests: 68,
          healthPercent: 85,
          lastRunAt: "2024-01-15T07:30:00Z",
        },
        {
          projectId: "prj_3",
          projectName: "Dashboard",
          hasRuns: true,
          totalTests: 45,
          failingTests: 20,
          passingTests: 25,
          healthPercent: 56,
          lastRunAt: "2024-01-15T06:00:00Z",
        },
        {
          projectId: "prj_4",
          projectName: "New Project",
          hasRuns: false,
        },
      ]}
    />
  );
}
