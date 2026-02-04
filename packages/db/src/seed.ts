/**
 * Seed data for development and testing.
 *
 * All IDs are hardcoded for predictability across test runs.
 * Format: {prefix}_seed_{identifier}
 *
 * Usage:
 *   import { applySeed, seedUsers, seedOrgs } from "@posium/db/seed";
 *   await applySeed(db);
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, apiKey, organization } from "better-auth/plugins";
import { eq, inArray, sql } from "drizzle-orm";
import type { DBType } from "./index.js";
import * as schema from "./schema.js";

/**
 * Default secret for seed auth.
 * MUST match the secret used by the app at runtime.
 * For E2E tests, this matches apps/console/.env.test
 */
const DEFAULT_SEED_SECRET =
  "e2e-test-secret-that-is-at-least-32-characters-long";

// ============================================================================
// Seed Data Definitions - Users
// ============================================================================

/**
 * Seed users representing employees across different organizations.
 * Email domains use {company}.posium.dev to avoid sending to real addresses.
 */
export const seedUsers = {
  // Platform admin
  admin: {
    id: "usr_seed_admin",
    email: "admin@posium.dev",
    emailVerified: true,
    name: "Alex Chen",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=admin",
    role: "admin",
    banned: false,
  },
  // Amazon users
  amazonOwner: {
    id: "usr_seed_amazon_owner",
    email: "jeff.bezos@amazon.posium.dev",
    emailVerified: true,
    name: "Jeff Bezos",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=jeff",
    role: "user",
    banned: false,
  },
  amazonDev1: {
    id: "usr_seed_amazon_dev1",
    email: "marcus.johnson@amazon.posium.dev",
    emailVerified: true,
    name: "Marcus Johnson",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=marcus",
    role: "user",
    banned: false,
  },
  amazonDev2: {
    id: "usr_seed_amazon_dev2",
    email: "yuki.tanaka@amazon.posium.dev",
    emailVerified: true,
    name: "Yuki Tanaka",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=yuki",
    role: "user",
    banned: false,
  },
  // Stripe users
  stripeOwner: {
    id: "usr_seed_stripe_owner",
    email: "david.martinez@stripe.posium.dev",
    emailVerified: true,
    name: "David Martinez",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=david",
    role: "user",
    banned: false,
  },
  stripeDev1: {
    id: "usr_seed_stripe_dev1",
    email: "emily.wilson@stripe.posium.dev",
    emailVerified: true,
    name: "Emily Wilson",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=emily",
    role: "user",
    banned: false,
  },
  stripeDev2: {
    id: "usr_seed_stripe_dev2",
    email: "raj.patel@stripe.posium.dev",
    emailVerified: true,
    name: "Raj Patel",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=raj",
    role: "user",
    banned: false,
  },
  // GitHub users
  githubOwner: {
    id: "usr_seed_github_owner",
    email: "sarah.chen@github.posium.dev",
    emailVerified: true,
    name: "Sarah Chen",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=sarah",
    role: "user",
    banned: false,
  },
  githubDev1: {
    id: "usr_seed_github_dev1",
    email: "tom.anderson@github.posium.dev",
    emailVerified: true,
    name: "Tom Anderson",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=tom",
    role: "user",
    banned: false,
  },
  // Notion users
  notionOwner: {
    id: "usr_seed_notion_owner",
    email: "lisa.park@notion.posium.dev",
    emailVerified: true,
    name: "Lisa Park",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=lisa",
    role: "user",
    banned: false,
  },
  notionDev1: {
    id: "usr_seed_notion_dev1",
    email: "james.wright@notion.posium.dev",
    emailVerified: true,
    name: "James Wright",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=james",
    role: "user",
    banned: false,
  },
  // Uber users
  uberOwner: {
    id: "usr_seed_uber_owner",
    email: "michael.brown@uber.posium.dev",
    emailVerified: true,
    name: "Michael Brown",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=michael",
    role: "user",
    banned: false,
  },
  uberDev1: {
    id: "usr_seed_uber_dev1",
    email: "anna.kowalski@uber.posium.dev",
    emailVerified: true,
    name: "Anna Kowalski",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=anna",
    role: "user",
    banned: false,
  },
  // OpenAI users
  openaiOwner: {
    id: "usr_seed_openai_owner",
    email: "sam.altman@openai.posium.dev",
    emailVerified: true,
    name: "Sam Altman",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=sam",
    role: "user",
    banned: false,
  },
  openaiCTO: {
    id: "usr_seed_openai_cto",
    email: "mira.murati@openai.posium.dev",
    emailVerified: true,
    name: "Mira Murati",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=mira",
    role: "user",
    banned: false,
  },
  openaiPresident: {
    id: "usr_seed_openai_president",
    email: "greg.brockman@openai.posium.dev",
    emailVerified: true,
    name: "Greg Brockman",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=greg",
    role: "user",
    banned: false,
  },
  openaiDev1: {
    id: "usr_seed_openai_dev1",
    email: "jason.wei@openai.posium.dev",
    emailVerified: true,
    name: "Jason Wei",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=jason",
    role: "user",
    banned: false,
  },
  openaiDev2: {
    id: "usr_seed_openai_dev2",
    email: "alec.radford@openai.posium.dev",
    emailVerified: true,
    name: "Alec Radford",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=alec",
    role: "user",
    banned: false,
  },
  // Test edge cases
  unverified: {
    id: "usr_seed_unverified",
    email: "new.user@example.posium.dev",
    emailVerified: false,
    name: "New User",
    image: null,
    role: "user",
    banned: false,
  },
  banned: {
    id: "usr_seed_banned",
    email: "banned.user@example.posium.dev",
    emailVerified: true,
    name: "Banned User",
    image: null,
    role: "user",
    banned: true,
    banReason: "Violated terms of service",
  },
} as const;

/**
 * All seed users use the same simple password for easy testing.
 */
export const seedUserPasswords: Record<keyof typeof seedUsers, string> =
  Object.fromEntries(
    Object.keys(seedUsers).map((key) => [key, "password"]),
  ) as Record<keyof typeof seedUsers, string>;

// ============================================================================
// Seed Data Definitions - Organizations
// ============================================================================

export const seedOrgs = {
  amazon: {
    id: "org_seed_amazon",
    name: "Amazon",
    slug: "amazon",
    logo: "https://api.dicebear.com/7.x/identicon/svg?seed=amazon",
    metadata: JSON.stringify({ plan: "enterprise", seats: 100 }),
  },
  stripe: {
    id: "org_seed_stripe",
    name: "Stripe",
    slug: "stripe",
    logo: "https://api.dicebear.com/7.x/identicon/svg?seed=stripe",
    metadata: JSON.stringify({ plan: "pro", seats: 50 }),
  },
  github: {
    id: "org_seed_github",
    name: "GitHub",
    slug: "github",
    logo: "https://api.dicebear.com/7.x/identicon/svg?seed=github",
    metadata: JSON.stringify({ plan: "enterprise", seats: 75 }),
  },
  notion: {
    id: "org_seed_notion",
    name: "Notion",
    slug: "notion",
    logo: "https://api.dicebear.com/7.x/identicon/svg?seed=notion",
    metadata: JSON.stringify({ plan: "pro", seats: 30 }),
  },
  uber: {
    id: "org_seed_uber",
    name: "Uber",
    slug: "uber",
    logo: "https://api.dicebear.com/7.x/identicon/svg?seed=uber",
    metadata: JSON.stringify({ plan: "enterprise", seats: 80 }),
  },
  openai: {
    id: "org_seed_openai",
    name: "OpenAI",
    slug: "openai",
    logo: "https://api.dicebear.com/7.x/identicon/svg?seed=openai",
    metadata: JSON.stringify({ plan: "enterprise", seats: 40 }),
  },
} as const;

// ============================================================================
// Seed Data Definitions - Org Members
// ============================================================================

export const seedOrgMembers = {
  // Amazon org members
  amazonOwner: {
    id: "om_seed_amazon_owner",
    userId: seedUsers.amazonOwner.id,
    orgId: seedOrgs.amazon.id,
    role: "owner",
  },
  amazonDev1: {
    id: "om_seed_amazon_dev1",
    userId: seedUsers.amazonDev1.id,
    orgId: seedOrgs.amazon.id,
    role: "admin",
  },
  amazonDev2: {
    id: "om_seed_amazon_dev2",
    userId: seedUsers.amazonDev2.id,
    orgId: seedOrgs.amazon.id,
    role: "member",
  },
  // Stripe org members
  stripeOwner: {
    id: "om_seed_stripe_owner",
    userId: seedUsers.stripeOwner.id,
    orgId: seedOrgs.stripe.id,
    role: "owner",
  },
  stripeDev1: {
    id: "om_seed_stripe_dev1",
    userId: seedUsers.stripeDev1.id,
    orgId: seedOrgs.stripe.id,
    role: "admin",
  },
  stripeDev2: {
    id: "om_seed_stripe_dev2",
    userId: seedUsers.stripeDev2.id,
    orgId: seedOrgs.stripe.id,
    role: "member",
  },
  // GitHub org members
  githubOwner: {
    id: "om_seed_github_owner",
    userId: seedUsers.githubOwner.id,
    orgId: seedOrgs.github.id,
    role: "owner",
  },
  githubDev1: {
    id: "om_seed_github_dev1",
    userId: seedUsers.githubDev1.id,
    orgId: seedOrgs.github.id,
    role: "admin",
  },
  // Notion org members
  notionOwner: {
    id: "om_seed_notion_owner",
    userId: seedUsers.notionOwner.id,
    orgId: seedOrgs.notion.id,
    role: "owner",
  },
  notionDev1: {
    id: "om_seed_notion_dev1",
    userId: seedUsers.notionDev1.id,
    orgId: seedOrgs.notion.id,
    role: "admin",
  },
  // Uber org members
  uberOwner: {
    id: "om_seed_uber_owner",
    userId: seedUsers.uberOwner.id,
    orgId: seedOrgs.uber.id,
    role: "owner",
  },
  uberDev1: {
    id: "om_seed_uber_dev1",
    userId: seedUsers.uberDev1.id,
    orgId: seedOrgs.uber.id,
    role: "admin",
  },
  // OpenAI org members
  openaiOwner: {
    id: "om_seed_openai_owner",
    userId: seedUsers.openaiOwner.id,
    orgId: seedOrgs.openai.id,
    role: "owner",
  },
  openaiCTO: {
    id: "om_seed_openai_cto",
    userId: seedUsers.openaiCTO.id,
    orgId: seedOrgs.openai.id,
    role: "admin",
  },
  openaiPresident: {
    id: "om_seed_openai_president",
    userId: seedUsers.openaiPresident.id,
    orgId: seedOrgs.openai.id,
    role: "admin",
  },
  openaiDev1: {
    id: "om_seed_openai_dev1",
    userId: seedUsers.openaiDev1.id,
    orgId: seedOrgs.openai.id,
    role: "member",
  },
  openaiDev2: {
    id: "om_seed_openai_dev2",
    userId: seedUsers.openaiDev2.id,
    orgId: seedOrgs.openai.id,
    role: "member",
  },
} as const;

// ============================================================================
// Seed Data Definitions - Projects
// ============================================================================

export const seedProjects = {
  // Amazon projects
  amazonStorefront: {
    id: "prj_seed_amazon_storefront",
    orgId: seedOrgs.amazon.id,
    name: "Storefront Web App",
    description: "E-commerce storefront and product browsing experience",
    url: "https://www.amazon.com",
    createdBy: seedUsers.amazonOwner.id,
  },
  amazonCheckout: {
    id: "prj_seed_amazon_checkout",
    orgId: seedOrgs.amazon.id,
    name: "Checkout & Payments",
    description: "Shopping cart, checkout flow, and payment processing",
    url: "https://www.amazon.com/checkout",
    createdBy: seedUsers.amazonOwner.id,
  },
  amazonSeller: {
    id: "prj_seed_amazon_seller",
    orgId: seedOrgs.amazon.id,
    name: "Seller Central",
    description: "Seller dashboard for inventory and order management",
    url: "https://sellercentral.amazon.com",
    createdBy: seedUsers.amazonDev1.id,
  },
  // Stripe projects
  stripeDashboard: {
    id: "prj_seed_stripe_dashboard",
    orgId: seedOrgs.stripe.id,
    name: "Billing Dashboard",
    description: "Customer billing, subscriptions, and invoice management",
    url: "https://dashboard.stripe.com",
    createdBy: seedUsers.stripeOwner.id,
  },
  stripeCheckout: {
    id: "prj_seed_stripe_checkout",
    orgId: seedOrgs.stripe.id,
    name: "Stripe Checkout",
    description: "Payment checkout flow and integration widgets",
    url: "https://checkout.stripe.com",
    createdBy: seedUsers.stripeOwner.id,
  },
  stripeConnect: {
    id: "prj_seed_stripe_connect",
    orgId: seedOrgs.stripe.id,
    name: "Stripe Connect",
    description: "Platform payments and marketplace onboarding",
    url: "https://connect.stripe.com",
    createdBy: seedUsers.stripeDev1.id,
  },
  // GitHub projects
  githubRepo: {
    id: "prj_seed_github_repo",
    orgId: seedOrgs.github.id,
    name: "Repository App",
    description: "Repository browsing, code review, and pull requests",
    url: "https://github.com",
    createdBy: seedUsers.githubOwner.id,
  },
  githubCopilot: {
    id: "prj_seed_github_copilot",
    orgId: seedOrgs.github.id,
    name: "Copilot Web",
    description: "AI-powered code suggestions and chat interface",
    url: "https://github.com/features/copilot",
    createdBy: seedUsers.githubOwner.id,
  },
  githubActions: {
    id: "prj_seed_github_actions",
    orgId: seedOrgs.github.id,
    name: "GitHub Actions",
    description: "CI/CD workflows and automation pipelines",
    url: "https://github.com/features/actions",
    createdBy: seedUsers.githubDev1.id,
  },
  // Notion projects
  notionWorkspace: {
    id: "prj_seed_notion_workspace",
    orgId: seedOrgs.notion.id,
    name: "Workspace App",
    description: "Document editing, databases, and team collaboration",
    url: "https://www.notion.so",
    createdBy: seedUsers.notionOwner.id,
  },
  notionAPI: {
    id: "prj_seed_notion_api",
    orgId: seedOrgs.notion.id,
    name: "Notion API",
    description: "Public API and integration endpoints",
    url: "https://developers.notion.com",
    createdBy: seedUsers.notionDev1.id,
  },
  // Uber projects
  uberRider: {
    id: "prj_seed_uber_rider",
    orgId: seedOrgs.uber.id,
    name: "Rider Web App",
    description: "Ride booking, tracking, and payment for passengers",
    url: "https://www.uber.com",
    createdBy: seedUsers.uberOwner.id,
  },
  uberDriver: {
    id: "prj_seed_uber_driver",
    orgId: seedOrgs.uber.id,
    name: "Driver Dashboard",
    description: "Driver earnings, trip history, and account management",
    url: "https://drivers.uber.com",
    createdBy: seedUsers.uberOwner.id,
  },
  uberEats: {
    id: "prj_seed_uber_eats",
    orgId: seedOrgs.uber.id,
    name: "Uber Eats",
    description: "Food ordering, restaurant browsing, and delivery tracking",
    url: "https://www.ubereats.com",
    createdBy: seedUsers.uberDev1.id,
  },
  // OpenAI projects
  openaiChatGPT: {
    id: "prj_seed_openai_chatgpt",
    orgId: seedOrgs.openai.id,
    name: "ChatGPT Web",
    description: "ChatGPT web application - conversational AI interface and chat experience",
    url: "https://chat.openai.com",
    createdBy: seedUsers.openaiOwner.id,
  },
  openaiWebsite: {
    id: "prj_seed_openai_website",
    orgId: seedOrgs.openai.id,
    name: "OpenAI Website",
    description: "Corporate website, blog, and marketing pages",
    url: "https://openai.com",
    createdBy: seedUsers.openaiCTO.id,
  },
  openaiPlayground: {
    id: "prj_seed_openai_playground",
    orgId: seedOrgs.openai.id,
    name: "Developer Console",
    description: "API playground, key management, and developer tools",
    url: "https://platform.openai.com",
    createdBy: seedUsers.openaiPresident.id,
  },
  openaiAnalytics: {
    id: "prj_seed_openai_analytics",
    orgId: seedOrgs.openai.id,
    name: "Internal Product Analytics",
    description: "Internal dashboards for usage metrics and product insights",
    url: "https://analytics.openai.internal",
    createdBy: seedUsers.openaiDev1.id,
  },
  openaiCodex: {
    id: "prj_seed_openai_codex",
    orgId: seedOrgs.openai.id,
    name: "Codex Web",
    description: "AI-powered code generation and completion interface",
    url: "https://codex.openai.com",
    createdBy: seedUsers.openaiDev2.id,
  },
} as const;

// ============================================================================
// Seed Data Definitions - Project Members
// ============================================================================

export const seedProjectMembers = {
  // Amazon Storefront members
  amazonStorefrontOwner: {
    id: "pm_seed_amazon_storefront_owner",
    projectId: seedProjects.amazonStorefront.id,
    orgMemberId: seedOrgMembers.amazonOwner.id,
    role: "owner",
    createdBy: seedUsers.amazonOwner.id,
  },
  amazonStorefrontDev1: {
    id: "pm_seed_amazon_storefront_dev1",
    projectId: seedProjects.amazonStorefront.id,
    orgMemberId: seedOrgMembers.amazonDev1.id,
    role: "admin",
    createdBy: seedUsers.amazonOwner.id,
  },
  amazonStorefrontDev2: {
    id: "pm_seed_amazon_storefront_dev2",
    projectId: seedProjects.amazonStorefront.id,
    orgMemberId: seedOrgMembers.amazonDev2.id,
    role: "editor",
    createdBy: seedUsers.amazonOwner.id,
  },
  // Amazon Checkout members
  amazonCheckoutOwner: {
    id: "pm_seed_amazon_checkout_owner",
    projectId: seedProjects.amazonCheckout.id,
    orgMemberId: seedOrgMembers.amazonOwner.id,
    role: "owner",
    createdBy: seedUsers.amazonOwner.id,
  },
  amazonCheckoutDev1: {
    id: "pm_seed_amazon_checkout_dev1",
    projectId: seedProjects.amazonCheckout.id,
    orgMemberId: seedOrgMembers.amazonDev1.id,
    role: "admin",
    createdBy: seedUsers.amazonOwner.id,
  },
  // Amazon Seller members
  amazonSellerOwner: {
    id: "pm_seed_amazon_seller_owner",
    projectId: seedProjects.amazonSeller.id,
    orgMemberId: seedOrgMembers.amazonDev1.id,
    role: "owner",
    createdBy: seedUsers.amazonDev1.id,
  },
  // Stripe Dashboard members
  stripeDashboardOwner: {
    id: "pm_seed_stripe_dashboard_owner",
    projectId: seedProjects.stripeDashboard.id,
    orgMemberId: seedOrgMembers.stripeOwner.id,
    role: "owner",
    createdBy: seedUsers.stripeOwner.id,
  },
  stripeDashboardDev1: {
    id: "pm_seed_stripe_dashboard_dev1",
    projectId: seedProjects.stripeDashboard.id,
    orgMemberId: seedOrgMembers.stripeDev1.id,
    role: "admin",
    createdBy: seedUsers.stripeOwner.id,
  },
  // Stripe Checkout members
  stripeCheckoutOwner: {
    id: "pm_seed_stripe_checkout_owner",
    projectId: seedProjects.stripeCheckout.id,
    orgMemberId: seedOrgMembers.stripeOwner.id,
    role: "owner",
    createdBy: seedUsers.stripeOwner.id,
  },
  // Stripe Connect members
  stripeConnectOwner: {
    id: "pm_seed_stripe_connect_owner",
    projectId: seedProjects.stripeConnect.id,
    orgMemberId: seedOrgMembers.stripeDev1.id,
    role: "owner",
    createdBy: seedUsers.stripeDev1.id,
  },
  // GitHub Repo members
  githubRepoOwner: {
    id: "pm_seed_github_repo_owner",
    projectId: seedProjects.githubRepo.id,
    orgMemberId: seedOrgMembers.githubOwner.id,
    role: "owner",
    createdBy: seedUsers.githubOwner.id,
  },
  githubRepoDev1: {
    id: "pm_seed_github_repo_dev1",
    projectId: seedProjects.githubRepo.id,
    orgMemberId: seedOrgMembers.githubDev1.id,
    role: "admin",
    createdBy: seedUsers.githubOwner.id,
  },
  // GitHub Copilot members
  githubCopilotOwner: {
    id: "pm_seed_github_copilot_owner",
    projectId: seedProjects.githubCopilot.id,
    orgMemberId: seedOrgMembers.githubOwner.id,
    role: "owner",
    createdBy: seedUsers.githubOwner.id,
  },
  // GitHub Actions members
  githubActionsOwner: {
    id: "pm_seed_github_actions_owner",
    projectId: seedProjects.githubActions.id,
    orgMemberId: seedOrgMembers.githubDev1.id,
    role: "owner",
    createdBy: seedUsers.githubDev1.id,
  },
  // Notion Workspace members
  notionWorkspaceOwner: {
    id: "pm_seed_notion_workspace_owner",
    projectId: seedProjects.notionWorkspace.id,
    orgMemberId: seedOrgMembers.notionOwner.id,
    role: "owner",
    createdBy: seedUsers.notionOwner.id,
  },
  notionWorkspaceDev1: {
    id: "pm_seed_notion_workspace_dev1",
    projectId: seedProjects.notionWorkspace.id,
    orgMemberId: seedOrgMembers.notionDev1.id,
    role: "admin",
    createdBy: seedUsers.notionOwner.id,
  },
  // Notion API members
  notionAPIOwner: {
    id: "pm_seed_notion_api_owner",
    projectId: seedProjects.notionAPI.id,
    orgMemberId: seedOrgMembers.notionDev1.id,
    role: "owner",
    createdBy: seedUsers.notionDev1.id,
  },
  // Uber Rider members
  uberRiderOwner: {
    id: "pm_seed_uber_rider_owner",
    projectId: seedProjects.uberRider.id,
    orgMemberId: seedOrgMembers.uberOwner.id,
    role: "owner",
    createdBy: seedUsers.uberOwner.id,
  },
  uberRiderDev1: {
    id: "pm_seed_uber_rider_dev1",
    projectId: seedProjects.uberRider.id,
    orgMemberId: seedOrgMembers.uberDev1.id,
    role: "admin",
    createdBy: seedUsers.uberOwner.id,
  },
  // Uber Driver members
  uberDriverOwner: {
    id: "pm_seed_uber_driver_owner",
    projectId: seedProjects.uberDriver.id,
    orgMemberId: seedOrgMembers.uberOwner.id,
    role: "owner",
    createdBy: seedUsers.uberOwner.id,
  },
  // Uber Eats members
  uberEatsOwner: {
    id: "pm_seed_uber_eats_owner",
    projectId: seedProjects.uberEats.id,
    orgMemberId: seedOrgMembers.uberDev1.id,
    role: "owner",
    createdBy: seedUsers.uberDev1.id,
  },
  // OpenAI ChatGPT members
  openaiChatGPTOwner: {
    id: "pm_seed_openai_chatgpt_owner",
    projectId: seedProjects.openaiChatGPT.id,
    orgMemberId: seedOrgMembers.openaiOwner.id,
    role: "owner",
    createdBy: seedUsers.openaiOwner.id,
  },
  openaiChatGPTCTO: {
    id: "pm_seed_openai_chatgpt_cto",
    projectId: seedProjects.openaiChatGPT.id,
    orgMemberId: seedOrgMembers.openaiCTO.id,
    role: "admin",
    createdBy: seedUsers.openaiOwner.id,
  },
  openaiChatGPTDev1: {
    id: "pm_seed_openai_chatgpt_dev1",
    projectId: seedProjects.openaiChatGPT.id,
    orgMemberId: seedOrgMembers.openaiDev1.id,
    role: "editor",
    createdBy: seedUsers.openaiOwner.id,
  },
  openaiChatGPTDev2: {
    id: "pm_seed_openai_chatgpt_dev2",
    projectId: seedProjects.openaiChatGPT.id,
    orgMemberId: seedOrgMembers.openaiDev2.id,
    role: "editor",
    createdBy: seedUsers.openaiOwner.id,
  },
  // OpenAI Website members
  openaiWebsiteOwner: {
    id: "pm_seed_openai_website_owner",
    projectId: seedProjects.openaiWebsite.id,
    orgMemberId: seedOrgMembers.openaiCTO.id,
    role: "owner",
    createdBy: seedUsers.openaiCTO.id,
  },
  openaiWebsiteDev1: {
    id: "pm_seed_openai_website_dev1",
    projectId: seedProjects.openaiWebsite.id,
    orgMemberId: seedOrgMembers.openaiDev1.id,
    role: "admin",
    createdBy: seedUsers.openaiCTO.id,
  },
  // OpenAI Developer Console members
  openaiPlaygroundOwner: {
    id: "pm_seed_openai_playground_owner",
    projectId: seedProjects.openaiPlayground.id,
    orgMemberId: seedOrgMembers.openaiPresident.id,
    role: "owner",
    createdBy: seedUsers.openaiPresident.id,
  },
  openaiPlaygroundCTO: {
    id: "pm_seed_openai_playground_cto",
    projectId: seedProjects.openaiPlayground.id,
    orgMemberId: seedOrgMembers.openaiCTO.id,
    role: "admin",
    createdBy: seedUsers.openaiPresident.id,
  },
  openaiPlaygroundDev2: {
    id: "pm_seed_openai_playground_dev2",
    projectId: seedProjects.openaiPlayground.id,
    orgMemberId: seedOrgMembers.openaiDev2.id,
    role: "editor",
    createdBy: seedUsers.openaiPresident.id,
  },
  // OpenAI Analytics members
  openaiAnalyticsOwner: {
    id: "pm_seed_openai_analytics_owner",
    projectId: seedProjects.openaiAnalytics.id,
    orgMemberId: seedOrgMembers.openaiDev1.id,
    role: "owner",
    createdBy: seedUsers.openaiDev1.id,
  },
  openaiAnalyticsDev2: {
    id: "pm_seed_openai_analytics_dev2",
    projectId: seedProjects.openaiAnalytics.id,
    orgMemberId: seedOrgMembers.openaiDev2.id,
    role: "admin",
    createdBy: seedUsers.openaiDev1.id,
  },
  // OpenAI Codex members
  openaiCodexOwner: {
    id: "pm_seed_openai_codex_owner",
    projectId: seedProjects.openaiCodex.id,
    orgMemberId: seedOrgMembers.openaiDev2.id,
    role: "owner",
    createdBy: seedUsers.openaiDev2.id,
  },
  openaiCodexDev1: {
    id: "pm_seed_openai_codex_dev1",
    projectId: seedProjects.openaiCodex.id,
    orgMemberId: seedOrgMembers.openaiDev1.id,
    role: "admin",
    createdBy: seedUsers.openaiDev2.id,
  },
} as const;

