import { Router, Request, Response } from 'express';
import passport from 'passport';
import { JWTService } from '../services/jwt-service';
import { storage } from '../storage';
import { StreakService } from '../streak-service';
import { getDemoUser } from '../demo-user';
import { scrypt, timingSafeEqual, randomBytes, createHmac } from 'crypto';
import { promisify } from 'util';
import { supabaseStorage } from '../supabase-storage';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// IMPORTANT: This must always point to the Gamefolio web app, NOT the mobile backend.
// EXPO_PUBLIC_BACKEND_URL is this server's own URL — using it here would cause the
// production proxy to call itself, breaking login for all web-created accounts.
const PRODUCTION_API_URL = process.env.GAMEFOLIO_WEB_URL || 'https://app.gamefolio.com';

// Sync a user from production to the local DB (upsert by production userId)
async function syncUserFromProduction(prodUser: any): Promise<any> {
  try {
    const userId = prodUser.id;
    const username = prodUser.username || null;
    const email = prodUser.email || null;
    const displayName = prodUser.displayName || prodUser.display_name || username || null;
    const bio = prodUser.bio || null;
    const avatarUrl = prodUser.avatarUrl || prodUser.avatar_url || null;
    const bannerUrl = prodUser.bannerUrl || prodUser.banner_url || null;
    const xp = prodUser.xp || 0;
    const level = prodUser.level || 1;
    const gameTokens = prodUser.gameTokens || prodUser.game_tokens || 0;
    const isPrivate = prodUser.isPrivate ?? prodUser.is_private ?? false;
    const authProvider = prodUser.authProvider || prodUser.auth_provider || 'local';
    // Use the user_type from production if available; fall back to 'gamer' so
    // established production accounts always bypass the onboarding gate.
    const userType = prodUser.userType || prodUser.user_type || 'gamer';

    // If a different user has this username locally, rename their username to avoid conflict
    if (username) {
      await db.execute(sql`
        UPDATE users SET username = CONCAT(username, '_dev')
        WHERE username = ${username} AND id != ${userId}
      `);
    }
    // If a different user has this email locally, clear their email to avoid conflict
    if (email) {
      await db.execute(sql`
        UPDATE users SET email = NULL
        WHERE email = ${email} AND id != ${userId}
      `);
    }

    // Placeholder password hash that can never match any real password
    const placeholderPassword = 'PRODUCTION_SYNCED.notavalidhash';

    await db.execute(sql`
      INSERT INTO users (
        id, username, email, password, display_name, bio, avatar_url, banner_url,
        xp, level, game_tokens, is_private, auth_provider, email_verified, user_type, created_at, updated_at
      ) VALUES (
        ${userId}, ${username}, ${email}, ${placeholderPassword}, ${displayName}, ${bio},
        ${avatarUrl}, ${bannerUrl}, ${xp}, ${level}, ${gameTokens},
        ${isPrivate}, ${authProvider}, true, ${userType}, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        bio = EXCLUDED.bio,
        avatar_url = EXCLUDED.avatar_url,
        banner_url = EXCLUDED.banner_url,
        xp = EXCLUDED.xp,
        level = EXCLUDED.level,
        is_private = EXCLUDED.is_private,
        email_verified = true,
        user_type = COALESCE(users.user_type, EXCLUDED.user_type),
        updated_at = NOW()
    `);
    return await storage.getUserById(userId);
  } catch (err) {
    console.error('[syncUserFromProduction] Failed to sync user:', err);
    return null;
  }
}

