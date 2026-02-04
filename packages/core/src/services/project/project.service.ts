/**
 * ProjectService - Project management business logic.
 *
 * Handles CRUD operations for projects within organizations.
 */

import { eq, and, isNull, inArray, gte, count, desc, isNotNull, sql } from "drizzle-orm";
import { schema } from "@posium/db";
import { publish, EVENTS } from "@posium/appevents";
import type { ServiceContext } from "../../context.js";
import { requireActorUserId } from "../../context.js";
import { NotFoundError, ForbiddenError } from "../../errors.js";
import { requireOrgMembership } from "../../auth/membership.js";
import { withTransaction } from "../../transactions.js";
import type {
  Project,
  ProjectWithStats,
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsOptions,
  ProjectHealth,
  ProjectSummary,
} from "./project.types.js";

/**
 * ProjectService interface.
 */
export interface ProjectService {
  /** List all projects in an organization with stats */
  list(ctx: ServiceContext, options: ListProjectsOptions): Promise<ProjectWithStats[]>;

  /** Get a single project by ID */
  getById(ctx: ServiceContext, id: string): Promise<Project>;

  /** Create a new project */
  create(ctx: ServiceContext, input: CreateProjectInput): Promise<Project>;

  /** Update a project (requires org membership) */
  update(ctx: ServiceContext, id: string, input: UpdateProjectInput): Promise<Project>;

  /** Soft delete a project (requires admin role) */
  delete(ctx: ServiceContext, id: string): Promise<void>;

  /** Get project health based on latest run */
  getHealth(ctx: ServiceContext, projectId: string): Promise<ProjectHealth>;

  /** Get projects for an org sorted by recent activity (for notifications) */
  listWithHealth(ctx: ServiceContext, orgId: string, limit?: number): Promise<ProjectSummary[]>;

  /** Count total projects in an org */
  countByOrg(ctx: ServiceContext, orgId: string): Promise<number>;
}

/**
 * Creates a ProjectService instance.
 */
