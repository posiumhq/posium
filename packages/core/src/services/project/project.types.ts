/**
 * Type definitions for ProjectService.
 */

/**
 * Project run statistics.
 */
export interface ProjectStats {
  totalTests: number;
  passing: number;
  failing: number;
  flaky: number;
  runs24h: number;
}

/**
 * Basic project info.
 */
export interface Project {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  logo: string | null;
  url: string | null;
}

/**
 * Project with stats for listings.
 */
export interface ProjectWithStats extends Project {
  stats: ProjectStats;
}

/**
 * Options for listing projects.
 */
export interface ListProjectsOptions {
  orgId: string;
}

/**
 * Input for creating a project.
 */
export interface CreateProjectInput {
  orgId: string;
  name: string;
  description?: string;
  url?: string;
  logo?: string;
  /** Target URL for the default environment created with the project (required) */
  targetUrl: string;
}

/**
 * Input for updating a project.
 */
export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  url?: string | null;
  logo?: string | null;
}

/**
 * Project health data based on latest run.
 * Used for notifications and project health indicators.
 */
export interface ProjectHealth {
  /** Whether this project has any completed runs */
  hasRuns: boolean;
  /** Total unique tests in the latest run */
  totalTests: number;
  /** Number of failing tests */
  failingTests: number;
  /** Number of passing tests (passed on first attempt) */
  passingTests: number;
}

/**
 * Project summary with last run info.
 * Used for notification digests and org-level views.
 */
export interface ProjectSummary {
  projectId: string;
  projectName: string;
  lastRunAt: Date | null;
}

/**
 * Project summary with health data.
 */
export interface ProjectWithHealth extends ProjectSummary {
  health: ProjectHealth;
}