// Proxy login to the production server; returns { accessToken, refreshToken, user } or null
async function proxyLoginToProduction(username: string, password: string): Promise<any | null> {
  try {
    const response = await fetch(`${PRODUCTION_API_URL}/api/auth/token/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) return null;
    return response.json();
  } catch (err) {
    console.error('[proxyLoginToProduction] Failed:', err);
    return null;
  }
}

const scryptAsync = promisify(scrypt);
const router = Router();

/**
 * Determine the base URL to use for OAuth callback redirect URIs.
 * In dev, uses the Replit dev domain (no port - proxied via HTTPS).
 * In production, uses SITE_URL.
 */
function getCallbackBaseUrl(): string {
  // When running in dev with Replit, use the Replit dev domain
  // This ensures OAuth codes are stored on the SAME server the app exchanges them from
  if (process.env.NODE_ENV !== 'production' && process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return process.env.SITE_URL || 'https://app.gamefolio.com';
}

// ── Stateless HMAC-signed mobile auth codes ───────────────────────────────────
// Auth codes are self-contained signed tokens (userId + metadata + expiry).
// No in-memory Map or database needed — works across all server instances.

const MOBILE_CODE_SECRET =
  process.env.SESSION_SECRET ||
  process.env.JWT_ACCESS_SECRET ||
  'mobile-auth-code-fallback-secret';

function generateMobileAuthCode(payload: {
  userId: number;
  needsOnboarding: boolean;
  isNewUser: boolean;
}): string {
  const data = JSON.stringify({ ...payload, exp: Date.now() + 10 * 60 * 1000 });
  const encoded = Buffer.from(data).toString('base64url');
  const sig = createHmac('sha256', MOBILE_CODE_SECRET).update(encoded).digest('hex');
  return `mac.${encoded}.${sig}`;
}

function verifyMobileAuthCode(code: string): {
  userId: number;
  needsOnboarding: boolean;
  isNewUser: boolean;
} | null {
  try {
    if (!code.startsWith('mac.')) return null;
    const parts = code.split('.');
    if (parts.length !== 3) return null;
    const [, encoded, sig] = parts;
    const expectedSig = createHmac('sha256', MOBILE_CODE_SECRET).update(encoded).digest('hex');
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) return null;
    const data = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    if (Date.now() > data.exp) return null;
    return { userId: data.userId, needsOnboarding: data.needsOnboarding, isNewUser: data.isNewUser };
  } catch {
    return null;
  }
}

// ── Stateless HMAC-signed OAuth state ────────────────────────────────────────
// The state is self-contained (platform + flow + redirectTo + timestamp + nonce)
// and HMAC-signed, so it works across multiple server instances and restarts.
// No in-memory or database storage is needed.

const OAUTH_STATE_SECRET =
  process.env.SESSION_SECRET ||
  process.env.JWT_ACCESS_SECRET ||
  'gamefolio-oauth-state-hmac-secret';

interface OAuthStatePayload {
  p: string;           // platform (discord | google)
  f: string;           // flow (mobile | web)
  r: string;           // redirectTo (empty string if not applicable)
  ts: number;          // timestamp ms
  n: string;           // nonce hex
}

/**
 * Generate a stateless, HMAC-signed OAuth state token.
 * The payload is base64url-encoded JSON; the signature is appended after a dot.
 */
function generateOAuthState(platform: string, flow: 'mobile' | 'web' = 'mobile', redirectTo = ''): string {
  const payload: OAuthStatePayload = {
    p: platform,
    f: flow,
    r: redirectTo,
    ts: Date.now(),
    n: randomBytes(8).toString('hex'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', OAUTH_STATE_SECRET).update(payloadB64).digest('hex');
  return `${payloadB64}.${sig}`;
}

/**
 * Verify a stateless OAuth state token.
 * Returns the decoded payload if the signature is valid and the token has not
 * expired (10-minute window). Returns null on any failure.
 */
function verifyOAuthState(
  state: string,
  expectedPlatform: string,
  expectedFlow?: 'mobile' | 'web',
): OAuthStatePayload | null {
  try {
    const dotIdx = state.lastIndexOf('.');
    if (dotIdx === -1) return null;

    const payloadB64 = state.substring(0, dotIdx);
    const sig = state.substring(dotIdx + 1);

    // Constant-time signature comparison
    const expectedSig = createHmac('sha256', OAUTH_STATE_SECRET).update(payloadB64).digest('hex');
    if (sig.length !== expectedSig.length) return null;
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) return null;

    const payload: OAuthStatePayload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString(),
    );

    // Reject expired tokens (10-minute window)
    if (Date.now() - payload.ts > 10 * 60 * 1000) return null;

    // Reject wrong platform
    if (payload.p !== expectedPlatform) return null;

    // Reject wrong flow if specified
    if (expectedFlow && payload.f !== expectedFlow) return null;

    return payload;
  } catch {
    return null;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashedPassword, salt] = stored.split('.');
  const hashedPasswordBuf = Buffer.from(hashedPassword, 'hex');
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedPasswordBuf, suppliedBuf);
}

/**
 * Token-based login endpoint for desktop applications
 * Returns JWT tokens instead of creating a session
 */
router.post('/auth/token/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Handle demo user
    if (username === 'demo' || username === 'Demo') {
      const demoUser = getDemoUser();
      const tokens = JWTService.generateTokenPair(demoUser);
      const { password: _, ...userWithoutPassword } = demoUser;

      return res.json({
        ...tokens,
        user: userWithoutPassword,
      });
    }

    // Find user by username or email
    let user = await storage.getUserByUsername(username.toLowerCase());

    if (!user && username.includes('@')) {
      if (typeof storage.getUserByEmail === 'function') {
        user = await storage.getUserByEmail(username.toLowerCase());
      } else {
        const allUsers = await storage.getAllUsers();
        user = allUsers.find(u => u.email?.toLowerCase() === username.toLowerCase()) || null;
      }
    }

    if (!user) {
      // User not in local DB — try production server for authentication
      console.log(`[login] User "${username}" not found locally, trying production server...`);
      const prodResult = await proxyLoginToProduction(username, password);
      if (!prodResult || !prodResult.user) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }

      // Sync the user to local DB so subsequent requests work
      const syncedUser = await syncUserFromProduction(prodResult.user);
      if (!syncedUser) {
        return res.status(500).json({ message: 'Failed to sync user account. Please try again.' });
      }

      // Issue a LOCAL JWT for this user (so the local server can verify it)
      const tokens = JWTService.generateTokenPair(syncedUser);
      const { password: _pw, ...userWithoutPassword } = syncedUser;

      const [signedAvatarUrl, signedBannerUrl] = await Promise.all([
        userWithoutPassword.avatarUrl ? supabaseStorage.convertToSignedUrl(userWithoutPassword.avatarUrl, 3600) : Promise.resolve(null),
        userWithoutPassword.bannerUrl ? supabaseStorage.convertToSignedUrl(userWithoutPassword.bannerUrl, 3600) : Promise.resolve(null),
      ]);
      const resolvedAvatar = signedAvatarUrl || userWithoutPassword.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent((userWithoutPassword.displayName || userWithoutPassword.username || 'User').slice(0, 20))}&background=1a1a2e&color=4ADE80&bold=true&size=128`;
      const resolvedBanner = signedBannerUrl || userWithoutPassword.bannerUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=800&auto=format&fit=crop';

      console.log(`[login] Production login successful for "${username}" (userId: ${syncedUser.id})`);
      return res.json({
        ...tokens,
        user: { ...userWithoutPassword, avatarUrl: resolvedAvatar, bannerUrl: resolvedBanner },
        needsOnboarding: false,
        isNewUser: false,
      });
    }

    // Check auth provider
    if (user.authProvider === 'google') {
      return res.status(401).json({ 
        message: "This account is associated with Google - please login using the 'Continue with Google' button" 
      });
    }

    if (user.authProvider === 'discord') {
      return res.status(401).json({ 
        message: "This account is associated with Discord - please login using the 'Continue with Discord' button" 
      });
    }

    // If this is a production-synced user (placeholder password), proxy to production
    if (user.password?.startsWith('PRODUCTION_SYNCED')) {
      console.log(`[login] Production-synced user "${username}", proxying to production...`);
      const prodResult = await proxyLoginToProduction(username, password);
      if (!prodResult || !prodResult.user) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }
      // Re-sync updated user data from production
      const syncedUser = await syncUserFromProduction(prodResult.user) || user;
      const tokens = JWTService.generateTokenPair(syncedUser);
      const { password: _pw, ...syncedUserWithoutPassword } = syncedUser;
      console.log(`[login] Production proxy login successful for "${username}"`);
      return res.json({
        ...tokens,
        user: syncedUserWithoutPassword,
        needsOnboarding: false,
        isNewUser: false,
      });
    }

    // Verify password
    const isMatch = await comparePasswords(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect username or password' });
    }

    // Update login time
    try {
      await storage.updateUserLoginTime(user.id, 0);
    } catch (error) {
      console.error('Error updating user login time:', error);
    }

    // Update login streak
    let streakInfo;
    try {
      streakInfo = await StreakService.updateLoginStreak(user.id);
      if (streakInfo.bonusAwarded > 0) {
        console.log(`🎉 Streak bonus for ${user.username}: ${streakInfo.message}`);
      }
    } catch (error) {
      console.error('Error updating login streak:', error);
    }

    // Fetch updated user data
    const updatedUser = await storage.getUserById(user.id);
    const userToReturn = updatedUser || user;

    // Generate tokens
    const tokens = JWTService.generateTokenPair(userToReturn);
    const { password: _, ...userWithoutPassword } = userToReturn;

    // Sign avatar/banner URLs for private bucket access
    const [signedAvatarUrl, signedBannerUrl] = await Promise.all([
      userWithoutPassword.avatarUrl ? supabaseStorage.convertToSignedUrl(userWithoutPassword.avatarUrl, 3600) : Promise.resolve(null),
      userWithoutPassword.bannerUrl ? supabaseStorage.convertToSignedUrl(userWithoutPassword.bannerUrl, 3600) : Promise.resolve(null),
    ]);
    const _resolvedAvatar = signedAvatarUrl || ((userWithoutPassword.avatarUrl?.startsWith('http://') || userWithoutPassword.avatarUrl?.startsWith('https://')) ? userWithoutPassword.avatarUrl : null) || `https://ui-avatars.com/api/?name=${encodeURIComponent((userWithoutPassword.displayName || userWithoutPassword.username || 'User').slice(0, 20))}&background=1a1a2e&color=4ADE80&bold=true&size=128`;
    const _resolvedBanner = signedBannerUrl || ((userWithoutPassword.bannerUrl?.startsWith('http://') || userWithoutPassword.bannerUrl?.startsWith('https://')) ? userWithoutPassword.bannerUrl : null) || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=800&auto=format&fit=crop';
    const signedUserData = {
      ...userWithoutPassword,
      avatarUrl: _resolvedAvatar,
      avatar_url: _resolvedAvatar,
      bannerUrl: _resolvedBanner,
      banner_url: _resolvedBanner,
    };

    // Return tokens and user data
    const response = {
      ...tokens,
      user: streakInfo ? {
        ...signedUserData,
        streakInfo: {
          currentStreak: streakInfo.currentStreak,
          bonusAwarded: streakInfo.bonusAwarded,
          dailyXP: streakInfo.dailyXP,
          longestStreak: userToReturn.longestStreak || 0,
          nextMilestone: streakInfo.currentStreak + (5 - (streakInfo.currentStreak % 5)),
          message: streakInfo.message,
          isNewMilestone: streakInfo.isNewMilestone,
        },
      } : signedUserData,
    };

    return res.json(response);
  } catch (error) {
    console.error('Token login error:', error);
    return res.status(500).json({ message: 'Login failed' });
  }
});