export function createProjectService(): ProjectService {
  return {
    async list(ctx, options) {
      const { orgId } = options;

      // Check org membership
      await requireOrgMembership(ctx, orgId);

      // Get all projects in this org
      const projects = await ctx.db
        .select()
        .from(schema.project)
        .where(
          and(
            eq(schema.project.orgId, orgId),
            isNull(schema.project.deletedAt)
          )
        );

      if (projects.length === 0) {
        return [];
      }

      const projectIds = projects.map((p) => p.id);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Get test counts per project in a single query
      const testCounts = await ctx.db
        .select({
          projectId: schema.test.projectId,
          count: count(),
        })
        .from(schema.test)
        .where(
          and(
            inArray(schema.test.projectId, projectIds),
            isNull(schema.test.deletedAt)
          )
        )
        .groupBy(schema.test.projectId);

      // Get completed runs in last 24h per project
      // Only count terminal statuses for accurate stats
      const terminalStatuses = ["passed", "failed", "flaky", "cancelled", "timed_out"];
      const runs24h = await ctx.db
        .select({
          projectId: schema.run.projectId,
          status: schema.run.status,
        })
        .from(schema.run)
        .where(
          and(
            inArray(schema.run.projectId, projectIds),
            isNull(schema.run.deletedAt),
            gte(schema.run.createdAt, twentyFourHoursAgo),
            inArray(schema.run.status, terminalStatuses)
          )
        );

      // Group runs by project for counting
      const runsByProject = new Map<string, typeof runs24h>();
      for (const run of runs24h) {
        const existing = runsByProject.get(run.projectId) ?? [];
        existing.push(run);
        runsByProject.set(run.projectId, existing);
      }

      // Combine data
      return projects.map((project) => {
        const testCountRow = testCounts.find((t) => t.projectId === project.id);
        const projectRuns = runsByProject.get(project.id) ?? [];

        // Count by status - only passing, failing, flaky are user-facing stats
        // cancelled and timed_out are counted in runs24h but not separately
        const passing = projectRuns.filter((r) => r.status === "passed").length;
        const failing = projectRuns.filter((r) => r.status === "failed").length;
        const flaky = projectRuns.filter((r) => r.status === "flaky").length;

        return {
          id: project.id,
          orgId: project.orgId,
          name: project.name,
          description: project.description,
          logo: project.logo,
          url: project.url,
          stats: {
            totalTests: Number(testCountRow?.count ?? 0),
            passing,
            failing,
            flaky,
            runs24h: projectRuns.length,
          },
        };
      });
    },

    async getById(ctx, id) {
      // Get the project first
      const [project] = await ctx.db
        .select()
        .from(schema.project)
        .where(and(eq(schema.project.id, id), isNull(schema.project.deletedAt)))
        .limit(1);

      if (!project) {
        throw new NotFoundError("Project", id);
      }

      // Check org membership
      await requireOrgMembership(ctx, project.orgId);

      return {
        id: project.id,
        orgId: project.orgId,
        name: project.name,
        description: project.description,
        logo: project.logo,
        url: project.url,
      };
    },

    async create(ctx, input) {
      const userId = requireActorUserId(ctx.actor);
      const { orgId, name, description, url, logo, targetUrl } = input;

      // Check org membership
      await requireOrgMembership(ctx, orgId);

      // Get creator's orgMember ID for projectMember
      // Note: No soft delete filter since we now use hard deletes for members
      const [creatorMembership] = await ctx.db
        .select({ id: schema.orgMember.id })
        .from(schema.orgMember)
        .where(
          and(
            eq(schema.orgMember.orgId, orgId),
            eq(schema.orgMember.userId, userId)
          )
        )
        .limit(1);

      if (!creatorMembership) {
        throw new ForbiddenError("Creator is not a member of this organization");
      }

      // Create project, projectMember, and default environment in a transaction
      const newProject = await withTransaction(ctx, async (txCtx) => {
        // Create the project
        const [created] = await txCtx.db
          .insert(schema.project)
          .values({
            orgId,
            name,
            description,
            url,
            logo,
            createdBy: userId,
          })
          .returning();

        if (!created) {
          throw new Error("Failed to create project");
        }

        // Add creator as project owner
        await txCtx.db.insert(schema.projectMember).values({
          projectId: created.id,
          orgMemberId: creatorMembership.id,
          role: "owner",
          createdBy: userId,
        });

        // Create default environment with target URL and 120s timeout
        await txCtx.db.insert(schema.environment).values({
          projectId: created.id,
          name: "default",
          isDefault: true,
          config: {
            targetUrl,
            timeout: 120,
          },
          createdBy: userId,
        });

        return created;
      });

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.PROJECT_CREATED_V1, {
          projectId: newProject.id,
          orgId: newProject.orgId,
          name: newProject.name,
          createdByUserId: userId,
        });
      }

      return {
        id: newProject.id,
        orgId: newProject.orgId,
        name: newProject.name,
        description: newProject.description,
        logo: newProject.logo,
        url: newProject.url,
      };
    },

    async update(ctx, id, input) {
      const userId = requireActorUserId(ctx.actor);

      // Get the project first
      const [project] = await ctx.db
        .select()
        .from(schema.project)
        .where(and(eq(schema.project.id, id), isNull(schema.project.deletedAt)))
        .limit(1);

      if (!project) {
        throw new NotFoundError("Project", id);
      }

      // Check org membership
      await requireOrgMembership(ctx, project.orgId);

      // Build update object
      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.url !== undefined) updates.url = input.url;
      if (input.logo !== undefined) updates.logo = input.logo;

      const [updated] = await ctx.db
        .update(schema.project)
        .set(updates)
        .where(eq(schema.project.id, id))
        .returning();

      if (!updated) {
        throw new Error("Failed to update project");
      }

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.PROJECT_UPDATED_V1, {
          projectId: updated.id,
          orgId: updated.orgId,
          updatedByUserId: userId,
          changes: input as Record<string, unknown>,
        });
      }

      return {
        id: updated.id,
        orgId: updated.orgId,
        name: updated.name,
        description: updated.description,
        logo: updated.logo,
        url: updated.url,
      };
    },

    async delete(ctx, id) {
      const userId = requireActorUserId(ctx.actor);

      // Get the project first
      const [project] = await ctx.db
        .select()
        .from(schema.project)
        .where(and(eq(schema.project.id, id), isNull(schema.project.deletedAt)))
        .limit(1);

      if (!project) {
        throw new NotFoundError("Project", id);
      }

      // Require admin role for deletion
      await requireOrgMembership(ctx, project.orgId, "admin");

      // Soft delete
      await ctx.db
        .update(schema.project)
        .set({ deletedAt: new Date() })
        .where(eq(schema.project.id, id));

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.PROJECT_DELETED_V1, {
          projectId: id,
          orgId: project.orgId,
          deletedByUserId: userId,
        });
      }
    },

    async getHealth(ctx, projectId) {
      // Verify project exists and user has access
      const [project] = await ctx.db
        .select({ id: schema.project.id, orgId: schema.project.orgId })
        .from(schema.project)
        .where(and(eq(schema.project.id, projectId), isNull(schema.project.deletedAt)))
        .limit(1);

      if (!project) {
        throw new NotFoundError("Project", projectId);
      }

      await requireOrgMembership(ctx, project.orgId);

      // First check if there are ANY finished runs
      const [anyFinishedRun] = await ctx.db
        .select({ runId: schema.run.id })
        .from(schema.run)
        .where(
          and(
            eq(schema.run.projectId, projectId),
            isNotNull(schema.run.finishedAt),
            isNull(schema.run.deletedAt)
          )
        )
        .limit(1);

      if (!anyFinishedRun) {
        return {
          hasRuns: false,
          totalTests: 0,
          failingTests: 0,
          passingTests: 0,
        };
      }

      // Get the latest finished run (passed, failed, or flaky)
      const [latestRunWithTests] = await ctx.db
        .select({ runId: schema.run.id })
        .from(schema.run)
        .where(
          and(
            eq(schema.run.projectId, projectId),
            inArray(schema.run.status, ["passed", "failed", "flaky"]),
            isNull(schema.run.deletedAt)
          )
        )
        .orderBy(desc(schema.run.finishedAt))
        .limit(1);

      if (!latestRunWithTests) {
        return {
          hasRuns: true,
          totalTests: 0,
          failingTests: 0,
          passingTests: 0,
        };
      }

      // Get test results from the latest run, deduped by testId (highest attempt wins)
      const runTests = await ctx.db
        .select({
          testId: schema.runTest.testId,
          status: schema.runTest.status,
          attempt: schema.runTest.attempt,
        })
        .from(schema.runTest)
        .where(
          and(
            eq(schema.runTest.runId, latestRunWithTests.runId),
            isNull(schema.runTest.deletedAt)
          )
        );

      // Dedupe by testId - keep highest attempt per test
      const testStatusMap = new Map<string, { status: string; attempt: number }>();
      for (const rt of runTests) {
        const existing = testStatusMap.get(rt.testId);
        if (!existing || rt.attempt > existing.attempt) {
          testStatusMap.set(rt.testId, { status: rt.status, attempt: rt.attempt });
        }
      }

      // Count unique tests by final status
      let passingTests = 0;
      let failingTests = 0;

      for (const { status, attempt } of testStatusMap.values()) {
        // A test that passed on retry is flaky, not passing
        if (status === "passed" && attempt === 1) {
          passingTests++;
        } else if (status === "failed") {
          failingTests++;
        }
        // Flaky tests (passed on retry or status === "flaky") are not counted as passing or failing
      }

      return {
        hasRuns: true,
        totalTests: testStatusMap.size,
        failingTests,
        passingTests,
      };
    },

    async listWithHealth(ctx, orgId, limit = 10) {
      await requireOrgMembership(ctx, orgId);

      // Subquery to get the latest run date for each project
      const latestRunSubquery = ctx.db
        .select({
          projectId: schema.run.projectId,
          lastRunAt: sql<Date>`max(${schema.run.finishedAt})`.as("lastRunAt"),
        })
        .from(schema.run)
        .where(
          and(
            isNotNull(schema.run.finishedAt),
            isNull(schema.run.deletedAt)
          )
        )
        .groupBy(schema.run.projectId)
        .as("latestRuns");

      const results = await ctx.db
        .select({
          projectId: schema.project.id,
          projectName: schema.project.name,
          lastRunAt: latestRunSubquery.lastRunAt,
        })
        .from(schema.project)
        .leftJoin(latestRunSubquery, eq(schema.project.id, latestRunSubquery.projectId))
        .where(and(eq(schema.project.orgId, orgId), isNull(schema.project.deletedAt)))
        .orderBy(
          sql`${latestRunSubquery.lastRunAt} IS NULL`,
          desc(latestRunSubquery.lastRunAt),
          schema.project.name
        )
        .limit(limit);

      return results.map((r) => ({
        projectId: r.projectId,
        projectName: r.projectName,
        lastRunAt: r.lastRunAt,
      }));
    },

    async countByOrg(ctx, orgId) {
      await requireOrgMembership(ctx, orgId);

      const [result] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.project)
        .where(and(eq(schema.project.orgId, orgId), isNull(schema.project.deletedAt)));

      return result?.count ?? 0;
    },
  };
}
