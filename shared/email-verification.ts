import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./schema";

/**
 * Email verification tokens table
 */
export const verificationTokens = pgTable("verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expires: timestamp("expires").notNull(),
});

/**
 * Password reset tokens table
 */
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expires: timestamp("expires").notNull(),
});

// Schemas for inserting verification tokens
export const insertVerificationTokenSchema = createInsertSchema(verificationTokens, {
  token: z.string().min(1),
  expires: z.date(),
}).omit({ id: true });

// Schemas for inserting password reset tokens
export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens, {
  token: z.string().min(1),
  expires: z.date(),
}).omit({ id: true });

// Type definitions
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type InsertVerificationToken = z.infer<typeof insertVerificationTokenSchema>;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;