/**
 * Token refresh endpoint
 * Allows desktop apps to refresh their access token using a refresh token
 */
router.post('/auth/token/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    // Verify refresh token
    const payload = JWTService.verifyToken(refreshToken);

    // Special handling for demo user (ID 999) - not in database
    let user;
    if (Number(payload.userId) === 999) {
      user = getDemoUser();
    } else {
      // Fetch current user data from database
      user = await storage.getUserById(payload.userId);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
    }

    // Generate new tokens
    const tokens = JWTService.generateTokenPair(user);
    const { password: _, ...userWithoutPassword } = user;

    return res.json({
      ...tokens,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        return res.status(401).json({ message: 'Refresh token has expired' });
      }
      if (error.message.includes('Invalid')) {
        return res.status(401).json({ message: 'Invalid refresh token' });
      }
    }
    return res.status(500).json({ message: 'Token refresh failed' });
  }
});

/**
 * Google OAuth token-based authentication
 * Returns JWT tokens for desktop apps instead of creating a session
 */
router.post('/auth/token/google', async (req: Request, res: Response) => {
  try {
    const { email, displayName, photoURL, uid } = req.body;

    if (!email || !uid) {
      return res.status(400).json({ message: 'Missing required Google auth data' });
    }

    // Check if user already exists by email
    let user = await storage.getUserByEmail?.(email);

    if (!user) {
      // Create new user with Google data
      const tempUsername = `temp_${uid.substring(0, 8)}_${Date.now()}`;
      user = await storage.createUser({
        username: tempUsername,
        email: email.toLowerCase(),
        displayName: displayName || email.split('@')[0],
        password: '',
        avatarUrl: photoURL || undefined,
        emailVerified: true,
        authProvider: 'google',
        externalId: uid,
        bio: '',
      });

      // Update login time and streak
      try {
        await storage.updateUserLoginTime(user.id, 0);
        const streakInfo = await StreakService.updateLoginStreak(user.id);

        const tokens = JWTService.generateTokenPair(user);
        const { password: _, ...userWithoutPassword } = user;

        return res.status(200).json({
          ...tokens,
          user: {
            ...userWithoutPassword,
            needsOnboarding: true,
            isNewGoogleUser: true,
            streakInfo: streakInfo ? {
              currentStreak: streakInfo.currentStreak,
              bonusAwarded: streakInfo.bonusAwarded,
              dailyXP: streakInfo.dailyXP,
              longestStreak: user.longestStreak || 0,
              nextMilestone: streakInfo.currentStreak + (5 - (streakInfo.currentStreak % 5)),
              message: streakInfo.message,
              isNewMilestone: streakInfo.isNewMilestone,
            } : undefined,
          },
        });
      } catch (error) {
        console.error('Error updating user login time or streak:', error);
      }
    }

    // Existing user - check if they need onboarding
    const needsOnboarding = !user.userType || user.username.startsWith('temp_');

    // Update existing user's Google data if needed
    if (!user.avatarUrl && photoURL) {
      user = await storage.updateUser(user.id, {
        avatarUrl: photoURL,
        authProvider: 'google',
        externalId: uid,
      }) || user;
    }

    // Update login time and streak
    try {
      await storage.updateUserLoginTime(user.id, 0);
      const streakInfo = await StreakService.updateLoginStreak(user.id);

      const tokens = JWTService.generateTokenPair(user);
      const { password: _, ...userWithoutPassword } = user;

      return res.status(200).json({
        ...tokens,
        user: {
          ...userWithoutPassword,
          needsOnboarding,
          streakInfo: streakInfo ? {
            currentStreak: streakInfo.currentStreak,
            bonusAwarded: streakInfo.bonusAwarded,
            dailyXP: streakInfo.dailyXP,
            longestStreak: user.longestStreak || 0,
            nextMilestone: streakInfo.currentStreak + (5 - (streakInfo.currentStreak % 5)),
            message: streakInfo.message,
            isNewMilestone: streakInfo.isNewMilestone,
          } : undefined,
        },
      });
    } catch (error) {
      console.error('Error updating user login time or streak:', error);
    }

    // Fallback response
    const tokens = JWTService.generateTokenPair(user);
    const { password: _, ...userWithoutPassword } = user;

    return res.status(200).json({
      ...tokens,
      user: {
        ...userWithoutPassword,
        needsOnboarding,
      },
    });
  } catch (error) {
    console.error('Google token auth error:', error);
    return res.status(500).json({ message: 'Google authentication failed' });
  }
});