// ============================================================================
// Seed Data Definitions - Environments
// ============================================================================

export const seedEnvironments = {
  // Amazon Storefront environments
  amazonStorefrontDev: {
    id: "env_seed_amazon_storefront_dev",
    projectId: seedProjects.amazonStorefront.id,
    name: "Development",
    isDefault: false,
    config: { baseUrl: "http://localhost:3000", timeout: 30000 },
    createdBy: seedUsers.amazonOwner.id,
  },
  amazonStorefrontStaging: {
    id: "env_seed_amazon_storefront_staging",
    projectId: seedProjects.amazonStorefront.id,
    name: "Staging",
    isDefault: false,
    config: { baseUrl: "https://staging.amazon.com", timeout: 30000 },
    createdBy: seedUsers.amazonOwner.id,
  },
  amazonStorefrontProd: {
    id: "env_seed_amazon_storefront_prod",
    projectId: seedProjects.amazonStorefront.id,
    name: "Production",
    isDefault: true,
    config: { baseUrl: "https://www.amazon.com", timeout: 60000 },
    createdBy: seedUsers.amazonOwner.id,
  },
  // Stripe Dashboard environments
  stripeDashboardDev: {
    id: "env_seed_stripe_dashboard_dev",
    projectId: seedProjects.stripeDashboard.id,
    name: "Development",
    isDefault: false,
    config: { baseUrl: "http://localhost:3000", timeout: 30000 },
    createdBy: seedUsers.stripeOwner.id,
  },
  stripeDashboardProd: {
    id: "env_seed_stripe_dashboard_prod",
    projectId: seedProjects.stripeDashboard.id,
    name: "Production",
    isDefault: true,
    config: { baseUrl: "https://dashboard.stripe.com", timeout: 60000 },
    createdBy: seedUsers.stripeOwner.id,
  },
  // GitHub Repo environments
  githubRepoDev: {
    id: "env_seed_github_repo_dev",
    projectId: seedProjects.githubRepo.id,
    name: "Development",
    isDefault: false,
    config: { baseUrl: "http://localhost:3000", timeout: 30000 },
    createdBy: seedUsers.githubOwner.id,
  },
  githubRepoProd: {
    id: "env_seed_github_repo_prod",
    projectId: seedProjects.githubRepo.id,
    name: "Production",
    isDefault: true,
    config: { baseUrl: "https://github.com", timeout: 60000 },
    createdBy: seedUsers.githubOwner.id,
  },
  // OpenAI ChatGPT environments
  openaiChatGPTDev: {
    id: "env_seed_openai_chatgpt_dev",
    projectId: seedProjects.openaiChatGPT.id,
    name: "Development",
    isDefault: false,
    config: { baseUrl: "http://localhost:3000", timeout: 30000 },
    createdBy: seedUsers.openaiOwner.id,
  },
  openaiChatGPTStaging: {
    id: "env_seed_openai_chatgpt_staging",
    projectId: seedProjects.openaiChatGPT.id,
    name: "Staging",
    isDefault: false,
    config: { baseUrl: "https://staging.chat.openai.com", timeout: 45000 },
    createdBy: seedUsers.openaiOwner.id,
  },
  openaiChatGPTProd: {
    id: "env_seed_openai_chatgpt_prod",
    projectId: seedProjects.openaiChatGPT.id,
    name: "Production",
    isDefault: true,
    config: { baseUrl: "https://chat.openai.com", timeout: 60000 },
    createdBy: seedUsers.openaiOwner.id,
  },
  // OpenAI Website environments
  openaiWebsiteDev: {
    id: "env_seed_openai_website_dev",
    projectId: seedProjects.openaiWebsite.id,
    name: "Development",
    isDefault: false,
    config: { baseUrl: "http://localhost:3001", timeout: 30000 },
    createdBy: seedUsers.openaiCTO.id,
  },
  openaiWebsiteProd: {
    id: "env_seed_openai_website_prod",
    projectId: seedProjects.openaiWebsite.id,
    name: "Production",
    isDefault: true,
    config: { baseUrl: "https://openai.com", timeout: 45000 },
    createdBy: seedUsers.openaiCTO.id,
  },
  // OpenAI Developer Console environments
  openaiPlaygroundDev: {
    id: "env_seed_openai_playground_dev",
    projectId: seedProjects.openaiPlayground.id,
    name: "Development",
    isDefault: false,
    config: { baseUrl: "http://localhost:3002", timeout: 30000 },
    createdBy: seedUsers.openaiPresident.id,
  },
  openaiPlaygroundProd: {
    id: "env_seed_openai_playground_prod",
    projectId: seedProjects.openaiPlayground.id,
    name: "Production",
    isDefault: true,
    config: { baseUrl: "https://platform.openai.com", timeout: 60000 },
    createdBy: seedUsers.openaiPresident.id,
  },
  // OpenAI Analytics environments
  openaiAnalyticsDev: {
    id: "env_seed_openai_analytics_dev",
    projectId: seedProjects.openaiAnalytics.id,
    name: "Development",
    isDefault: false,
    config: { baseUrl: "http://localhost:3003", timeout: 30000 },
    createdBy: seedUsers.openaiDev1.id,
  },
  openaiAnalyticsProd: {
    id: "env_seed_openai_analytics_prod",
    projectId: seedProjects.openaiAnalytics.id,
    name: "Production",
    isDefault: true,
    config: { baseUrl: "https://analytics.openai.internal", timeout: 45000 },
    createdBy: seedUsers.openaiDev1.id,
  },
  // OpenAI Codex environments
  openaiCodexDev: {
    id: "env_seed_openai_codex_dev",
    projectId: seedProjects.openaiCodex.id,
    name: "Development",
    isDefault: false,
    config: { baseUrl: "http://localhost:3004", timeout: 30000 },
    createdBy: seedUsers.openaiDev2.id,
  },
  openaiCodexProd: {
    id: "env_seed_openai_codex_prod",
    projectId: seedProjects.openaiCodex.id,
    name: "Production",
    isDefault: true,
    config: { baseUrl: "https://codex.openai.com", timeout: 60000 },
    createdBy: seedUsers.openaiDev2.id,
  },
} as const;

// ============================================================================
// Seed Data Definitions - Test Suites
// ============================================================================

export const seedSuites = {
  // Amazon Storefront suites
  amazonSearch: {
    id: "ste_seed_amazon_search",
    projectId: seedProjects.amazonStorefront.id,
    parentSuiteId: null,
    name: "Search & Browse",
    description: "Product search, filtering, and browsing tests",
    sortOrder: 1,
    createdBy: seedUsers.amazonDev1.id,
  },
  amazonCart: {
    id: "ste_seed_amazon_cart",
    projectId: seedProjects.amazonStorefront.id,
    parentSuiteId: null,
    name: "Shopping Cart",
    description: "Add to cart, update quantity, and cart management",
    sortOrder: 2,
    createdBy: seedUsers.amazonDev1.id,
  },
  amazonAuth: {
    id: "ste_seed_amazon_auth",
    projectId: seedProjects.amazonStorefront.id,
    parentSuiteId: null,
    name: "User Authentication",
    description: "Login, logout, and session management",
    sortOrder: 3,
    createdBy: seedUsers.amazonDev1.id,
  },
  amazonProductDetails: {
    id: "ste_seed_amazon_product",
    projectId: seedProjects.amazonStorefront.id,
    parentSuiteId: null,
    name: "Product Details",
    description: "Product pages, reviews, and recommendations",
    sortOrder: 4,
    createdBy: seedUsers.amazonDev2.id,
  },
  // Amazon Storefront - additional suites
  amazonWishlist: {
    id: "ste_seed_amazon_wishlist",
    projectId: seedProjects.amazonStorefront.id,
    parentSuiteId: null,
    name: "Wishlist",
    description: "Wishlist creation, sharing, and item management",
    sortOrder: 5,
    createdBy: seedUsers.amazonDev2.id,
  },
  amazonAccount: {
    id: "ste_seed_amazon_account",
    projectId: seedProjects.amazonStorefront.id,
    parentSuiteId: null,
    name: "Account Management",
    description: "Profile, addresses, and payment methods",
    sortOrder: 6,
    createdBy: seedUsers.amazonDev1.id,
  },
  amazonOrders: {
    id: "ste_seed_amazon_orders",
    projectId: seedProjects.amazonStorefront.id,
    parentSuiteId: null,
    name: "Order History",
    description: "Order tracking, returns, and reordering",
    sortOrder: 7,
    createdBy: seedUsers.amazonDev1.id,
  },
  amazonRecommendations: {
    id: "ste_seed_amazon_recommendations",
    projectId: seedProjects.amazonStorefront.id,
    parentSuiteId: null,
    name: "Recommendations",
    description: "Personalized product recommendations and browsing history",
    sortOrder: 8,
    createdBy: seedUsers.amazonDev2.id,
  },
  // Nested suites under Search & Browse
  amazonSearchFilters: {
    id: "ste_seed_amazon_search_filters",
    projectId: seedProjects.amazonStorefront.id,
    parentSuiteId: "ste_seed_amazon_search",
    name: "Advanced Filters",
    description: "Price range, ratings, Prime eligibility filters",
    sortOrder: 1,
    createdBy: seedUsers.amazonDev1.id,
  },
  amazonSearchSorting: {
    id: "ste_seed_amazon_search_sorting",
    projectId: seedProjects.amazonStorefront.id,
    parentSuiteId: "ste_seed_amazon_search",
    name: "Sorting Options",
    description: "Sort by price, rating, relevance, newest",
    sortOrder: 2,
    createdBy: seedUsers.amazonDev1.id,
  },
  // Nested suites under Shopping Cart
  amazonCartPromos: {
    id: "ste_seed_amazon_cart_promos",
    projectId: seedProjects.amazonStorefront.id,
    parentSuiteId: "ste_seed_amazon_cart",
    name: "Promotions & Coupons",
    description: "Apply coupons, promo codes, and deals",
    sortOrder: 1,
    createdBy: seedUsers.amazonDev2.id,
  },
  // Amazon Checkout suites
  amazonCheckoutFlow: {
    id: "ste_seed_amazon_checkout_flow",
    projectId: seedProjects.amazonCheckout.id,
    parentSuiteId: null,
    name: "Checkout Flow",
    description: "End-to-end checkout process tests",
    sortOrder: 1,
    createdBy: seedUsers.amazonDev1.id,
  },
  amazonPayment: {
    id: "ste_seed_amazon_payment",
    projectId: seedProjects.amazonCheckout.id,
    parentSuiteId: null,
    name: "Payment Processing",
    description: "Credit card, gift card, and payment method tests",
    sortOrder: 2,
    createdBy: seedUsers.amazonDev1.id,
  },
  // Stripe Dashboard suites
  stripeSubscriptions: {
    id: "ste_seed_stripe_subscriptions",
    projectId: seedProjects.stripeDashboard.id,
    parentSuiteId: null,
    name: "Subscriptions",
    description: "Subscription creation, updates, and cancellation",
    sortOrder: 1,
    createdBy: seedUsers.stripeDev1.id,
  },
  stripeInvoices: {
    id: "ste_seed_stripe_invoices",
    projectId: seedProjects.stripeDashboard.id,
    parentSuiteId: null,
    name: "Invoices",
    description: "Invoice generation, payment, and history",
    sortOrder: 2,
    createdBy: seedUsers.stripeDev1.id,
  },
  stripeCustomers: {
    id: "ste_seed_stripe_customers",
    projectId: seedProjects.stripeDashboard.id,
    parentSuiteId: null,
    name: "Customer Management",
    description: "Customer CRUD operations and search",
    sortOrder: 3,
    createdBy: seedUsers.stripeDev2.id,
  },
  // GitHub Repo suites
  githubPullRequests: {
    id: "ste_seed_github_prs",
    projectId: seedProjects.githubRepo.id,
    parentSuiteId: null,
    name: "Pull Requests",
    description: "PR creation, review, and merge workflows",
    sortOrder: 1,
    createdBy: seedUsers.githubDev1.id,
  },
  githubCodeReview: {
    id: "ste_seed_github_review",
    projectId: seedProjects.githubRepo.id,
    parentSuiteId: null,
    name: "Code Review",
    description: "Comment, approve, and request changes",
    sortOrder: 2,
    createdBy: seedUsers.githubDev1.id,
  },
  githubIssues: {
    id: "ste_seed_github_issues",
    projectId: seedProjects.githubRepo.id,
    parentSuiteId: null,
    name: "Issues",
    description: "Issue creation, labeling, and assignment",
    sortOrder: 3,
    createdBy: seedUsers.githubOwner.id,
  },
  // Notion Workspace suites
  notionDocuments: {
    id: "ste_seed_notion_docs",
    projectId: seedProjects.notionWorkspace.id,
    parentSuiteId: null,
    name: "Documents",
    description: "Page creation, editing, and formatting",
    sortOrder: 1,
    createdBy: seedUsers.notionDev1.id,
  },
  notionDatabases: {
    id: "ste_seed_notion_databases",
    projectId: seedProjects.notionWorkspace.id,
    parentSuiteId: null,
    name: "Databases",
    description: "Database views, filters, and properties",
    sortOrder: 2,
    createdBy: seedUsers.notionDev1.id,
  },
  // Uber Rider suites
  uberBooking: {
    id: "ste_seed_uber_booking",
    projectId: seedProjects.uberRider.id,
    parentSuiteId: null,
    name: "Ride Booking",
    description: "Request ride, select vehicle, and confirm pickup",
    sortOrder: 1,
    createdBy: seedUsers.uberDev1.id,
  },
  uberTracking: {
    id: "ste_seed_uber_tracking",
    projectId: seedProjects.uberRider.id,
    parentSuiteId: null,
    name: "Ride Tracking",
    description: "Driver location, ETA, and trip progress",
    sortOrder: 2,
    createdBy: seedUsers.uberDev1.id,
  },
  // OpenAI ChatGPT suites
  openaiChat: {
    id: "ste_seed_openai_chat",
    projectId: seedProjects.openaiChatGPT.id,
    parentSuiteId: null,
    name: "Chat Interface",
    description: "Message input, streaming responses, and response formatting",
    sortOrder: 1,
    createdBy: seedUsers.openaiOwner.id,
  },
  openaiConversation: {
    id: "ste_seed_openai_conversation",
    projectId: seedProjects.openaiChatGPT.id,
    parentSuiteId: null,
    name: "Conversations",
    description: "New chat, rename, delete, and history management",
    sortOrder: 2,
    createdBy: seedUsers.openaiOwner.id,
  },
  openaiPlugins: {
    id: "ste_seed_openai_plugins",
    projectId: seedProjects.openaiChatGPT.id,
    parentSuiteId: null,
    name: "Plugins & Tools",
    description: "Code interpreter, DALL-E, browsing, and custom GPTs",
    sortOrder: 3,
    createdBy: seedUsers.openaiCTO.id,
  },
  openaiAuth: {
    id: "ste_seed_openai_auth",
    projectId: seedProjects.openaiChatGPT.id,
    parentSuiteId: null,
    name: "Authentication",
    description: "Login, signup, SSO, and session management",
    sortOrder: 4,
    createdBy: seedUsers.openaiDev1.id,
  },
  openaiSettings: {
    id: "ste_seed_openai_settings",
    projectId: seedProjects.openaiChatGPT.id,
    parentSuiteId: null,
    name: "User Settings",
    description: "Preferences, theme, model selection, and data controls",
    sortOrder: 5,
    createdBy: seedUsers.openaiDev1.id,
  },
  // OpenAI Website suites
  openaiWebsiteHome: {
    id: "ste_seed_openai_website_home",
    projectId: seedProjects.openaiWebsite.id,
    parentSuiteId: null,
    name: "Homepage",
    description: "Hero section, product showcase, and navigation",
    sortOrder: 1,
    createdBy: seedUsers.openaiCTO.id,
  },
  openaiWebsiteBlog: {
    id: "ste_seed_openai_website_blog",
    projectId: seedProjects.openaiWebsite.id,
    parentSuiteId: null,
    name: "Blog & Research",
    description: "Blog posts, research papers, and announcements",
    sortOrder: 2,
    createdBy: seedUsers.openaiDev1.id,
  },
  openaiWebsiteCareers: {
    id: "ste_seed_openai_website_careers",
    projectId: seedProjects.openaiWebsite.id,
    parentSuiteId: null,
    name: "Careers",
    description: "Job listings, application forms, and team pages",
    sortOrder: 3,
    createdBy: seedUsers.openaiDev1.id,
  },
  // OpenAI Developer Console suites
  openaiPlaygroundAPI: {
    id: "ste_seed_openai_playground_api",
    projectId: seedProjects.openaiPlayground.id,
    parentSuiteId: null,
    name: "API Playground",
    description: "Prompt testing, parameter tuning, and response preview",
    sortOrder: 1,
    createdBy: seedUsers.openaiPresident.id,
  },
  openaiPlaygroundKeys: {
    id: "ste_seed_openai_playground_keys",
    projectId: seedProjects.openaiPlayground.id,
    parentSuiteId: null,
    name: "API Keys",
    description: "Key generation, revocation, and usage tracking",
    sortOrder: 2,
    createdBy: seedUsers.openaiDev2.id,
  },
  openaiPlaygroundBilling: {
    id: "ste_seed_openai_playground_billing",
    projectId: seedProjects.openaiPlayground.id,
    parentSuiteId: null,
    name: "Billing",
    description: "Usage dashboard, invoices, and payment methods",
    sortOrder: 3,
    createdBy: seedUsers.openaiDev2.id,
  },
  // OpenAI Analytics suites
  openaiAnalyticsDashboard: {
    id: "ste_seed_openai_analytics_dashboard",
    projectId: seedProjects.openaiAnalytics.id,
    parentSuiteId: null,
    name: "Dashboard",
    description: "Key metrics, charts, and real-time data",
    sortOrder: 1,
    createdBy: seedUsers.openaiDev1.id,
  },
  openaiAnalyticsReports: {
    id: "ste_seed_openai_analytics_reports",
    projectId: seedProjects.openaiAnalytics.id,
    parentSuiteId: null,
    name: "Reports",
    description: "Scheduled reports, exports, and custom queries",
    sortOrder: 2,
    createdBy: seedUsers.openaiDev2.id,
  },
  // OpenAI Codex suites
  openaiCodexEditor: {
    id: "ste_seed_openai_codex_editor",
    projectId: seedProjects.openaiCodex.id,
    parentSuiteId: null,
    name: "Code Editor",
    description: "Code input, syntax highlighting, and AI completions",
    sortOrder: 1,
    createdBy: seedUsers.openaiDev2.id,
  },
  openaiCodexLanguages: {
    id: "ste_seed_openai_codex_languages",
    projectId: seedProjects.openaiCodex.id,
    parentSuiteId: null,
    name: "Language Support",
    description: "Multi-language code generation and translation",
    sortOrder: 2,
    createdBy: seedUsers.openaiDev1.id,
  },
} as const;

// ============================================================================
// Seed Data Definitions - Tests
// ============================================================================

