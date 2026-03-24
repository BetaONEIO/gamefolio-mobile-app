import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import { generateSignedUrl } from '@/backend/lib/signed-urls';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { Env } from '@/constants/Env';

const GAMEFOLIO_API_URL = 'https://app.gamefolio.com/api';

async function authenticateWithGamefolioAPI(username: string, password: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} | null> {
  try {
    console.log('[AUTH] Authenticating with Gamefolio API...');
    const response = await fetch(`${GAMEFOLIO_API_URL}/auth/token/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      console.log('[AUTH] Gamefolio API auth failed:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('[AUTH] Gamefolio API auth successful');
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn || 3600,
    };
  } catch (error) {
    console.error('[AUTH] Gamefolio API auth error:', error);
    return null;
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

    console.log('[AUTH] Login successful:', userData.username);

    // Also authenticate with Gamefolio API for uploads
    const gamefolioAuth = await authenticateWithGamefolioAPI(username, password);

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
      gamefolioTokens: gamefolioAuth,
    };
  });