/**
 * Discord OAuth token-based authentication
 * Returns JWT tokens for desktop apps instead of creating a session
 */
router.post('/auth/token/discord', async (req: Request, res: Response) => {
  try {
    const { id, username, discriminator, email, avatar } = req.body;

    if (!id || !username || !email) {
      return res.status(400).json({ message: 'Missing required Discord auth data' });
    }

    // Check if user already exists by email
    let user = await storage.getUserByEmail?.(email);

    if (!user) {
      // Create new user with Discord data
      const displayName = `${username}#${discriminator}`;
      const tempUsername = `temp_${id.substring(0, 8)}_${Date.now()}`;
      const avatarUrl = avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png` : undefined;

      user = await storage.createUser({
        username: tempUsername,
        email: email.toLowerCase(),
        displayName,
        password: '',
        avatarUrl,
        emailVerified: true,
        authProvider: 'discord',
        externalId: id,
        bio: '',
      });

      // Update login time and streak
      try {
        await storage.updateUserLoginTime(user.id, 0);
        const streakInfo = await StreakService.updateLoginStreak(user.id);

        const tokens = JWTService.generateTokenPair(user);
        const { password: _, ...userWithoutPassword } = user;

        return res.status(200).json({
          ...tokens,
          user: {
            ...userWithoutPassword,
            needsOnboarding: true,
            isNewDiscordUser: true,
            streakInfo: streakInfo ? {
              currentStreak: streakInfo.currentStreak,
              bonusAwarded: streakInfo.bonusAwarded,
              dailyXP: streakInfo.dailyXP,
              longestStreak: user.longestStreak || 0,
              nextMilestone: streakInfo.currentStreak + (5 - (streakInfo.currentStreak % 5)),
              message: streakInfo.message,
              isNewMilestone: streakInfo.isNewMilestone,
            } : undefined,
          },
        });
      } catch (error) {
        console.error('Error updating user login time or streak:', error);
      }
    }

    // Existing user - check if they need onboarding
    const needsOnboarding = !user.userType || user.username.startsWith('temp_');

    // Update login time and streak
    try {
      await storage.updateUserLoginTime(user.id, 0);
      const streakInfo = await StreakService.updateLoginStreak(user.id);

      const tokens = JWTService.generateTokenPair(user);
      const { password: _, ...userWithoutPassword } = user;

      return res.status(200).json({
        ...tokens,
        user: {
          ...userWithoutPassword,
          needsOnboarding,
          streakInfo: streakInfo ? {
            currentStreak: streakInfo.currentStreak,
            bonusAwarded: streakInfo.bonusAwarded,
            dailyXP: streakInfo.dailyXP,
            longestStreak: user.longestStreak || 0,
            nextMilestone: streakInfo.currentStreak + (5 - (streakInfo.currentStreak % 5)),
            message: streakInfo.message,
            isNewMilestone: streakInfo.isNewMilestone,
          } : undefined,
        },
      });
    } catch (error) {
      console.error('Error updating user login time or streak:', error);
    }

    // Fallback response
    const tokens = JWTService.generateTokenPair(user);
    const { password: _, ...userWithoutPassword } = user;

    return res.status(200).json({
      ...tokens,
      user: {
        ...userWithoutPassword,
        needsOnboarding,
      },
    });
  } catch (error) {
    console.error('Discord token auth error:', error);
    return res.status(500).json({ message: 'Discord authentication failed' });
  }
});

/**
 * Health check endpoint for mobile apps
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'Gamefolio API'
  });
});

// Mobile app deep link scheme
const RORK_APP_SCHEME = 'rork-app://';

/**
 * Mobile Google OAuth endpoint
 * Receives Google auth data from mobile app (after Firebase Google Sign-In), creates/finds user, returns JWT tokens
 * The mobile app should use Firebase Google Sign-In and send the result here
 */
router.post('/auth/mobile/google', async (req: Request, res: Response) => {
  try {
    const { email, displayName, photoURL, uid } = req.body;

    if (!email || !uid) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required Google auth data'
      });
    }

    // Check if user already exists by email
    let user = await storage.getUserByEmail?.(email);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      // Create new user with Google data
      const timestamp = Date.now().toString().slice(-6);
      const tempUsername = `temp_${uid.substring(0, 8)}_${timestamp}`;
      
      user = await storage.createUser({
        username: tempUsername.toLowerCase(),
        email: email.toLowerCase(),
        displayName: displayName || email.split('@')[0],
        password: '', // Empty password for OAuth users
        avatarUrl: (photoURL && (photoURL.startsWith('http://') || photoURL.startsWith('https://'))) ? photoURL : null,
        bannerUrl: null,
        emailVerified: true,
        authProvider: 'google',
        externalId: uid,
        userType: null,
        ageRange: null
      });
    }

    // Check if user needs onboarding
    const needsOnboarding = !user.userType || user.username.startsWith('temp_');

    // Update existing user's Google data if needed
    if (!isNewUser && !user.avatarUrl && photoURL) {
      user = await storage.updateUser(user.id, {
        avatarUrl: photoURL,
        authProvider: 'google',
        externalId: uid
      }) || user;
    }

    // Update login time and streak
    let streakInfo;
    try {
      await storage.updateUserLoginTime(user.id, 0);
      streakInfo = await StreakService.updateLoginStreak(user.id);
    } catch (error) {
      console.error('Error updating user login time or streak:', error);
    }

    // Generate JWT tokens
    const tokens = JWTService.generateTokenPair(user);
    const { password: _, ...userWithoutPassword } = user;

    // Return JSON response with tokens - mobile app uses these directly
    return res.status(200).json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        ...userWithoutPassword,
        needsOnboarding,
        isNewGoogleUser: isNewUser,
        ...(streakInfo && {
          streakInfo: {
            currentStreak: streakInfo.currentStreak,
            bonusAwarded: streakInfo.bonusAwarded,
            dailyXP: streakInfo.dailyXP,
            longestStreak: user.longestStreak || 0,
            nextMilestone: streakInfo.currentStreak + (5 - (streakInfo.currentStreak % 5)),
            message: streakInfo.message,
            isNewMilestone: streakInfo.isNewMilestone
          }
        })
      }
    });

  } catch (error) {
    console.error('Mobile Google auth error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Google authentication failed'
    });
  }
});

/**
 * Initiate Google OAuth for mobile app
 * Returns the Google OAuth URL that the mobile app should open in a browser
 */
router.get('/auth/mobile/google/init', (req: Request, res: Response) => {
  const baseUrl = getCallbackBaseUrl();
  const redirectUri = `${baseUrl}/api/auth/mobile/google/callback`;

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!googleClientId || !googleClientSecret) {
    console.error('[Google Mobile Init] Missing credentials:', { hasClientId: !!googleClientId, hasClientSecret: !!googleClientSecret });
    return res.status(500).json({ message: 'Google OAuth is not configured on this server. Please contact support.' });
  }

  const state = generateOAuthState('google', 'mobile');

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${googleClientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent('openid email profile')}&` +
    `state=${encodeURIComponent(state)}&` +
    `access_type=offline&` +
    `prompt=select_account`;

  console.log('[Google Mobile Init] Auth URL generated, redirectUri:', redirectUri);

  res.json({
    authUrl: googleAuthUrl,
    redirectUri,
    state
  });
});

/**
 * Google OAuth callback for mobile app
 * Handles the OAuth code exchange and redirects to mobile app with a one-time auth code
 */
router.get('/auth/mobile/google/callback', async (req: Request, res: Response) => {
  console.log('[Google Mobile Callback] Received callback from Google');
  try {
    const { code, error: oauthError, state } = req.query;

    if (oauthError) {
      console.error('[Google Mobile Callback] OAuth error:', oauthError);
      return res.redirect(`${RORK_APP_SCHEME}auth/error?message=${encodeURIComponent(String(oauthError))}`);
    }

    if (!code) {
      return res.redirect(`${RORK_APP_SCHEME}auth/error?message=${encodeURIComponent('No authorization code received')}`);
    }

    const statePayload = state ? verifyOAuthState(String(state), 'google', 'mobile') : null;
    if (!statePayload) {
      console.error('[Google Mobile Callback] Invalid or missing state parameter');
      return res.redirect(`${RORK_APP_SCHEME}auth/error?message=${encodeURIComponent('Invalid authentication state')}`);
    }

    const baseUrl = getCallbackBaseUrl();
    const redirectUri = `${baseUrl}/api/auth/mobile/google/callback`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code: String(code),
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('[Google Mobile Callback] Token exchange failed:', errText);
      return res.redirect(`${RORK_APP_SCHEME}auth/error?message=${encodeURIComponent('Failed to exchange authorization code')}`);
    }

    const tokenData = await tokenResponse.json();

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoResponse.ok) {
      return res.redirect(`${RORK_APP_SCHEME}auth/error?message=${encodeURIComponent('Failed to fetch Google user info')}`);
    }

    const googleUser = await userInfoResponse.json();
    const { id, email, name, picture } = googleUser;

    if (!id || !email) {
      return res.redirect(`${RORK_APP_SCHEME}auth/error?message=${encodeURIComponent('Google account missing required info')}`);
    }

    let user = await storage.getUserByEmail?.(email);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const timestamp = Date.now().toString().slice(-6);
      const tempUsername = `temp_${id.substring(0, 8)}_${timestamp}`;

      user = await storage.createUser({
        username: tempUsername.toLowerCase(),
        displayName: name || email.split('@')[0],
        email: email.toLowerCase(),
        password: '',
        emailVerified: true,
        avatarUrl: picture || null,
        bannerUrl: null,
        authProvider: 'google',
        externalId: id,
        userType: null,
        ageRange: null
      });
    }

    const needsOnboarding = !user.userType || user.username.startsWith('temp_');

    if (!isNewUser && !user.avatarUrl && picture) {
      user = await storage.updateUser(user.id, {
        avatarUrl: picture,
        authProvider: 'google',
        externalId: id
      }) || user;
    }

    try {
      await storage.updateUserLoginTime(user.id, 0);
      await StreakService.updateLoginStreak(user.id);
    } catch (error) {
      console.error('[Google Mobile Callback] Error updating login time/streak:', error);
    }

    const authCode = generateMobileAuthCode({ userId: user.id, needsOnboarding, isNewUser });

    console.log('[Google Mobile Callback] Success, redirecting to app. User:', user.username, 'isNew:', isNewUser);
    return res.redirect(`${RORK_APP_SCHEME}auth/callback?code=${encodeURIComponent(authCode)}`);

  } catch (error) {
    console.error('[Google Mobile Callback] Error:', error);
    return res.redirect(`${RORK_APP_SCHEME}auth/error?message=${encodeURIComponent('Google authentication failed')}`);
  }
});

