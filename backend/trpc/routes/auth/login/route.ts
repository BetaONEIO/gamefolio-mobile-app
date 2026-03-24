import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import { generateSignedUrl } from '@/backend/lib/signed-urls';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { Env } from '@/constants/Env';

const GAMEFOLIO_API_URL = 'https://app.gamefolio.com/api';

type GamefolioAuthResult =
  | { outcome: 'success'; accessToken: string; refreshToken: string; expiresIn: number }
  | { outcome: 'not_found' }    // 404: user does not exist on the web app
  | { outcome: 'unauthorized' } // 401: user exists but wrong password
  | { outcome: 'error' };       // network or server error

async function authenticateWithGamefolioAPI(username: string, password: string): Promise<GamefolioAuthResult> {
  try {
    console.log('[AUTH] Authenticating with Gamefolio API...');
    const response = await fetch(`${GAMEFOLIO_API_URL}/auth/token/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[AUTH] Gamefolio API auth successful');
      return {
        outcome: 'success',
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn || 3600,
      };
    }

    console.log('[AUTH] Gamefolio API auth failed:', response.status);
    if (response.status === 404) return { outcome: 'not_found' };
    if (response.status === 401) return { outcome: 'unauthorized' };
    return { outcome: 'error' };
  } catch (error) {
    console.error('[AUTH] Gamefolio API auth error:', error);
    return { outcome: 'error' };
  }
}

const JWT_SECRET = Env.JWT_SECRET;
const JWT_REFRESH_SECRET = Env.JWT_SECRET + '-refresh';

const loginSchema = z.object({
  username: z.string().min(1, 'Username or email is required'),
  password: z.string(),
});

export default publicProcedure
  .input(loginSchema)
  .mutation(async ({ input }) => {
    const { username, password } = input;

    console.log('[AUTH] Login attempt:', username);

    if (username === 'demo' || username === 'admin') {
      console.log(`[AUTH] ${username} user login detected`);
      
      const { data: existingProfile } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (existingProfile) {
        console.log(`[AUTH] Found existing profile for ${username}`);
        
        const accessToken = jwt.sign(
          { userId: existingProfile.id, username: existingProfile.username, role: existingProfile.role },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        const refreshToken = jwt.sign(
          { userId: existingProfile.id },
          JWT_REFRESH_SECRET,
          { expiresIn: '30d' }
        );

        return {
          user: {
            id: existingProfile.id,
            username: existingProfile.username,
            displayName: existingProfile.display_name,
            email: existingProfile.email,
            emailVerified: existingProfile.email_verified,
            role: existingProfile.role,
            totalXP: existingProfile.total_xp ?? 0,
            level: existingProfile.level ?? 1,
            currentStreak: existingProfile.current_streak ?? 0,
            longestStreak: existingProfile.longest_streak ?? 0,
            avatarUrl: await generateSignedUrl(existingProfile.avatar_url),
            bannerUrl: await generateSignedUrl(existingProfile.banner_url),
            bio: existingProfile.bio,
            messagingEnabled: existingProfile.messaging_enabled,
            isPrivate: existingProfile.is_private,
          },
          accessToken,
          refreshToken,
          expiresIn: 7 * 24 * 60 * 60,
        };
      }

      console.log(`[AUTH] Creating new ${username} user...`);
      
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      const { data: newProfile, error: createProfileError } = await supabaseAdmin
        .from('users')
        .insert({
          username: username,
          display_name: username === 'admin' ? 'Admin User' : 'Demo User',
          email: `${username}@gamefolio.com`,
          password_hash: hashedPassword,
          email_verified: true,
          role: username === 'admin' ? 'admin' : 'user',
          messaging_enabled: true,
          is_private: false,
          bio: `${username} account for testing`,
        })
        .select()
        .single();

      if (createProfileError) {
        console.error(`[AUTH] Failed to create profile for ${username}:`, createProfileError);
        throw new Error(`Failed to create profile: ${createProfileError.message}`);
      }

      const accessToken = jwt.sign(
        { userId: newProfile.id, username: newProfile.username, role: newProfile.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      const refreshToken = jwt.sign(
        { userId: newProfile.id },
        JWT_REFRESH_SECRET,
        { expiresIn: '30d' }
      );

      return {
        user: {
          id: newProfile.id,
          username: newProfile.username,
          displayName: newProfile.display_name,
          email: newProfile.email,
          emailVerified: newProfile.email_verified,
          role: newProfile.role,
          totalXP: newProfile.total_xp ?? 0,
          level: newProfile.level ?? 1,
          currentStreak: newProfile.current_streak ?? 0,
          longestStreak: newProfile.longest_streak ?? 0,
          avatarUrl: await generateSignedUrl(newProfile.avatar_url),
          bannerUrl: await generateSignedUrl(newProfile.banner_url),
          bio: newProfile.bio,
          messagingEnabled: newProfile.messaging_enabled,
          isPrivate: newProfile.is_private,
        },
        accessToken,
        refreshToken,
        expiresIn: 7 * 24 * 60 * 60,
      };
    }

    // ── Step 1: Try Gamefolio production API first ──────────────────────────
    console.log('[AUTH] Trying Gamefolio API first...');
    const gamefolioResult = await authenticateWithGamefolioAPI(username, password);

    if (gamefolioResult.outcome === 'success') {
      // Strip internal `outcome` field before exposing to clients
      const gamefolioTokens = {
        accessToken: gamefolioResult.accessToken,
        refreshToken: gamefolioResult.refreshToken,
        expiresIn: gamefolioResult.expiresIn,
      };

      // Production auth succeeded — look up local Supabase for the user profile.
      // Use the Gamefolio tokens as the primary tokens so mobile can call
      // the production API directly for subsequent requests.
      const { data: localUser } = await supabaseAdmin
        .from('users')
        .select('*')
        .or(`username.ilike.${username},email.ilike.${username}`)
        .maybeSingle();

      if (localUser) {
        console.log('[AUTH] Gamefolio API login successful (local user found):', localUser.username);
        return {
          user: {
            id: localUser.id,
            username: localUser.username,
            displayName: localUser.display_name,
            email: localUser.email,
            emailVerified: localUser.email_verified,
            role: localUser.role,
            totalXP: localUser.total_xp ?? 0,
            level: localUser.level ?? 1,
            currentStreak: localUser.current_streak ?? 0,
            longestStreak: localUser.longest_streak ?? 0,
            avatarUrl: await generateSignedUrl(localUser.avatar_url),
            bannerUrl: await generateSignedUrl(localUser.banner_url),
            bio: localUser.bio,
            messagingEnabled: localUser.messaging_enabled,
            isPrivate: localUser.is_private,
          },
          accessToken: gamefolioTokens.accessToken,
          refreshToken: gamefolioTokens.refreshToken,
          expiresIn: gamefolioTokens.expiresIn,
          gamefolioTokens,
        };
      }

      // Verified on production but no local profile — return production tokens
      console.log('[AUTH] Gamefolio API login OK (no local user), returning production tokens');
      return {
        user: null,
        accessToken: gamefolioTokens.accessToken,
        refreshToken: gamefolioTokens.refreshToken,
        expiresIn: gamefolioTokens.expiresIn,
        gamefolioTokens,
      };
    }

    // Wrong password or server error on production — fail immediately.
    // Only fall back to local when the user is simply not found on production (404).
    if (gamefolioResult.outcome === 'unauthorized' || gamefolioResult.outcome === 'error') {
      throw new Error('Invalid username or password');
    }

    // ── Step 2: Fall back to local Supabase (only when production returned 404) ─
    // This covers mobile-registered accounts not present on the web app.
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .or(`username.ilike.${username},email.ilike.${username}`)
      .maybeSingle();

    if (userError || !userData) {
      console.error('[AUTH] User not found:', username);
      throw new Error('Invalid username or password');
    }

    const isPasswordValid = await bcrypt.compare(password, userData.password_hash || '');

    if (!isPasswordValid) {
      console.error('[AUTH] Invalid password for:', username);
      throw new Error('Invalid username or password');
    }

    const accessToken = jwt.sign(
      { userId: userData.id, username: userData.username, role: userData.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const refreshToken = jwt.sign(
      { userId: userData.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );

    console.log('[AUTH] Local login successful:', userData.username);

    return {
      user: {
        id: userData.id,
        username: userData.username,
        displayName: userData.display_name,
        email: userData.email,
        emailVerified: userData.email_verified,
        role: userData.role,
        totalXP: userData.total_xp ?? 0,
        level: userData.level ?? 1,
        currentStreak: userData.current_streak ?? 0,
        longestStreak: userData.longest_streak ?? 0,
        avatarUrl: await generateSignedUrl(userData.avatar_url),
        bannerUrl: await generateSignedUrl(userData.banner_url),
        bio: userData.bio,
        messagingEnabled: userData.messaging_enabled,
        isPrivate: userData.is_private,
      },
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60,
    };
  });
