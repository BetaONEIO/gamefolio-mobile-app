import { Pool } from "pg";

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log("Migrating asset_rewards table...");
    
    // Rename reward_type to asset_type if old name still exists
    await pool.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'asset_rewards' AND column_name = 'reward_type'
        ) THEN
          ALTER TABLE asset_rewards RENAME COLUMN reward_type TO asset_type;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'asset_rewards' AND column_name = 'asset_type'
        ) THEN
          ALTER TABLE asset_rewards ADD COLUMN asset_type TEXT NOT NULL DEFAULT 'other';
        END IF;
      END $$;
    `);

    // Add all missing columns
    await pool.query(`
      ALTER TABLE asset_rewards
        ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'static',
        ADD COLUMN IF NOT EXISTS unlock_chance REAL NOT NULL DEFAULT 10,
        ADD COLUMN IF NOT EXISTS reward_value INTEGER,
        ADD COLUMN IF NOT EXISTS times_rewarded INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS available_in_lootbox BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS available_in_store BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS pro_only BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS free_item BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS redeemable BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS reward_category TEXT DEFAULT 'other',
        ADD COLUMN IF NOT EXISTS store_price INTEGER,
        ADD COLUMN IF NOT EXISTS source_bucket TEXT,
        ADD COLUMN IF NOT EXISTS source_path TEXT,
        ADD COLUMN IF NOT EXISTS created_by INTEGER,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW() NOT NULL
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