/**
 * Initiate Discord OAuth for mobile app
 * Returns the Discord OAuth URL that the mobile app should open in a browser
 * Includes state parameter for CSRF protection
 */
router.get('/auth/mobile/discord/init', (req: Request, res: Response) => {
  const baseUrl = getCallbackBaseUrl();
  const redirectUri = `${baseUrl}/api/auth/mobile/discord/callback`;

  const discordClientId = process.env.DISCORD_CLIENT_ID;

  if (!discordClientId) {
    console.error('[Discord Mobile Init] DISCORD_CLIENT_ID not configured');
    return res.status(500).json({ message: 'Discord OAuth is not configured on this server. Please contact support.' });
  }
  
  // Generate state token for CSRF protection (stateless HMAC-signed)
  const state = generateOAuthState('discord', 'mobile');

  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?` +
    `client_id=${discordClientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent('identify email')}&` +
    `state=${encodeURIComponent(state)}`;
  
  res.json({ 
    authUrl: discordAuthUrl,
    redirectUri,
    state
  });
});

/**
 * Discord OAuth callback for mobile app
 * Handles the OAuth code exchange and redirects to mobile app with a one-time auth code
 * Mobile app exchanges this code for tokens via /auth/mobile/exchange endpoint
 */
router.get('/auth/mobile/discord/callback', async (req: Request, res: Response) => {
  console.log('[Discord Mobile Callback] Received callback from Discord');
  try {
    const { code, error: oauthError, state } = req.query;
    
    if (oauthError) {
      return res.redirect(`${RORK_APP_SCHEME}auth/error?message=${encodeURIComponent(String(oauthError))}`);
    }

    if (!code) {
      return res.redirect(`${RORK_APP_SCHEME}auth/error?message=${encodeURIComponent('No authorization code received')}`);
    }

    // Validate state parameter for CSRF protection (stateless HMAC verification)
    const statePayload = state ? verifyOAuthState(String(state), 'discord', 'mobile') : null;
    if (!statePayload) {
      console.error('[Discord Mobile Callback] Invalid or missing OAuth state parameter');
      return res.redirect(`${RORK_APP_SCHEME}auth/error?message=${encodeURIComponent('Invalid authentication state')}`);
    }

    const baseUrl = getCallbackBaseUrl();
    const redirectUri = `${baseUrl}/api/auth/mobile/discord/callback`;

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        code: String(code),
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        scope: 'identify email',
      }).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!tokenResponse.ok) {
      console.error('Discord token exchange failed:', await tokenResponse.text());
      return res.redirect(`${RORK_APP_SCHEME}auth/error?message=${encodeURIComponent('Failed to exchange authorization code')}`);
    }

    const tokenData = await tokenResponse.json();

    // Get user information from Discord
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `${tokenData.token_type} ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      return res.redirect(`${RORK_APP_SCHEME}auth/error?message=${encodeURIComponent('Failed to fetch Discord user info')}`);
    }

    const discordUser = await userResponse.json();
    const { id, username, discriminator, email, avatar } = discordUser;

    if (!id || !email) {
      return res.redirect(`${RORK_APP_SCHEME}auth/error?message=${encodeURIComponent('Discord account missing email')}`);
    }

    // Check if user already exists by email
    let user = await storage.getUserByEmail?.(email);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      // Create new user with Discord data
      const displayName = discriminator ? `${username}#${discriminator}` : username;
      const timestamp = Date.now().toString().slice(-6);
      const tempUsername = `temp_${id.substring(0, 8)}_${timestamp}`;
      const avatarUrl = avatar 
        ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`
        : null;

      user = await storage.createUser({
        username: tempUsername.toLowerCase(),
        displayName,
        email: email.toLowerCase(),
        password: '', // Empty password for OAuth users
        emailVerified: true,
        avatarUrl,
        bannerUrl: null,
        authProvider: 'discord',
        externalId: id,
        userType: null,
        ageRange: null
      });
    }

    // Check if user needs onboarding
    const needsOnboarding = !user.userType || user.username.startsWith('temp_');

    // Update existing user's Discord data if needed
    if (!isNewUser && !user.avatarUrl && avatar) {
      const avatarUrl = `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`;
      user = await storage.updateUser(user.id, {
        avatarUrl,
        authProvider: 'discord',
        externalId: id
      }) || user;
    }

    // Update login time and streak
    try {
      await storage.updateUserLoginTime(user.id, 0);
      await StreakService.updateLoginStreak(user.id);
    } catch (error) {
      console.error('Error updating user login time or streak:', error);
    }

    const authCode = generateMobileAuthCode({ userId: user.id, needsOnboarding, isNewUser });

    return res.redirect(`${RORK_APP_SCHEME}auth/callback?code=${encodeURIComponent(authCode)}`);

  } catch (error) {
    console.error('Mobile Discord callback error:', error);
    return res.redirect(`${RORK_APP_SCHEME}auth/error?message=${encodeURIComponent('Discord authentication failed')}`);
  }
});

/**
 * Mobile Discord OAuth endpoint (alternative to callback)
 * Receives Discord auth data from mobile app, creates/finds user, returns JWT tokens
 */
router.post('/auth/mobile/discord', async (req: Request, res: Response) => {
  try {
    const { id, username, discriminator, email, avatar } = req.body;

    if (!id || !email) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required Discord auth data'
      });
    }

    // Check if user already exists by email
    let user = await storage.getUserByEmail?.(email);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      // Create new user with Discord data
      const displayName = discriminator ? `${username}#${discriminator}` : username;
      const timestamp = Date.now().toString().slice(-6);
      const tempUsername = `temp_${id.substring(0, 8)}_${timestamp}`;
      const avatarUrl = avatar 
        ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`
        : null;

      user = await storage.createUser({
        username: tempUsername.toLowerCase(),
        displayName,
        email: email.toLowerCase(),
        password: '', // Empty password for OAuth users
        emailVerified: true,
        avatarUrl,
        bannerUrl: null,
        authProvider: 'discord',
        externalId: id,
        userType: null,
        ageRange: null
      });
    }

    // Check if user needs onboarding
    const needsOnboarding = !user.userType || user.username.startsWith('temp_');

    // Update existing user's Discord data if needed
    if (!isNewUser && !user.avatarUrl && avatar) {
      const avatarUrl = `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`;
      user = await storage.updateUser(user.id, {
        avatarUrl,
        authProvider: 'discord',
        externalId: id
      }) || user;
    }

    // Update login time and streak
    let streakInfo;
    try {
      await storage.updateUserLoginTime(user.id, 0);
      streakInfo = await StreakService.updateLoginStreak(user.id);
    } catch (error) {
      console.error('Error updating user login time or streak:', error);
    }

    // Generate JWT tokens
    const tokens = JWTService.generateTokenPair(user);
    const { password: _, ...userWithoutPassword } = user;

    // Return JSON response with tokens - mobile app uses these directly
    return res.status(200).json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        ...userWithoutPassword,
        needsOnboarding,
        isNewDiscordUser: isNewUser,
        ...(streakInfo && {
          streakInfo: {
            currentStreak: streakInfo.currentStreak,
            bonusAwarded: streakInfo.bonusAwarded,
            dailyXP: streakInfo.dailyXP,
            longestStreak: user.longestStreak || 0,
            nextMilestone: streakInfo.currentStreak + (5 - (streakInfo.currentStreak % 5)),
            message: streakInfo.message,
            isNewMilestone: streakInfo.isNewMilestone
          }
        })
      }
    });

  } catch (error) {
    console.error('Mobile Discord auth error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Discord authentication failed'
    });
  }
});

/**
 * Exchange one-time auth code for tokens
 * Mobile app calls this after receiving the auth code from the callback redirect
 * This is more secure than putting tokens directly in the redirect URL
 */
router.post('/auth/mobile/exchange', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Missing auth code'
      });
    }

    const authData = verifyMobileAuthCode(code);

    if (!authData) {
      console.error('[Mobile Exchange] Invalid or expired auth code');
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired auth code'
      });
    }

    const user = await storage.getUserById(authData.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const tokens = JWTService.generateTokenPair(user);
    const { password: _, ...userWithoutPassword } = user;

    return res.status(200).json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 7 * 24 * 60 * 60,
      user: {
        ...userWithoutPassword,
        needsOnboarding: authData.needsOnboarding,
        isNewUser: authData.isNewUser
      }
    });

  } catch (error) {
    console.error('Mobile auth code exchange error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to exchange auth code'
    });
  }
});

/**
 * Initiate Google OAuth for web browsers
 * Returns the Google OAuth URL. Frontend redirects window.location there.
 * Accepts ?returnTo=<url> to know where to send the user back after auth.
 */
router.get('/auth/web/google/init', (req: Request, res: Response) => {
  const returnTo = (req.query.returnTo as string) || '';
  const baseUrl = getCallbackBaseUrl();
  const redirectUri = `${baseUrl}/api/auth/web/google/callback`;

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!googleClientId || !googleClientSecret) {
    return res.status(500).json({ message: 'Google OAuth is not configured on this server.' });
  }

  const state = generateOAuthState('google', 'web', returnTo);

  const googleAuthUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${googleClientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent('openid email profile')}&` +
    `state=${encodeURIComponent(state)}&` +
    `access_type=offline&` +
    `prompt=select_account`;

  console.log('[Google Web Init] Auth URL generated, redirectUri:', redirectUri);
  res.json({ authUrl: googleAuthUrl, redirectUri, state });
});

