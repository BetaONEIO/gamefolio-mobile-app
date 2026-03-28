import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connection = postgres(dbUrl, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  ssl: dbUrl.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(connection, { schema });
export const pool = connection;
