import { randomBytes } from 'crypto';
import { db } from '../db';
import { emailVerificationTokens, passwordResetTokens } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Generate a random token
 */
export const generateToken = (): string => {
  return randomBytes(32).toString('hex');
};

/**
 * Generate a 6-digit verification code
 */
export const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Create a new email verification code
 */
export const createVerificationCode = async (userId: number): Promise<string> => {
  // Delete any existing codes for the user first
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
  
  // Generate a new 6-digit code and unique token
  const code = generateVerificationCode();
  const token = generateToken(); // Use the existing generateToken function
  
  // Create an expiration date (15 minutes from now) - shorter for security
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15);
  
  console.log(`🔧 Creating verification code for user ${userId}, expires at: ${expiresAt.toISOString()}`);
  
  // Insert the new code and token
  await db.insert(emailVerificationTokens).values({
    userId,
    token,
    code,
    expiresAt,
  });
  
  return code;
};

/**
 * Verify an email verification code
 */
export const verifyEmailCode = async (userId: number, code: string): Promise<boolean> => {
  // Find the code for this specific user
  const [verificationToken] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, userId));
  
  if (!verificationToken) {
    console.log(`❌ Verification code not found for user ${userId}`);
    return false;
  }
  
  // Check if the code matches
  if (verificationToken.code !== code) {
    console.log(`❌ Invalid verification code for user ${userId}`);
    return false;
  }
  
  const now = new Date();
  const expiresAt = new Date(verificationToken.expiresAt);
  
  console.log(`🔍 Code verification - Now: ${now.toISOString()}, Expires: ${expiresAt.toISOString()}`);
  console.log(`🔍 Raw code data:`, {
    codeId: verificationToken.id,
    userId: verificationToken.userId,
    expiresAt: verificationToken.expiresAt,
    code: verificationToken.code
  });
  
  // Check if the code has expired
  if (now > expiresAt) {
    // Delete the expired code
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, verificationToken.id));
    console.log(`🕒 Verification code expired for user ${verificationToken.userId}. Expired at: ${expiresAt.toISOString()}, Current time: ${now.toISOString()}`);
    return false;
  }
  
  // Delete the code (one-time use)
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, verificationToken.id));
  
  console.log(`✅ Code verified successfully for user ${verificationToken.userId}`);
  return true;
};

/**
 * Verify email verification token and return user ID
 */
export const verifyEmailToken = async (token: string): Promise<number | null> => {
  // Find the token
  const [verificationToken] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, token));
  
  if (!verificationToken) {
    console.log(`❌ Verification token not found: ${token.substring(0, 10)}...`);
    return null;
  }
  
  const now = new Date();
  const expiresAt = new Date(verificationToken.expiresAt);
  
  console.log(`🔍 Token verification - Now: ${now.toISOString()}, Expires: ${expiresAt.toISOString()}`);
  
  // Check if the token has expired
  if (now > expiresAt) {
    // Delete the expired token
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, verificationToken.id));
    console.log(`🕒 Verification token expired for user ${verificationToken.userId}. Expired at: ${expiresAt.toISOString()}, Current time: ${now.toISOString()}`);
    return null;
  }
  
  // Delete the token (one-time use)
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, verificationToken.id));
  
  console.log(`✅ Token verified successfully for user ${verificationToken.userId}`);
  return verificationToken.userId;
};

/**
 * Create a new password reset code (6-digit code sent via email)
 */
export const createPasswordResetCode = async (userId: number, email: string): Promise<string> => {
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  
  const code = generateVerificationCode();
  const token = generateToken();
  
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15);
  
  console.log(`🔧 Creating password reset code for user ${userId}, expires at: ${expiresAt.toISOString()}`);
  
  await db.insert(passwordResetTokens).values({
    userId,
    token,
    code,
    email: email.toLowerCase(),
    expiresAt,
  });
  
  return code;
};

/**
 * Verify a password reset code by email and return userId
 */
export const verifyPasswordResetCode = async (email: string, code: string): Promise<number | null> => {
  const [resetToken] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.email, email.toLowerCase()));
  
  if (!resetToken) {
    console.log(`❌ Password reset code not found for email ${email}`);
    return null;
  }
  
  if (resetToken.code !== code) {
    console.log(`❌ Invalid password reset code for email ${email}`);
    return null;
  }
  
  const now = new Date();
  const expiresAt = new Date(resetToken.expiresAt);
  
  if (now > expiresAt) {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, resetToken.id));
    console.log(`🕒 Password reset code expired for email ${email}`);
    return null;
  }
  
  console.log(`✅ Password reset code verified for email ${email}`);
  return resetToken.userId;
};

/**
 * Delete password reset tokens for a user (after code is used)
 */
export const deletePasswordResetTokensByUser = async (userId: number): Promise<void> => {
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
};