/**
 * Google OAuth callback for web browsers
 * Processes code, stores a one-time auth code, redirects to frontend with ?code=xxx&provider=google
 */
router.get('/auth/web/google/callback', async (req: Request, res: Response) => {
  const fallback = process.env.SITE_URL || 'https://app.gamefolio.com';

  try {
    const { code, error: oauthError, state } = req.query;

    const statePayload = state ? verifyOAuthState(String(state), 'google', 'web') : null;
    const redirectTo = statePayload?.r || fallback;

    if (oauthError) {
      console.error('[Google Web Callback] OAuth error:', oauthError);
      return res.redirect(`${redirectTo}?auth_error=${encodeURIComponent(String(oauthError))}`);
    }

    if (!code) {
      return res.redirect(`${redirectTo}?auth_error=${encodeURIComponent('No authorization code received')}`);
    }

    if (!state || !statePayload) {
      console.error('[Google Web Callback] Invalid or missing OAuth state');
      return res.redirect(`${fallback}?auth_error=${encodeURIComponent('Invalid authentication state')}`);
    }

    const baseUrl = getCallbackBaseUrl();
    const redirectUri = `${baseUrl}/api/auth/web/google/callback`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code: String(code),
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      console.error('[Google Web Callback] Token exchange failed:', await tokenResponse.text());
      return res.redirect(`${redirectTo}?auth_error=${encodeURIComponent('Failed to exchange authorization code')}`);
    }

    const tokenData = await tokenResponse.json();

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoResponse.ok) {
      return res.redirect(`${redirectTo}?auth_error=${encodeURIComponent('Failed to fetch Google user info')}`);
    }

    const googleUser = await userInfoResponse.json();
    const { id, email, name, picture } = googleUser;

    if (!id || !email) {
      return res.redirect(`${redirectTo}?auth_error=${encodeURIComponent('Google account missing required info')}`);
    }

    let user = await storage.getUserByEmail?.(email);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const timestamp = Date.now().toString().slice(-6);
      const tempUsername = `temp_${id.substring(0, 8)}_${timestamp}`;
      user = await storage.createUser({
        username: tempUsername.toLowerCase(),
        displayName: name || email.split('@')[0],
        email: email.toLowerCase(),
        password: '',
        emailVerified: true,
        avatarUrl: picture || null,
        bannerUrl: null,
        authProvider: 'google',
        externalId: id,
        userType: null,
        ageRange: null,
      });
    }

    const needsOnboarding = !user.userType || user.username.startsWith('temp_');

    if (!isNewUser && !user.avatarUrl && picture) {
      user = await storage.updateUser(user.id, { avatarUrl: picture, authProvider: 'google', externalId: id }) || user;
    }

    try {
      await storage.updateUserLoginTime(user.id, 0);
      await StreakService.updateLoginStreak(user.id);
    } catch (err) {
      console.error('[Google Web Callback] Error updating login time/streak:', err);
    }

    const authCode = generateMobileAuthCode({ userId: user.id, needsOnboarding, isNewUser });

    console.log('[Google Web Callback] Success, redirecting. User:', user.username, 'isNew:', isNewUser);
    const sep = redirectTo.includes('?') ? '&' : '?';
    return res.redirect(`${redirectTo}${sep}code=${encodeURIComponent(authCode)}&provider=google`);
  } catch (error) {
    console.error('[Google Web Callback] Error:', error);
    return res.redirect(`${fallback}?auth_error=${encodeURIComponent('Google authentication failed')}`);
  }
});

