/**
 * Validate schema and seed data against an ephemeral PGlite database.
 * Useful for CI to verify schema/seed changes without a real PostgreSQL.
 *
 * Usage: pnpm db:check-test-db
 *
 * Note: Requires migrations to exist. Run `pnpm db:generate` first if needed.
 */
import { existsSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/schema.js";
import { applySeed } from "../src/seed.js";

async function main() {
  console.log("🧪 Testing schema against PGlite...\n");

  // Check if migrations exist
  if (!existsSync("./drizzle/meta/_journal.json")) {
    console.error("❌ No migrations found in ./drizzle");
    console.error("   Run `pnpm db:generate` first to create migrations");
    process.exit(1);
  }

  const client = new PGlite();
  const db = drizzle(client, { schema });

  console.log("📦 Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });

  // Verify tables exist by querying schema
  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  console.log(`\n✅ Schema valid! Created ${tables.rows.length} tables:\n`);
  for (const row of tables.rows) {
    console.log(`   - ${(row as { table_name: string }).table_name}`);
  }

  // Apply seed data to verify it works
  console.log("\n");
  await applySeed(db as Parameters<typeof applySeed>[0]);

  // Verify seed data
  const userCount = await client.query('SELECT COUNT(*) as count FROM "user"');
  const orgCount = await client.query("SELECT COUNT(*) as count FROM org");
  const projectCount = await client.query(
    "SELECT COUNT(*) as count FROM project",
  );

  console.log("\n📊 Seed verification:");
  console.log(`   - Users: ${(userCount.rows[0] as { count: number }).count}`);
  console.log(`   - Orgs: ${(orgCount.rows[0] as { count: number }).count}`);
  console.log(
    `   - Projects: ${(projectCount.rows[0] as { count: number }).count}`,
  );

  console.log("\n🗑️  Ephemeral database destroyed. Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Check failed:", err.message);
  process.exit(1);
});
