import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure postgres connection for Supabase
const connection = postgres(process.env.DATABASE_URL, {
  max: 10, // Maximum pool size
  idle_timeout: 30, // Close idle connections after 30 seconds
  connect_timeout: 10, // Timeout after 10 seconds
});

export const db = drizzle(connection, { schema });
export const pool = connection; // Export for compatibility