/**
 * Initiate Discord OAuth for web browsers
 * Returns the Discord OAuth URL. Frontend redirects window.location there.
 */
router.get('/auth/web/discord/init', (req: Request, res: Response) => {
  const returnTo = (req.query.returnTo as string) || '';
  const baseUrl = getCallbackBaseUrl();
  const redirectUri = `${baseUrl}/api/auth/web/discord/callback`;

  const discordClientId = process.env.DISCORD_CLIENT_ID;

  if (!discordClientId) {
    return res.status(500).json({ message: 'Discord OAuth is not configured on this server.' });
  }

  const state = generateOAuthState('discord', 'web', returnTo);

  const discordAuthUrl =
    `https://discord.com/api/oauth2/authorize?` +
    `client_id=${discordClientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent('identify email')}&` +
    `state=${encodeURIComponent(state)}`;

  console.log('[Discord Web Init] Auth URL generated, redirectUri:', redirectUri);
  res.json({ authUrl: discordAuthUrl, redirectUri, state });
});

/**
 * Discord OAuth callback for web browsers
 * Processes code, stores a one-time auth code, redirects to frontend with ?code=xxx&provider=discord
 */
router.get('/auth/web/discord/callback', async (req: Request, res: Response) => {
  const fallback = process.env.SITE_URL || 'https://app.gamefolio.com';

  try {
    const { code, error: oauthError, state } = req.query;

    const statePayload = state ? verifyOAuthState(String(state), 'discord', 'web') : null;
    const redirectTo = statePayload?.r || fallback;

    if (oauthError) {
      return res.redirect(`${redirectTo}?auth_error=${encodeURIComponent(String(oauthError))}`);
    }

    if (!code) {
      return res.redirect(`${redirectTo}?auth_error=${encodeURIComponent('No authorization code received')}`);
    }

    if (!state || !statePayload) {
      console.error('[Discord Web Callback] Invalid or missing OAuth state');
      return res.redirect(`${fallback}?auth_error=${encodeURIComponent('Invalid authentication state')}`);
    }

    const baseUrl = getCallbackBaseUrl();
    const redirectUri = `${baseUrl}/api/auth/web/discord/callback`;

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        code: String(code),
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        scope: 'identify email',
      }).toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!tokenResponse.ok) {
      console.error('[Discord Web Callback] Token exchange failed:', await tokenResponse.text());
      return res.redirect(`${redirectTo}?auth_error=${encodeURIComponent('Failed to exchange authorization code')}`);
    }

    const tokenData = await tokenResponse.json();

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `${tokenData.token_type} ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      return res.redirect(`${redirectTo}?auth_error=${encodeURIComponent('Failed to fetch Discord user info')}`);
    }

    const discordUser = await userResponse.json();
    const { id, username, discriminator, email, avatar } = discordUser;

    if (!id || !email) {
      return res.redirect(`${redirectTo}?auth_error=${encodeURIComponent('Discord account missing email. Please ensure your email is verified on Discord.')}`);
    }

    let user = await storage.getUserByEmail?.(email);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const displayName = discriminator ? `${username}#${discriminator}` : username;
      const timestamp = Date.now().toString().slice(-6);
      const tempUsername = `temp_${id.substring(0, 8)}_${timestamp}`;
      const avatarUrl = avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png` : null;

      user = await storage.createUser({
        username: tempUsername.toLowerCase(),
        displayName,
        email: email.toLowerCase(),
        password: '',
        emailVerified: true,
        avatarUrl,
        bannerUrl: null,
        authProvider: 'discord',
        externalId: id,
        userType: null,
        ageRange: null,
      });
    }

    const needsOnboarding = !user.userType || user.username.startsWith('temp_');

    if (!isNewUser && !user.avatarUrl && avatar) {
      const avatarUrl = `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`;
      user = await storage.updateUser(user.id, { avatarUrl, authProvider: 'discord', externalId: id }) || user;
    }

    try {
      await storage.updateUserLoginTime(user.id, 0);
      await StreakService.updateLoginStreak(user.id);
    } catch (err) {
      console.error('[Discord Web Callback] Error updating login time/streak:', err);
    }

    const authCode = generateMobileAuthCode({ userId: user.id, needsOnboarding, isNewUser });

    console.log('[Discord Web Callback] Success, redirecting. User:', user.username, 'isNew:', isNewUser);
    const sep = redirectTo.includes('?') ? '&' : '?';
    return res.redirect(`${redirectTo}${sep}code=${encodeURIComponent(authCode)}&provider=discord`);
  } catch (error) {
    console.error('[Discord Web Callback] Error:', error);
    return res.redirect(`${fallback}?auth_error=${encodeURIComponent('Discord authentication failed')}`);
  }
});

export default router;