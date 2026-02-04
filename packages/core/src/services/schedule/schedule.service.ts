/**
 * ScheduleService - Schedule management business logic.
 *
 * Handles CRUD operations for test schedules within projects.
 */

import { eq, and, isNull, desc, asc, inArray, ilike, sql, gte, lte } from "drizzle-orm";
import { schema } from "@posium/db";
import { EVENTS, publish } from "@posium/appevents";
import type { ServiceContext } from "../../context.js";
import { requireActorUserId } from "../../context.js";
import { NotFoundError } from "../../errors.js";
import { requireOrgMembership } from "../../auth/membership.js";
import {
  normalizePagination,
  buildPaginationMeta,
} from "../../pagination/index.js";
import type {
  Schedule,
  ScheduleWithDetails,
  ScheduleFilters,
  ScheduleSortColumn,
  ListSchedulesOptions,
  ListSchedulesResult,
  CreateScheduleInput,
  UpdateScheduleInput,
} from "./schedule.types.js";

/**
 * Build SQL filter conditions for schedule queries.
 */
function buildScheduleFilterConditions(
  filters: ScheduleFilters | undefined,
  projectId: string
) {
  const conditions = [
    eq(schema.schedule.projectId, projectId),
    isNull(schema.schedule.deletedAt),
  ];

  if (!filters) return conditions;

  // Name filter (case-insensitive partial match)
  if (filters.name) {
    conditions.push(ilike(schema.schedule.name, `%${filters.name}%`));
  }

  // Status filter
  if (filters.status && filters.status.length > 0) {
    conditions.push(inArray(schema.schedule.status, filters.status));
  }

  // Last run date range filter
  if (filters.lastRun) {
    if (filters.lastRun.from) {
      conditions.push(gte(schema.schedule.lastRunAt, filters.lastRun.from));
    }
    if (filters.lastRun.to) {
      conditions.push(lte(schema.schedule.lastRunAt, filters.lastRun.to));
    }
  }

  return conditions;
}

/**
 * Build ORDER BY clause for schedule queries.
 */
function buildScheduleOrderBy(
  sortBy: ScheduleSortColumn | undefined,
  sortOrder: "asc" | "desc" | undefined
) {
  const direction = sortOrder === "asc" ? asc : desc;

  switch (sortBy) {
    case "name":
      return direction(schema.schedule.name);
    case "status":
      return direction(schema.schedule.status);
    case "lastRunAt":
      return direction(schema.schedule.lastRunAt);
    case "nextRunAt":
      return direction(schema.schedule.nextRunAt);
    case "createdAt":
      return direction(schema.schedule.createdAt);
    default:
      return desc(schema.schedule.createdAt);
  }
}

/**
 * ScheduleService interface.
 */
export interface ScheduleService {
  /** List all schedules in a project with details */
  list(ctx: ServiceContext, options: ListSchedulesOptions): Promise<ListSchedulesResult>;

  /** Get a single schedule by ID */
  getById(ctx: ServiceContext, id: string): Promise<Schedule>;

  /** Create a new schedule */
  create(ctx: ServiceContext, input: CreateScheduleInput): Promise<Schedule>;

  /** Update a schedule */
  update(ctx: ServiceContext, id: string, input: UpdateScheduleInput): Promise<Schedule>;

  /** Enable a schedule */
  enable(ctx: ServiceContext, id: string): Promise<Schedule>;

  /** Disable a schedule */
  disable(ctx: ServiceContext, id: string): Promise<Schedule>;

  /** Soft delete a schedule */
  delete(ctx: ServiceContext, id: string): Promise<void>;
}

/**
 * Get project and verify org membership.
 */
async function getProjectForSchedule(
  ctx: ServiceContext,
  projectId: string
): Promise<{ id: string; orgId: string }> {
  const [project] = await ctx.db
    .select({ id: schema.project.id, orgId: schema.project.orgId })
    .from(schema.project)
    .where(and(eq(schema.project.id, projectId), isNull(schema.project.deletedAt)))
    .limit(1);

  if (!project) {
    throw new NotFoundError("Project", projectId);
  }

  await requireOrgMembership(ctx, project.orgId);
  return project;
}

/**
 * Get schedule and verify org membership.
 */
async function getScheduleWithAuth(
  ctx: ServiceContext,
  scheduleId: string
): Promise<{ schedule: typeof schema.schedule.$inferSelect; project: { id: string; orgId: string } }> {
  const [schedule] = await ctx.db
    .select()
    .from(schema.schedule)
    .where(and(eq(schema.schedule.id, scheduleId), isNull(schema.schedule.deletedAt)))
    .limit(1);

  if (!schedule) {
    throw new NotFoundError("Schedule", scheduleId);
  }

  const project = await getProjectForSchedule(ctx, schedule.projectId);
  return { schedule, project };
}