export const seedTests = {
  // Amazon Search tests
  searchProducts: {
    id: "tst_seed_search_products",
    projectId: seedProjects.amazonStorefront.id,
    suiteId: seedSuites.amazonSearch.id,
    kind: "test",
    name: "Search products by keyword",
    description: "Verifies product search returns relevant results",
    createdBy: seedUsers.amazonDev1.id,
  },
  filterByCategory: {
    id: "tst_seed_filter_category",
    projectId: seedProjects.amazonStorefront.id,
    suiteId: seedSuites.amazonSearch.id,
    kind: "test",
    name: "Filter results by category",
    description: "Applies category filter and verifies filtered results",
    createdBy: seedUsers.amazonDev1.id,
  },
  filterByPrice: {
    id: "tst_seed_filter_price",
    projectId: seedProjects.amazonStorefront.id,
    suiteId: seedSuites.amazonSearch.id,
    kind: "test",
    name: "Filter results by price range",
    description: "Sets price range and validates filtered products",
    createdBy: seedUsers.amazonDev1.id,
  },
  sortByRating: {
    id: "tst_seed_sort_rating",
    projectId: seedProjects.amazonStorefront.id,
    suiteId: seedSuites.amazonSearch.id,
    kind: "test",
    name: "Sort results by customer rating",
    description: "Sorts by rating and verifies order",
    createdBy: seedUsers.amazonDev2.id,
  },
  // Amazon Cart tests
  addToCart: {
    id: "tst_seed_add_to_cart",
    projectId: seedProjects.amazonStorefront.id,
    suiteId: seedSuites.amazonCart.id,
    kind: "test",
    name: "Add product to cart",
    description: "Adds item to cart and verifies cart count increases",
    createdBy: seedUsers.amazonDev1.id,
  },
  updateCartQuantity: {
    id: "tst_seed_update_quantity",
    projectId: seedProjects.amazonStorefront.id,
    suiteId: seedSuites.amazonCart.id,
    kind: "test",
    name: "Update cart item quantity",
    description: "Changes quantity and verifies subtotal updates",
    createdBy: seedUsers.amazonDev1.id,
  },
  removeFromCart: {
    id: "tst_seed_remove_from_cart",
    projectId: seedProjects.amazonStorefront.id,
    suiteId: seedSuites.amazonCart.id,
    kind: "test",
    name: "Remove item from cart",
    description: "Deletes item and verifies removal from cart",
    createdBy: seedUsers.amazonDev2.id,
  },
  saveForLater: {
    id: "tst_seed_save_for_later",
    projectId: seedProjects.amazonStorefront.id,
    suiteId: seedSuites.amazonCart.id,
    kind: "test",
    name: "Save item for later",
    description: "Moves item to saved list and verifies",
    createdBy: seedUsers.amazonDev2.id,
  },
  // Amazon Auth tests
  userLogin: {
    id: "tst_seed_user_login",
    projectId: seedProjects.amazonStorefront.id,
    suiteId: seedSuites.amazonAuth.id,
    kind: "test",
    name: "User can login with valid credentials",
    description: "Verifies successful login flow with email and password",
    createdBy: seedUsers.amazonDev1.id,
  },
  userLogout: {
    id: "tst_seed_user_logout",
    projectId: seedProjects.amazonStorefront.id,
    suiteId: seedSuites.amazonAuth.id,
    kind: "test",
    name: "User can logout successfully",
    description: "Verifies session is cleared on logout",
    createdBy: seedUsers.amazonDev1.id,
  },
  loginInvalid: {
    id: "tst_seed_login_invalid",
    projectId: seedProjects.amazonStorefront.id,
    suiteId: seedSuites.amazonAuth.id,
    kind: "test",
    name: "Login fails with invalid credentials",
    description: "Verifies error message for incorrect password",
    createdBy: seedUsers.amazonDev1.id,
  },
  // Amazon Product Details tests
  viewProductDetails: {
    id: "tst_seed_view_product",
    projectId: seedProjects.amazonStorefront.id,
    suiteId: seedSuites.amazonProductDetails.id,
    kind: "test",
    name: "View product details page",
    description: "Opens product and verifies title, price, and images",
    createdBy: seedUsers.amazonDev2.id,
  },
  viewProductReviews: {
    id: "tst_seed_view_reviews",
    projectId: seedProjects.amazonStorefront.id,
    suiteId: seedSuites.amazonProductDetails.id,
    kind: "test",
    name: "View product reviews",
    description: "Scrolls to reviews section and loads more reviews",
    createdBy: seedUsers.amazonDev2.id,
  },
  // Amazon Checkout tests
  startCheckout: {
    id: "tst_seed_start_checkout",
    projectId: seedProjects.amazonCheckout.id,
    suiteId: seedSuites.amazonCheckoutFlow.id,
    kind: "test",
    name: "Initiate checkout from cart",
    description: "Clicks checkout button and reaches address page",
    createdBy: seedUsers.amazonDev1.id,
  },
  enterShippingAddress: {
    id: "tst_seed_shipping_address",
    projectId: seedProjects.amazonCheckout.id,
    suiteId: seedSuites.amazonCheckoutFlow.id,
    kind: "test",
    name: "Enter shipping address",
    description: "Fills address form and proceeds to payment",
    createdBy: seedUsers.amazonDev1.id,
  },
  completeOrder: {
    id: "tst_seed_complete_order",
    projectId: seedProjects.amazonCheckout.id,
    suiteId: seedSuites.amazonCheckoutFlow.id,
    kind: "test",
    name: "Complete order placement",
    description: "Confirms order and verifies confirmation page",
    createdBy: seedUsers.amazonDev1.id,
  },
  // Amazon Payment tests
  addCreditCard: {
    id: "tst_seed_add_credit_card",
    projectId: seedProjects.amazonCheckout.id,
    suiteId: seedSuites.amazonPayment.id,
    kind: "test",
    name: "Add credit card payment method",
    description: "Enters card details and saves payment method",
    createdBy: seedUsers.amazonDev1.id,
  },
  applyGiftCard: {
    id: "tst_seed_apply_gift_card",
    projectId: seedProjects.amazonCheckout.id,
    suiteId: seedSuites.amazonPayment.id,
    kind: "test",
    name: "Apply gift card to order",
    description: "Enters gift card code and verifies balance applied",
    createdBy: seedUsers.amazonDev1.id,
  },
  // Stripe Subscription tests
  createSubscription: {
    id: "tst_seed_create_subscription",
    projectId: seedProjects.stripeDashboard.id,
    suiteId: seedSuites.stripeSubscriptions.id,
    kind: "test",
    name: "Create new subscription",
    description: "Creates subscription and verifies in dashboard",
    createdBy: seedUsers.stripeDev1.id,
  },
  cancelSubscription: {
    id: "tst_seed_cancel_subscription",
    projectId: seedProjects.stripeDashboard.id,
    suiteId: seedSuites.stripeSubscriptions.id,
    kind: "test",
    name: "Cancel subscription",
    description: "Cancels subscription and verifies status update",
    createdBy: seedUsers.stripeDev1.id,
  },
  upgradeSubscription: {
    id: "tst_seed_upgrade_subscription",
    projectId: seedProjects.stripeDashboard.id,
    suiteId: seedSuites.stripeSubscriptions.id,
    kind: "test",
    name: "Upgrade subscription plan",
    description: "Changes plan tier and verifies prorated amount",
    createdBy: seedUsers.stripeDev1.id,
  },
  // Stripe Invoice tests
  createInvoice: {
    id: "tst_seed_create_invoice",
    projectId: seedProjects.stripeDashboard.id,
    suiteId: seedSuites.stripeInvoices.id,
    kind: "test",
    name: "Create manual invoice",
    description: "Creates invoice with line items",
    createdBy: seedUsers.stripeDev1.id,
  },
  sendInvoice: {
    id: "tst_seed_send_invoice",
    projectId: seedProjects.stripeDashboard.id,
    suiteId: seedSuites.stripeInvoices.id,
    kind: "test",
    name: "Send invoice to customer",
    description: "Sends invoice email and verifies status",
    createdBy: seedUsers.stripeDev2.id,
  },
  // Stripe Customer tests
  createCustomer: {
    id: "tst_seed_create_customer",
    projectId: seedProjects.stripeDashboard.id,
    suiteId: seedSuites.stripeCustomers.id,
    kind: "test",
    name: "Create new customer",
    description: "Creates customer with email and metadata",
    createdBy: seedUsers.stripeDev2.id,
  },
  searchCustomers: {
    id: "tst_seed_search_customers",
    projectId: seedProjects.stripeDashboard.id,
    suiteId: seedSuites.stripeCustomers.id,
    kind: "test",
    name: "Search customers by email",
    description: "Searches and verifies matching results",
    createdBy: seedUsers.stripeDev2.id,
  },
  // GitHub Pull Request tests
  createPullRequest: {
    id: "tst_seed_create_pr",
    projectId: seedProjects.githubRepo.id,
    suiteId: seedSuites.githubPullRequests.id,
    kind: "test",
    name: "Create pull request",
    description: "Opens PR from feature branch to main",
    createdBy: seedUsers.githubDev1.id,
  },
  mergePullRequest: {
    id: "tst_seed_merge_pr",
    projectId: seedProjects.githubRepo.id,
    suiteId: seedSuites.githubPullRequests.id,
    kind: "test",
    name: "Merge pull request",
    description: "Approves and merges PR with squash",
    createdBy: seedUsers.githubDev1.id,
  },
  closePullRequest: {
    id: "tst_seed_close_pr",
    projectId: seedProjects.githubRepo.id,
    suiteId: seedSuites.githubPullRequests.id,
    kind: "test",
    name: "Close pull request without merge",
    description: "Closes PR and adds comment",
    createdBy: seedUsers.githubOwner.id,
  },
  // GitHub Code Review tests
  addReviewComment: {
    id: "tst_seed_add_review_comment",
    projectId: seedProjects.githubRepo.id,
    suiteId: seedSuites.githubCodeReview.id,
    kind: "test",
    name: "Add inline review comment",
    description: "Comments on specific line of code",
    createdBy: seedUsers.githubDev1.id,
  },
  approvePR: {
    id: "tst_seed_approve_pr",
    projectId: seedProjects.githubRepo.id,
    suiteId: seedSuites.githubCodeReview.id,
    kind: "test",
    name: "Approve pull request",
    description: "Submits approval review",
    createdBy: seedUsers.githubDev1.id,
  },
  requestChanges: {
    id: "tst_seed_request_changes",
    projectId: seedProjects.githubRepo.id,
    suiteId: seedSuites.githubCodeReview.id,
    kind: "test",
    name: "Request changes on PR",
    description: "Submits review requesting changes",
    createdBy: seedUsers.githubOwner.id,
  },
  // GitHub Issues tests
  createIssue: {
    id: "tst_seed_create_issue",
    projectId: seedProjects.githubRepo.id,
    suiteId: seedSuites.githubIssues.id,
    kind: "test",
    name: "Create new issue",
    description: "Opens issue with title and description",
    createdBy: seedUsers.githubOwner.id,
  },
  assignIssue: {
    id: "tst_seed_assign_issue",
    projectId: seedProjects.githubRepo.id,
    suiteId: seedSuites.githubIssues.id,
    kind: "test",
    name: "Assign issue to user",
    description: "Assigns issue and adds labels",
    createdBy: seedUsers.githubDev1.id,
  },
  // Notion Document tests
  createPage: {
    id: "tst_seed_create_page",
    projectId: seedProjects.notionWorkspace.id,
    suiteId: seedSuites.notionDocuments.id,
    kind: "test",
    name: "Create new page",
    description: "Creates page with title and content blocks",
    createdBy: seedUsers.notionDev1.id,
  },
  addHeadingBlock: {
    id: "tst_seed_add_heading",
    projectId: seedProjects.notionWorkspace.id,
    suiteId: seedSuites.notionDocuments.id,
    kind: "test",
    name: "Add heading block",
    description: "Inserts H1, H2, H3 headings",
    createdBy: seedUsers.notionDev1.id,
  },
  addCodeBlock: {
    id: "tst_seed_add_code",
    projectId: seedProjects.notionWorkspace.id,
    suiteId: seedSuites.notionDocuments.id,
    kind: "test",
    name: "Add code block",
    description: "Inserts code block with syntax highlighting",
    createdBy: seedUsers.notionDev1.id,
  },
  // Notion Database tests
  createDatabase: {
    id: "tst_seed_create_database",
    projectId: seedProjects.notionWorkspace.id,
    suiteId: seedSuites.notionDatabases.id,
    kind: "test",
    name: "Create database",
    description: "Creates database with properties",
    createdBy: seedUsers.notionDev1.id,
  },
  addDatabaseView: {
    id: "tst_seed_add_view",
    projectId: seedProjects.notionWorkspace.id,
    suiteId: seedSuites.notionDatabases.id,
    kind: "test",
    name: "Add database view",
    description: "Creates table, board, and calendar views",
    createdBy: seedUsers.notionOwner.id,
  },
  filterDatabase: {
    id: "tst_seed_filter_database",
    projectId: seedProjects.notionWorkspace.id,
    suiteId: seedSuites.notionDatabases.id,
    kind: "test",
    name: "Filter database entries",
    description: "Applies filters and verifies results",
    createdBy: seedUsers.notionDev1.id,
  },
  // Uber Booking tests
  requestRide: {
    id: "tst_seed_request_ride",
    projectId: seedProjects.uberRider.id,
    suiteId: seedSuites.uberBooking.id,
    kind: "test",
    name: "Request a ride",
    description: "Enters destination and requests UberX",
    createdBy: seedUsers.uberDev1.id,
  },
  selectVehicleType: {
    id: "tst_seed_select_vehicle",
    projectId: seedProjects.uberRider.id,
    suiteId: seedSuites.uberBooking.id,
    kind: "test",
    name: "Select vehicle type",
    description: "Compares prices and selects vehicle",
    createdBy: seedUsers.uberDev1.id,
  },
  scheduleRide: {
    id: "tst_seed_schedule_ride",
    projectId: seedProjects.uberRider.id,
    suiteId: seedSuites.uberBooking.id,
    kind: "test",
    name: "Schedule ride for later",
    description: "Sets future pickup time",
    createdBy: seedUsers.uberOwner.id,
  },
  // Uber Tracking tests
  trackDriver: {
    id: "tst_seed_track_driver",
    projectId: seedProjects.uberRider.id,
    suiteId: seedSuites.uberTracking.id,
    kind: "test",
    name: "Track driver location",
    description: "Views real-time driver position on map",
    createdBy: seedUsers.uberDev1.id,
  },
  viewETA: {
    id: "tst_seed_view_eta",
    projectId: seedProjects.uberRider.id,
    suiteId: seedSuites.uberTracking.id,
    kind: "test",
    name: "View arrival ETA",
    description: "Checks estimated time of arrival",
    createdBy: seedUsers.uberDev1.id,
  },
  // OpenAI ChatGPT - Chat Interface tests
  sendMessage: {
    id: "tst_seed_send_message",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiChat.id,
    kind: "test",
    name: "Send message and receive streaming response",
    description: "Types a prompt and verifies streaming response appears",
    createdBy: seedUsers.openaiOwner.id,
  },
  regenerateResponse: {
    id: "tst_seed_regenerate",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiChat.id,
    kind: "test",
    name: "Regenerate response",
    description: "Clicks regenerate button and gets new response",
    createdBy: seedUsers.openaiOwner.id,
  },
  copyResponse: {
    id: "tst_seed_copy_response",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiChat.id,
    kind: "test",
    name: "Copy response to clipboard",
    description: "Copies assistant message text to clipboard",
    createdBy: seedUsers.openaiCTO.id,
  },
  stopGeneration: {
    id: "tst_seed_stop_generation",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiChat.id,
    kind: "test",
    name: "Stop response generation",
    description: "Stops streaming response mid-generation",
    createdBy: seedUsers.openaiDev1.id,
  },
  editPreviousMessage: {
    id: "tst_seed_edit_message",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiChat.id,
    kind: "test",
    name: "Edit previous user message",
    description: "Edits a previous message and regenerates response",
    createdBy: seedUsers.openaiDev1.id,
  },
  codeBlockFormatting: {
    id: "tst_seed_code_block",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiChat.id,
    kind: "test",
    name: "Code block renders with syntax highlighting",
    description: "Verifies code blocks display with proper formatting and copy button",
    createdBy: seedUsers.openaiDev2.id,
  },
  markdownRendering: {
    id: "tst_seed_markdown",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiChat.id,
    kind: "test",
    name: "Markdown renders correctly",
    description: "Verifies headings, lists, links render properly in responses",
    createdBy: seedUsers.openaiDev2.id,
  },
  // OpenAI ChatGPT - Conversation tests
  startNewChat: {
    id: "tst_seed_start_new_chat",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiConversation.id,
    kind: "test",
    name: "Start new conversation",
    description: "Creates new conversation from sidebar button",
    createdBy: seedUsers.openaiOwner.id,
  },
  renameConversation: {
    id: "tst_seed_rename_conversation",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiConversation.id,
    kind: "test",
    name: "Rename conversation",
    description: "Edits conversation title via sidebar menu",
    createdBy: seedUsers.openaiOwner.id,
  },
  deleteConversation: {
    id: "tst_seed_delete_conversation",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiConversation.id,
    kind: "test",
    name: "Delete conversation",
    description: "Deletes chat and confirms removal from sidebar",
    createdBy: seedUsers.openaiOwner.id,
  },
  searchConversations: {
    id: "tst_seed_search_conversations",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiConversation.id,
    kind: "test",
    name: "Search conversation history",
    description: "Searches for a conversation by keyword and opens it",
    createdBy: seedUsers.openaiCTO.id,
  },
  shareConversation: {
    id: "tst_seed_share_conversation",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiConversation.id,
    kind: "test",
    name: "Share conversation link",
    description: "Generates and copies shareable conversation link",
    createdBy: seedUsers.openaiDev1.id,
  },
  // OpenAI ChatGPT - Plugins tests
  enableCodeInterpreter: {
    id: "tst_seed_code_interpreter",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiPlugins.id,
    kind: "test",
    name: "Enable Code Interpreter",
    description: "Activates Code Interpreter and runs Python code",
    createdBy: seedUsers.openaiCTO.id,
  },
  dalleImageGeneration: {
    id: "tst_seed_dalle",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiPlugins.id,
    kind: "test",
    name: "Generate image with DALL-E",
    description: "Requests image generation and verifies image appears",
    createdBy: seedUsers.openaiCTO.id,
  },
  browsingPlugin: {
    id: "tst_seed_browsing",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiPlugins.id,
    kind: "test",
    name: "Browse web with browsing plugin",
    description: "Enables browsing and fetches current web content",
    createdBy: seedUsers.openaiDev1.id,
  },
  customGPTSelection: {
    id: "tst_seed_custom_gpt",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiPlugins.id,
    kind: "draft",
    name: "Select and use custom GPT",
    description: "Browses GPT store and starts conversation with custom GPT",
    createdBy: seedUsers.openaiDev2.id,
  },
  // OpenAI ChatGPT - Authentication tests
  loginWithEmail: {
    id: "tst_seed_login_email",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiAuth.id,
    kind: "test",
    name: "Login with email and password",
    description: "Signs in with email credentials and reaches chat",
    createdBy: seedUsers.openaiDev1.id,
  },
  loginWithGoogle: {
    id: "tst_seed_login_google",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiAuth.id,
    kind: "test",
    name: "Login with Google SSO",
    description: "Signs in via Google OAuth and reaches chat",
    createdBy: seedUsers.openaiDev1.id,
  },
  openaiLogout: {
    id: "tst_seed_openai_logout",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiAuth.id,
    kind: "test",
    name: "Logout and clear session",
    description: "Logs out and verifies redirect to login page",
    createdBy: seedUsers.openaiDev2.id,
  },
  // OpenAI ChatGPT - Settings tests
  changeModelSelection: {
    id: "tst_seed_model_select",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiSettings.id,
    kind: "test",
    name: "Change model selection",
    description: "Switches between GPT-4 and GPT-3.5 models",
    createdBy: seedUsers.openaiDev1.id,
  },
  toggleDarkMode: {
    id: "tst_seed_dark_mode",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiSettings.id,
    kind: "test",
    name: "Toggle dark mode",
    description: "Switches theme and verifies UI updates",
    createdBy: seedUsers.openaiDev2.id,
  },
  exportChatData: {
    id: "tst_seed_export_data",
    projectId: seedProjects.openaiChatGPT.id,
    suiteId: seedSuites.openaiSettings.id,
    kind: "test",
    name: "Export chat data",
    description: "Requests data export and verifies download link",
    createdBy: seedUsers.openaiDev2.id,
  },
  // OpenAI Website tests
  websiteHomepageLoad: {
    id: "tst_seed_website_home",
    projectId: seedProjects.openaiWebsite.id,
    suiteId: seedSuites.openaiWebsiteHome.id,
    kind: "test",
    name: "Homepage loads correctly",
    description: "Verifies hero section, navigation, and key elements",
    createdBy: seedUsers.openaiCTO.id,
  },
  websiteProductNav: {
    id: "tst_seed_website_products",
    projectId: seedProjects.openaiWebsite.id,
    suiteId: seedSuites.openaiWebsiteHome.id,
    kind: "test",
    name: "Navigate to product pages",
    description: "Clicks product links and verifies page content",
    createdBy: seedUsers.openaiDev1.id,
  },
  websiteBlogList: {
    id: "tst_seed_website_blog",
    projectId: seedProjects.openaiWebsite.id,
    suiteId: seedSuites.openaiWebsiteBlog.id,
    kind: "test",
    name: "View blog post list",
    description: "Loads blog page and verifies posts display",
    createdBy: seedUsers.openaiDev1.id,
  },
  websiteCareersList: {
    id: "tst_seed_website_careers",
    projectId: seedProjects.openaiWebsite.id,
    suiteId: seedSuites.openaiWebsiteCareers.id,
    kind: "test",
    name: "View job listings",
    description: "Loads careers page and filters by department",
    createdBy: seedUsers.openaiDev1.id,
  },
  // OpenAI Developer Console tests
  playgroundPromptTest: {
    id: "tst_seed_playground_prompt",
    projectId: seedProjects.openaiPlayground.id,
    suiteId: seedSuites.openaiPlaygroundAPI.id,
    kind: "test",
    name: "Test prompt in playground",
    description: "Enters prompt, adjusts parameters, and submits",
    createdBy: seedUsers.openaiPresident.id,
  },
  playgroundModelSwitch: {
    id: "tst_seed_playground_model",
    projectId: seedProjects.openaiPlayground.id,
    suiteId: seedSuites.openaiPlaygroundAPI.id,
    kind: "test",
    name: "Switch models in playground",
    description: "Changes model and verifies parameter updates",
    createdBy: seedUsers.openaiDev2.id,
  },
  createAPIKey: {
    id: "tst_seed_create_api_key",
    projectId: seedProjects.openaiPlayground.id,
    suiteId: seedSuites.openaiPlaygroundKeys.id,
    kind: "test",
    name: "Create new API key",
    description: "Generates new API key and copies it",
    createdBy: seedUsers.openaiDev2.id,
  },
  revokeAPIKey: {
    id: "tst_seed_revoke_api_key",
    projectId: seedProjects.openaiPlayground.id,
    suiteId: seedSuites.openaiPlaygroundKeys.id,
    kind: "test",
    name: "Revoke API key",
    description: "Deletes an API key and confirms removal",
    createdBy: seedUsers.openaiDev2.id,
  },
  viewUsageDashboard: {
    id: "tst_seed_usage_dashboard",
    projectId: seedProjects.openaiPlayground.id,
    suiteId: seedSuites.openaiPlaygroundBilling.id,
    kind: "test",
    name: "View usage dashboard",
    description: "Loads billing page and verifies usage charts",
    createdBy: seedUsers.openaiDev2.id,
  },
  // OpenAI Analytics tests
  dashboardMetricsLoad: {
    id: "tst_seed_analytics_metrics",
    projectId: seedProjects.openaiAnalytics.id,
    suiteId: seedSuites.openaiAnalyticsDashboard.id,
    kind: "test",
    name: "Dashboard metrics load",
    description: "Verifies KPI cards and charts render with data",
    createdBy: seedUsers.openaiDev1.id,
  },
  dashboardDateRange: {
    id: "tst_seed_analytics_date",
    projectId: seedProjects.openaiAnalytics.id,
    suiteId: seedSuites.openaiAnalyticsDashboard.id,
    kind: "test",
    name: "Change date range filter",
    description: "Selects custom date range and verifies data updates",
    createdBy: seedUsers.openaiDev2.id,
  },
  exportAnalyticsReport: {
    id: "tst_seed_analytics_export",
    projectId: seedProjects.openaiAnalytics.id,
    suiteId: seedSuites.openaiAnalyticsReports.id,
    kind: "test",
    name: "Export analytics report",
    description: "Generates and downloads CSV report",
    createdBy: seedUsers.openaiDev2.id,
  },
  // OpenAI Codex tests
  codexCodeCompletion: {
    id: "tst_seed_codex_completion",
    projectId: seedProjects.openaiCodex.id,
    suiteId: seedSuites.openaiCodexEditor.id,
    kind: "test",
    name: "Code completion suggestion",
    description: "Types code and verifies AI completion appears",
    createdBy: seedUsers.openaiDev2.id,
  },
  codexLanguageSwitch: {
    id: "tst_seed_codex_lang",
    projectId: seedProjects.openaiCodex.id,
    suiteId: seedSuites.openaiCodexLanguages.id,
    kind: "test",
    name: "Switch programming language",
    description: "Changes language and verifies syntax highlighting updates",
    createdBy: seedUsers.openaiDev1.id,
  },
  codexCodeExplain: {
    id: "tst_seed_codex_explain",
    projectId: seedProjects.openaiCodex.id,
    suiteId: seedSuites.openaiCodexEditor.id,
    kind: "test",
    name: "Explain code selection",
    description: "Selects code and requests AI explanation",
    createdBy: seedUsers.openaiDev1.id,
  },
  // Integration tests - used by runner integration tests
  integrationPassing: {
    id: "tst_seed_integration_passing",
    projectId: seedProjects.amazonStorefront.id,
    suiteId: null,
    kind: "test",
    name: "Integration Passing Test",
    description: "E2E test with 2 passing assertions",
    createdBy: seedUsers.amazonOwner.id,
  },
  integrationFailing: {
    id: "tst_seed_integration_failing",
    projectId: seedProjects.amazonStorefront.id,
    suiteId: null,
    kind: "test",
    name: "Integration Failing Test",
    description: "E2E test with 1 pass, 1 fail",
    createdBy: seedUsers.amazonOwner.id,
  },
} as const;

// ============================================================================
// Seed Data Definitions - Test Versions
// ============================================================================

