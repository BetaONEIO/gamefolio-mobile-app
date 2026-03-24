import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import { generateSignedUrl } from '@/backend/lib/signed-urls';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { Env } from '@/constants/Env';

const JWT_SECRET = Env.JWT_SECRET;
const JWT_REFRESH_SECRET = Env.JWT_SECRET + '-refresh';

const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  displayName: z.string().min(1, 'Display name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  dateOfBirth: z.string().optional(),
  referralCode: z.string().optional(),
});

export default publicProcedure
  .input(registerSchema)
  .mutation(async ({ input }) => {
    const { username, displayName, email, password, dateOfBirth, referralCode } = input;

    console.log('[AUTH] Registering user:', { username, email, referralCode });

    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('username, email')
      .or(`username.ilike.${username},email.ilike.${email}`)
      .maybeSingle();

    if (existingUser) {
      if (existingUser.username?.toLowerCase() === username.toLowerCase()) {
        throw new Error('Username already taken');
      }
      if (existingUser.email?.toLowerCase() === email.toLowerCase()) {
        throw new Error('Email already registered');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let referrerId: number | undefined;
    if (referralCode) {
      const { data: referrer } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', parseInt(referralCode, 10))
        .maybeSingle();
      
      if (referrer) {
        referrerId = referrer.id;
        console.log('[AUTH] Valid referral code from user:', referrerId);
      }
    }

    const initialXP = referrerId ? 250 : 0;

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        username,
        display_name: displayName,
        email,
        password_hash: hashedPassword,
        date_of_birth: dateOfBirth,
        email_verified: false,
        role: 'user',
        messaging_enabled: true,
        is_private: false,
        total_xp: initialXP,
        level: 1,
      })
      .select()
      .single();

    if (profileError) {
      console.error('[AUTH] Profile creation error:', profileError);
      throw new Error('Failed to create user profile');
    }

    if (referrerId) {
      const { data: referrerData } = await supabaseAdmin
        .from('users')
        .select('total_xp, level')
        .eq('id', referrerId)
        .single();

      if (referrerData) {
        const newXP = (referrerData.total_xp || 0) + 250;
        const newLevel = Math.floor(Math.sqrt(newXP / 500)) + 1;
        
        await supabaseAdmin
          .from('users')
          .update({ 
            total_xp: newXP,
            level: newLevel,
          })
          .eq('id', referrerId);

        await supabaseAdmin
          .from('referrals')
          .insert({
            referrer_id: referrerId,
            referred_id: profileData.id,
            xp_awarded: 250,
            created_at: new Date().toISOString(),
          });

        console.log('[AUTH] Referral bonus awarded to user:', referrerId);
      }
    }

    const accessToken = jwt.sign(
      { userId: profileData.id, username: profileData.username, role: profileData.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const refreshToken = jwt.sign(
      { userId: profileData.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );

    console.log('[AUTH] User registered successfully:', username);

    return {
      user: {
        id: profileData.id,
        username: profileData.username,
        displayName: profileData.display_name,
        email: profileData.email,
        emailVerified: profileData.email_verified,
        role: profileData.role,
        totalXP: profileData.total_xp ?? 0,
        level: profileData.level ?? 1,
        currentStreak: profileData.current_streak ?? 0,
        longestStreak: profileData.longest_streak ?? 0,
        avatarUrl: await generateSignedUrl(profileData.avatar_url),
        bannerUrl: await generateSignedUrl(profileData.banner_url),
        bio: profileData.bio,
        messagingEnabled: profileData.messaging_enabled,
        isPrivate: profileData.is_private,
      },
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60,
    };
  });
