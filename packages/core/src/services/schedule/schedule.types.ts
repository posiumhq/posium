/**
 * Type definitions for ScheduleService.
 */

import type {
  PaginationOptions,
  SortingOptions,
  DateRangeFilter,
  PaginationMeta,
} from "../../pagination/index.js";

/**
 * Schedule status.
 */
export type ScheduleStatus = "enabled" | "disabled";

/**
 * Sortable columns for schedules.
 */
export type ScheduleSortColumn =
  | "name"
  | "status"
  | "lastRunAt"
  | "nextRunAt"
  | "createdAt";

/**
 * Filter options for schedule listings.
 */
export interface ScheduleFilters {
  /** Filter by status (enabled, disabled) */
  status?: ScheduleStatus[];
  /** Filter by name (partial match, case-insensitive) */
  name?: string;
  /** Filter by last run date range */
  lastRun?: DateRangeFilter;
}

/**
 * Schedule metadata.
 */
export interface ScheduleMetadata {
  [key: string]: unknown;
}

/**
 * Basic schedule info.
 */
export interface Schedule {
  id: string;
  projectId: string;
  planId: string;
  environmentId: string | null;
  name: string;
  cron: string;
  timezone: string;
  status: ScheduleStatus;
  lastRunId: string | null;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

/**
 * Schedule with enriched details for listings.
 */
export interface ScheduleWithDetails extends Schedule {
  planName: string;
  tests: Array<{ id: string; name: string }>;
  suites: Array<{ id: string; name: string }>;
  lastRunStatus: string | null;
}

/**
 * Plan summary for schedule listings.
 */
export interface PlanSummary {
  id: string;
  name: string;
}

/**
 * Options for listing schedules.
 */
export interface ListSchedulesOptions
  extends PaginationOptions,
    SortingOptions<ScheduleSortColumn> {
  projectId: string;
  filters?: ScheduleFilters;
}

/**
 * Result of listing schedules.
 */
export interface ListSchedulesResult {
  schedules: ScheduleWithDetails[];
  plans: PlanSummary[];
  pagination: PaginationMeta;
}

/**
 * Input for creating a schedule.
 */
export interface CreateScheduleInput {
  projectId: string;
  planId: string;
  environmentId?: string;
  name: string;
  cron: string;
  timezone: string;
  metadata?: ScheduleMetadata;
}

/**
 * Input for updating a schedule.
 */
export interface UpdateScheduleInput {
  name?: string;
  cron?: string;
  timezone?: string;
  environmentId?: string | null;
  metadata?: ScheduleMetadata;
}