// Note: Not using `as const` here because steps array must be mutable for Drizzle
export const seedTestVersions = {
  searchProductsV1: {
    id: "tv_seed_search_products_v1",
    testId: seedTests.searchProducts.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=search-input]",
        },
        {
          type: "input",
          action: "fill",
          selector: "[data-testid=search-input]",
          value: "wireless headphones",
        },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=search-submit]",
        },
        {
          type: "wait",
          action: "waitForSelector",
          selector: "[data-testid=search-results]",
        },
        {
          type: "assertion",
          action: "expect",
          selector: "[data-testid=result-item]",
          value: "toHaveCount.greaterThan(0)",
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.amazonDev1.id,
  },
  addToCartV1: {
    id: "tv_seed_add_to_cart_v1",
    testId: seedTests.addToCart.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        {
          type: "navigate",
          action: "goto",
          value: "/products/wireless-headphones",
        },
        {
          type: "wait",
          action: "waitForSelector",
          selector: "[data-testid=product-title]",
        },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=add-to-cart-button]",
        },
        {
          type: "wait",
          action: "waitForSelector",
          selector: "[data-testid=cart-notification]",
        },
        {
          type: "assertion",
          action: "expect",
          selector: "[data-testid=cart-count]",
          value: "toHaveText('1')",
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.amazonDev1.id,
  },
  userLoginV1: {
    id: "tv_seed_user_login_v1",
    testId: seedTests.userLogin.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/login" },
        {
          type: "input",
          action: "fill",
          selector: "[name=email]",
          value: "test@example.com",
        },
        {
          type: "input",
          action: "fill",
          selector: "[name=password]",
          value: "password123",
        },
        { type: "action", action: "click", selector: "[type=submit]" },
        { type: "wait", action: "waitForNavigation", value: "/dashboard" },
        {
          type: "assertion",
          action: "expect",
          selector: "h1",
          value: "toHaveText('Welcome')",
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.amazonDev1.id,
  },
  createSubscriptionV1: {
    id: "tv_seed_create_subscription_v1",
    testId: seedTests.createSubscription.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/subscriptions/new" },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=select-customer]",
        },
        {
          type: "input",
          action: "fill",
          selector: "[data-testid=customer-search]",
          value: "john@example.com",
        },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=customer-option]",
        },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=select-plan]",
        },
        { type: "action", action: "click", selector: "[data-testid=plan-pro]" },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=create-subscription-btn]",
        },
        {
          type: "wait",
          action: "waitForSelector",
          selector: "[data-testid=subscription-success]",
        },
        {
          type: "assertion",
          action: "expect",
          selector: "[data-testid=subscription-status]",
          value: "toHaveText('Active')",
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.stripeDev1.id,
  },
  createPRV1: {
    id: "tv_seed_create_pr_v1",
    testId: seedTests.createPullRequest.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        {
          type: "navigate",
          action: "goto",
          value: "/repo/compare/main...feature-branch",
        },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=create-pr-button]",
        },
        {
          type: "input",
          action: "fill",
          selector: "[name=pr-title]",
          value: "Add new feature",
        },
        {
          type: "input",
          action: "fill",
          selector: "[name=pr-body]",
          value: "This PR adds...",
        },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=submit-pr]",
        },
        {
          type: "wait",
          action: "waitForSelector",
          selector: "[data-testid=pr-number]",
        },
        {
          type: "assertion",
          action: "expect",
          selector: "[data-testid=pr-status]",
          value: "toHaveText('Open')",
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.githubDev1.id,
  },
  sendMessageV1: {
    id: "tv_seed_send_message_v1",
    testId: seedTests.sendMessage.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        {
          type: "wait",
          action: "waitForSelector",
          selector: "[data-testid=prompt-input]",
        },
        {
          type: "input",
          action: "fill",
          selector: "[data-testid=prompt-input]",
          value: "Hello, how are you?",
        },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=send-button]",
        },
        {
          type: "wait",
          action: "waitForSelector",
          selector: "[data-testid=assistant-message]",
        },
        {
          type: "assertion",
          action: "expect",
          selector: "[data-testid=assistant-message]",
          value: "toBeVisible()",
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiOwner.id,
  },
  requestRideV1: {
    id: "tv_seed_request_ride_v1",
    testId: seedTests.requestRide.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        {
          type: "input",
          action: "fill",
          selector: "[data-testid=destination-input]",
          value: "123 Main Street",
        },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=destination-suggestion]",
        },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=vehicle-uberx]",
        },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=request-ride-btn]",
        },
        {
          type: "wait",
          action: "waitForSelector",
          selector: "[data-testid=driver-matching]",
        },
        {
          type: "assertion",
          action: "expect",
          selector: "[data-testid=ride-status]",
          value: "toHaveText('Looking for driver')",
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.uberDev1.id,
  },
  createPageV1: {
    id: "tv_seed_create_page_v1",
    testId: seedTests.createPage.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/workspace" },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=new-page-btn]",
        },
        {
          type: "input",
          action: "fill",
          selector: "[data-testid=page-title]",
          value: "Meeting Notes",
        },
        { type: "action", action: "click", selector: "[contenteditable=true]" },
        {
          type: "input",
          action: "type",
          selector: "[contenteditable=true]",
          value: "Agenda for today's meeting",
        },
        {
          type: "assertion",
          action: "expect",
          selector: "[data-testid=page-title]",
          value: "toHaveText('Meeting Notes')",
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.notionDev1.id,
  },
  // Amazon Storefront - additional test versions (making all tests "published")
  filterByCategoryV1: {
    id: "tv_seed_filter_category_v1",
    testId: seedTests.filterByCategory.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/search?q=headphones" },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=category-filter]",
        },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=category-electronics]",
        },
        {
          type: "wait",
          action: "waitForSelector",
          selector: "[data-testid=search-results]",
        },
        {
          type: "assertion",
          action: "expect",
          selector: "[data-testid=active-filter]",
          value: "toContainText('Electronics')",
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.amazonDev1.id,
  },
  filterByPriceV1: {
    id: "tv_seed_filter_price_v1",
    testId: seedTests.filterByPrice.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/search?q=laptop" },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=price-filter]",
        },
        {
          type: "input",
          action: "fill",
          selector: "[data-testid=price-min]",
          value: "500",
        },
        {
          type: "input",
          action: "fill",
          selector: "[data-testid=price-max]",
          value: "1000",
        },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=apply-price-filter]",
        },
        {
          type: "assertion",
          action: "expect",
          selector: "[data-testid=price-range-label]",
          value: "toContainText('$500 - $1000')",
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.amazonDev1.id,
  },
  sortByRatingV1: {
    id: "tv_seed_sort_rating_v1",
    testId: seedTests.sortByRating.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/search?q=keyboard" },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=sort-dropdown]",
        },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=sort-by-rating]",
        },
        {
          type: "wait",
          action: "waitForSelector",
          selector: "[data-testid=search-results]",
        },
        {
          type: "assertion",
          action: "expect",
          selector:
            "[data-testid=result-item]:first-child [data-testid=rating]",
          value: "toHaveAttribute('data-stars', '5')",
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.amazonDev2.id,
  },
  updateCartQuantityV1: {
    id: "tv_seed_update_quantity_v1",
    testId: seedTests.updateCartQuantity.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/cart" },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=quantity-select]",
        },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=quantity-3]",
        },
        {
          type: "wait",
          action: "waitForSelector",
          selector: "[data-testid=cart-updated]",
        },
        {
          type: "assertion",
          action: "expect",
          selector: "[data-testid=item-subtotal]",
          value: "toContainText('3 x')",
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.amazonDev1.id,
  },
  removeFromCartV1: {
    id: "tv_seed_remove_from_cart_v1",
    testId: seedTests.removeFromCart.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/cart" },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=remove-item-btn]",
        },
        {
          type: "wait",
          action: "waitForSelector",
          selector: "[data-testid=item-removed]",
        },
        {
          type: "assertion",
          action: "expect",
          selector: "[data-testid=cart-items]",
          value: "not.toContainText('Wireless Headphones')",
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.amazonDev2.id,
  },
  saveForLaterV1: {
    id: "tv_seed_save_for_later_v1",
    testId: seedTests.saveForLater.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/cart" },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=save-for-later-btn]",
        },
        {
          type: "wait",
          action: "waitForSelector",
          selector: "[data-testid=saved-items]",
        },
        {
          type: "assertion",
          action: "expect",
          selector: "[data-testid=saved-items]",
          value: "toContainText('Wireless Headphones')",
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.amazonDev2.id,
  },
  userLogoutV1: {
    id: "tv_seed_user_logout_v1",
    testId: seedTests.userLogout.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/account" },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=user-menu]",
        },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=logout-btn]",
        },
        { type: "wait", action: "waitForNavigation", value: "/" },
        {
          type: "assertion",
          action: "expect",
          selector: "[data-testid=login-btn]",
          value: "toBeVisible()",
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.amazonDev1.id,
  },
  loginInvalidV1: {
    id: "tv_seed_login_invalid_v1",
    testId: seedTests.loginInvalid.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/login" },
        {
          type: "input",
          action: "fill",
          selector: "[name=email]",
          value: "test@example.com",
        },
        {
          type: "input",
          action: "fill",
          selector: "[name=password]",
          value: "wrongpassword",
        },
        { type: "action", action: "click", selector: "[type=submit]" },
        {
          type: "wait",
          action: "waitForSelector",
          selector: "[data-testid=error-message]",
        },
        {
          type: "assertion",
          action: "expect",
          selector: "[data-testid=error-message]",
          value: "toContainText('Invalid credentials')",
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.amazonDev1.id,
  },
  viewProductDetailsV1: {
    id: "tv_seed_view_product_v1",
    testId: seedTests.viewProductDetails.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        {
          type: "navigate",
          action: "goto",
          value: "/products/wireless-headphones",
        },
        {
          type: "wait",
          action: "waitForSelector",
          selector: "[data-testid=product-page]",
        },
        {
          type: "assertion",
          action: "expect",
          selector: "[data-testid=product-title]",
          value: "toBeVisible()",
        },
        {
          type: "assertion",
          action: "expect",
          selector: "[data-testid=product-price]",
          value: "toBeVisible()",
        },
        {
          type: "assertion",
          action: "expect",
          selector: "[data-testid=product-images]",
          value: "toBeVisible()",
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.amazonDev2.id,
  },
  viewProductReviewsV1: {
    id: "tv_seed_view_reviews_v1",
    testId: seedTests.viewProductReviews.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        {
          type: "navigate",
          action: "goto",
          value: "/products/wireless-headphones",
        },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=reviews-tab]",
        },
        {
          type: "wait",
          action: "waitForSelector",
          selector: "[data-testid=reviews-section]",
        },
        {
          type: "action",
          action: "click",
          selector: "[data-testid=load-more-reviews]",
        },
        {
          type: "assertion",
          action: "expect",
          selector: "[data-testid=review-item]",
          value: "toHaveCount.greaterThan(5)",
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.amazonDev2.id,
  },
  // Integration test versions - use TestCaseStep format for StepExecutor
  integrationPassingV1: {
    id: "tv_seed_integration_passing_v1",
    testId: seedTests.integrationPassing.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial integration test",
    steps: {
      steps: [
        {
          id: "goto-example",
          type: "goto",
          method: "goto",
          description: "Navigate to example.com",
          commandDetails: { url: "https://example.com", timeout: 30000 },
        },
        {
          id: "verify-heading",
          type: "assert",
          method: "toContainText",
          description: "Verify heading shows Example Domain",
          commandDetails: { selector: "h1", selectorType: "css", value: "Example Domain" },
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.amazonOwner.id,
  },
  integrationFailingV1: {
    id: "tv_seed_integration_failing_v1",
    testId: seedTests.integrationFailing.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Failing test version",
    steps: {
      steps: [
        {
          id: "goto-example",
          type: "goto",
          method: "goto",
          description: "Navigate to example.com",
          commandDetails: { url: "https://example.com", timeout: 30000 },
        },
        {
          id: "verify-heading-pass",
          type: "assert",
          method: "toContainText",
          description: "Verify heading shows Example Domain (passes)",
          commandDetails: { selector: "h1", selectorType: "css", value: "Example Domain" },
        },
        {
          id: "verify-nonexistent",
          type: "assert",
          method: "toContainText",
          description: "Verify wrong text (fails)",
          commandDetails: { selector: "h1", selectorType: "css", value: "This Title Does Not Exist" },
        },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.amazonOwner.id,
  },
  // OpenAI ChatGPT Chat test versions
  copyResponseV1: {
    id: "tv_seed_copy_response_v1",
    testId: seedTests.copyResponse.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        { type: "wait", action: "waitForSelector", selector: "[data-testid=assistant-message]" },
        { type: "action", action: "click", selector: "[data-testid=copy-button]" },
        { type: "assertion", action: "expect", selector: "[data-testid=copied-toast]", value: "toBeVisible()" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiCTO.id,
  },
  regenerateResponseV1: {
    id: "tv_seed_regenerate_v1",
    testId: seedTests.regenerateResponse.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        { type: "wait", action: "waitForSelector", selector: "[data-testid=assistant-message]" },
        { type: "action", action: "click", selector: "[data-testid=regenerate-button]" },
        { type: "wait", action: "waitForSelector", selector: "[data-testid=loading-indicator]" },
        { type: "assertion", action: "expect", selector: "[data-testid=assistant-message]", value: "toBeVisible()" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiOwner.id,
  },
  stopGenerationV1: {
    id: "tv_seed_stop_generation_v1",
    testId: seedTests.stopGeneration.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        { type: "input", action: "fill", selector: "[data-testid=prompt-input]", value: "Write a long story" },
        { type: "action", action: "click", selector: "[data-testid=send-button]" },
        { type: "wait", action: "waitForSelector", selector: "[data-testid=stop-button]" },
        { type: "action", action: "click", selector: "[data-testid=stop-button]" },
        { type: "assertion", action: "expect", selector: "[data-testid=send-button]", value: "toBeVisible()" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiDev1.id,
  },
  editPreviousMessageV1: {
    id: "tv_seed_edit_message_v1",
    testId: seedTests.editPreviousMessage.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        { type: "wait", action: "waitForSelector", selector: "[data-testid=user-message]" },
        { type: "action", action: "click", selector: "[data-testid=edit-message-button]" },
        { type: "input", action: "fill", selector: "[data-testid=edit-textarea]", value: "Updated message" },
        { type: "action", action: "click", selector: "[data-testid=save-edit-button]" },
        { type: "assertion", action: "expect", selector: "[data-testid=assistant-message]", value: "toBeVisible()" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiDev1.id,
  },
  codeBlockFormattingV1: {
    id: "tv_seed_code_block_v1",
    testId: seedTests.codeBlockFormatting.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        { type: "input", action: "fill", selector: "[data-testid=prompt-input]", value: "Show me Python code for hello world" },
        { type: "action", action: "click", selector: "[data-testid=send-button]" },
        { type: "wait", action: "waitForSelector", selector: "[data-testid=code-block]" },
        { type: "assertion", action: "expect", selector: "[data-testid=code-copy-button]", value: "toBeVisible()" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiDev2.id,
  },
  markdownRenderingV1: {
    id: "tv_seed_markdown_v1",
    testId: seedTests.markdownRendering.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        { type: "input", action: "fill", selector: "[data-testid=prompt-input]", value: "Create a list with headers" },
        { type: "action", action: "click", selector: "[data-testid=send-button]" },
        { type: "wait", action: "waitForSelector", selector: "[data-testid=assistant-message] h2" },
        { type: "assertion", action: "expect", selector: "[data-testid=assistant-message] ul", value: "toBeVisible()" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiDev2.id,
  },
  // OpenAI ChatGPT Conversation test versions
  startNewChatV1: {
    id: "tv_seed_start_new_chat_v1",
    testId: seedTests.startNewChat.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        { type: "action", action: "click", selector: "[data-testid=new-chat-button]" },
        { type: "assertion", action: "expect", selector: "[data-testid=prompt-input]", value: "toBeEmpty()" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiOwner.id,
  },
  renameConversationV1: {
    id: "tv_seed_rename_conversation_v1",
    testId: seedTests.renameConversation.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        { type: "action", action: "click", selector: "[data-testid=conversation-menu]" },
        { type: "action", action: "click", selector: "[data-testid=rename-option]" },
        { type: "input", action: "fill", selector: "[data-testid=rename-input]", value: "New Name" },
        { type: "action", action: "click", selector: "[data-testid=save-rename]" },
        { type: "assertion", action: "expect", selector: "[data-testid=conversation-title]", value: "toContainText('New Name')" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiOwner.id,
  },
  deleteConversationV1: {
    id: "tv_seed_delete_conversation_v1",
    testId: seedTests.deleteConversation.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        { type: "action", action: "click", selector: "[data-testid=conversation-menu]" },
        { type: "action", action: "click", selector: "[data-testid=delete-option]" },
        { type: "action", action: "click", selector: "[data-testid=confirm-delete]" },
        { type: "assertion", action: "expect", selector: "[data-testid=deleted-toast]", value: "toBeVisible()" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiOwner.id,
  },
  searchConversationsV1: {
    id: "tv_seed_search_conversations_v1",
    testId: seedTests.searchConversations.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        { type: "action", action: "click", selector: "[data-testid=search-button]" },
        { type: "input", action: "fill", selector: "[data-testid=search-input]", value: "python" },
        { type: "wait", action: "waitForSelector", selector: "[data-testid=search-result]" },
        { type: "action", action: "click", selector: "[data-testid=search-result]" },
        { type: "assertion", action: "expect", selector: "[data-testid=conversation-content]", value: "toContainText('python')" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiCTO.id,
  },
  shareConversationV1: {
    id: "tv_seed_share_conversation_v1",
    testId: seedTests.shareConversation.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        { type: "action", action: "click", selector: "[data-testid=share-button]" },
        { type: "action", action: "click", selector: "[data-testid=copy-link]" },
        { type: "assertion", action: "expect", selector: "[data-testid=link-copied-toast]", value: "toBeVisible()" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiDev1.id,
  },
  // OpenAI ChatGPT Plugin test versions
  enableCodeInterpreterV1: {
    id: "tv_seed_code_interpreter_v1",
    testId: seedTests.enableCodeInterpreter.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        { type: "action", action: "click", selector: "[data-testid=model-selector]" },
        { type: "action", action: "click", selector: "[data-testid=gpt4-option]" },
        { type: "action", action: "click", selector: "[data-testid=code-interpreter-toggle]" },
        { type: "input", action: "fill", selector: "[data-testid=prompt-input]", value: "Calculate 2+2 using Python" },
        { type: "action", action: "click", selector: "[data-testid=send-button]" },
        { type: "wait", action: "waitForSelector", selector: "[data-testid=code-output]" },
        { type: "assertion", action: "expect", selector: "[data-testid=code-output]", value: "toContainText('4')" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiCTO.id,
  },
  dalleImageGenerationV1: {
    id: "tv_seed_dalle_v1",
    testId: seedTests.dalleImageGeneration.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        { type: "input", action: "fill", selector: "[data-testid=prompt-input]", value: "Generate an image of a sunset" },
        { type: "action", action: "click", selector: "[data-testid=send-button]" },
        { type: "wait", action: "waitForSelector", selector: "[data-testid=generated-image]", timeout: 60000 },
        { type: "assertion", action: "expect", selector: "[data-testid=generated-image]", value: "toBeVisible()" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiCTO.id,
  },
  browsingPluginV1: {
    id: "tv_seed_browsing_v1",
    testId: seedTests.browsingPlugin.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        { type: "action", action: "click", selector: "[data-testid=browse-toggle]" },
        { type: "input", action: "fill", selector: "[data-testid=prompt-input]", value: "What is the current weather in SF?" },
        { type: "action", action: "click", selector: "[data-testid=send-button]" },
        { type: "wait", action: "waitForSelector", selector: "[data-testid=browsing-indicator]" },
        { type: "assertion", action: "expect", selector: "[data-testid=assistant-message]", value: "toBeVisible()" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiDev1.id,
  },
  // OpenAI ChatGPT Auth test versions
  loginWithEmailV1: {
    id: "tv_seed_login_email_v1",
    testId: seedTests.loginWithEmail.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/login" },
        { type: "input", action: "fill", selector: "[name=email]", value: "test@openai.com" },
        { type: "action", action: "click", selector: "[data-testid=continue-button]" },
        { type: "input", action: "fill", selector: "[name=password]", value: "password123" },
        { type: "action", action: "click", selector: "[type=submit]" },
        { type: "wait", action: "waitForNavigation", value: "/" },
        { type: "assertion", action: "expect", selector: "[data-testid=prompt-input]", value: "toBeVisible()" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiDev1.id,
  },
  loginWithGoogleV1: {
    id: "tv_seed_login_google_v1",
    testId: seedTests.loginWithGoogle.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/login" },
        { type: "action", action: "click", selector: "[data-testid=google-login]" },
        { type: "wait", action: "waitForNavigation", value: "accounts.google.com" },
        { type: "input", action: "fill", selector: "[name=identifier]", value: "test@gmail.com" },
        { type: "action", action: "click", selector: "[data-testid=next]" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiDev1.id,
  },
  openaiLogoutV1: {
    id: "tv_seed_openai_logout_v1",
    testId: seedTests.openaiLogout.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        { type: "action", action: "click", selector: "[data-testid=user-menu]" },
        { type: "action", action: "click", selector: "[data-testid=logout-button]" },
        { type: "wait", action: "waitForNavigation", value: "/login" },
        { type: "assertion", action: "expect", selector: "[data-testid=login-form]", value: "toBeVisible()" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiDev2.id,
  },
  // OpenAI ChatGPT Settings test versions
  changeModelSelectionV1: {
    id: "tv_seed_model_select_v1",
    testId: seedTests.changeModelSelection.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/" },
        { type: "action", action: "click", selector: "[data-testid=model-selector]" },
        { type: "action", action: "click", selector: "[data-testid=gpt35-option]" },
        { type: "assertion", action: "expect", selector: "[data-testid=model-selector]", value: "toContainText('GPT-3.5')" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiDev1.id,
  },
  toggleDarkModeV1: {
    id: "tv_seed_dark_mode_v1",
    testId: seedTests.toggleDarkMode.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/settings" },
        { type: "action", action: "click", selector: "[data-testid=theme-toggle]" },
        { type: "assertion", action: "expect", selector: "html", value: "toHaveClass('dark')" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiDev2.id,
  },
  exportChatDataV1: {
    id: "tv_seed_export_data_v1",
    testId: seedTests.exportChatData.id,
    version: 1,
    basedOnVersionId: null,
    changelog: "Initial version",
    steps: {
      steps: [
        { type: "navigate", action: "goto", value: "/settings/data" },
        { type: "action", action: "click", selector: "[data-testid=export-button]" },
        { type: "wait", action: "waitForSelector", selector: "[data-testid=export-ready]" },
        { type: "assertion", action: "expect", selector: "[data-testid=download-link]", value: "toBeVisible()" },
      ],
    },
    snapshot: {},
    createdBy: seedUsers.openaiDev2.id,
  },
};

// ============================================================================
// Seed Data Definitions - Tags
// ============================================================================

export const seedTags = {
  // Amazon Storefront tags
  amazonSmoke: {
    id: "tag_seed_amazon_smoke",
    projectId: seedProjects.amazonStorefront.id,
    name: "smoke",
    color: "#10b981",
  },
  amazonRegression: {
    id: "tag_seed_amazon_regression",
    projectId: seedProjects.amazonStorefront.id,
    name: "regression",
    color: "#6366f1",
  },
  amazonCritical: {
    id: "tag_seed_amazon_critical",
    projectId: seedProjects.amazonStorefront.id,
    name: "critical",
    color: "#ef4444",
  },
  amazonFlaky: {
    id: "tag_seed_amazon_flaky",
    projectId: seedProjects.amazonStorefront.id,
    name: "flaky",
    color: "#f59e0b",
  },
  amazonUI: {
    id: "tag_seed_amazon_ui",
    projectId: seedProjects.amazonStorefront.id,
    name: "ui",
    color: "#8b5cf6",
  },
  // Stripe Dashboard tags
  stripeSmoke: {
    id: "tag_seed_stripe_smoke",
    projectId: seedProjects.stripeDashboard.id,
    name: "smoke",
    color: "#10b981",
  },
  stripeCritical: {
    id: "tag_seed_stripe_critical",
    projectId: seedProjects.stripeDashboard.id,
    name: "critical",
    color: "#ef4444",
  },
  stripeAPI: {
    id: "tag_seed_stripe_api",
    projectId: seedProjects.stripeDashboard.id,
    name: "api",
    color: "#3b82f6",
  },
  // GitHub Repo tags
  githubSmoke: {
    id: "tag_seed_github_smoke",
    projectId: seedProjects.githubRepo.id,
    name: "smoke",
    color: "#10b981",
  },
  githubCritical: {
    id: "tag_seed_github_critical",
    projectId: seedProjects.githubRepo.id,
    name: "critical",
    color: "#ef4444",
  },
  // OpenAI ChatGPT tags
  openaiSmoke: {
    id: "tag_seed_openai_smoke",
    projectId: seedProjects.openaiChatGPT.id,
    name: "smoke",
    color: "#10b981",
  },
  openaiStreaming: {
    id: "tag_seed_openai_streaming",
    projectId: seedProjects.openaiChatGPT.id,
    name: "streaming",
    color: "#06b6d4",
  },
} as const;

// ============================================================================
// Seed Data Definitions - Plans
// ============================================================================

export const seedPlans = {
  // Amazon Storefront plans
  amazonSmokeTest: {
    id: "pln_seed_amazon_smoke",
    projectId: seedProjects.amazonStorefront.id,
    name: "Smoke Tests",
    description: "Quick validation of critical paths",
    createdBy: seedUsers.amazonDev1.id,
  },
  amazonFullRegression: {
    id: "pln_seed_amazon_regression",
    projectId: seedProjects.amazonStorefront.id,
    name: "Full Regression",
    description: "Complete test suite for release validation",
    createdBy: seedUsers.amazonDev1.id,
  },
  // Stripe Dashboard plans
  stripeDailyHealth: {
    id: "pln_seed_stripe_daily",
    projectId: seedProjects.stripeDashboard.id,
    name: "Daily Health Check",
    description: "Critical path validation for daily runs",
    createdBy: seedUsers.stripeDev1.id,
  },
  // GitHub Repo plans
  githubPRValidation: {
    id: "pln_seed_github_pr",
    projectId: seedProjects.githubRepo.id,
    name: "PR Validation",
    description: "Tests to run on every pull request",
    createdBy: seedUsers.githubDev1.id,
  },
  // OpenAI ChatGPT plans
  openaiChatGPTSmoke: {
    id: "pln_seed_openai_smoke",
    projectId: seedProjects.openaiChatGPT.id,
    name: "Smoke Tests",
    description: "Core chat functionality validation",
    createdBy: seedUsers.openaiOwner.id,
  },
  openaiChatGPTRegression: {
    id: "pln_seed_openai_regression",
    projectId: seedProjects.openaiChatGPT.id,
    name: "Full Regression",
    description: "Complete test suite for ChatGPT release",
    createdBy: seedUsers.openaiCTO.id,
  },
} as const;

// ============================================================================
// Seed Data Definitions - Plan Items
// ============================================================================

export const seedPlanItems = {
  // Amazon Smoke Test plan items (critical tests for quick validation)
  smokePlanSearchProducts: {
    id: "pi_seed_smoke_search",
    planId: seedPlans.amazonSmokeTest.id,
    testId: seedTests.searchProducts.id,
    suiteId: null,
    sortOrder: 1,
  },
  smokePlanAddToCart: {
    id: "pi_seed_smoke_cart",
    planId: seedPlans.amazonSmokeTest.id,
    testId: seedTests.addToCart.id,
    suiteId: null,
    sortOrder: 2,
  },
  smokePlanUserLogin: {
    id: "pi_seed_smoke_login",
    planId: seedPlans.amazonSmokeTest.id,
    testId: seedTests.userLogin.id,
    suiteId: null,
    sortOrder: 3,
  },
  smokePlanViewProduct: {
    id: "pi_seed_smoke_view_product",
    planId: seedPlans.amazonSmokeTest.id,
    testId: seedTests.viewProductDetails.id,
    suiteId: null,
    sortOrder: 4,
  },

  // Amazon Full Regression plan items (includes entire suites)
  regressionPlanSearchSuite: {
    id: "pi_seed_regression_search_suite",
    planId: seedPlans.amazonFullRegression.id,
    testId: null,
    suiteId: seedSuites.amazonSearch.id,
    sortOrder: 1,
  },
  regressionPlanCartSuite: {
    id: "pi_seed_regression_cart_suite",
    planId: seedPlans.amazonFullRegression.id,
    testId: null,
    suiteId: seedSuites.amazonCart.id,
    sortOrder: 2,
  },
  regressionPlanAuthSuite: {
    id: "pi_seed_regression_auth_suite",
    planId: seedPlans.amazonFullRegression.id,
    testId: null,
    suiteId: seedSuites.amazonAuth.id,
    sortOrder: 3,
  },
  regressionPlanProductSuite: {
    id: "pi_seed_regression_product_suite",
    planId: seedPlans.amazonFullRegression.id,
    testId: null,
    suiteId: seedSuites.amazonProductDetails.id,
    sortOrder: 4,
  },
  regressionPlanWishlistSuite: {
    id: "pi_seed_regression_wishlist_suite",
    planId: seedPlans.amazonFullRegression.id,
    testId: null,
    suiteId: seedSuites.amazonWishlist.id,
    sortOrder: 5,
  },
  regressionPlanAccountSuite: {
    id: "pi_seed_regression_account_suite",
    planId: seedPlans.amazonFullRegression.id,
    testId: null,
    suiteId: seedSuites.amazonAccount.id,
    sortOrder: 6,
  },
  // OpenAI ChatGPT Smoke plan items
  openaiSmokeSendMessage: {
    id: "pi_seed_openai_smoke_send",
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: seedTests.sendMessage.id,
    suiteId: null,
    sortOrder: 1,
  },
  openaiSmokeRegenerate: {
    id: "pi_seed_openai_smoke_regen",
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: seedTests.regenerateResponse.id,
    suiteId: null,
    sortOrder: 2,
  },
  openaiSmokeNewChat: {
    id: "pi_seed_openai_smoke_newchat",
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: seedTests.startNewChat.id,
    suiteId: null,
    sortOrder: 3,
  },
  openaiSmokeLogin: {
    id: "pi_seed_openai_smoke_login",
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: seedTests.loginWithEmail.id,
    suiteId: null,
    sortOrder: 4,
  },
  // OpenAI ChatGPT Regression plan items (include entire suites)
  openaiRegressionChatSuite: {
    id: "pi_seed_openai_reg_chat",
    planId: seedPlans.openaiChatGPTRegression.id,
    testId: null,
    suiteId: seedSuites.openaiChat.id,
    sortOrder: 1,
  },
  openaiRegressionConversationSuite: {
    id: "pi_seed_openai_reg_conv",
    planId: seedPlans.openaiChatGPTRegression.id,
    testId: null,
    suiteId: seedSuites.openaiConversation.id,
    sortOrder: 2,
  },
  openaiRegressionPluginsSuite: {
    id: "pi_seed_openai_reg_plugins",
    planId: seedPlans.openaiChatGPTRegression.id,
    testId: null,
    suiteId: seedSuites.openaiPlugins.id,
    sortOrder: 3,
  },
  openaiRegressionAuthSuite: {
    id: "pi_seed_openai_reg_auth",
    planId: seedPlans.openaiChatGPTRegression.id,
    testId: null,
    suiteId: seedSuites.openaiAuth.id,
    sortOrder: 4,
  },
  openaiRegressionSettingsSuite: {
    id: "pi_seed_openai_reg_settings",
    planId: seedPlans.openaiChatGPTRegression.id,
    testId: null,
    suiteId: seedSuites.openaiSettings.id,
    sortOrder: 5,
  },
} as const;

// ============================================================================
// Seed Data Definitions - Schedules
// ============================================================================

export const seedSchedules = {
  // Amazon Storefront schedules
  amazonDailySmoke: {
    id: "sch_seed_amazon_daily_smoke",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonSmokeTest.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    name: "Daily Smoke Tests",
    cron: "0 9 * * *",
    timezone: "America/Los_Angeles",
    status: "enabled",
    jobScheduleId: null,
    metadata: { notifyOnFailure: true, retryCount: 2 },
    lastRunId: "run_seed_amazon_run1",
    lastRunAt: new Date("2024-12-20T09:00:00Z"),
    nextRunAt: new Date("2024-12-21T09:00:00Z"),
    createdBy: seedUsers.amazonDev1.id,
  },
  amazonWeeklyRegression: {
    id: "sch_seed_amazon_weekly_regression",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonFullRegression.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    name: "Weekly Full Regression",
    cron: "0 2 * * 0",
    timezone: "America/Los_Angeles",
    status: "enabled",
    jobScheduleId: null,
    metadata: { notifyOnFailure: true, notifyOnSuccess: true },
    lastRunId: null,
    lastRunAt: null,
    nextRunAt: new Date("2024-12-22T02:00:00Z"),
    createdBy: seedUsers.amazonOwner.id,
  },
  amazonStagingNightly: {
    id: "sch_seed_amazon_staging_nightly",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonSmokeTest.id,
    environmentId: seedEnvironments.amazonStorefrontStaging.id,
    name: "Staging Nightly Tests",
    cron: "0 0 * * *",
    timezone: "America/Los_Angeles",
    status: "enabled",
    jobScheduleId: null,
    metadata: { branch: "develop" },
    lastRunId: null,
    lastRunAt: null,
    nextRunAt: new Date("2024-12-21T00:00:00Z"),
    createdBy: seedUsers.amazonDev1.id,
  },
  amazonHourlyHealth: {
    id: "sch_seed_amazon_hourly_health",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonSmokeTest.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    name: "Hourly Health Check",
    cron: "0 * * * *",
    timezone: "UTC",
    status: "disabled",
    jobScheduleId: null,
    metadata: { criticalPathOnly: true },
    lastRunId: null,
    lastRunAt: null,
    nextRunAt: null,
    createdBy: seedUsers.amazonOwner.id,
  },
  // Stripe schedules
  stripeDailyHealth: {
    id: "sch_seed_stripe_daily_health",
    projectId: seedProjects.stripeDashboard.id,
    planId: seedPlans.stripeDailyHealth.id,
    environmentId: seedEnvironments.stripeDashboardProd.id,
    name: "Daily Health Check",
    cron: "0 6 * * *",
    timezone: "America/New_York",
    status: "enabled",
    jobScheduleId: null,
    metadata: { notifyOnFailure: true },
    lastRunId: "run_seed_stripe_run1",
    lastRunAt: new Date("2024-12-20T06:00:00Z"),
    nextRunAt: new Date("2024-12-21T06:00:00Z"),
    createdBy: seedUsers.stripeOwner.id,
  },
  // GitHub schedules
  githubPRNightly: {
    id: "sch_seed_github_pr_nightly",
    projectId: seedProjects.githubRepo.id,
    planId: seedPlans.githubPRValidation.id,
    environmentId: seedEnvironments.githubRepoProd.id,
    name: "Nightly PR Tests",
    cron: "0 3 * * *",
    timezone: "UTC",
    status: "enabled",
    jobScheduleId: null,
    metadata: { runOnOpenPRs: true },
    lastRunId: "run_seed_github_run1",
    lastRunAt: new Date("2024-12-20T03:00:00Z"),
    nextRunAt: new Date("2024-12-21T03:00:00Z"),
    createdBy: seedUsers.githubDev1.id,
  },
  // OpenAI ChatGPT schedules
  openaiDailySmoke: {
    id: "sch_seed_openai_daily_smoke",
    projectId: seedProjects.openaiChatGPT.id,
    planId: seedPlans.openaiChatGPTSmoke.id,
    environmentId: seedEnvironments.openaiChatGPTProd.id,
    name: "Daily Smoke Tests",
    cron: "0 9 * * *",
    timezone: "America/Los_Angeles",
    status: "enabled",
    jobScheduleId: null,
    metadata: { notifyOnFailure: true, slackChannel: "#chatgpt-alerts" },
    lastRunId: "run_seed_openai_daily_14",
    lastRunAt: new Date(),
    nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdBy: seedUsers.openaiOwner.id,
  },
  openaiWeeklyRegression: {
    id: "sch_seed_openai_weekly_regression",
    projectId: seedProjects.openaiChatGPT.id,
    planId: seedPlans.openaiChatGPTRegression.id,
    environmentId: seedEnvironments.openaiChatGPTProd.id,
    name: "Weekly Full Regression",
    cron: "0 2 * * 0",
    timezone: "America/Los_Angeles",
    status: "enabled",
    jobScheduleId: null,
    metadata: { notifyOnFailure: true, notifyOnSuccess: true },
    lastRunId: null,
    lastRunAt: null,
    nextRunAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdBy: seedUsers.openaiCTO.id,
  },
};

// ============================================================================
// Dynamic Date Helpers for OpenAI Runs
// ============================================================================

/**
 * Generate dates relative to today for realistic historical data.
 * Returns dates at 9 AM PST for the given days ago.
 */
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(9, 0, 0, 0);
  return date;
}

function daysAgoEnd(days: number, durationMinutes: number = 5): Date {
  const date = daysAgo(days);
  date.setMinutes(date.getMinutes() + durationMinutes);
  return date;
}

// ============================================================================
// Seed Data Definitions - Runs
// ============================================================================

export const seedRuns = {
  // Amazon Storefront runs - varied statuses
  amazonRun1: {
    id: "run_seed_amazon_run1",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonSmokeTest.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonDailySmoke.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2024-12-20T09:00:00Z"),
    finishedAt: new Date("2024-12-20T09:05:23Z"),
    dispatchedAt: new Date("2024-12-20T09:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 8, passed: 8, failed: 0, skipped: 0, duration: 323000 },
    metadata: { scheduleName: "Daily Smoke", branch: "main" },
  },
  amazonRun2: {
    id: "run_seed_amazon_run2",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonFullRegression.id,
    testId: null,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "manual",
    status: "failed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2024-12-19T14:00:00Z"),
    finishedAt: new Date("2024-12-19T14:12:45Z"),
    dispatchedAt: new Date("2024-12-19T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 15, passed: 13, failed: 2, skipped: 0, duration: 765000 },
    metadata: { branch: "main", commit: "abc123" },
  },
  amazonRun3: {
    id: "run_seed_amazon_run3",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.addToCart.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontStaging.id,
    trigger: "manual",
    status: "running",
    triggeredByUserId: seedUsers.amazonDev2.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date(),
    finishedAt: null,
    dispatchedAt: new Date(),
    config: { browser: "chromium", headless: false, timeout: 60000 },
    summary: { total: 1, passed: 0, failed: 0, skipped: 0 },
    metadata: { branch: "feature/cart-improvements" },
  },
  // Stripe Dashboard runs
  stripeRun1: {
    id: "run_seed_stripe_run1",
    projectId: seedProjects.stripeDashboard.id,
    planId: seedPlans.stripeDailyHealth.id,
    testId: null,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.stripeDashboardProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2024-12-20T06:00:00Z"),
    finishedAt: new Date("2024-12-20T06:08:15Z"),
    dispatchedAt: new Date("2024-12-20T06:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 12, passed: 12, failed: 0, skipped: 0, duration: 495000 },
    metadata: { scheduleName: "Daily Health Check", branch: "main" },
  },
  stripeRun2: {
    id: "run_seed_stripe_run2",
    projectId: seedProjects.stripeDashboard.id,
    planId: null,
    testId: null,
    suiteId: seedSuites.stripeSubscriptions.id,
    scheduleId: null,
    environmentId: seedEnvironments.stripeDashboardDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.stripeDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2024-12-19T16:30:00Z"),
    finishedAt: new Date("2024-12-19T16:35:42Z"),
    dispatchedAt: new Date("2024-12-19T16:30:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 3, passed: 3, failed: 0, skipped: 0, duration: 342000 },
    metadata: { branch: "develop" },
  },
  // GitHub Repo runs
  githubRun1: {
    id: "run_seed_github_run1",
    projectId: seedProjects.githubRepo.id,
    planId: seedPlans.githubPRValidation.id,
    testId: null,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.githubRepoProd.id,
    trigger: "api",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2024-12-20T11:00:00Z"),
    finishedAt: new Date("2024-12-20T11:04:30Z"),
    dispatchedAt: new Date("2024-12-20T11:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 9, passed: 9, failed: 0, skipped: 0, duration: 270000 },
    metadata: { prNumber: 1234, branch: "feature/new-ui" },
  },
  // OpenAI ChatGPT runs - 14+ days of history with mixed results for trend visualization
  // Day 0 (today) - Passed
  openaiDaily0: {
    id: "run_seed_openai_daily_0",
    projectId: seedProjects.openaiChatGPT.id,
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.openaiDailySmoke.id,
    environmentId: seedEnvironments.openaiChatGPTProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: daysAgo(0),
    finishedAt: daysAgoEnd(0),
    dispatchedAt: daysAgo(0),
    config: { browser: "chromium", headless: true, timeout: 60000 },
    summary: { total: 4, passed: 4, failed: 0, skipped: 0, flaky: 0, duration: 245000 },
    metadata: { branch: "main", commit: "a1b2c3d" },
  },
  // Day 1 - Passed
  openaiDaily1: {
    id: "run_seed_openai_daily_1",
    projectId: seedProjects.openaiChatGPT.id,
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.openaiDailySmoke.id,
    environmentId: seedEnvironments.openaiChatGPTProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: daysAgo(1),
    finishedAt: daysAgoEnd(1),
    dispatchedAt: daysAgo(1),
    config: { browser: "chromium", headless: true, timeout: 60000 },
    summary: { total: 4, passed: 4, failed: 0, skipped: 0, flaky: 0, duration: 238000 },
    metadata: { branch: "main", commit: "b2c3d4e" },
  },
  // Day 2 - Failed (simulating a real issue)
  openaiDaily2: {
    id: "run_seed_openai_daily_2",
    projectId: seedProjects.openaiChatGPT.id,
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.openaiDailySmoke.id,
    environmentId: seedEnvironments.openaiChatGPTProd.id,
    trigger: "schedule",
    status: "failed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: daysAgo(2),
    finishedAt: daysAgoEnd(2),
    dispatchedAt: daysAgo(2),
    config: { browser: "chromium", headless: true, timeout: 60000 },
    summary: { total: 4, passed: 2, failed: 2, skipped: 0, flaky: 0, duration: 312000 },
    metadata: { branch: "main", commit: "c3d4e5f" },
  },
  // Day 3 - Passed
  openaiDaily3: {
    id: "run_seed_openai_daily_3",
    projectId: seedProjects.openaiChatGPT.id,
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.openaiDailySmoke.id,
    environmentId: seedEnvironments.openaiChatGPTProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: daysAgo(3),
    finishedAt: daysAgoEnd(3),
    dispatchedAt: daysAgo(3),
    config: { browser: "chromium", headless: true, timeout: 60000 },
    summary: { total: 4, passed: 4, failed: 0, skipped: 0, flaky: 0, duration: 251000 },
    metadata: { branch: "main", commit: "d4e5f6g" },
  },
  // Day 4 - Flaky (1 test had to retry)
  openaiDaily4: {
    id: "run_seed_openai_daily_4",
    projectId: seedProjects.openaiChatGPT.id,
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.openaiDailySmoke.id,
    environmentId: seedEnvironments.openaiChatGPTProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: daysAgo(4),
    finishedAt: daysAgoEnd(4, 7),
    dispatchedAt: daysAgo(4),
    config: { browser: "chromium", headless: true, timeout: 60000 },
    summary: { total: 4, passed: 4, failed: 0, skipped: 0, flaky: 1, duration: 389000 },
    metadata: { branch: "main", commit: "e5f6g7h" },
  },
  // Day 5 - Passed
  openaiDaily5: {
    id: "run_seed_openai_daily_5",
    projectId: seedProjects.openaiChatGPT.id,
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.openaiDailySmoke.id,
    environmentId: seedEnvironments.openaiChatGPTProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: daysAgo(5),
    finishedAt: daysAgoEnd(5),
    dispatchedAt: daysAgo(5),
    config: { browser: "chromium", headless: true, timeout: 60000 },
    summary: { total: 4, passed: 4, failed: 0, skipped: 0, flaky: 0, duration: 242000 },
    metadata: { branch: "main", commit: "f6g7h8i" },
  },
  // Day 6 - Failed (another issue)
  openaiDaily6: {
    id: "run_seed_openai_daily_6",
    projectId: seedProjects.openaiChatGPT.id,
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.openaiDailySmoke.id,
    environmentId: seedEnvironments.openaiChatGPTProd.id,
    trigger: "schedule",
    status: "failed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: daysAgo(6),
    finishedAt: daysAgoEnd(6),
    dispatchedAt: daysAgo(6),
    config: { browser: "chromium", headless: true, timeout: 60000 },
    summary: { total: 4, passed: 3, failed: 1, skipped: 0, flaky: 0, duration: 287000 },
    metadata: { branch: "main", commit: "g7h8i9j" },
  },
  // Day 7 - Passed
  openaiDaily7: {
    id: "run_seed_openai_daily_7",
    projectId: seedProjects.openaiChatGPT.id,
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.openaiDailySmoke.id,
    environmentId: seedEnvironments.openaiChatGPTProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: daysAgo(7),
    finishedAt: daysAgoEnd(7),
    dispatchedAt: daysAgo(7),
    config: { browser: "chromium", headless: true, timeout: 60000 },
    summary: { total: 4, passed: 4, failed: 0, skipped: 0, flaky: 0, duration: 255000 },
    metadata: { branch: "main", commit: "h8i9j0k" },
  },
  // Day 8 - Passed
  openaiDaily8: {
    id: "run_seed_openai_daily_8",
    projectId: seedProjects.openaiChatGPT.id,
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.openaiDailySmoke.id,
    environmentId: seedEnvironments.openaiChatGPTProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: daysAgo(8),
    finishedAt: daysAgoEnd(8),
    dispatchedAt: daysAgo(8),
    config: { browser: "chromium", headless: true, timeout: 60000 },
    summary: { total: 4, passed: 4, failed: 0, skipped: 0, flaky: 0, duration: 248000 },
    metadata: { branch: "main", commit: "i9j0k1l" },
  },
  // Day 9 - Flaky
  openaiDaily9: {
    id: "run_seed_openai_daily_9",
    projectId: seedProjects.openaiChatGPT.id,
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.openaiDailySmoke.id,
    environmentId: seedEnvironments.openaiChatGPTProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: daysAgo(9),
    finishedAt: daysAgoEnd(9, 8),
    dispatchedAt: daysAgo(9),
    config: { browser: "chromium", headless: true, timeout: 60000 },
    summary: { total: 4, passed: 4, failed: 0, skipped: 0, flaky: 2, duration: 412000 },
    metadata: { branch: "main", commit: "j0k1l2m" },
  },
  // Day 10 - Passed
  openaiDaily10: {
    id: "run_seed_openai_daily_10",
    projectId: seedProjects.openaiChatGPT.id,
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.openaiDailySmoke.id,
    environmentId: seedEnvironments.openaiChatGPTProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: daysAgo(10),
    finishedAt: daysAgoEnd(10),
    dispatchedAt: daysAgo(10),
    config: { browser: "chromium", headless: true, timeout: 60000 },
    summary: { total: 4, passed: 4, failed: 0, skipped: 0, flaky: 0, duration: 239000 },
    metadata: { branch: "main", commit: "k1l2m3n" },
  },
  // Day 11 - Passed
  openaiDaily11: {
    id: "run_seed_openai_daily_11",
    projectId: seedProjects.openaiChatGPT.id,
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.openaiDailySmoke.id,
    environmentId: seedEnvironments.openaiChatGPTProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: daysAgo(11),
    finishedAt: daysAgoEnd(11),
    dispatchedAt: daysAgo(11),
    config: { browser: "chromium", headless: true, timeout: 60000 },
    summary: { total: 4, passed: 4, failed: 0, skipped: 0, flaky: 0, duration: 253000 },
    metadata: { branch: "main", commit: "l2m3n4o" },
  },
  // Day 12 - Failed
  openaiDaily12: {
    id: "run_seed_openai_daily_12",
    projectId: seedProjects.openaiChatGPT.id,
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.openaiDailySmoke.id,
    environmentId: seedEnvironments.openaiChatGPTProd.id,
    trigger: "schedule",
    status: "failed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: daysAgo(12),
    finishedAt: daysAgoEnd(12),
    dispatchedAt: daysAgo(12),
    config: { browser: "chromium", headless: true, timeout: 60000 },
    summary: { total: 4, passed: 2, failed: 2, skipped: 0, flaky: 0, duration: 298000 },
    metadata: { branch: "main", commit: "m3n4o5p" },
  },
  // Day 13 - Passed
  openaiDaily13: {
    id: "run_seed_openai_daily_13",
    projectId: seedProjects.openaiChatGPT.id,
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.openaiDailySmoke.id,
    environmentId: seedEnvironments.openaiChatGPTProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: daysAgo(13),
    finishedAt: daysAgoEnd(13),
    dispatchedAt: daysAgo(13),
    config: { browser: "chromium", headless: true, timeout: 60000 },
    summary: { total: 4, passed: 4, failed: 0, skipped: 0, flaky: 0, duration: 244000 },
    metadata: { branch: "main", commit: "n4o5p6q" },
  },
  // Day 14 - Passed
  openaiDaily14: {
    id: "run_seed_openai_daily_14",
    projectId: seedProjects.openaiChatGPT.id,
    planId: seedPlans.openaiChatGPTSmoke.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.openaiDailySmoke.id,
    environmentId: seedEnvironments.openaiChatGPTProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: daysAgo(14),
    finishedAt: daysAgoEnd(14),
    dispatchedAt: daysAgo(14),
    config: { browser: "chromium", headless: true, timeout: 60000 },
    summary: { total: 4, passed: 4, failed: 0, skipped: 0, flaky: 0, duration: 261000 },
    metadata: { branch: "main", commit: "o5p6q7r" },
  },
  // Additional manual runs for variety - a recent manual run
  openaiManualRun1: {
    id: "run_seed_openai_manual_1",
    projectId: seedProjects.openaiChatGPT.id,
    planId: seedPlans.openaiChatGPTRegression.id,
    testId: null,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.openaiChatGPTProd.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.openaiOwner.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: daysAgo(1),
    finishedAt: daysAgoEnd(1, 12),
    dispatchedAt: daysAgo(1),
    config: { browser: "chromium", headless: true, timeout: 60000 },
    summary: { total: 23, passed: 22, failed: 0, skipped: 1, flaky: 1, duration: 720000 },
    metadata: { branch: "main", triggeredBy: "Sam Altman" },
  },
  amazonDailySmoke1: {
    id: "run_seed_amazon_daily_smoke_1",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonSmokeTest.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonDailySmoke.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-07T09:00:00Z"),
    finishedAt: new Date("2025-12-07T09:05:00Z"),
    dispatchedAt: new Date("2025-12-07T09:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 3, passed: 3, failed: 0, skipped: 0, duration: 15000 },
    metadata: { generated: true },
  },
  amazonDailySmoke2: {
    id: "run_seed_amazon_daily_smoke_2",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonSmokeTest.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonDailySmoke.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-08T09:00:00Z"),
    finishedAt: new Date("2025-12-08T09:05:00Z"),
    dispatchedAt: new Date("2025-12-08T09:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 3, passed: 3, failed: 0, skipped: 0, duration: 15000 },
    metadata: { generated: true },
  },
  amazonDailySmoke3: {
    id: "run_seed_amazon_daily_smoke_3",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonSmokeTest.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonDailySmoke.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-09T09:00:00Z"),
    finishedAt: new Date("2025-12-09T09:05:00Z"),
    dispatchedAt: new Date("2025-12-09T09:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 3, passed: 3, failed: 0, skipped: 0, duration: 15000 },
    metadata: { generated: true },
  },
  amazonDailySmoke4: {
    id: "run_seed_amazon_daily_smoke_4",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonSmokeTest.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonDailySmoke.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-10T09:00:00Z"),
    finishedAt: new Date("2025-12-10T09:05:00Z"),
    dispatchedAt: new Date("2025-12-10T09:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 3, passed: 3, failed: 0, skipped: 0, duration: 15000 },
    metadata: { generated: true },
  },
  amazonDailySmoke5: {
    id: "run_seed_amazon_daily_smoke_5",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonSmokeTest.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonDailySmoke.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "failed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-11T09:00:00Z"),
    finishedAt: new Date("2025-12-11T09:05:00Z"),
    dispatchedAt: new Date("2025-12-11T09:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 3, passed: 2, failed: 1, skipped: 0, duration: 15000 },
    metadata: { generated: true },
  },
  amazonDailySmoke6: {
    id: "run_seed_amazon_daily_smoke_6",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonSmokeTest.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonDailySmoke.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-12T09:00:00Z"),
    finishedAt: new Date("2025-12-12T09:05:00Z"),
    dispatchedAt: new Date("2025-12-12T09:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 3, passed: 3, failed: 0, skipped: 0, duration: 15000 },
    metadata: { generated: true },
  },
  amazonDailySmoke7: {
    id: "run_seed_amazon_daily_smoke_7",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonSmokeTest.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonDailySmoke.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-13T09:00:00Z"),
    finishedAt: new Date("2025-12-13T09:05:00Z"),
    dispatchedAt: new Date("2025-12-13T09:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 3, passed: 3, failed: 0, skipped: 0, duration: 15000 },
    metadata: { generated: true },
  },
  amazonDailySmoke8: {
    id: "run_seed_amazon_daily_smoke_8",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonSmokeTest.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonDailySmoke.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-14T09:00:00Z"),
    finishedAt: new Date("2025-12-14T09:05:00Z"),
    dispatchedAt: new Date("2025-12-14T09:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 3, passed: 3, failed: 0, skipped: 0, duration: 15000 },
    metadata: { generated: true },
  },
  amazonDailySmoke9: {
    id: "run_seed_amazon_daily_smoke_9",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonSmokeTest.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonDailySmoke.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-15T09:00:00Z"),
    finishedAt: new Date("2025-12-15T09:05:00Z"),
    dispatchedAt: new Date("2025-12-15T09:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 3, passed: 3, failed: 0, skipped: 0, duration: 15000 },
    metadata: { generated: true },
  },
  amazonDailySmoke10: {
    id: "run_seed_amazon_daily_smoke_10",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonSmokeTest.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonDailySmoke.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "failed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-16T09:00:00Z"),
    finishedAt: new Date("2025-12-16T09:05:00Z"),
    dispatchedAt: new Date("2025-12-16T09:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 3, passed: 2, failed: 1, skipped: 0, duration: 15000 },
    metadata: { generated: true },
  },
  amazonDailySmoke11: {
    id: "run_seed_amazon_daily_smoke_11",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonSmokeTest.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonDailySmoke.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-17T09:00:00Z"),
    finishedAt: new Date("2025-12-17T09:05:00Z"),
    dispatchedAt: new Date("2025-12-17T09:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 3, passed: 3, failed: 0, skipped: 0, duration: 15000 },
    metadata: { generated: true },
  },
  amazonDailySmoke12: {
    id: "run_seed_amazon_daily_smoke_12",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonSmokeTest.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonDailySmoke.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-18T09:00:00Z"),
    finishedAt: new Date("2025-12-18T09:05:00Z"),
    dispatchedAt: new Date("2025-12-18T09:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 3, passed: 3, failed: 0, skipped: 0, duration: 15000 },
    metadata: { generated: true },
  },
  amazonDailySmoke13: {
    id: "run_seed_amazon_daily_smoke_13",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonSmokeTest.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonDailySmoke.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-19T09:00:00Z"),
    finishedAt: new Date("2025-12-19T09:05:00Z"),
    dispatchedAt: new Date("2025-12-19T09:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 3, passed: 3, failed: 0, skipped: 0, duration: 15000 },
    metadata: { generated: true },
  },
  amazonDailySmoke14: {
    id: "run_seed_amazon_daily_smoke_14",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonSmokeTest.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonDailySmoke.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-20T09:00:00Z"),
    finishedAt: new Date("2025-12-20T09:05:00Z"),
    dispatchedAt: new Date("2025-12-20T09:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 3, passed: 3, failed: 0, skipped: 0, duration: 15000 },
    metadata: { generated: true },
  },
  amazonRegression1: {
    id: "run_seed_amazon_regression_1",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonFullRegression.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonWeeklyRegression.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-14T02:00:00Z"),
    finishedAt: new Date("2025-12-14T03:05:00Z"),
    dispatchedAt: new Date("2025-12-14T02:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 10, passed: 10, failed: 0, skipped: 0, duration: 300000 },
    metadata: { generated: true },
  },
  amazonRegression2: {
    id: "run_seed_amazon_regression_2",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonFullRegression.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonWeeklyRegression.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-07T02:00:00Z"),
    finishedAt: new Date("2025-12-07T03:05:00Z"),
    dispatchedAt: new Date("2025-12-07T02:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 10, passed: 10, failed: 0, skipped: 0, duration: 300000 },
    metadata: { generated: true },
  },
  amazonRegression3: {
    id: "run_seed_amazon_regression_3",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonFullRegression.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonWeeklyRegression.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-11-30T02:00:00Z"),
    finishedAt: new Date("2025-11-30T03:05:00Z"),
    dispatchedAt: new Date("2025-11-30T02:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 10, passed: 10, failed: 0, skipped: 0, duration: 300000 },
    metadata: { generated: true },
  },
  amazonRegression4: {
    id: "run_seed_amazon_regression_4",
    projectId: seedProjects.amazonStorefront.id,
    planId: seedPlans.amazonFullRegression.id,
    testId: null,
    suiteId: null,
    scheduleId: seedSchedules.amazonWeeklyRegression.id,
    environmentId: seedEnvironments.amazonStorefrontProd.id,
    trigger: "schedule",
    status: "passed",
    triggeredByUserId: null,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-11-23T02:00:00Z"),
    finishedAt: new Date("2025-11-23T03:05:00Z"),
    dispatchedAt: new Date("2025-11-23T02:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 10, passed: 10, failed: 0, skipped: 0, duration: 300000 },
    metadata: { generated: true },
  },
  amazonManual1: {
    id: "run_seed_amazon_manual_1",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.addToCart.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-20T14:00:00Z"),
    finishedAt: new Date("2025-12-20T14:02:00Z"),
    dispatchedAt: new Date("2025-12-20T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual2: {
    id: "run_seed_amazon_manual_2",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.searchProducts.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-19T14:00:00Z"),
    finishedAt: new Date("2025-12-19T14:02:00Z"),
    dispatchedAt: new Date("2025-12-19T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual3: {
    id: "run_seed_amazon_manual_3",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.addToCart.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-18T14:00:00Z"),
    finishedAt: new Date("2025-12-18T14:02:00Z"),
    dispatchedAt: new Date("2025-12-18T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual4: {
    id: "run_seed_amazon_manual_4",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.searchProducts.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-17T14:00:00Z"),
    finishedAt: new Date("2025-12-17T14:02:00Z"),
    dispatchedAt: new Date("2025-12-17T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual5: {
    id: "run_seed_amazon_manual_5",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.addToCart.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-16T14:00:00Z"),
    finishedAt: new Date("2025-12-16T14:02:00Z"),
    dispatchedAt: new Date("2025-12-16T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual6: {
    id: "run_seed_amazon_manual_6",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.searchProducts.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-15T14:00:00Z"),
    finishedAt: new Date("2025-12-15T14:02:00Z"),
    dispatchedAt: new Date("2025-12-15T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual7: {
    id: "run_seed_amazon_manual_7",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.addToCart.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-14T14:00:00Z"),
    finishedAt: new Date("2025-12-14T14:02:00Z"),
    dispatchedAt: new Date("2025-12-14T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual8: {
    id: "run_seed_amazon_manual_8",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.searchProducts.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-13T14:00:00Z"),
    finishedAt: new Date("2025-12-13T14:02:00Z"),
    dispatchedAt: new Date("2025-12-13T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual9: {
    id: "run_seed_amazon_manual_9",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.addToCart.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-12T14:00:00Z"),
    finishedAt: new Date("2025-12-12T14:02:00Z"),
    dispatchedAt: new Date("2025-12-12T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual10: {
    id: "run_seed_amazon_manual_10",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.searchProducts.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-21T14:00:00Z"),
    finishedAt: new Date("2025-12-21T14:02:00Z"),
    dispatchedAt: new Date("2025-12-21T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual11: {
    id: "run_seed_amazon_manual_11",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.addToCart.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-20T14:00:00Z"),
    finishedAt: new Date("2025-12-20T14:02:00Z"),
    dispatchedAt: new Date("2025-12-20T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual12: {
    id: "run_seed_amazon_manual_12",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.searchProducts.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-19T14:00:00Z"),
    finishedAt: new Date("2025-12-19T14:02:00Z"),
    dispatchedAt: new Date("2025-12-19T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual13: {
    id: "run_seed_amazon_manual_13",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.addToCart.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-18T14:00:00Z"),
    finishedAt: new Date("2025-12-18T14:02:00Z"),
    dispatchedAt: new Date("2025-12-18T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual14: {
    id: "run_seed_amazon_manual_14",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.searchProducts.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-17T14:00:00Z"),
    finishedAt: new Date("2025-12-17T14:02:00Z"),
    dispatchedAt: new Date("2025-12-17T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual15: {
    id: "run_seed_amazon_manual_15",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.addToCart.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-16T14:00:00Z"),
    finishedAt: new Date("2025-12-16T14:02:00Z"),
    dispatchedAt: new Date("2025-12-16T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual16: {
    id: "run_seed_amazon_manual_16",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.searchProducts.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-15T14:00:00Z"),
    finishedAt: new Date("2025-12-15T14:02:00Z"),
    dispatchedAt: new Date("2025-12-15T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual17: {
    id: "run_seed_amazon_manual_17",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.addToCart.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-14T14:00:00Z"),
    finishedAt: new Date("2025-12-14T14:02:00Z"),
    dispatchedAt: new Date("2025-12-14T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual18: {
    id: "run_seed_amazon_manual_18",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.searchProducts.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-13T14:00:00Z"),
    finishedAt: new Date("2025-12-13T14:02:00Z"),
    dispatchedAt: new Date("2025-12-13T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual19: {
    id: "run_seed_amazon_manual_19",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.addToCart.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-12T14:00:00Z"),
    finishedAt: new Date("2025-12-12T14:02:00Z"),
    dispatchedAt: new Date("2025-12-12T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual20: {
    id: "run_seed_amazon_manual_20",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.searchProducts.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-21T14:00:00Z"),
    finishedAt: new Date("2025-12-21T14:02:00Z"),
    dispatchedAt: new Date("2025-12-21T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual21: {
    id: "run_seed_amazon_manual_21",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.addToCart.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-20T14:00:00Z"),
    finishedAt: new Date("2025-12-20T14:02:00Z"),
    dispatchedAt: new Date("2025-12-20T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual22: {
    id: "run_seed_amazon_manual_22",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.searchProducts.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-19T14:00:00Z"),
    finishedAt: new Date("2025-12-19T14:02:00Z"),
    dispatchedAt: new Date("2025-12-19T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual23: {
    id: "run_seed_amazon_manual_23",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.addToCart.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-18T14:00:00Z"),
    finishedAt: new Date("2025-12-18T14:02:00Z"),
    dispatchedAt: new Date("2025-12-18T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual24: {
    id: "run_seed_amazon_manual_24",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.searchProducts.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-17T14:00:00Z"),
    finishedAt: new Date("2025-12-17T14:02:00Z"),
    dispatchedAt: new Date("2025-12-17T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual25: {
    id: "run_seed_amazon_manual_25",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.addToCart.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-16T14:00:00Z"),
    finishedAt: new Date("2025-12-16T14:02:00Z"),
    dispatchedAt: new Date("2025-12-16T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual26: {
    id: "run_seed_amazon_manual_26",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.searchProducts.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-15T14:00:00Z"),
    finishedAt: new Date("2025-12-15T14:02:00Z"),
    dispatchedAt: new Date("2025-12-15T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual27: {
    id: "run_seed_amazon_manual_27",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.addToCart.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-14T14:00:00Z"),
    finishedAt: new Date("2025-12-14T14:02:00Z"),
    dispatchedAt: new Date("2025-12-14T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual28: {
    id: "run_seed_amazon_manual_28",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.searchProducts.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-13T14:00:00Z"),
    finishedAt: new Date("2025-12-13T14:02:00Z"),
    dispatchedAt: new Date("2025-12-13T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual29: {
    id: "run_seed_amazon_manual_29",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.addToCart.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-12T14:00:00Z"),
    finishedAt: new Date("2025-12-12T14:02:00Z"),
    dispatchedAt: new Date("2025-12-12T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual30: {
    id: "run_seed_amazon_manual_30",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.searchProducts.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-21T14:00:00Z"),
    finishedAt: new Date("2025-12-21T14:02:00Z"),
    dispatchedAt: new Date("2025-12-21T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual31: {
    id: "run_seed_amazon_manual_31",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.addToCart.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-20T14:00:00Z"),
    finishedAt: new Date("2025-12-20T14:02:00Z"),
    dispatchedAt: new Date("2025-12-20T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  amazonManual32: {
    id: "run_seed_amazon_manual_32",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.searchProducts.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "passed",
    triggeredByUserId: seedUsers.amazonDev1.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: new Date("2025-12-19T14:00:00Z"),
    finishedAt: new Date("2025-12-19T14:02:00Z"),
    dispatchedAt: new Date("2025-12-19T14:00:00Z"),
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: { total: 1, passed: 1, failed: 0, skipped: 0, duration: 2000 },
    metadata: { generated: true },
  },
  // Integration test runs - used by e2e/reporter_reporting_integration.spec.ts
  // These start as "queued" and are updated by the reporter during integration tests
  integrationPassingRun: {
    id: "run_seed_integration_passing",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.integrationPassing.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "queued",
    triggeredByUserId: seedUsers.amazonOwner.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: null,
    finishedAt: null,
    dispatchedAt: null,
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: null,
    metadata: { integration_test: true, scenario: "passing" },
  },
  integrationFailingRun: {
    id: "run_seed_integration_failing",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: seedTests.integrationFailing.id,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "queued",
    triggeredByUserId: seedUsers.amazonOwner.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: null,
    finishedAt: null,
    dispatchedAt: null,
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: null,
    metadata: { integration_test: true, scenario: "failing" },
  },
  integrationFlakyRun: {
    id: "run_seed_integration_flaky",
    projectId: seedProjects.amazonStorefront.id,
    planId: null,
    testId: null,
    suiteId: null,
    scheduleId: null,
    environmentId: seedEnvironments.amazonStorefrontDev.id,
    trigger: "manual",
    status: "queued",
    triggeredByUserId: seedUsers.amazonOwner.id,
    triggeredByApiKeyId: null,
    jobId: null,
    startedAt: null,
    finishedAt: null,
    dispatchedAt: null,
    config: { browser: "chromium", headless: true, timeout: 30000 },
    summary: null,
    metadata: { integration_test: true, scenario: "flaky" },
  },
};

// ============================================================================
// Seed Data Definitions - Run Tests (individual test results within runs)
// ============================================================================

/**
 * RunTest records link individual test executions to runs with their statuses.
 * This provides the granular test-level results that power trends and reporting.
 */
export const seedRunTests = {
  // Amazon Run 1 (passed) - individual test results
  amazonRun1SearchProducts: {
    id: "rt_seed_amazon_run1_search",
    runId: seedRuns.amazonRun1.id,
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 4523,
    error: null,
  },
  amazonRun1FilterCategory: {
    id: "rt_seed_amazon_run1_filter_cat",
    runId: seedRuns.amazonRun1.id,
    testId: seedTests.filterByCategory.id,
    testVersionId: seedTestVersions.filterByCategoryV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 3891,
    error: null,
  },
  amazonRun1FilterPrice: {
    id: "rt_seed_amazon_run1_filter_price",
    runId: seedRuns.amazonRun1.id,
    testId: seedTests.filterByPrice.id,
    testVersionId: seedTestVersions.filterByPriceV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 4102,
    error: null,
  },
  amazonRun1AddToCart: {
    id: "rt_seed_amazon_run1_cart",
    runId: seedRuns.amazonRun1.id,
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 3245,
    error: null,
  },
  amazonRun1UserLogin: {
    id: "rt_seed_amazon_run1_login",
    runId: seedRuns.amazonRun1.id,
    testId: seedTests.userLogin.id,
    testVersionId: seedTestVersions.userLoginV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5678,
    error: null,
  },
  amazonRun1ViewProduct: {
    id: "rt_seed_amazon_run1_product",
    runId: seedRuns.amazonRun1.id,
    testId: seedTests.viewProductDetails.id,
    testVersionId: seedTestVersions.viewProductDetailsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2987,
    error: null,
  },
  amazonRun1SortRating: {
    id: "rt_seed_amazon_run1_sort",
    runId: seedRuns.amazonRun1.id,
    testId: seedTests.sortByRating.id,
    testVersionId: seedTestVersions.sortByRatingV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 3456,
    error: null,
  },
  amazonRun1UpdateQuantity: {
    id: "rt_seed_amazon_run1_qty",
    runId: seedRuns.amazonRun1.id,
    testId: seedTests.updateCartQuantity.id,
    testVersionId: seedTestVersions.updateCartQuantityV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2891,
    error: null,
  },
  // Amazon Run 2 (failed) - mixed results including failures
  amazonRun2SearchProducts: {
    id: "rt_seed_amazon_run2_search",
    runId: seedRuns.amazonRun2.id,
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 4812,
    error: null,
  },
  amazonRun2FilterCategory: {
    id: "rt_seed_amazon_run2_filter_cat",
    runId: seedRuns.amazonRun2.id,
    testId: seedTests.filterByCategory.id,
    testVersionId: seedTestVersions.filterByCategoryV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 4023,
    error: null,
  },
  amazonRun2FilterPrice: {
    id: "rt_seed_amazon_run2_filter_price",
    runId: seedRuns.amazonRun2.id,
    testId: seedTests.filterByPrice.id,
    testVersionId: seedTestVersions.filterByPriceV1.id,
    status: "failed",
    attempt: 1,
    durationMs: 8234,
    error: {
      message: "Timeout waiting for price filter to apply",
      stack:
        "Error: Timeout waiting for price filter to apply\n    at waitForSelector",
      type: "TimeoutError",
    },
  },
  amazonRun2AddToCart: {
    id: "rt_seed_amazon_run2_cart",
    runId: seedRuns.amazonRun2.id,
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 3456,
    error: null,
  },
  amazonRun2UserLogin: {
    id: "rt_seed_amazon_run2_login",
    runId: seedRuns.amazonRun2.id,
    testId: seedTests.userLogin.id,
    testVersionId: seedTestVersions.userLoginV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5432,
    error: null,
  },
  amazonRun2ViewProduct: {
    id: "rt_seed_amazon_run2_product",
    runId: seedRuns.amazonRun2.id,
    testId: seedTests.viewProductDetails.id,
    testVersionId: seedTestVersions.viewProductDetailsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 3123,
    error: null,
  },
  amazonRun2SortRating: {
    id: "rt_seed_amazon_run2_sort",
    runId: seedRuns.amazonRun2.id,
    testId: seedTests.sortByRating.id,
    testVersionId: seedTestVersions.sortByRatingV1.id,
    status: "flaky",
    attempt: 2,
    durationMs: 6789,
    error: null,
  },
  amazonRun2UpdateQuantity: {
    id: "rt_seed_amazon_run2_qty",
    runId: seedRuns.amazonRun2.id,
    testId: seedTests.updateCartQuantity.id,
    testVersionId: seedTestVersions.updateCartQuantityV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2765,
    error: null,
  },
  amazonRun2RemoveCart: {
    id: "rt_seed_amazon_run2_remove",
    runId: seedRuns.amazonRun2.id,
    testId: seedTests.removeFromCart.id,
    testVersionId: seedTestVersions.removeFromCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 3012,
    error: null,
  },
  amazonRun2SaveLater: {
    id: "rt_seed_amazon_run2_save",
    runId: seedRuns.amazonRun2.id,
    testId: seedTests.saveForLater.id,
    testVersionId: seedTestVersions.saveForLaterV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2890,
    error: null,
  },
  amazonRun2UserLogout: {
    id: "rt_seed_amazon_run2_logout",
    runId: seedRuns.amazonRun2.id,
    testId: seedTests.userLogout.id,
    testVersionId: seedTestVersions.userLogoutV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2345,
    error: null,
  },
  amazonRun2LoginInvalid: {
    id: "rt_seed_amazon_run2_invalid",
    runId: seedRuns.amazonRun2.id,
    testId: seedTests.loginInvalid.id,
    testVersionId: seedTestVersions.loginInvalidV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 3567,
    error: null,
  },
  amazonRun2ViewReviews: {
    id: "rt_seed_amazon_run2_reviews",
    runId: seedRuns.amazonRun2.id,
    testId: seedTests.viewProductReviews.id,
    testVersionId: seedTestVersions.viewProductReviewsV1.id,
    status: "failed",
    attempt: 1,
    durationMs: 10234,
    error: {
      message: "Element [data-testid=load-more-reviews] not found",
      stack: "Error: Element not found\n    at waitForSelector",
      type: "ElementNotFoundError",
    },
  },
  // Amazon Run 3 (running) - in progress
  amazonRun3AddToCart: {
    id: "rt_seed_amazon_run3_cart",
    runId: seedRuns.amazonRun3.id,
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "running",
    attempt: 1,
    durationMs: null,
    error: null,
  },
  // Stripe Run 1 - subscription tests
  stripeRun1CreateSub: {
    id: "rt_seed_stripe_run1_create",
    runId: seedRuns.stripeRun1.id,
    testId: seedTests.createSubscription.id,
    testVersionId: seedTestVersions.createSubscriptionV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 6543,
    error: null,
  },
  // GitHub Run 1 - PR tests
  githubRun1CreatePR: {
    id: "rt_seed_github_run1_create",
    runId: seedRuns.githubRun1.id,
    testId: seedTests.createPullRequest.id,
    testVersionId: seedTestVersions.createPRV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5678,
    error: null,
  },
  amazonDailySmoke1Search: {
    id: "rt_amazonDailySmoke1Search",
    runId: "run_seed_amazon_daily_smoke_1",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke1Login: {
    id: "rt_amazonDailySmoke1Login",
    runId: "run_seed_amazon_daily_smoke_1",
    testId: seedTests.userLogin.id,
    testVersionId: seedTestVersions.userLoginV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke1Cart: {
    id: "rt_amazonDailySmoke1Cart",
    runId: "run_seed_amazon_daily_smoke_1",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke2Search: {
    id: "rt_amazonDailySmoke2Search",
    runId: "run_seed_amazon_daily_smoke_2",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke2Login: {
    id: "rt_amazonDailySmoke2Login",
    runId: "run_seed_amazon_daily_smoke_2",
    testId: seedTests.userLogin.id,
    testVersionId: seedTestVersions.userLoginV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke2Cart: {
    id: "rt_amazonDailySmoke2Cart",
    runId: "run_seed_amazon_daily_smoke_2",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke3Search: {
    id: "rt_amazonDailySmoke3Search",
    runId: "run_seed_amazon_daily_smoke_3",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke3Login: {
    id: "rt_amazonDailySmoke3Login",
    runId: "run_seed_amazon_daily_smoke_3",
    testId: seedTests.userLogin.id,
    testVersionId: seedTestVersions.userLoginV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke3Cart: {
    id: "rt_amazonDailySmoke3Cart",
    runId: "run_seed_amazon_daily_smoke_3",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke4Search: {
    id: "rt_amazonDailySmoke4Search",
    runId: "run_seed_amazon_daily_smoke_4",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke4Login: {
    id: "rt_amazonDailySmoke4Login",
    runId: "run_seed_amazon_daily_smoke_4",
    testId: seedTests.userLogin.id,
    testVersionId: seedTestVersions.userLoginV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke4Cart: {
    id: "rt_amazonDailySmoke4Cart",
    runId: "run_seed_amazon_daily_smoke_4",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke5Search: {
    id: "rt_amazonDailySmoke5Search",
    runId: "run_seed_amazon_daily_smoke_5",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke5Login: {
    id: "rt_amazonDailySmoke5Login",
    runId: "run_seed_amazon_daily_smoke_5",
    testId: seedTests.userLogin.id,
    testVersionId: seedTestVersions.userLoginV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke5Cart: {
    id: "rt_amazonDailySmoke5Cart",
    runId: "run_seed_amazon_daily_smoke_5",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "failed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke6Search: {
    id: "rt_amazonDailySmoke6Search",
    runId: "run_seed_amazon_daily_smoke_6",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke6Login: {
    id: "rt_amazonDailySmoke6Login",
    runId: "run_seed_amazon_daily_smoke_6",
    testId: seedTests.userLogin.id,
    testVersionId: seedTestVersions.userLoginV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke6Cart: {
    id: "rt_amazonDailySmoke6Cart",
    runId: "run_seed_amazon_daily_smoke_6",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke7Search: {
    id: "rt_amazonDailySmoke7Search",
    runId: "run_seed_amazon_daily_smoke_7",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke7Login: {
    id: "rt_amazonDailySmoke7Login",
    runId: "run_seed_amazon_daily_smoke_7",
    testId: seedTests.userLogin.id,
    testVersionId: seedTestVersions.userLoginV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke7Cart: {
    id: "rt_amazonDailySmoke7Cart",
    runId: "run_seed_amazon_daily_smoke_7",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke8Search: {
    id: "rt_amazonDailySmoke8Search",
    runId: "run_seed_amazon_daily_smoke_8",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke8Login: {
    id: "rt_amazonDailySmoke8Login",
    runId: "run_seed_amazon_daily_smoke_8",
    testId: seedTests.userLogin.id,
    testVersionId: seedTestVersions.userLoginV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke8Cart: {
    id: "rt_amazonDailySmoke8Cart",
    runId: "run_seed_amazon_daily_smoke_8",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke9Search: {
    id: "rt_amazonDailySmoke9Search",
    runId: "run_seed_amazon_daily_smoke_9",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke9Login: {
    id: "rt_amazonDailySmoke9Login",
    runId: "run_seed_amazon_daily_smoke_9",
    testId: seedTests.userLogin.id,
    testVersionId: seedTestVersions.userLoginV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke9Cart: {
    id: "rt_amazonDailySmoke9Cart",
    runId: "run_seed_amazon_daily_smoke_9",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke10Search: {
    id: "rt_amazonDailySmoke10Search",
    runId: "run_seed_amazon_daily_smoke_10",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke10Login: {
    id: "rt_amazonDailySmoke10Login",
    runId: "run_seed_amazon_daily_smoke_10",
    testId: seedTests.userLogin.id,
    testVersionId: seedTestVersions.userLoginV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke10Cart: {
    id: "rt_amazonDailySmoke10Cart",
    runId: "run_seed_amazon_daily_smoke_10",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "failed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke11Search: {
    id: "rt_amazonDailySmoke11Search",
    runId: "run_seed_amazon_daily_smoke_11",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke11Login: {
    id: "rt_amazonDailySmoke11Login",
    runId: "run_seed_amazon_daily_smoke_11",
    testId: seedTests.userLogin.id,
    testVersionId: seedTestVersions.userLoginV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke11Cart: {
    id: "rt_amazonDailySmoke11Cart",
    runId: "run_seed_amazon_daily_smoke_11",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke12Search: {
    id: "rt_amazonDailySmoke12Search",
    runId: "run_seed_amazon_daily_smoke_12",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke12Login: {
    id: "rt_amazonDailySmoke12Login",
    runId: "run_seed_amazon_daily_smoke_12",
    testId: seedTests.userLogin.id,
    testVersionId: seedTestVersions.userLoginV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke12Cart: {
    id: "rt_amazonDailySmoke12Cart",
    runId: "run_seed_amazon_daily_smoke_12",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke13Search: {
    id: "rt_amazonDailySmoke13Search",
    runId: "run_seed_amazon_daily_smoke_13",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke13Login: {
    id: "rt_amazonDailySmoke13Login",
    runId: "run_seed_amazon_daily_smoke_13",
    testId: seedTests.userLogin.id,
    testVersionId: seedTestVersions.userLoginV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke13Cart: {
    id: "rt_amazonDailySmoke13Cart",
    runId: "run_seed_amazon_daily_smoke_13",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke14Search: {
    id: "rt_amazonDailySmoke14Search",
    runId: "run_seed_amazon_daily_smoke_14",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke14Login: {
    id: "rt_amazonDailySmoke14Login",
    runId: "run_seed_amazon_daily_smoke_14",
    testId: seedTests.userLogin.id,
    testVersionId: seedTestVersions.userLoginV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonDailySmoke14Cart: {
    id: "rt_amazonDailySmoke14Cart",
    runId: "run_seed_amazon_daily_smoke_14",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 5000,
    error: null,
  },
  amazonRegression1Search: {
    id: "rt_amazonRegression1Search",
    runId: "run_seed_amazon_regression_1",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 4500,
    error: null,
  },
  amazonRegression2Search: {
    id: "rt_amazonRegression2Search",
    runId: "run_seed_amazon_regression_2",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 4500,
    error: null,
  },
  amazonRegression3Search: {
    id: "rt_amazonRegression3Search",
    runId: "run_seed_amazon_regression_3",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 4500,
    error: null,
  },
  amazonRegression4Search: {
    id: "rt_amazonRegression4Search",
    runId: "run_seed_amazon_regression_4",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 4500,
    error: null,
  },
  amazonManual1Test: {
    id: "rt_amazonManual1Test",
    runId: "run_seed_amazon_manual_1",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual2Test: {
    id: "rt_amazonManual2Test",
    runId: "run_seed_amazon_manual_2",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual3Test: {
    id: "rt_amazonManual3Test",
    runId: "run_seed_amazon_manual_3",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual4Test: {
    id: "rt_amazonManual4Test",
    runId: "run_seed_amazon_manual_4",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual5Test: {
    id: "rt_amazonManual5Test",
    runId: "run_seed_amazon_manual_5",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual6Test: {
    id: "rt_amazonManual6Test",
    runId: "run_seed_amazon_manual_6",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual7Test: {
    id: "rt_amazonManual7Test",
    runId: "run_seed_amazon_manual_7",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual8Test: {
    id: "rt_amazonManual8Test",
    runId: "run_seed_amazon_manual_8",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual9Test: {
    id: "rt_amazonManual9Test",
    runId: "run_seed_amazon_manual_9",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual10Test: {
    id: "rt_amazonManual10Test",
    runId: "run_seed_amazon_manual_10",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual11Test: {
    id: "rt_amazonManual11Test",
    runId: "run_seed_amazon_manual_11",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual12Test: {
    id: "rt_amazonManual12Test",
    runId: "run_seed_amazon_manual_12",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual13Test: {
    id: "rt_amazonManual13Test",
    runId: "run_seed_amazon_manual_13",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual14Test: {
    id: "rt_amazonManual14Test",
    runId: "run_seed_amazon_manual_14",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual15Test: {
    id: "rt_amazonManual15Test",
    runId: "run_seed_amazon_manual_15",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual16Test: {
    id: "rt_amazonManual16Test",
    runId: "run_seed_amazon_manual_16",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual17Test: {
    id: "rt_amazonManual17Test",
    runId: "run_seed_amazon_manual_17",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual18Test: {
    id: "rt_amazonManual18Test",
    runId: "run_seed_amazon_manual_18",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual19Test: {
    id: "rt_amazonManual19Test",
    runId: "run_seed_amazon_manual_19",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual20Test: {
    id: "rt_amazonManual20Test",
    runId: "run_seed_amazon_manual_20",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual21Test: {
    id: "rt_amazonManual21Test",
    runId: "run_seed_amazon_manual_21",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual22Test: {
    id: "rt_amazonManual22Test",
    runId: "run_seed_amazon_manual_22",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual23Test: {
    id: "rt_amazonManual23Test",
    runId: "run_seed_amazon_manual_23",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual24Test: {
    id: "rt_amazonManual24Test",
    runId: "run_seed_amazon_manual_24",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual25Test: {
    id: "rt_amazonManual25Test",
    runId: "run_seed_amazon_manual_25",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual26Test: {
    id: "rt_amazonManual26Test",
    runId: "run_seed_amazon_manual_26",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual27Test: {
    id: "rt_amazonManual27Test",
    runId: "run_seed_amazon_manual_27",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual28Test: {
    id: "rt_amazonManual28Test",
    runId: "run_seed_amazon_manual_28",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual29Test: {
    id: "rt_amazonManual29Test",
    runId: "run_seed_amazon_manual_29",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual30Test: {
    id: "rt_amazonManual30Test",
    runId: "run_seed_amazon_manual_30",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual31Test: {
    id: "rt_amazonManual31Test",
    runId: "run_seed_amazon_manual_31",
    testId: seedTests.addToCart.id,
    testVersionId: seedTestVersions.addToCartV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  amazonManual32Test: {
    id: "rt_amazonManual32Test",
    runId: "run_seed_amazon_manual_32",
    testId: seedTests.searchProducts.id,
    testVersionId: seedTestVersions.searchProductsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 2000,
    error: null,
  },
  // ============================================================================
  // OpenAI ChatGPT Daily Smoke Run Results
  // ============================================================================
  // Day 0 - All passed
  openaiDaily0SendMessage: {
    id: "rt_openai_d0_send",
    runId: seedRuns.openaiDaily0.id,
    testId: seedTests.sendMessage.id,
    testVersionId: seedTestVersions.sendMessageV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 58000,
    error: null,
  },
  openaiDaily0Regenerate: {
    id: "rt_openai_d0_regen",
    runId: seedRuns.openaiDaily0.id,
    testId: seedTests.regenerateResponse.id,
    testVersionId: seedTestVersions.regenerateResponseV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 62000,
    error: null,
  },
  openaiDaily0NewChat: {
    id: "rt_openai_d0_newchat",
    runId: seedRuns.openaiDaily0.id,
    testId: seedTests.startNewChat.id,
    testVersionId: seedTestVersions.startNewChatV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 45000,
    error: null,
  },
  openaiDaily0Login: {
    id: "rt_openai_d0_login",
    runId: seedRuns.openaiDaily0.id,
    testId: seedTests.loginWithEmail.id,
    testVersionId: seedTestVersions.loginWithEmailV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 80000,
    error: null,
  },
  // Day 1 - All passed
  openaiDaily1SendMessage: {
    id: "rt_openai_d1_send",
    runId: seedRuns.openaiDaily1.id,
    testId: seedTests.sendMessage.id,
    testVersionId: seedTestVersions.sendMessageV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 55000,
    error: null,
  },
  openaiDaily1Regenerate: {
    id: "rt_openai_d1_regen",
    runId: seedRuns.openaiDaily1.id,
    testId: seedTests.regenerateResponse.id,
    testVersionId: seedTestVersions.regenerateResponseV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 59000,
    error: null,
  },
  openaiDaily1NewChat: {
    id: "rt_openai_d1_newchat",
    runId: seedRuns.openaiDaily1.id,
    testId: seedTests.startNewChat.id,
    testVersionId: seedTestVersions.startNewChatV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 44000,
    error: null,
  },
  openaiDaily1Login: {
    id: "rt_openai_d1_login",
    runId: seedRuns.openaiDaily1.id,
    testId: seedTests.loginWithEmail.id,
    testVersionId: seedTestVersions.loginWithEmailV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 80000,
    error: null,
  },
  // Day 2 - Failed (2 passed, 2 failed)
  openaiDaily2SendMessage: {
    id: "rt_openai_d2_send",
    runId: seedRuns.openaiDaily2.id,
    testId: seedTests.sendMessage.id,
    testVersionId: seedTestVersions.sendMessageV1.id,
    status: "failed",
    attempt: 1,
    durationMs: 95000,
    error: {
      message: "Timeout waiting for streaming response",
      stack: "Error: Timeout waiting for streaming response\n    at waitForSelector (chat.spec.ts:45)",
      type: "TimeoutError",
    },
  },
  openaiDaily2Regenerate: {
    id: "rt_openai_d2_regen",
    runId: seedRuns.openaiDaily2.id,
    testId: seedTests.regenerateResponse.id,
    testVersionId: seedTestVersions.regenerateResponseV1.id,
    status: "failed",
    attempt: 1,
    durationMs: 87000,
    error: {
      message: "Regenerate button not found",
      stack: "Error: Regenerate button not found\n    at click (chat.spec.ts:78)",
      type: "ElementNotFoundError",
    },
  },
  openaiDaily2NewChat: {
    id: "rt_openai_d2_newchat",
    runId: seedRuns.openaiDaily2.id,
    testId: seedTests.startNewChat.id,
    testVersionId: seedTestVersions.startNewChatV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 48000,
    error: null,
  },
  openaiDaily2Login: {
    id: "rt_openai_d2_login",
    runId: seedRuns.openaiDaily2.id,
    testId: seedTests.loginWithEmail.id,
    testVersionId: seedTestVersions.loginWithEmailV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 82000,
    error: null,
  },
  // Day 3 - All passed
  openaiDaily3SendMessage: {
    id: "rt_openai_d3_send",
    runId: seedRuns.openaiDaily3.id,
    testId: seedTests.sendMessage.id,
    testVersionId: seedTestVersions.sendMessageV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 60000,
    error: null,
  },
  openaiDaily3Regenerate: {
    id: "rt_openai_d3_regen",
    runId: seedRuns.openaiDaily3.id,
    testId: seedTests.regenerateResponse.id,
    testVersionId: seedTestVersions.regenerateResponseV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 63000,
    error: null,
  },
  openaiDaily3NewChat: {
    id: "rt_openai_d3_newchat",
    runId: seedRuns.openaiDaily3.id,
    testId: seedTests.startNewChat.id,
    testVersionId: seedTestVersions.startNewChatV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 46000,
    error: null,
  },
  openaiDaily3Login: {
    id: "rt_openai_d3_login",
    runId: seedRuns.openaiDaily3.id,
    testId: seedTests.loginWithEmail.id,
    testVersionId: seedTestVersions.loginWithEmailV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 82000,
    error: null,
  },
  // Day 4 - Flaky (1 test was flaky)
  openaiDaily4SendMessage: {
    id: "rt_openai_d4_send",
    runId: seedRuns.openaiDaily4.id,
    testId: seedTests.sendMessage.id,
    testVersionId: seedTestVersions.sendMessageV1.id,
    status: "flaky",
    attempt: 2,
    durationMs: 125000,
    error: null,
  },
  openaiDaily4Regenerate: {
    id: "rt_openai_d4_regen",
    runId: seedRuns.openaiDaily4.id,
    testId: seedTests.regenerateResponse.id,
    testVersionId: seedTestVersions.regenerateResponseV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 61000,
    error: null,
  },
  openaiDaily4NewChat: {
    id: "rt_openai_d4_newchat",
    runId: seedRuns.openaiDaily4.id,
    testId: seedTests.startNewChat.id,
    testVersionId: seedTestVersions.startNewChatV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 47000,
    error: null,
  },
  openaiDaily4Login: {
    id: "rt_openai_d4_login",
    runId: seedRuns.openaiDaily4.id,
    testId: seedTests.loginWithEmail.id,
    testVersionId: seedTestVersions.loginWithEmailV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 79000,
    error: null,
  },
  // Day 5 - All passed
  openaiDaily5SendMessage: {
    id: "rt_openai_d5_send",
    runId: seedRuns.openaiDaily5.id,
    testId: seedTests.sendMessage.id,
    testVersionId: seedTestVersions.sendMessageV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 57000,
    error: null,
  },
  openaiDaily5Regenerate: {
    id: "rt_openai_d5_regen",
    runId: seedRuns.openaiDaily5.id,
    testId: seedTests.regenerateResponse.id,
    testVersionId: seedTestVersions.regenerateResponseV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 60000,
    error: null,
  },
  openaiDaily5NewChat: {
    id: "rt_openai_d5_newchat",
    runId: seedRuns.openaiDaily5.id,
    testId: seedTests.startNewChat.id,
    testVersionId: seedTestVersions.startNewChatV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 45000,
    error: null,
  },
  openaiDaily5Login: {
    id: "rt_openai_d5_login",
    runId: seedRuns.openaiDaily5.id,
    testId: seedTests.loginWithEmail.id,
    testVersionId: seedTestVersions.loginWithEmailV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 80000,
    error: null,
  },
  // Day 6 - Failed (3 passed, 1 failed)
  openaiDaily6SendMessage: {
    id: "rt_openai_d6_send",
    runId: seedRuns.openaiDaily6.id,
    testId: seedTests.sendMessage.id,
    testVersionId: seedTestVersions.sendMessageV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 58000,
    error: null,
  },
  openaiDaily6Regenerate: {
    id: "rt_openai_d6_regen",
    runId: seedRuns.openaiDaily6.id,
    testId: seedTests.regenerateResponse.id,
    testVersionId: seedTestVersions.regenerateResponseV1.id,
    status: "failed",
    attempt: 1,
    durationMs: 92000,
    error: {
      message: "Response content mismatch after regeneration",
      stack: "Error: Response content mismatch\n    at expect (chat.spec.ts:92)",
      type: "AssertionError",
    },
  },
  openaiDaily6NewChat: {
    id: "rt_openai_d6_newchat",
    runId: seedRuns.openaiDaily6.id,
    testId: seedTests.startNewChat.id,
    testVersionId: seedTestVersions.startNewChatV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 46000,
    error: null,
  },
  openaiDaily6Login: {
    id: "rt_openai_d6_login",
    runId: seedRuns.openaiDaily6.id,
    testId: seedTests.loginWithEmail.id,
    testVersionId: seedTestVersions.loginWithEmailV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 81000,
    error: null,
  },
  // Day 7 - All passed
  openaiDaily7SendMessage: {
    id: "rt_openai_d7_send",
    runId: seedRuns.openaiDaily7.id,
    testId: seedTests.sendMessage.id,
    testVersionId: seedTestVersions.sendMessageV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 59000,
    error: null,
  },
  openaiDaily7Regenerate: {
    id: "rt_openai_d7_regen",
    runId: seedRuns.openaiDaily7.id,
    testId: seedTests.regenerateResponse.id,
    testVersionId: seedTestVersions.regenerateResponseV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 62000,
    error: null,
  },
  openaiDaily7NewChat: {
    id: "rt_openai_d7_newchat",
    runId: seedRuns.openaiDaily7.id,
    testId: seedTests.startNewChat.id,
    testVersionId: seedTestVersions.startNewChatV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 48000,
    error: null,
  },
  openaiDaily7Login: {
    id: "rt_openai_d7_login",
    runId: seedRuns.openaiDaily7.id,
    testId: seedTests.loginWithEmail.id,
    testVersionId: seedTestVersions.loginWithEmailV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 86000,
    error: null,
  },
  // Day 8 - All passed
  openaiDaily8SendMessage: {
    id: "rt_openai_d8_send",
    runId: seedRuns.openaiDaily8.id,
    testId: seedTests.sendMessage.id,
    testVersionId: seedTestVersions.sendMessageV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 56000,
    error: null,
  },
  openaiDaily8Regenerate: {
    id: "rt_openai_d8_regen",
    runId: seedRuns.openaiDaily8.id,
    testId: seedTests.regenerateResponse.id,
    testVersionId: seedTestVersions.regenerateResponseV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 61000,
    error: null,
  },
  openaiDaily8NewChat: {
    id: "rt_openai_d8_newchat",
    runId: seedRuns.openaiDaily8.id,
    testId: seedTests.startNewChat.id,
    testVersionId: seedTestVersions.startNewChatV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 45000,
    error: null,
  },
  openaiDaily8Login: {
    id: "rt_openai_d8_login",
    runId: seedRuns.openaiDaily8.id,
    testId: seedTests.loginWithEmail.id,
    testVersionId: seedTestVersions.loginWithEmailV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 86000,
    error: null,
  },
  // Day 9 - Flaky (2 tests were flaky)
  openaiDaily9SendMessage: {
    id: "rt_openai_d9_send",
    runId: seedRuns.openaiDaily9.id,
    testId: seedTests.sendMessage.id,
    testVersionId: seedTestVersions.sendMessageV1.id,
    status: "flaky",
    attempt: 2,
    durationMs: 118000,
    error: null,
  },
  openaiDaily9Regenerate: {
    id: "rt_openai_d9_regen",
    runId: seedRuns.openaiDaily9.id,
    testId: seedTests.regenerateResponse.id,
    testVersionId: seedTestVersions.regenerateResponseV1.id,
    status: "flaky",
    attempt: 3,
    durationMs: 185000,
    error: null,
  },
  openaiDaily9NewChat: {
    id: "rt_openai_d9_newchat",
    runId: seedRuns.openaiDaily9.id,
    testId: seedTests.startNewChat.id,
    testVersionId: seedTestVersions.startNewChatV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 47000,
    error: null,
  },
  openaiDaily9Login: {
    id: "rt_openai_d9_login",
    runId: seedRuns.openaiDaily9.id,
    testId: seedTests.loginWithEmail.id,
    testVersionId: seedTestVersions.loginWithEmailV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 82000,
    error: null,
  },
  // Day 10 - All passed
  openaiDaily10SendMessage: {
    id: "rt_openai_d10_send",
    runId: seedRuns.openaiDaily10.id,
    testId: seedTests.sendMessage.id,
    testVersionId: seedTestVersions.sendMessageV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 55000,
    error: null,
  },
  openaiDaily10Regenerate: {
    id: "rt_openai_d10_regen",
    runId: seedRuns.openaiDaily10.id,
    testId: seedTests.regenerateResponse.id,
    testVersionId: seedTestVersions.regenerateResponseV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 60000,
    error: null,
  },
  openaiDaily10NewChat: {
    id: "rt_openai_d10_newchat",
    runId: seedRuns.openaiDaily10.id,
    testId: seedTests.startNewChat.id,
    testVersionId: seedTestVersions.startNewChatV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 44000,
    error: null,
  },
  openaiDaily10Login: {
    id: "rt_openai_d10_login",
    runId: seedRuns.openaiDaily10.id,
    testId: seedTests.loginWithEmail.id,
    testVersionId: seedTestVersions.loginWithEmailV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 80000,
    error: null,
  },
  // Day 11 - All passed
  openaiDaily11SendMessage: {
    id: "rt_openai_d11_send",
    runId: seedRuns.openaiDaily11.id,
    testId: seedTests.sendMessage.id,
    testVersionId: seedTestVersions.sendMessageV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 58000,
    error: null,
  },
  openaiDaily11Regenerate: {
    id: "rt_openai_d11_regen",
    runId: seedRuns.openaiDaily11.id,
    testId: seedTests.regenerateResponse.id,
    testVersionId: seedTestVersions.regenerateResponseV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 63000,
    error: null,
  },
  openaiDaily11NewChat: {
    id: "rt_openai_d11_newchat",
    runId: seedRuns.openaiDaily11.id,
    testId: seedTests.startNewChat.id,
    testVersionId: seedTestVersions.startNewChatV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 46000,
    error: null,
  },
  openaiDaily11Login: {
    id: "rt_openai_d11_login",
    runId: seedRuns.openaiDaily11.id,
    testId: seedTests.loginWithEmail.id,
    testVersionId: seedTestVersions.loginWithEmailV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 86000,
    error: null,
  },
  // Day 12 - Failed (2 passed, 2 failed)
  openaiDaily12SendMessage: {
    id: "rt_openai_d12_send",
    runId: seedRuns.openaiDaily12.id,
    testId: seedTests.sendMessage.id,
    testVersionId: seedTestVersions.sendMessageV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 57000,
    error: null,
  },
  openaiDaily12Regenerate: {
    id: "rt_openai_d12_regen",
    runId: seedRuns.openaiDaily12.id,
    testId: seedTests.regenerateResponse.id,
    testVersionId: seedTestVersions.regenerateResponseV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 62000,
    error: null,
  },
  openaiDaily12NewChat: {
    id: "rt_openai_d12_newchat",
    runId: seedRuns.openaiDaily12.id,
    testId: seedTests.startNewChat.id,
    testVersionId: seedTestVersions.startNewChatV1.id,
    status: "failed",
    attempt: 1,
    durationMs: 90000,
    error: {
      message: "New chat button unresponsive",
      stack: "Error: New chat button unresponsive\n    at click (conversation.spec.ts:15)",
      type: "ElementNotInteractableError",
    },
  },
  openaiDaily12Login: {
    id: "rt_openai_d12_login",
    runId: seedRuns.openaiDaily12.id,
    testId: seedTests.loginWithEmail.id,
    testVersionId: seedTestVersions.loginWithEmailV1.id,
    status: "failed",
    attempt: 1,
    durationMs: 95000,
    error: {
      message: "Login form not found on page",
      stack: "Error: Login form not found\n    at waitForSelector (auth.spec.ts:23)",
      type: "TimeoutError",
    },
  },
  // Day 13 - All passed
  openaiDaily13SendMessage: {
    id: "rt_openai_d13_send",
    runId: seedRuns.openaiDaily13.id,
    testId: seedTests.sendMessage.id,
    testVersionId: seedTestVersions.sendMessageV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 56000,
    error: null,
  },
  openaiDaily13Regenerate: {
    id: "rt_openai_d13_regen",
    runId: seedRuns.openaiDaily13.id,
    testId: seedTests.regenerateResponse.id,
    testVersionId: seedTestVersions.regenerateResponseV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 60000,
    error: null,
  },
  openaiDaily13NewChat: {
    id: "rt_openai_d13_newchat",
    runId: seedRuns.openaiDaily13.id,
    testId: seedTests.startNewChat.id,
    testVersionId: seedTestVersions.startNewChatV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 45000,
    error: null,
  },
  openaiDaily13Login: {
    id: "rt_openai_d13_login",
    runId: seedRuns.openaiDaily13.id,
    testId: seedTests.loginWithEmail.id,
    testVersionId: seedTestVersions.loginWithEmailV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 83000,
    error: null,
  },
  // Day 14 - All passed
  openaiDaily14SendMessage: {
    id: "rt_openai_d14_send",
    runId: seedRuns.openaiDaily14.id,
    testId: seedTests.sendMessage.id,
    testVersionId: seedTestVersions.sendMessageV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 58000,
    error: null,
  },
  openaiDaily14Regenerate: {
    id: "rt_openai_d14_regen",
    runId: seedRuns.openaiDaily14.id,
    testId: seedTests.regenerateResponse.id,
    testVersionId: seedTestVersions.regenerateResponseV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 64000,
    error: null,
  },
  openaiDaily14NewChat: {
    id: "rt_openai_d14_newchat",
    runId: seedRuns.openaiDaily14.id,
    testId: seedTests.startNewChat.id,
    testVersionId: seedTestVersions.startNewChatV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 47000,
    error: null,
  },
  openaiDaily14Login: {
    id: "rt_openai_d14_login",
    runId: seedRuns.openaiDaily14.id,
    testId: seedTests.loginWithEmail.id,
    testVersionId: seedTestVersions.loginWithEmailV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 92000,
    error: null,
  },
  // OpenAI Manual Run 1 - Full regression with mixed results
  openaiManual1SendMessage: {
    id: "rt_openai_m1_send",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.sendMessage.id,
    testVersionId: seedTestVersions.sendMessageV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 54000,
    error: null,
  },
  openaiManual1Regenerate: {
    id: "rt_openai_m1_regen",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.regenerateResponse.id,
    testVersionId: seedTestVersions.regenerateResponseV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 58000,
    error: null,
  },
  openaiManual1CopyResponse: {
    id: "rt_openai_m1_copy",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.copyResponse.id,
    testVersionId: seedTestVersions.copyResponseV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 32000,
    error: null,
  },
  openaiManual1StopGeneration: {
    id: "rt_openai_m1_stop",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.stopGeneration.id,
    testVersionId: seedTestVersions.stopGenerationV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 28000,
    error: null,
  },
  openaiManual1EditMessage: {
    id: "rt_openai_m1_edit",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.editPreviousMessage.id,
    testVersionId: seedTestVersions.editPreviousMessageV1.id,
    status: "flaky",
    attempt: 2,
    durationMs: 95000,
    error: null,
  },
  openaiManual1CodeBlock: {
    id: "rt_openai_m1_code",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.codeBlockFormatting.id,
    testVersionId: seedTestVersions.codeBlockFormattingV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 45000,
    error: null,
  },
  openaiManual1Markdown: {
    id: "rt_openai_m1_md",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.markdownRendering.id,
    testVersionId: seedTestVersions.markdownRenderingV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 38000,
    error: null,
  },
  openaiManual1NewChat: {
    id: "rt_openai_m1_newchat",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.startNewChat.id,
    testVersionId: seedTestVersions.startNewChatV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 42000,
    error: null,
  },
  openaiManual1RenameConv: {
    id: "rt_openai_m1_rename",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.renameConversation.id,
    testVersionId: seedTestVersions.renameConversationV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 35000,
    error: null,
  },
  openaiManual1DeleteConv: {
    id: "rt_openai_m1_delete",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.deleteConversation.id,
    testVersionId: seedTestVersions.deleteConversationV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 40000,
    error: null,
  },
  openaiManual1SearchConv: {
    id: "rt_openai_m1_search",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.searchConversations.id,
    testVersionId: seedTestVersions.searchConversationsV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 52000,
    error: null,
  },
  openaiManual1ShareConv: {
    id: "rt_openai_m1_share",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.shareConversation.id,
    testVersionId: seedTestVersions.shareConversationV1.id,
    status: "skipped",
    attempt: 0,
    durationMs: 0,
    error: null,
  },
  openaiManual1CodeInterpreter: {
    id: "rt_openai_m1_ci",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.enableCodeInterpreter.id,
    testVersionId: seedTestVersions.enableCodeInterpreterV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 78000,
    error: null,
  },
  openaiManual1Dalle: {
    id: "rt_openai_m1_dalle",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.dalleImageGeneration.id,
    testVersionId: seedTestVersions.dalleImageGenerationV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 125000,
    error: null,
  },
  openaiManual1Browsing: {
    id: "rt_openai_m1_browse",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.browsingPlugin.id,
    testVersionId: seedTestVersions.browsingPluginV1.id,
    status: "failed",
    attempt: 1,
    durationMs: 95000,
    error: {
      message: "Browsing plugin timed out fetching external content",
      stack: "Error: Browsing plugin timeout\n    at fetchContent (plugins.spec.ts:89)",
      type: "TimeoutError",
    },
  },
  openaiManual1LoginEmail: {
    id: "rt_openai_m1_login_email",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.loginWithEmail.id,
    testVersionId: seedTestVersions.loginWithEmailV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 82000,
    error: null,
  },
  openaiManual1LoginGoogle: {
    id: "rt_openai_m1_login_google",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.loginWithGoogle.id,
    testVersionId: seedTestVersions.loginWithGoogleV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 95000,
    error: null,
  },
  openaiManual1Logout: {
    id: "rt_openai_m1_logout",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.openaiLogout.id,
    testVersionId: seedTestVersions.openaiLogoutV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 28000,
    error: null,
  },
  openaiManual1ModelSelect: {
    id: "rt_openai_m1_model",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.changeModelSelection.id,
    testVersionId: seedTestVersions.changeModelSelectionV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 35000,
    error: null,
  },
  openaiManual1DarkMode: {
    id: "rt_openai_m1_dark",
    runId: seedRuns.openaiManualRun1.id,
    testId: seedTests.toggleDarkMode.id,
    testVersionId: seedTestVersions.toggleDarkModeV1.id,
    status: "passed",
    attempt: 1,
    durationMs: 22000,
    error: null,
  },
};

// ============================================================================
// Seed Data Definitions - Test Tags (links tests to tags)
// ============================================================================

export const seedTestTags = {
  // Amazon Storefront test tags
  searchProductsSmoke: {
    id: "tt_seed_search_smoke",
    testId: seedTests.searchProducts.id,
    tagId: seedTags.amazonSmoke.id,
  },
  searchProductsCritical: {
    id: "tt_seed_search_critical",
    testId: seedTests.searchProducts.id,
    tagId: seedTags.amazonCritical.id,
  },
  filterCategoryRegression: {
    id: "tt_seed_filter_cat_regression",
    testId: seedTests.filterByCategory.id,
    tagId: seedTags.amazonRegression.id,
  },
  filterPriceRegression: {
    id: "tt_seed_filter_price_regression",
    testId: seedTests.filterByPrice.id,
    tagId: seedTags.amazonRegression.id,
  },
  filterPriceFlaky: {
    id: "tt_seed_filter_price_flaky",
    testId: seedTests.filterByPrice.id,
    tagId: seedTags.amazonFlaky.id,
  },
  sortRatingUI: {
    id: "tt_seed_sort_rating_ui",
    testId: seedTests.sortByRating.id,
    tagId: seedTags.amazonUI.id,
  },
  sortRatingFlaky: {
    id: "tt_seed_sort_rating_flaky",
    testId: seedTests.sortByRating.id,
    tagId: seedTags.amazonFlaky.id,
  },
  addToCartSmoke: {
    id: "tt_seed_cart_smoke",
    testId: seedTests.addToCart.id,
    tagId: seedTags.amazonSmoke.id,
  },
  addToCartCritical: {
    id: "tt_seed_cart_critical",
    testId: seedTests.addToCart.id,
    tagId: seedTags.amazonCritical.id,
  },
  userLoginSmoke: {
    id: "tt_seed_login_smoke",
    testId: seedTests.userLogin.id,
    tagId: seedTags.amazonSmoke.id,
  },
  userLoginCritical: {
    id: "tt_seed_login_critical",
    testId: seedTests.userLogin.id,
    tagId: seedTags.amazonCritical.id,
  },
  viewProductUI: {
    id: "tt_seed_view_product_ui",
    testId: seedTests.viewProductDetails.id,
    tagId: seedTags.amazonUI.id,
  },
  viewReviewsUI: {
    id: "tt_seed_view_reviews_ui",
    testId: seedTests.viewProductReviews.id,
    tagId: seedTags.amazonUI.id,
  },
  // Additional Amazon tags
  removeFromCartRegression: {
    id: "tt_seed_remove_cart_regression",
    testId: seedTests.removeFromCart.id,
    tagId: seedTags.amazonRegression.id,
  },
  removeFromCartUI: {
    id: "tt_seed_remove_cart_ui",
    testId: seedTests.removeFromCart.id,
    tagId: seedTags.amazonUI.id,
  },
  updateQuantityRegression: {
    id: "tt_seed_update_qty_regression",
    testId: seedTests.updateCartQuantity.id,
    tagId: seedTags.amazonRegression.id,
  },
  // Save for later tags (5 tags)
  saveForLaterSmoke: {
    id: "tt_seed_save_later_smoke",
    testId: seedTests.saveForLater.id,
    tagId: seedTags.amazonSmoke.id,
  },
  saveForLaterRegression: {
    id: "tt_seed_save_later_regression",
    testId: seedTests.saveForLater.id,
    tagId: seedTags.amazonRegression.id,
  },
  saveForLaterCritical: {
    id: "tt_seed_save_later_critical",
    testId: seedTests.saveForLater.id,
    tagId: seedTags.amazonCritical.id,
  },
  saveForLaterFlaky: {
    id: "tt_seed_save_later_flaky",
    testId: seedTests.saveForLater.id,
    tagId: seedTags.amazonFlaky.id,
  },
  saveForLaterUI: {
    id: "tt_seed_save_later_ui",
    testId: seedTests.saveForLater.id,
    tagId: seedTags.amazonUI.id,
  },
  // Stripe test tags
  createSubSmoke: {
    id: "tt_seed_stripe_create_smoke",
    testId: seedTests.createSubscription.id,
    tagId: seedTags.stripeSmoke.id,
  },
  createSubCritical: {
    id: "tt_seed_stripe_create_critical",
    testId: seedTests.createSubscription.id,
    tagId: seedTags.stripeCritical.id,
  },
  // GitHub test tags
  createPRSmoke: {
    id: "tt_seed_github_pr_smoke",
    testId: seedTests.createPullRequest.id,
    tagId: seedTags.githubSmoke.id,
  },
  createPRCritical: {
    id: "tt_seed_github_pr_critical",
    testId: seedTests.createPullRequest.id,
    tagId: seedTags.githubCritical.id,
  },
  // OpenAI test tags
  sendMessageSmoke: {
    id: "tt_seed_openai_send_smoke",
    testId: seedTests.sendMessage.id,
    tagId: seedTags.openaiSmoke.id,
  },
  sendMessageStreaming: {
    id: "tt_seed_openai_send_streaming",
    testId: seedTests.sendMessage.id,
    tagId: seedTags.openaiStreaming.id,
  },
} as const;

// ============================================================================
// Seed Data Definitions - Notification Channels
// ============================================================================

export const seedNotifChannels = {
  amazonOwnerEmail: {
    id: "nch_seed_amazon_owner_email",
    orgMemberId: seedOrgMembers.amazonOwner.id,
    name: "Work Email",
    type: "email",
    config: { email: "jeff.bezos@amazon.posium.dev" },
    enabled: true,
  },
  amazonOwnerSlack: {
    id: "nch_seed_amazon_owner_slack",
    orgMemberId: seedOrgMembers.amazonOwner.id,
    name: "Team Slack",
    type: "slack_webhook",
    config: {
      webhookUrl:
        "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX",
    },
    enabled: true,
  },
  stripeOwnerEmail: {
    id: "nch_seed_stripe_owner_email",
    orgMemberId: seedOrgMembers.stripeOwner.id,
    name: "Work Email",
    type: "email",
    config: { email: "david.martinez@stripe.posium.dev" },
    enabled: true,
  },
  githubOwnerEmail: {
    id: "nch_seed_github_owner_email",
    orgMemberId: seedOrgMembers.githubOwner.id,
    name: "Work Email",
    type: "email",
    config: { email: "sarah.chen@github.posium.dev" },
    enabled: true,
  },
} as const;

// ============================================================================
// Seed Data Definitions - Notification Rules
// ============================================================================

export const seedNotifRules = {
  amazonOwnerDailyEmail: {
    id: "nrl_seed_amazon_owner_daily",
    orgMemberId: seedOrgMembers.amazonOwner.id,
    event: "daily_status",
    channelId: seedNotifChannels.amazonOwnerEmail.id,
    enabled: true,
  },
  amazonOwnerWeeklySlack: {
    id: "nrl_seed_amazon_owner_weekly",
    orgMemberId: seedOrgMembers.amazonOwner.id,
    event: "weekly_status",
    channelId: seedNotifChannels.amazonOwnerSlack.id,
    enabled: true,
  },
  stripeOwnerRunFailed: {
    id: "nrl_seed_stripe_owner_failed",
    orgMemberId: seedOrgMembers.stripeOwner.id,
    event: "run_failed",
    channelId: seedNotifChannels.stripeOwnerEmail.id,
    enabled: true,
  },
} as const;

// ============================================================================
// Seed Application Functions
// ============================================================================

/**
 * Seed options for configuring applySeed behavior.
 */
export interface SeedOptions {
  /**
   * Auth secret for creating credential accounts.
   * MUST match the secret used by the app at runtime.
   * Defaults to the E2E test secret.
   */
  secret?: string;
}

// Build email -> seedId mapping for custom ID generation
const emailToSeedId = new Map<string, string>();
for (const user of Object.values(seedUsers)) {
  emailToSeedId.set(user.email, user.id);
}

// Track current signup email for ID generation (set before signUpEmail call)
let pendingSignupEmail: string | null = null;

/**
 * Set the email for the next signup to enable custom ID generation.
 * Must be called before auth.api.signUpEmail().
 */
function setSeedSignupEmail(email: string): void {
  pendingSignupEmail = email;
}

/**
 * Creates a minimal Better Auth instance for seeding.
 * Uses custom ID generation to preserve seed user IDs.
 */
function createSeedAuth(db: DBType, secret: string) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    secret,
    emailAndPassword: { enabled: true },
    plugins: [admin(), apiKey(), organization()],
    advanced: {
      database: {
        // Custom ID generation to preserve seed user IDs
        generateId: (options): string | false => {
          if (options.model === "user" && pendingSignupEmail) {
            const seedId = emailToSeedId.get(pendingSignupEmail);
            pendingSignupEmail = null; // Reset for next signup
            if (seedId) {
              return seedId;
            }
          }
          // Default: let Better Auth generate ID
          return false;
        },
      },
    },
  });
}

/**
 * Apply all seed data to the database.
 * Creates users via Better Auth API with credential accounts (enabling password login).
 *
 * @param db - Database instance
 * @param options - Optional seed configuration
 *
 * @example
 * ```ts
 * // Default usage (uses default E2E test secret)
 * await applySeed(db);
 *
 * // With custom secret (for production seeding)
 * await applySeed(db, { secret: process.env.BETTER_AUTH_SECRET });
 * ```
 */
export async function applySeed(
  db: DBType,
  options: SeedOptions = {},
): Promise<void> {
  console.log("🌱 Applying seed data...\n");

  const { secret = DEFAULT_SEED_SECRET } = options;

  // Create auth instance for user signup
  const auth = createSeedAuth(db, secret);

  // Create users via Better Auth API (enables password login)
  // Uses custom ID generation to preserve hardcoded seed IDs
  console.log("   Creating users...");
  for (const [key, seedUser] of Object.entries(seedUsers)) {
    const password = seedUserPasswords[key as keyof typeof seedUserPasswords];

    // Check if user already exists (idempotent - skip if exists)
    const existingUser = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.id, seedUser.id))
      .limit(1);

    if (existingUser.length > 0) {
      console.log(`      Skipping ${key}: already exists`);
      // Update user fields in case seed data changed
      await db
        .update(schema.user)
        .set({
          name: seedUser.name,
          role: seedUser.role,
          banned: seedUser.banned,
          banReason: "banReason" in seedUser ? seedUser.banReason : null,
          image: seedUser.image,
          emailVerified: seedUser.emailVerified,
        })
        .where(eq(schema.user.id, seedUser.id));
      continue;
    }

    console.log(`      Creating ${key}: ${seedUser.email}`);

    try {
      // Set pending email for custom ID generation
      setSeedSignupEmail(seedUser.email);

      const result = await auth.api.signUpEmail({
        body: {
          email: seedUser.email,
          password,
          name: seedUser.name,
        },
      });

      console.log(`      Created user: ${result.user.id}`);

      // Update user with additional fields (role, banned, image, emailVerified)
      await db
        .update(schema.user)
        .set({
          role: seedUser.role,
          banned: seedUser.banned,
          banReason: "banReason" in seedUser ? seedUser.banReason : null,
          image: seedUser.image,
          emailVerified: seedUser.emailVerified,
        })
        .where(eq(schema.user.id, result.user.id));
    } catch (error) {
      console.error(`      ERROR creating ${key}:`, error);
      throw error;
    }
  }

  // Organizations
  console.log("   Creating organizations...");
  for (const org of Object.values(seedOrgs)) {
    await db
      .insert(schema.org)
      .values(org)
      .onConflictDoUpdate({
        target: schema.org.id,
        set: { ...org, updatedAt: sql`now()` },
      });
  }

  // Org Members
  console.log("   Creating org members...");
  for (const member of Object.values(seedOrgMembers)) {
    await db
      .insert(schema.orgMember)
      .values(member)
      .onConflictDoUpdate({
        target: schema.orgMember.id,
        set: { ...member, updatedAt: sql`now()` },
      });
  }

  // Projects
  console.log("   Creating projects...");
  for (const project of Object.values(seedProjects)) {
    await db
      .insert(schema.project)
      .values(project)
      .onConflictDoUpdate({
        target: schema.project.id,
        set: { ...project, updatedAt: sql`now()` },
      });
  }

  // Project Members
  console.log("   Creating project members...");
  for (const member of Object.values(seedProjectMembers)) {
    await db
      .insert(schema.projectMember)
      .values(member)
      .onConflictDoUpdate({
        target: schema.projectMember.id,
        set: { ...member, updatedAt: sql`now()` },
      });
  }

  // Environments
  console.log("   Creating environments...");
  for (const env of Object.values(seedEnvironments)) {
    await db
      .insert(schema.environment)
      .values(env)
      .onConflictDoUpdate({
        target: schema.environment.id,
        set: { ...env, updatedAt: sql`now()` },
      });
  }

  // Suites
  console.log("   Creating test suites...");
  for (const suite of Object.values(seedSuites)) {
    await db
      .insert(schema.suite)
      .values(suite)
      .onConflictDoUpdate({
        target: schema.suite.id,
        set: { ...suite, updatedAt: sql`now()` },
      });
  }

  // Tests
  console.log("   Creating tests...");
  for (const test of Object.values(seedTests)) {
    await db
      .insert(schema.test)
      .values(test)
      .onConflictDoUpdate({
        target: schema.test.id,
        set: { ...test, updatedAt: sql`now()` },
      });
  }

  // Test Versions
  console.log("   Creating test versions...");
  for (const version of Object.values(seedTestVersions)) {
    await db
      .insert(schema.testVersion)
      .values(version)
      .onConflictDoUpdate({
        target: schema.testVersion.id,
        set: { ...version, updatedAt: sql`now()` },
      });
  }

  // Tags
  console.log("   Creating tags...");
  for (const tag of Object.values(seedTags)) {
    await db
      .insert(schema.tag)
      .values(tag)
      .onConflictDoUpdate({
        target: schema.tag.id,
        set: { ...tag, updatedAt: sql`now()` },
      });
  }

  // Plans
  console.log("   Creating plans...");
  for (const plan of Object.values(seedPlans)) {
    await db
      .insert(schema.plan)
      .values(plan)
      .onConflictDoUpdate({
        target: schema.plan.id,
        set: { ...plan, updatedAt: sql`now()` },
      });
  }

  // Plan Items
  console.log("   Creating plan items...");
  for (const planItem of Object.values(seedPlanItems)) {
    await db
      .insert(schema.planItem)
      .values(planItem)
      .onConflictDoUpdate({
        target: schema.planItem.id,
        set: { ...planItem, updatedAt: sql`now()` },
      });
  }

  // Schedules
  console.log("   Creating schedules...");
  for (const schedule of Object.values(seedSchedules)) {
    await db
      .insert(schema.schedule)
      .values(schedule)
      .onConflictDoUpdate({
        target: schema.schedule.id,
        set: { ...schedule, updatedAt: sql`now()` },
      });
  }

  // Runs
  console.log("   Creating test runs...");
  for (const run of Object.values(seedRuns)) {
    await db
      .insert(schema.run)
      .values(run)
      .onConflictDoUpdate({
        target: schema.run.id,
        set: { ...run, updatedAt: sql`now()` },
      });
  }

  // Run Tests (individual test results within runs)
  console.log("   Creating run tests...");
  for (const runTest of Object.values(seedRunTests)) {
    await db
      .insert(schema.runTest)
      .values(runTest)
      .onConflictDoUpdate({
        target: schema.runTest.id,
        set: { ...runTest, updatedAt: sql`now()` },
      });
  }

  // Test Tags (links tests to tags)
  console.log("   Creating test tags...");
  for (const testTag of Object.values(seedTestTags)) {
    await db
      .insert(schema.testTag)
      .values(testTag)
      .onConflictDoUpdate({
        target: schema.testTag.id,
        set: { ...testTag, updatedAt: sql`now()` },
      });
  }

  // Notification Channels
  console.log("   Creating notification channels...");
  for (const channel of Object.values(seedNotifChannels)) {
    await db
      .insert(schema.orgMemberNotifChannel)
      .values(channel)
      .onConflictDoUpdate({
        target: schema.orgMemberNotifChannel.id,
        set: { ...channel, updatedAt: sql`now()` },
      });
  }

  // Notification Rules
  console.log("   Creating notification rules...");
  for (const rule of Object.values(seedNotifRules)) {
    await db
      .insert(schema.orgMemberNotifRule)
      .values(rule)
      .onConflictDoUpdate({
        target: schema.orgMemberNotifRule.id,
        set: { ...rule, updatedAt: sql`now()` },
      });
  }

  console.log("\n✅ Seed data applied successfully!");
}

/**
 * Clear all seed data from the database.
 * Useful for resetting to a clean state.
 */
export async function clearSeed(db: DBType): Promise<void> {
  console.log("🧹 Clearing seed data...\n");

  // Delete in reverse order of dependencies
  const seedIds = {
    notifRules: Object.values(seedNotifRules).map((r) => r.id),
    notifChannels: Object.values(seedNotifChannels).map((c) => c.id),
    testTags: Object.values(seedTestTags).map((t) => t.id),
    runTests: Object.values(seedRunTests).map((r) => r.id),
    runs: Object.values(seedRuns).map((r) => r.id),
    schedules: Object.values(seedSchedules).map((s) => s.id),
    planItems: Object.values(seedPlanItems).map((p) => p.id),
    plans: Object.values(seedPlans).map((p) => p.id),
    tags: Object.values(seedTags).map((t) => t.id),
    testVersions: Object.values(seedTestVersions).map((v) => v.id),
    tests: Object.values(seedTests).map((t) => t.id),
    suites: Object.values(seedSuites).map((s) => s.id),
    environments: Object.values(seedEnvironments).map((e) => e.id),
    projectMembers: Object.values(seedProjectMembers).map((m) => m.id),
    projects: Object.values(seedProjects).map((p) => p.id),
    orgMembers: Object.values(seedOrgMembers).map((m) => m.id),
    orgs: Object.values(seedOrgs).map((o) => o.id),
    users: Object.values(seedUsers).map((u) => u.id),
  };

  console.log("   Removing notification rules...");
  await db
    .delete(schema.orgMemberNotifRule)
    .where(inArray(schema.orgMemberNotifRule.id, seedIds.notifRules));
  console.log("   Removing notification channels...");
  await db
    .delete(schema.orgMemberNotifChannel)
    .where(inArray(schema.orgMemberNotifChannel.id, seedIds.notifChannels));
  console.log("   Removing test tags...");
  await db
    .delete(schema.testTag)
    .where(inArray(schema.testTag.id, seedIds.testTags));
  console.log("   Removing run tests...");
  await db
    .delete(schema.runTest)
    .where(inArray(schema.runTest.id, seedIds.runTests));
  console.log("   Removing runs...");
  await db.delete(schema.run).where(inArray(schema.run.id, seedIds.runs));
  console.log("   Removing schedules...");
  await db
    .delete(schema.schedule)
    .where(inArray(schema.schedule.id, seedIds.schedules));
  console.log("   Removing plan items...");
  await db
    .delete(schema.planItem)
    .where(inArray(schema.planItem.id, seedIds.planItems));
  console.log("   Removing plans...");
  await db.delete(schema.plan).where(inArray(schema.plan.id, seedIds.plans));
  console.log("   Removing tags...");
  await db.delete(schema.tag).where(inArray(schema.tag.id, seedIds.tags));
  console.log("   Removing test versions...");
  await db
    .delete(schema.testVersion)
    .where(inArray(schema.testVersion.id, seedIds.testVersions));
  console.log("   Removing tests...");
  await db.delete(schema.test).where(inArray(schema.test.id, seedIds.tests));
  console.log("   Removing suites...");
  await db.delete(schema.suite).where(inArray(schema.suite.id, seedIds.suites));
  console.log("   Removing environments...");
  await db
    .delete(schema.environment)
    .where(inArray(schema.environment.id, seedIds.environments));
  console.log("   Removing project members...");
  await db
    .delete(schema.projectMember)
    .where(inArray(schema.projectMember.id, seedIds.projectMembers));
  console.log("   Removing projects...");
  await db
    .delete(schema.project)
    .where(inArray(schema.project.id, seedIds.projects));
  console.log("   Removing org members...");
  await db
    .delete(schema.orgMember)
    .where(inArray(schema.orgMember.id, seedIds.orgMembers));
  console.log("   Removing organizations...");
  await db.delete(schema.org).where(inArray(schema.org.id, seedIds.orgs));
  console.log("   Removing users...");
  await db.delete(schema.user).where(inArray(schema.user.id, seedIds.users));

  console.log("\n✅ Seed data cleared!");
}

// ============================================================================
// API Key Seed Data (Service Users)
// ============================================================================

/**
 * API key seeding requires BetterAuth instance.
 * Call this separately after applySeed() when auth is available.
 *
 * @example
 * ```ts
 * import { applySeed, seedApiKeys, seedApiKeyConfig } from "@posium/db/seed";
 * import { createAuth, getOrCreateServiceUser } from "@posium/auth/server";
 *
 * await applySeed(db);
 * const auth = createAuth(db, { secret: "..." });
 * await seedApiKeys(db, auth, getOrCreateServiceUser);
 * ```
 */
/**
 * API key configurations with hardcoded key values.
 * These key values are stable across test runs, allowing tests to import
 * them directly without needing the module-level cache.
 *
 * IMPORTANT: BetterAuth's customKeyGenerator returns the FULL key including prefix.
 * When we pass prefix: "apikey_" to createApiKey, BetterAuth passes { prefix: "apikey_" }
 * to customKeyGenerator, expecting it to use the prefix if desired.
 * The key returned by customKeyGenerator is used AS-IS (not prefixed again).
 */
export const seedApiKeyConfig = {
  amazonOrgWide: {
    name: "Amazon CI/CD Key",
    key: "apikey_seed_amazon_cicd_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3",
    orgId: seedOrgs.amazon.id,
    scope: "org" as const,
    projects: [] as string[],
    createdBy: seedUsers.amazonOwner.id,
  },
  amazonStorefrontOnly: {
    name: "Storefront Deploy Key",
    key: "apikey_seed_storefront_deploy_g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9",
    orgId: seedOrgs.amazon.id,
    scope: "project" as const,
    projects: [seedProjects.amazonStorefront.id],
    createdBy: seedUsers.amazonDev1.id,
  },
  stripeOrgWide: {
    name: "Stripe CI/CD Key",
    key: "apikey_seed_stripe_cicd_m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6",
    orgId: seedOrgs.stripe.id,
    scope: "org" as const,
    projects: [] as string[],
    createdBy: seedUsers.stripeOwner.id,
  },
  githubOrgWide: {
    name: "GitHub CI/CD Key",
    key: "apikey_seed_github_cicd_s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2",
    orgId: seedOrgs.github.id,
    scope: "org" as const,
    projects: [] as string[],
    createdBy: seedUsers.githubOwner.id,
  },
  // Test keys for security edge cases
  amazonDisabledKey: {
    name: "Disabled Test Key",
    key: "apikey_seed_disabled_test_d1s2a3b4l5e6d7k8e9y0t1e2s3t4k5e6y7v8a9l0u1e2s3",
    orgId: seedOrgs.amazon.id,
    scope: "org" as const,
    projects: [] as string[],
    createdBy: seedUsers.amazonOwner.id,
    disabled: true,
  },
  amazonExpiredKey: {
    name: "Expired Test Key",
    key: "apikey_seed_expired_test_e1x2p3i4r5e6d7k8e9y0t1e2s3t4k5e6y7v8a9l0u1e2s3",
    orgId: seedOrgs.amazon.id,
    scope: "org" as const,
    projects: [] as string[],
    createdBy: seedUsers.amazonOwner.id,
    expired: true,
  },
} as const;

/**
 * Get API key values for seeding (without prefix).
 * Returns the random portion of keys in the order they will be created by seedApiKeys().
 * customKeyGenerator will receive { length, prefix } and should return the full key.
 * BetterAuth uses this return value AS-IS (does not add prefix again).
 */
export function getSeedApiKeyValues(): string[] {
  return Object.values(seedApiKeyConfig).map((config) => config.key);
}

/** Result of seeding API keys */
export interface SeedApiKeyResult {
  name: string;
  key: string;
  orgId: string;
  id: string;
}

/**
 * Module-level cache for seeded API keys.
 * Populated during seedApiKeys() and accessed via getSeededApiKeys().
 * This avoids needing JSON files or other external storage.
 */
let seededApiKeysCache: SeedApiKeyResult[] | null = null;

/**
 * Get the seeded API keys.
 * Returns null if seedApiKeys() hasn't been called yet.
 *
 * @example
 * ```ts
 * import { getSeededApiKeys } from "@posium/db/seed";
 *
 * const keys = getSeededApiKeys();
 * const amazonKey = keys?.find(k => k.name === "Amazon CI/CD Key");
 * ```
 */
export function getSeededApiKeys(): SeedApiKeyResult[] | null {
  return seededApiKeysCache;
}

/**
 * Get a seeded API key by name.
 * Throws if keys haven't been seeded or key not found.
 *
 * @example
 * ```ts
 * import { getSeededApiKeyByName } from "@posium/db/seed";
 *
 * const key = getSeededApiKeyByName("Amazon CI/CD Key");
 * headers["x-api-key"] = key.key;
 * ```
 */
export function getSeededApiKeyByName(name: string): SeedApiKeyResult {
  if (!seededApiKeysCache) {
    throw new Error("API keys not seeded yet - call seedApiKeys() first");
  }
  const found = seededApiKeysCache.find((k) => k.name === name);
  if (!found) {
    throw new Error(
      `API key "${name}" not found. Available: ${seededApiKeysCache.map((k) => k.name).join(", ")}`,
    );
  }
  return found;
}

/** Auth interface required for seeding */
export interface SeedAuthApi {
  api: {
    createApiKey: (opts: {
      body: {
        userId: string;
        name: string;
        prefix: string;
        permissions: Record<string, string[]>;
        metadata: Record<string, unknown>;
      };
    }) => Promise<{ id: string; key: string }>;
    updateApiKey: (opts: {
      body: {
        userId: string;
        keyId: string;
        metadata?: Record<string, unknown>;
        enabled?: boolean;
      };
    }) => Promise<unknown>;
  };
}

/** Service user getter function type */
export type GetOrCreateServiceUser = (
  orgId: string,
  db: DBType,
) => Promise<{ userId: string; isNew: boolean }>;

/**
 * Creates service users and API keys for seed organizations.
 *
 * NOTE: API keys are created via BetterAuth API, not direct DB insert,
 * because key values are hashed and only BetterAuth can generate valid keys.
 *
 * @returns Array of created keys with their full key values (shown once)
 */
export async function seedApiKeys(
  db: DBType,
  auth: SeedAuthApi,
  getOrCreateServiceUser: GetOrCreateServiceUser,
): Promise<{ keys: SeedApiKeyResult[] }> {
  console.log("🔑 Creating API keys for seed orgs...\n");

  const createdKeys: SeedApiKeyResult[] = [];

  for (const [configName, config] of Object.entries(seedApiKeyConfig)) {
    console.log(`   Creating ${configName}...`);

    // Validate project-scoped keys have at least one project
    // Note: TypeScript knows current seed data has non-empty arrays, but this
    // validation protects against future changes to seedApiKeyConfig
    const projectCount = config.projects.length as number;
    if (config.scope === "project" && projectCount === 0) {
      throw new Error(
        `Project-scoped API key "${config.name}" must have at least one project`,
      );
    }

    // Get or create service user for org
    const { userId } = await getOrCreateServiceUser(config.orgId, db);

    // Build permissions
    const permissions: Record<string, string[]> = {};
    if (config.scope === "org") {
      permissions[`org:${config.orgId}`] = ["manage"];
    } else {
      for (const projectId of config.projects) {
        permissions[`project:${projectId}`] = ["manage"];
      }
    }

    // Create key via BetterAuth
    const result = await auth.api.createApiKey({
      body: {
        userId,
        name: config.name,
        prefix: "apikey_",
        permissions,
        metadata: {
          organizationId: config.orgId,
          createdBy: config.createdBy,
          suffix: "",
          scope: config.scope,
          projects: config.projects,
        },
      },
    });

    // Update with suffix and optional disabled flag
    const suffix = result.key.slice(-5);
    const updateBody: {
      userId: string;
      keyId: string;
      metadata: Record<string, unknown>;
      enabled?: boolean;
    } = {
      userId, // Required for server-side calls
      keyId: result.id,
      metadata: {
        organizationId: config.orgId,
        createdBy: config.createdBy,
        suffix,
        scope: config.scope,
        projects: config.projects,
      },
    };

    // Handle disabled keys
    if ("disabled" in config && config.disabled) {
      updateBody.enabled = false;
    }

    await auth.api.updateApiKey({ body: updateBody });

    // Handle expired keys via direct DB update (BetterAuth API requires expiresIn >= 1)
    if ("expired" in config && config.expired) {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      await db
        .update(schema.apikey)
        .set({ expiresAt: pastDate })
        .where(eq(schema.apikey.id, result.id));
    }

    createdKeys.push({
      name: config.name,
      key: result.key,
      orgId: config.orgId,
      id: result.id,
    });
  }

  // Cache the keys for later access via getSeededApiKeys()
  seededApiKeysCache = createdKeys;

  console.log("\n✅ API keys created:");
  for (const { name, key, orgId } of createdKeys) {
    console.log(`   ${name} (${orgId}): ${key}`);
  }

  return { keys: createdKeys };
}

// ============================================================================
// CLI Entry Point
// ============================================================================

/**
 * Run seed operations from command line.
 * Usage:
 *   tsx src/seed.ts          # Apply seed data
 *   tsx src/seed.ts --unseed # Remove seed data
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is required");
    console.error("   Make sure infisical is configured correctly");
    process.exit(1);
  }

  // Dynamic import to avoid circular dependency issues
  const { createDb } = await import("./index.js");

  console.log("🔌 Connecting to database...\n");
  const db = createDb(databaseUrl);

  const isUnseed = process.argv.includes("--unseed");

  if (isUnseed) {
    await clearSeed(db);
  } else {
    await applySeed(db);
  }

  process.exit(0);
}

// Only run if executed directly (not imported)
const isDirectExecution =
  process.argv[1]?.endsWith("seed.js") || process.argv[1]?.endsWith("seed.ts");

if (isDirectExecution) {
  main().catch((err) => {
    console.error(
      `\n❌ ${process.argv.includes("--unseed") ? "Unseed" : "Seed"} failed:`,
      err.message,
    );
    process.exit(1);
  });
}
