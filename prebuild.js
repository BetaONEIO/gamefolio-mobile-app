/**
 * Pre-build database alignment script.
 *
 * When the Replit-provided PostgreSQL has `users.id` as `character varying`
 * but the Drizzle schema expects `serial` (integer), the auto-migration
 * generates invalid SQL ("SET DATA TYPE serial") which fails.
 *
 * This script converts `users.id` from varchar → integer (for an empty
 * table only) so the migration step finds no difference and skips it.
 * Always exits 0 so a failure here never blocks the build.
 */

"use strict";

const { Client } = require("pg");

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[prebuild] DATABASE_URL not set — skipping.");
    return;
  }

  const client = new Client({ connectionString: url, connectionTimeoutMillis: 8000 });

  try {
    await client.connect();
  } catch (err) {
    console.warn("[prebuild] Could not connect to DATABASE_URL:", err.message);
    return;
  }

  try {
    const typeRow = await client.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'`
    );

    if (!typeRow.rows.length) {
      console.log("[prebuild] users.id column not found — nothing to fix.");
      return;
    }

    const type = typeRow.rows[0].data_type;
    console.log("[prebuild] users.id current type:", type);

    if (type !== "character varying") {
      console.log("[prebuild] No fix needed.");
      return;
    }

    const countRow = await client.query("SELECT COUNT(*)::int AS n FROM users");
    if (countRow.rows[0].n > 0) {
      console.warn("[prebuild] users table is not empty — skipping type fix.");
      return;
    }

    console.log("[prebuild] Converting users.id varchar → serial (integer) ...");
    await client.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey CASCADE");
    await client.query("ALTER TABLE users DROP COLUMN id");
    await client.query("ALTER TABLE users ADD COLUMN id SERIAL PRIMARY KEY");
    console.log("[prebuild] Done — users.id is now serial.");
  } catch (err) {
    console.warn("[prebuild] Fix failed (non-fatal):", err.message);
  } finally {
    await client.end().catch(() => {});
  }
}

run().catch((err) => {
  console.warn("[prebuild] Unexpected error (non-fatal):", err.message);
});
