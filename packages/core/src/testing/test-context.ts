/**
 * Test context utilities for service testing.
 *
 * These utilities make it easy to create ServiceContext instances
 * for testing with predictable seed data.
 */

import type { DBType } from "@posium/db";
import type { PgBoss } from "@posium/boss";
import type { Auth } from "@posium/auth/server";
import type { ServiceContext, Actor } from "../context.js";

export interface TestContextOptions {
  /** Database connection */
  db: DBType;
  /** Optional PgBoss instance */
  boss?: PgBoss | null;
  /** Optional Auth instance (for BetterAuth operations) */
  auth?: Auth;
  /** Actor making the request (defaults to Amazon owner) */
  actor?: Actor;
  /** User ID shorthand (creates a user actor) */
  userId?: string;
  /** Organization ID to scope to */
  orgId?: string;
}

/**
 * Create a ServiceContext for testing.
 *
 * Uses seed user IDs by default for predictable tests.
 * The default actor is the Amazon owner user.
 *
 * @example
 * ```typescript
 * // Basic usage with defaults
 * const ctx = createTestContext({ db, boss });
 *
 * // With specific user
 * const ctx = createTestContext({
 *   db,
 *   boss,
 *   userId: seedUsers.stripeOwner.id,
 *   orgId: seedOrgs.stripe.id,
 * });
 *
 * // With API key actor
 * const ctx = createTestContext({
 *   db,
 *   boss,
 *   actor: { type: "apiKey", apiKeyId: "key_123", createdBy: "usr_123" },
 * });
 * ```
 */
export function createTestContext(options: TestContextOptions): ServiceContext {
  const { db, boss, auth, actor, userId, orgId } = options;

  // Determine the actor
  let resolvedActor: Actor;
  if (actor) {
    resolvedActor = actor;
  } else if (userId) {
    resolvedActor = { type: "user", userId };
  } else {
    // Default to Amazon owner for predictable tests
    resolvedActor = { type: "user", userId: "usr_seed_amazon_owner" };
  }

  return {
    db,
    boss: boss ?? undefined,
    auth,
    actor: resolvedActor,
    orgId: orgId ?? (resolvedActor.type === "user" ? "org_seed_amazon" : undefined),
  };
}

/**
 * Seed user IDs for quick reference in tests.
 * These match the IDs in @posium/db/seed.
 */
export const testUsers = {
  admin: "usr_seed_admin",
  amazonOwner: "usr_seed_amazon_owner",
  amazonDev1: "usr_seed_amazon_dev1",
  amazonDev2: "usr_seed_amazon_dev2",
  stripeOwner: "usr_seed_stripe_owner",
  stripeDev1: "usr_seed_stripe_dev1",
  stripeDev2: "usr_seed_stripe_dev2",
  githubOwner: "usr_seed_github_owner",
  githubDev1: "usr_seed_github_dev1",
  notionOwner: "usr_seed_notion_owner",
  notionDev1: "usr_seed_notion_dev1",
  uberOwner: "usr_seed_uber_owner",
  uberDev1: "usr_seed_uber_dev1",
  openaiOwner: "usr_seed_openai_owner",
  unverified: "usr_seed_unverified",
  banned: "usr_seed_banned",
} as const;

/**
 * Seed organization IDs for quick reference in tests.
 */
export const testOrgs = {
  amazon: "org_seed_amazon",
  stripe: "org_seed_stripe",
  github: "org_seed_github",
  notion: "org_seed_notion",
  uber: "org_seed_uber",
  openai: "org_seed_openai",
} as const;

/**
 * Seed project IDs for quick reference in tests.
 */
export const testProjects = {
  amazonStorefront: "prj_seed_amazon_storefront",
  amazonCheckout: "prj_seed_amazon_checkout",
  amazonSeller: "prj_seed_amazon_seller",
  stripeDashboard: "prj_seed_stripe_dashboard",
  stripeCheckout: "prj_seed_stripe_checkout",
  stripeConnect: "prj_seed_stripe_connect",
  githubRepo: "prj_seed_github_repo",
  githubCopilot: "prj_seed_github_copilot",
} as const;

/**
 * Seed suite IDs for quick reference in tests.
 */
export const testSuites = {
  amazonSearch: "ste_seed_amazon_search",
  amazonCart: "ste_seed_amazon_cart",
} as const;

/**
 * Seed test IDs for quick reference in tests.
 */
export const testTests = {
  searchProducts: "tst_seed_search_products",
  filterByCategory: "tst_seed_filter_category",
} as const;

/**
 * Seed run IDs for quick reference in tests.
 */
export const testRuns = {
  amazonRun1: "run_seed_amazon_run1",
  amazonRun2: "run_seed_amazon_run2",
  amazonRun3: "run_seed_amazon_run3",
  stripeRun1: "run_seed_stripe_run1",
  stripeRun2: "run_seed_stripe_run2",
  githubRun1: "run_seed_github_run1",
  openaiRun1: "run_seed_openai_run1",
} as const;

/**
 * Seed schedule IDs for quick reference in tests.
 */
export const testSchedules = {
  amazonDailySmoke: "sch_seed_amazon_daily_smoke",
  amazonWeeklyRegression: "sch_seed_amazon_weekly_regression",
  amazonStagingNightly: "sch_seed_amazon_staging_nightly",
  stripeDailyHealth: "sch_seed_stripe_daily_health",
  githubPrNightly: "sch_seed_github_pr_nightly",
} as const;

/**
 * Seed plan IDs for quick reference in tests.
 */
export const testPlans = {
  amazonSmoke: "pln_seed_amazon_smoke",
  amazonRegression: "pln_seed_amazon_regression",
  stripeDaily: "pln_seed_stripe_daily",
  githubPr: "pln_seed_github_pr",
} as const;

/**
 * Seed environment IDs for quick reference in tests.
 */
export const testEnvironments = {
  amazonStorefrontDev: "env_seed_amazon_storefront_dev",
  amazonStorefrontStaging: "env_seed_amazon_storefront_staging",
  amazonStorefrontProd: "env_seed_amazon_storefront_prod",
  stripeDashboardDev: "env_seed_stripe_dashboard_dev",
  stripeDashboardProd: "env_seed_stripe_dashboard_prod",
  githubRepoDev: "env_seed_github_repo_dev",
  githubRepoProd: "env_seed_github_repo_prod",
} as const;

/**
 * Create contexts for common seed users.
 *
 * @example
 * ```typescript
 * const contexts = createSeedContexts(db, boss);
 * const projects = await projectService.list(contexts.amazonOwner);
 * ```
 */
export function createSeedContexts(db: DBType, boss?: PgBoss) {
  return {
    amazonOwner: createTestContext({
      db,
      boss,
      userId: testUsers.amazonOwner,
      orgId: testOrgs.amazon,
    }),
    amazonDev1: createTestContext({
      db,
      boss,
      userId: testUsers.amazonDev1,
      orgId: testOrgs.amazon,
    }),
    amazonDev2: createTestContext({
      db,
      boss,
      userId: testUsers.amazonDev2,
      orgId: testOrgs.amazon,
    }),
    stripeOwner: createTestContext({
      db,
      boss,
      userId: testUsers.stripeOwner,
      orgId: testOrgs.stripe,
    }),
    stripeDev1: createTestContext({
      db,
      boss,
      userId: testUsers.stripeDev1,
      orgId: testOrgs.stripe,
    }),
    githubOwner: createTestContext({
      db,
      boss,
      userId: testUsers.githubOwner,
      orgId: testOrgs.github,
    }),
  };
}
