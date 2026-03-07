import { sql } from "drizzle-orm";
import { Pool } from "pg";

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log("Adding new reward fields to asset_rewards table...");
    
    // Add new columns if they don't exist
    await pool.query(`
      ALTER TABLE asset_rewards 
      ADD COLUMN IF NOT EXISTS free_item BOOLEAN DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS redeemable BOOLEAN DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS reward_category TEXT DEFAULT 'other',
      ADD COLUMN IF NOT EXISTS source_bucket TEXT,
      ADD COLUMN IF NOT EXISTS source_path TEXT
    `);
    
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate().catch(console.error);