/**
 * Creates a ScheduleService instance.
 */
export function createScheduleService(): ScheduleService {
  return {
    async list(ctx, options) {
      const { projectId, page, perPage, sortBy, sortOrder, filters } = options;

      // Verify project exists and user has access
      await getProjectForSchedule(ctx, projectId);

      // Build filter conditions
      const conditions = buildScheduleFilterConditions(filters, projectId);

      // Count total matching records
      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.schedule)
        .where(and(...conditions));

      const total = countResult?.count ?? 0;

      // Normalize pagination
      const { offset, limit, page: normalizedPage, perPage: normalizedPerPage } = normalizePagination({
        page,
        perPage,
      });

      // Early return if no schedules
      if (total === 0) {
        return {
          schedules: [],
          plans: [],
          pagination: buildPaginationMeta(normalizedPage, normalizedPerPage, 0),
        };
      }

      // Get paginated schedules for this project
      const schedules = await ctx.db
        .select({
          id: schema.schedule.id,
          name: schema.schedule.name,
          cron: schema.schedule.cron,
          timezone: schema.schedule.timezone,
          status: schema.schedule.status,
          planId: schema.schedule.planId,
          environmentId: schema.schedule.environmentId,
          lastRunId: schema.schedule.lastRunId,
          lastRunAt: schema.schedule.lastRunAt,
          nextRunAt: schema.schedule.nextRunAt,
          projectId: schema.schedule.projectId,
          createdAt: schema.schedule.createdAt,
          updatedAt: schema.schedule.updatedAt,
        })
        .from(schema.schedule)
        .where(and(...conditions))
        .orderBy(buildScheduleOrderBy(sortBy, sortOrder))
        .offset(offset)
        .limit(limit);

      // Handle edge case where no schedules on current page
      if (schedules.length === 0) {
        return {
          schedules: [],
          plans: [],
          pagination: buildPaginationMeta(normalizedPage, normalizedPerPage, total),
        };
      }

      // Get all plans for this project
      const plans = await ctx.db
        .select({
          id: schema.plan.id,
          name: schema.plan.name,
          description: schema.plan.description,
        })
        .from(schema.plan)
        .where(and(eq(schema.plan.projectId, projectId), isNull(schema.plan.deletedAt)));

      const plansMap = new Map(plans.map((p) => [p.id, p]));

      // Get all plan items for the referenced plans
      const planIds = [...new Set(schedules.map((s) => s.planId))];
      const planItems = await ctx.db
        .select({
          planId: schema.planItem.planId,
          testId: schema.planItem.testId,
          suiteId: schema.planItem.suiteId,
        })
        .from(schema.planItem)
        .where(and(inArray(schema.planItem.planId, planIds), isNull(schema.planItem.deletedAt)));

      // Group plan items by plan
      const planItemsByPlanId = new Map<string, typeof planItems>();
      for (const item of planItems) {
        const existing = planItemsByPlanId.get(item.planId) ?? [];
        existing.push(item);
        planItemsByPlanId.set(item.planId, existing);
      }

      // Get test names for referenced tests
      const testIds = planItems.filter((i) => i.testId).map((i) => i.testId!);
      const tests =
        testIds.length > 0
          ? await ctx.db
              .select({ id: schema.test.id, name: schema.test.name })
              .from(schema.test)
              .where(and(inArray(schema.test.id, testIds), isNull(schema.test.deletedAt)))
          : [];
      const testsMap = new Map(tests.map((t) => [t.id, t.name]));

      // Get suite names for referenced suites
      const suiteIds = planItems.filter((i) => i.suiteId).map((i) => i.suiteId!);
      const suites =
        suiteIds.length > 0
          ? await ctx.db
              .select({ id: schema.suite.id, name: schema.suite.name })
              .from(schema.suite)
              .where(and(inArray(schema.suite.id, suiteIds), isNull(schema.suite.deletedAt)))
          : [];
      const suitesMap = new Map(suites.map((s) => [s.id, s.name]));

      // Get last run status for schedules that have a lastRunId
      const lastRunIds = schedules.filter((s) => s.lastRunId).map((s) => s.lastRunId!);
      const lastRuns =
        lastRunIds.length > 0
          ? await ctx.db
              .select({ id: schema.run.id, status: schema.run.status })
              .from(schema.run)
              .where(inArray(schema.run.id, lastRunIds))
          : [];
      const lastRunsMap = new Map(lastRuns.map((r) => [r.id, r.status]));

      // Build response with details
      const schedulesWithDetails: ScheduleWithDetails[] = schedules.map((schedule) => {
        const plan = plansMap.get(schedule.planId);
        const items = planItemsByPlanId.get(schedule.planId) ?? [];

        // Determine target type and name from plan items
        const testItems = items
          .filter((i) => i.testId)
          .map((i) => ({
            id: i.testId!,
            name: testsMap.get(i.testId!) ?? "Unknown Test",
          }));
        const suiteItems = items
          .filter((i) => i.suiteId)
          .map((i) => ({
            id: i.suiteId!,
            name: suitesMap.get(i.suiteId!) ?? "Unknown Suite",
          }));

        return {
          id: schedule.id,
          projectId: schedule.projectId,
          planId: schedule.planId,
          environmentId: schedule.environmentId,
          name: schedule.name,
          cron: schedule.cron,
          timezone: schedule.timezone,
          status: schedule.status as "enabled" | "disabled",
          lastRunId: schedule.lastRunId,
          lastRunAt: schedule.lastRunAt,
          lastRunStatus: schedule.lastRunId ? (lastRunsMap.get(schedule.lastRunId) ?? null) : null,
          nextRunAt: schedule.nextRunAt,
          createdAt: schedule.createdAt,
          updatedAt: schedule.updatedAt,
          planName: plan?.name ?? "Unknown Plan",
          tests: testItems,
          suites: suiteItems,
        };
      });

      return {
        schedules: schedulesWithDetails,
        plans: plans.map((p) => ({ id: p.id, name: p.name })),
        pagination: buildPaginationMeta(normalizedPage, normalizedPerPage, total),
      };
    },

    async getById(ctx, id) {
      const { schedule } = await getScheduleWithAuth(ctx, id);

      return {
        id: schedule.id,
        projectId: schedule.projectId,
        planId: schedule.planId,
        environmentId: schedule.environmentId,
        name: schedule.name,
        cron: schedule.cron,
        timezone: schedule.timezone,
        status: schedule.status as "enabled" | "disabled",
        lastRunId: schedule.lastRunId,
        lastRunAt: schedule.lastRunAt,
        nextRunAt: schedule.nextRunAt,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt,
      };
    },

    async create(ctx, input) {
      const userId = requireActorUserId(ctx.actor);
      const { projectId, planId, name, cron, timezone, environmentId, metadata } = input;

      // Verify project exists and user has access
      await getProjectForSchedule(ctx, projectId);

      // Verify plan exists and belongs to the same project
      const [plan] = await ctx.db
        .select({ id: schema.plan.id })
        .from(schema.plan)
        .where(
          and(
            eq(schema.plan.id, planId),
            eq(schema.plan.projectId, projectId),
            isNull(schema.plan.deletedAt)
          )
        )
        .limit(1);

      if (!plan) {
        throw new NotFoundError("Plan", planId);
      }

      // Verify environment exists and belongs to the same project if provided
      if (environmentId) {
        const [env] = await ctx.db
          .select({ id: schema.environment.id })
          .from(schema.environment)
          .where(
            and(
              eq(schema.environment.id, environmentId),
              eq(schema.environment.projectId, projectId),
              isNull(schema.environment.deletedAt)
            )
          )
          .limit(1);

        if (!env) {
          throw new NotFoundError("Environment", environmentId);
        }
      }

      // Create the schedule
      const [newSchedule] = await ctx.db
        .insert(schema.schedule)
        .values({
          projectId,
          planId,
          name,
          cron,
          timezone,
          environmentId: environmentId ?? null,
          metadata: metadata ?? {},
          status: "enabled",
          createdBy: userId,
        })
        .returning();

      if (!newSchedule) {
        throw new Error("Failed to create schedule");
      }

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.SCHEDULE_CREATED_V1, {
          scheduleId: newSchedule.id,
          projectId: newSchedule.projectId,
          name: newSchedule.name,
          cron: newSchedule.cron,
          createdByUserId: userId,
        });
      }

      return {
        id: newSchedule.id,
        projectId: newSchedule.projectId,
        planId: newSchedule.planId,
        environmentId: newSchedule.environmentId,
        name: newSchedule.name,
        cron: newSchedule.cron,
        timezone: newSchedule.timezone,
        status: newSchedule.status as "enabled" | "disabled",
        lastRunId: newSchedule.lastRunId,
        lastRunAt: newSchedule.lastRunAt,
        nextRunAt: newSchedule.nextRunAt,
        createdAt: newSchedule.createdAt,
        updatedAt: newSchedule.updatedAt,
      };
    },

    async update(ctx, id, input) {
      const userId = requireActorUserId(ctx.actor);
      const { schedule } = await getScheduleWithAuth(ctx, id);

      // Build update object
      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updates.name = input.name;
      if (input.cron !== undefined) updates.cron = input.cron;
      if (input.timezone !== undefined) updates.timezone = input.timezone;
      if (input.environmentId !== undefined) {
        // Verify environment exists and belongs to the same project if provided (and not null)
        if (input.environmentId !== null) {
          const [env] = await ctx.db
            .select({ id: schema.environment.id })
            .from(schema.environment)
            .where(
              and(
                eq(schema.environment.id, input.environmentId),
                eq(schema.environment.projectId, schedule.projectId),
                isNull(schema.environment.deletedAt)
              )
            )
            .limit(1);

          if (!env) {
            throw new NotFoundError("Environment", input.environmentId);
          }
        }
        updates.environmentId = input.environmentId;
      }
      if (input.metadata !== undefined) updates.metadata = input.metadata;

      const [updated] = await ctx.db
        .update(schema.schedule)
        .set(updates)
        .where(eq(schema.schedule.id, id))
        .returning();

      if (!updated) {
        throw new Error("Failed to update schedule");
      }

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.SCHEDULE_UPDATED_V1, {
          scheduleId: updated.id,
          projectId: updated.projectId,
          changes: input as Record<string, unknown>,
          updatedByUserId: userId,
        });
      }

      return {
        id: updated.id,
        projectId: updated.projectId,
        planId: updated.planId,
        environmentId: updated.environmentId,
        name: updated.name,
        cron: updated.cron,
        timezone: updated.timezone,
        status: updated.status as "enabled" | "disabled",
        lastRunId: updated.lastRunId,
        lastRunAt: updated.lastRunAt,
        nextRunAt: updated.nextRunAt,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    },

    async enable(ctx, id) {
      const userId = requireActorUserId(ctx.actor);
      await getScheduleWithAuth(ctx, id);

      const [updated] = await ctx.db
        .update(schema.schedule)
        .set({ status: "enabled", updatedAt: new Date() })
        .where(eq(schema.schedule.id, id))
        .returning();

      if (!updated) {
        throw new Error("Failed to enable schedule");
      }

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.SCHEDULE_UPDATED_V1, {
          scheduleId: updated.id,
          projectId: updated.projectId,
          changes: { status: "enabled" },
          updatedByUserId: userId,
        });
      }

      return {
        id: updated.id,
        projectId: updated.projectId,
        planId: updated.planId,
        environmentId: updated.environmentId,
        name: updated.name,
        cron: updated.cron,
        timezone: updated.timezone,
        status: updated.status as "enabled" | "disabled",
        lastRunId: updated.lastRunId,
        lastRunAt: updated.lastRunAt,
        nextRunAt: updated.nextRunAt,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    },

    async disable(ctx, id) {
      const userId = requireActorUserId(ctx.actor);
      await getScheduleWithAuth(ctx, id);

      const [updated] = await ctx.db
        .update(schema.schedule)
        .set({ status: "disabled", updatedAt: new Date() })
        .where(eq(schema.schedule.id, id))
        .returning();

      if (!updated) {
        throw new Error("Failed to disable schedule");
      }

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.SCHEDULE_UPDATED_V1, {
          scheduleId: updated.id,
          projectId: updated.projectId,
          changes: { status: "disabled" },
          updatedByUserId: userId,
        });
      }

      return {
        id: updated.id,
        projectId: updated.projectId,
        planId: updated.planId,
        environmentId: updated.environmentId,
        name: updated.name,
        cron: updated.cron,
        timezone: updated.timezone,
        status: updated.status as "enabled" | "disabled",
        lastRunId: updated.lastRunId,
        lastRunAt: updated.lastRunAt,
        nextRunAt: updated.nextRunAt,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    },

    async delete(ctx, id) {
      const userId = requireActorUserId(ctx.actor);
      const { schedule } = await getScheduleWithAuth(ctx, id);

      // Soft delete
      await ctx.db
        .update(schema.schedule)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.schedule.id, id));

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.SCHEDULE_DELETED_V1, {
          scheduleId: schedule.id,
          projectId: schedule.projectId,
          deletedByUserId: userId,
        });
      }
    },
  };
}
