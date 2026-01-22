import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { supabaseAdmin } from "@/lib/supabase";
import jwt from "jsonwebtoken";
import { Env } from "@/constants/Env";

const app = new Hono();
const JWT_SECRET = Env.JWT_SECRET;
const JWT_REFRESH_SECRET = JWT_SECRET + '-refresh';

console.log('[Backend] JWT_SECRET loaded:', JWT_SECRET ? '✅ Present' : '❌ Missing');
console.log('[Backend] JWT_SECRET length:', JWT_SECRET?.length || 0);
console.log('[Backend] JWT_SECRET value:', JWT_SECRET);

app.use("*", cors());

// Twitch API helpers
interface TwitchToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface TwitchGame {
  id: string;
  name: string;
  box_art_url: string;
}

let cachedTwitchToken: { token: string; expiresAt: number } | null = null;

async function getTwitchToken(): Promise<string> {
  if (cachedTwitchToken && Date.now() < cachedTwitchToken.expiresAt) {
    return cachedTwitchToken.token;
  }

  console.log("[Twitch] Fetching new access token...");

  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: Env.TWITCH_CLIENT_ID,
      client_secret: Env.TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Twitch] Token fetch failed:", errorText);
    throw new Error("Failed to get Twitch access token");
  }

  const data: TwitchToken = await response.json();

  cachedTwitchToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  console.log("[Twitch] Token acquired successfully");
  return cachedTwitchToken.token;
}

// Helper function to calculate level from XP
function calculateLevel(totalXP: number): number {
  let level = 1;
  let xpNeeded = 0;
  
  while (xpNeeded <= totalXP) {
    xpNeeded += 1000 * level;
    if (xpNeeded <= totalXP) {
      level++;
    }
  }
  
  return level;
}

// Helper function to award XP to a user
async function awardXP(userId: number, xpAmount: number): Promise<{ success: boolean; newTotalXP?: number; newLevel?: number }> {
  try {
    const { data: currentUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('total_xp')
      .eq('id', userId)
      .single();

    if (fetchError || !currentUser) {
      console.error('[XP] Failed to fetch user for XP award:', fetchError);
      return { success: false };
    }

    const newTotalXP = (currentUser.total_xp || 0) + xpAmount;
    const newLevel = calculateLevel(newTotalXP);

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        total_xp: newTotalXP,
        level: newLevel,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('[XP] Failed to update XP:', updateError);
      return { success: false };
    }

    console.log('[XP] Awarded', xpAmount, 'XP to user', userId, '- New total:', newTotalXP, 'Level:', newLevel);
    return { success: true, newTotalXP, newLevel };
  } catch (error) {
    console.error('[XP] Error awarding XP:', error);
    return { success: false };
  }
}

// REST API Endpoints

// Token Login
app.post("/api/auth/token/login", async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;

    if (!username || !password) {
      return c.json({ message: "Username and password are required" }, 400);
    }

    console.log('[AUTH REST] Token login attempt:', username);

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .or(`username.eq.${username},email.eq.${username}`)
      .maybeSingle();

    if (userError || !userData) {
      console.error('[AUTH REST] User not found:', username);
      return c.json({ message: 'Invalid username or password' }, 401);
    }

    const bcrypt = await import('bcryptjs');
    const isPasswordValid = await bcrypt.compare(password, userData.password_hash || '');

    if (!isPasswordValid) {
      console.error('[AUTH REST] Invalid password for:', username);
      return c.json({ message: 'Invalid username or password' }, 401);
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

    console.log('[AUTH REST] Token login successful:', userData.username);

    return c.json({
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60,
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
        avatarUrl: userData.avatar_url,
        bannerUrl: userData.banner_url,
        bio: userData.bio,
        messagingEnabled: userData.messaging_enabled,
        isPrivate: userData.is_private,
      },
    });
  } catch (error) {
    console.error('[AUTH REST] Login error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// Token Register
app.post("/api/auth/token/register", async (c) => {
  try {
    const body = await c.req.json();
    const { username, displayName, email, password, dateOfBirth } = body;

    if (!username || !displayName || !email || !password) {
      return c.json({ message: "All fields are required" }, 400);
    }

    console.log('[AUTH REST] Token register attempt:', { username, email });

    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('username, email')
      .or(`username.eq.${username},email.eq.${email}`)
      .maybeSingle();

    if (existingUser) {
      if (existingUser.username === username) {
        return c.json({ message: 'Username already taken' }, 400);
      }
      if (existingUser.email === email) {
        return c.json({ message: 'Email already registered' }, 400);
      }
    }

    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

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
      })
      .select()
      .single();

    if (profileError) {
      console.error('[AUTH REST] Profile creation error:', profileError);
      return c.json({ message: 'Failed to create user profile' }, 500);
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

    console.log('[AUTH REST] User registered successfully:', username);

    return c.json({
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
        avatarUrl: profileData.avatar_url,
        bannerUrl: profileData.banner_url,
        bio: profileData.bio,
        messagingEnabled: profileData.messaging_enabled,
        isPrivate: profileData.is_private,
      },
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60,
    });
  } catch (error) {
    console.error('[AUTH REST] Register error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// Token Refresh
app.post("/api/auth/token/refresh", async (c) => {
  try {
    const body = await c.req.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return c.json({ message: "Refresh token is required" }, 400);
    }

    console.log("[AUTH] Token refresh attempt");

    let decoded: { userId: string };
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
    } catch (e) {
      console.error("[AUTH] Invalid refresh token:", e);
      return c.json({ message: "Invalid or expired refresh token" }, 401);
    }

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", decoded.userId)
      .single();

    if (profileError || !profileData) {
      console.error("[AUTH] Profile fetch error:", profileError);
      return c.json({ message: "User not found" }, 404);
    }

    const accessToken = jwt.sign(
      { userId: profileData.id, username: profileData.username, role: profileData.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const newRefreshToken = jwt.sign(
      { userId: profileData.id },
      JWT_REFRESH_SECRET,
      { expiresIn: "30d" }
    );

    console.log("[AUTH] Token refreshed successfully");

    return c.json({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 7 * 24 * 60 * 60,
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
        avatarUrl: profileData.avatar_url,
        bannerUrl: profileData.banner_url,
        bio: profileData.bio,
        messagingEnabled: profileData.messaging_enabled,
        isPrivate: profileData.is_private,
        userType: profileData.user_type,
        ageRange: profileData.age_range,
        gfTokenBalance: profileData.gf_token_balance,
      },
    });
  } catch (error) {
    console.error("[AUTH] Refresh token error:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Get Current User Profile
app.get("/api/user", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ message: "No authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let userId: string;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    userId = decoded.userId;
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  try {
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      console.error("Failed to fetch user:", userError);
      return c.json({ message: "User not found" }, 404);
    }

    return c.json({
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
        avatarUrl: userData.avatar_url,
        bannerUrl: userData.banner_url,
        bio: userData.bio,
        messagingEnabled: userData.messaging_enabled,
        isPrivate: userData.is_private,
        userType: userData.user_type,
        ageRange: userData.age_range,
        gfTokenBalance: userData.gf_token_balance,
        accentColor: userData.accent_color,
        backgroundColor: userData.background_color,
        isOnline: userData.is_online,
        lastActive: userData.last_active,
        isPro: userData.is_pro,
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Update Profile
app.patch("/api/user", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ message: "No authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let userId: string;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    userId = decoded.userId;
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  try {
    const body = await c.req.json();
    const updates: any = {};
    
    // Map camelCase to snake_case
    if (body.displayName !== undefined) updates.display_name = body.displayName;
    if (body.bio !== undefined) updates.bio = body.bio;
    if (body.avatarUrl !== undefined) updates.avatar_url = body.avatarUrl;
    if (body.bannerUrl !== undefined) updates.banner_url = body.bannerUrl;
    if (body.isPrivate !== undefined) updates.is_private = body.isPrivate;
    if (body.accentColor !== undefined) updates.accent_color = body.accentColor;
    if (body.backgroundColor !== undefined) updates.background_color = body.backgroundColor;
    if (body.profileBorderId !== undefined) updates.profile_border_id = body.profileBorderId;

    if (Object.keys(updates).length === 0) {
      return c.json({ success: true });
    }

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update profile:", updateError);
      return c.json({ message: "Failed to update profile" }, 500);
    }
    
    return c.json({
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        displayName: updatedUser.display_name,
        email: updatedUser.email,
        emailVerified: updatedUser.email_verified,
        role: updatedUser.role,
        totalXP: updatedUser.total_xp ?? 0,
        level: updatedUser.level ?? 1,
        currentStreak: updatedUser.current_streak ?? 0,
        longestStreak: updatedUser.longest_streak ?? 0,
        avatarUrl: updatedUser.avatar_url,
        bannerUrl: updatedUser.banner_url,
        bio: updatedUser.bio,
        messagingEnabled: updatedUser.messaging_enabled,
        isPrivate: updatedUser.is_private,
        userType: updatedUser.user_type,
        ageRange: updatedUser.age_range,
        gfTokenBalance: updatedUser.gf_token_balance,
        accentColor: updatedUser.accent_color,
        backgroundColor: updatedUser.background_color,
        isOnline: updatedUser.is_online,
        lastActive: updatedUser.last_active,
        isPro: updatedUser.is_pro,
        profileBorderId: updatedUser.profile_border_id,
      },
    });
  } catch (error) {
    console.error("Error processing update profile request:", error);
    return c.json({ message: "Invalid request body" }, 400);
  }
});

// REST API: Get Clips Feed
app.get("/api/clips", async (c) => {
  const pageParam = c.req.query("page");
  const limitParam = c.req.query("limit");
  const gameIdParam = c.req.query("gameId");
  const userIdParam = c.req.query("userId");

  const page = pageParam ? parseInt(pageParam, 10) : 1;
  const limit = limitParam ? parseInt(limitParam, 10) : 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  console.log(`[REST] Fetching clips feed - page: ${page}, limit: ${limit}`);

  try {
    let query = supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .eq('video_type', 'clip')
      .order('created_at', { ascending: false });

    if (gameIdParam) {
      query = query.eq('game_id', parseInt(gameIdParam, 10));
    }

    if (userIdParam) {
      query = query.eq('user_id', parseInt(userIdParam, 10));
    }

    query = query.range(from, to);

    const { data: clips, error } = await query;

    if (error) {
      console.error('[REST] Error fetching clips feed:', error);
      return c.json([], 500);
    }

    console.log('[REST] Found clips:', clips?.length || 0);
    
    // Log thumbnail data for debugging
    clips?.forEach((clip: any, index: number) => {
      console.log(`[REST] Clip ${index + 1}: id=${clip.id}, thumbnail_url="${clip.thumbnail_url || 'NULL'}", video_url="${clip.video_url || 'NULL'}"`);
    });

    const formattedClips = await Promise.all(clips?.map(async (clip: any) => {
      const { count: likesCount } = await supabaseAdmin
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      const { count: commentsCount } = await supabaseAdmin
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      return {
        id: clip.id,
        userId: clip.user_id,
        gameId: clip.game_id,
        title: clip.title || 'Untitled',
        description: clip.description || '',
        videoUrl: clip.video_url || '',
        thumbnailUrl: clip.thumbnail_url || '',
        videoType: clip.video_type || 'clip',
        duration: clip.duration || 0,
        views: clip.views || 0,
        shareCode: clip.share_code || '',
        ageRestricted: clip.age_restricted || false,
        createdAt: clip.created_at,
        user: {
          id: clip.user?.id || 0,
          username: clip.user?.username || 'unknown',
          displayName: clip.user?.display_name || clip.user?.username || 'Unknown',
          avatarUrl: clip.user?.avatar_url || '',
        },
        game: clip.game ? {
          id: clip.game.id,
          name: clip.game.name || 'Unknown Game',
          imageUrl: clip.game.image_url || '',
          twitchId: clip.game.twitch_id || '',
        } : null,
        _count: {
          likes: likesCount || 0,
          comments: commentsCount || 0,
        }
      };
    }) || []);

    console.log('[REST] Returning', formattedClips.length, 'formatted clips');
    return c.json(formattedClips);
  } catch (error) {
    console.error('[REST] Error in clips feed:', error);
    return c.json([], 500);
  }
});

// REST API: Get Latest Clips
app.get("/api/clips/latest", async (c) => {
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  console.log(`[REST] Fetching latest clips - limit: ${limit}`);

  try {
    const { data: clips, error } = await supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .eq('video_type', 'clip')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[REST] Error fetching latest clips:', error);
      return c.json([], 500);
    }

    console.log('[REST] Found latest clips:', clips?.length || 0);
    
    // Log thumbnail info for debugging
    clips?.forEach((clip: any, index: number) => {
      console.log(`[REST] Latest Clip ${index + 1}: id=${clip.id}, title="${clip.title}", thumbnail_url="${clip.thumbnail_url || 'NULL'}", game_image="${clip.game?.image_url || 'NULL'}"`);
    });

    const formattedClips = await Promise.all(clips?.map(async (clip: any) => {
      const { count: likesCount } = await supabaseAdmin
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      const { count: commentsCount } = await supabaseAdmin
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      return {
        id: clip.id,
        userId: clip.user_id,
        gameId: clip.game_id,
        title: clip.title || 'Untitled',
        description: clip.description || '',
        videoUrl: clip.video_url || '',
        thumbnailUrl: clip.thumbnail_url || '',
        videoType: clip.video_type || 'clip',
        duration: clip.duration || 0,
        views: clip.views || 0,
        shareCode: clip.share_code || '',
        ageRestricted: clip.age_restricted || false,
        createdAt: clip.created_at,
        user: {
          id: clip.user?.id || 0,
          username: clip.user?.username || 'unknown',
          displayName: clip.user?.display_name || clip.user?.username || 'Unknown',
          avatarUrl: clip.user?.avatar_url || '',
        },
        game: clip.game ? {
          id: clip.game.id,
          name: clip.game.name || 'Unknown Game',
          imageUrl: clip.game.image_url || '',
          twitchId: clip.game.twitch_id || '',
        } : null,
        _count: {
          likes: likesCount || 0,
          comments: commentsCount || 0,
        }
      };
    }) || []);

    console.log('[REST] Returning', formattedClips.length, 'latest clips with thumbnails');
    return c.json(formattedClips);
  } catch (error) {
    console.error('[REST] Error in latest clips:', error);
    return c.json([], 500);
  }
});

// REST API: Get Trending Clips
app.get("/api/clips/trending", async (c) => {
  const periodParam = c.req.query("period") || "all";
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  console.log(`[REST] Fetching trending clips - period: ${periodParam}, limit: ${limit}`);

  let dateFilter: Date | null = null;
  const now = new Date();

  switch (periodParam) {
    case 'day':
      dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'week':
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      dateFilter = null;
  }

  try {
    let query = supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .eq('video_type', 'clip');

    if (dateFilter) {
      query = query.gte('created_at', dateFilter.toISOString());
    }

    query = query
      .order('views', { ascending: false })
      .limit(limit);

    const { data: clips, error } = await query;

    if (error) {
      console.error('[REST] Error fetching trending clips:', error);
      return c.json([], 500);
    }

    console.log('[REST] Found trending clips:', clips?.length || 0);

    const formattedClips = await Promise.all(clips?.map(async (clip: any) => {
      const { count: likesCount } = await supabaseAdmin
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      const { count: commentsCount } = await supabaseAdmin
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      return {
        id: clip.id,
        userId: clip.user_id,
        gameId: clip.game_id,
        title: clip.title,
        description: clip.description || '',
        videoUrl: clip.video_url,
        thumbnailUrl: clip.thumbnail_url,
        videoType: clip.video_type || 'clip',
        duration: clip.duration || 0,
        views: clip.views || 0,
        shareCode: clip.share_code,
        ageRestricted: clip.age_restricted || false,
        createdAt: clip.created_at,
        user: {
          id: clip.user.id,
          username: clip.user.username,
          displayName: clip.user.display_name,
          avatarUrl: clip.user.avatar_url,
        },
        game: clip.game ? {
          id: clip.game.id,
          name: clip.game.name,
          imageUrl: clip.game.image_url,
          twitchId: clip.game.twitch_id,
        } : null,
        _count: {
          likes: likesCount || 0,
          comments: commentsCount || 0,
        }
      };
    }) || []);

    return c.json(formattedClips);
  } catch (error) {
    console.error('[REST] Error in trending clips:', error);
    return c.json([], 500);
  }
});

// REST API: Get Latest Reels
app.get("/api/reels/latest", async (c) => {
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  console.log(`[REST] Fetching latest reels - limit: ${limit}`);

  try {
    const { data: reels, error } = await supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .eq('video_type', 'reel')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[REST] Error fetching latest reels:', error);
      return c.json([], 500);
    }

    console.log('[REST] Found reels:', reels?.length || 0);
    
    // Log thumbnail info for debugging
    reels?.forEach((reel: any, index: number) => {
      console.log(`[REST] Latest Reel ${index + 1}: id=${reel.id}, title="${reel.title}", thumbnail_url="${reel.thumbnail_url || 'NULL'}", video_url="${reel.video_url || 'NULL'}", game_image="${reel.game?.image_url || 'NULL'}"`);
    });

    const formattedReels = await Promise.all(reels?.map(async (reel: any) => {
      const { count: likesCount } = await supabaseAdmin
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', reel.id);

      const { count: commentsCount } = await supabaseAdmin
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', reel.id);

      return {
        id: reel.id,
        userId: reel.user_id,
        gameId: reel.game_id,
        title: reel.title || 'Untitled',
        description: reel.description || '',
        videoUrl: reel.video_url || '',
        thumbnailUrl: reel.thumbnail_url || '',
        videoType: reel.video_type || 'reel',
        duration: reel.duration || 0,
        views: reel.views || 0,
        shareCode: reel.share_code || '',
        ageRestricted: reel.age_restricted || false,
        createdAt: reel.created_at,
        user: {
          id: reel.user?.id || 0,
          username: reel.user?.username || 'unknown',
          displayName: reel.user?.display_name || reel.user?.username || 'Unknown',
          avatarUrl: reel.user?.avatar_url || '',
        },
        game: reel.game ? {
          id: reel.game.id,
          name: reel.game.name || 'Unknown Game',
          imageUrl: reel.game.image_url || '',
          twitchId: reel.game.twitch_id || '',
        } : null,
        _count: {
          likes: likesCount || 0,
          comments: commentsCount || 0,
        }
      };
    }) || []);

    console.log('[REST] Returning', formattedReels.length, 'latest reels with thumbnails');
    return c.json(formattedReels);
  } catch (error) {
    console.error('[REST] Error in latest reels:', error);
    return c.json([], 500);
  }
});

// REST API: Get Trending Reels
app.get("/api/reels/trending", async (c) => {
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  console.log(`[REST] Fetching trending reels - limit: ${limit}`);

  try {
    const { data: reels, error } = await supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .eq('video_type', 'reel')
      .order('views', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[REST] Error fetching trending reels:', error);
      return c.json([], 500);
    }

    console.log('[REST] Found trending reels:', reels?.length || 0);

    const formattedReels = await Promise.all(reels?.map(async (reel: any) => {
      const { count: likesCount } = await supabaseAdmin
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', reel.id);

      const { count: commentsCount } = await supabaseAdmin
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', reel.id);

      return {
        id: reel.id,
        userId: reel.user_id,
        gameId: reel.game_id,
        title: reel.title,
        description: reel.description || '',
        videoUrl: reel.video_url,
        thumbnailUrl: reel.thumbnail_url,
        videoType: reel.video_type || 'reel',
        duration: reel.duration || 0,
        views: reel.views || 0,
        shareCode: reel.share_code,
        ageRestricted: reel.age_restricted || false,
        createdAt: reel.created_at,
        user: {
          id: reel.user.id,
          username: reel.user.username,
          displayName: reel.user.display_name,
          avatarUrl: reel.user.avatar_url,
        },
        game: reel.game ? {
          id: reel.game.id,
          name: reel.game.name,
          imageUrl: reel.game.image_url,
          twitchId: reel.game.twitch_id,
        } : null,
        _count: {
          likes: likesCount || 0,
          comments: commentsCount || 0,
        }
      };
    }) || []);

    return c.json(formattedReels);
  } catch (error) {
    console.error('[REST] Error in trending reels:', error);
    return c.json([], 500);
  }
});

// Mock data for search
const mockHashtags = [
  { id: '1', name: 'valorant', count: 15420 },
  { id: '2', name: 'fortnite', count: 12300 },
  { id: '3', name: 'apex', count: 9800 },
  { id: '4', name: 'csgo', count: 8500 },
  { id: '5', name: 'leagueoflegends', count: 7200 },
  { id: '6', name: 'minecraft', count: 6800 },
  { id: '7', name: 'overwatch', count: 5400 },
  { id: '8', name: 'rocketleague', count: 4200 },
  { id: '9', name: 'callofduty', count: 3900 },
  { id: '10', name: 'gta', count: 3500 },
  { id: '11', name: 'league', count: 5600 },
  { id: '12', name: 'leagueclips', count: 3200 },
];

const mockUsers = [
  { id: '1', username: 'ProGamer123', displayName: 'Pro Gamer', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100', verified: true, followers: 125000 },
  { id: '2', username: 'NinjaStreamer', displayName: 'Ninja Streamer', avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100', verified: true, followers: 89000 },
  { id: '3', username: 'GameMaster', displayName: 'Game Master', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100', verified: false, followers: 45000 },
  { id: '4', username: 'ValPlayer', displayName: 'Valorant Player', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100', verified: true, followers: 67000 },
  { id: '5', username: 'ApexPro', displayName: 'Apex Professional', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcabd36?w=100', verified: false, followers: 23000 },
  { id: '6', username: 'LeagueFan', displayName: 'League Fan', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100', verified: false, followers: 34000 },
  { id: '7', username: 'LeaguePro', displayName: 'League Pro Player', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', verified: true, followers: 156000 },
];

async function searchTwitchGames(query: string, limit: number): Promise<{ id: string; name: string; icon: string; category: string; players: number }[]> {
  console.log(`[Search/Twitch] Starting search for: "${query}"`);
  
  if (!Env.TWITCH_CLIENT_ID || !Env.TWITCH_CLIENT_SECRET) {
    console.error("[Search/Twitch] Missing Twitch credentials");
    return [];
  }
  
  try {
    const accessToken = await getTwitchToken();
    
    const searchUrl = new URL("https://api.twitch.tv/helix/search/categories");
    searchUrl.searchParams.set("query", query);
    searchUrl.searchParams.set("first", limit.toString());
    
    const response = await fetch(searchUrl.toString(), {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Client-Id": Env.TWITCH_CLIENT_ID,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Search/Twitch] Search failed:", response.status, errorText);
      return [];
    }

    const data: { data: TwitchGame[] } = await response.json();
    
    console.log(`[Search/Twitch] Found ${data.data?.length || 0} games for "${query}"`);
    
    if (!data.data || data.data.length === 0) {
      return [];
    }
    
    return data.data.map((game) => ({
      id: game.id,
      name: game.name,
      icon: game.box_art_url
        .replace("{width}", "100")
        .replace("{height}", "100"),
      category: "Game",
      players: 0,
    }));
  } catch (error) {
    console.error("[Search/Twitch] Error searching games:", error);
    return [];
  }
}

// REST API: General Search (hashtags, users, games)
app.get("/api/search", async (c) => {
  const query = c.req.query("query") || c.req.query("q");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 5;

  if (!query) {
    return c.json({ hashtags: [], users: [], games: [] });
  }

  const searchTerm = query.toLowerCase();
  console.log(`[Search REST] Searching for: "${query}"`);

  const hashtags = mockHashtags
    .filter(tag => tag.name.toLowerCase().includes(searchTerm))
    .slice(0, limit);
  
  console.log(`[Search REST] Found ${hashtags.length} hashtags`);

  // Search for real users from database
  let users: { id: string; username: string; displayName: string; avatar: string; verified: boolean; followers: number }[] = [];
  try {
    const { data: dbUsers, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, avatar_url, verified')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(limit);

    if (usersError) {
      console.error('[Search REST] Error searching users:', usersError);
    } else if (dbUsers && dbUsers.length > 0) {
      users = dbUsers.map(user => ({
        id: String(user.id),
        username: user.username || '',
        displayName: user.display_name || user.username || '',
        avatar: user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
        verified: user.verified || false,
        followers: 0,
      }));
      console.log(`[Search REST] Found ${users.length} users from database`);
    }
  } catch (error) {
    console.error('[Search REST] Failed to search users:', error);
  }

  // No fallback to mock users - only return real users from database
  console.log(`[Search REST] Returning ${users.length} real users (no mock fallback)`);

  let games: { id: string; name: string; icon: string; category: string; players: number }[] = [];
  try {
    games = await searchTwitchGames(query, limit);
    console.log(`[Search REST] Found ${games.length} games from Twitch`);
  } catch (error) {
    console.error(`[Search REST] Failed to search Twitch games:`, error);
  }

  return c.json({
    hashtags,
    users,
    games,
  });
});

// Token Logout
app.post("/api/auth/token/logout", async (c) => {
  const authHeader = c.req.header("Authorization");
  
  console.log('[AUTH REST] Logout request');

  if (authHeader) {
    console.log('[AUTH REST] Token invalidated on client side');
  }

  console.log('[AUTH REST] Logout successful');

  return c.json({
    message: 'Logged out successfully',
  });
});

// REST API: Messages - Get Conversations
app.get("/api/messages/conversations", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ message: "No authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let userId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
    userId = typeof decoded.userId === 'number' ? decoded.userId : parseInt(String(decoded.userId));
    
    if (isNaN(userId)) {
      console.error('[Messages REST] Invalid userId in token:', decoded.userId);
      return c.json({ message: 'Invalid token payload' }, 401);
    }
  } catch (e: any) {
    console.error('[Messages REST] Token verification failed:', e?.message || e);
    console.error('[Messages REST] JWT_SECRET length:', JWT_SECRET?.length || 0);
    console.error('[Messages REST] Token that failed (first 50 chars):', token.substring(0, 50));
    console.error('[Messages REST] Full error:', JSON.stringify(e, Object.getOwnPropertyNames(e)));
    return c.json({ message: "Invalid token" }, 401);
  }

  console.log('[Messages REST] Getting conversations for user:', userId);

  try {
    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at, is_read')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Messages REST] Supabase error:', error);
      return c.json({ message: `Failed to fetch conversations: ${error.message}` }, 500);
    }

    if (!messages || messages.length === 0) {
      console.log('[Messages REST] No messages found');
      return c.json([]);
    }

    console.log('[Messages REST] Found', messages.length, 'total messages');

    const conversationsMap = new Map<number, any>();
    const userIds = new Set<number>();

    for (const msg of messages) {
      const otherUserId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      userIds.add(otherUserId);
    }

    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, avatar_url')
      .in('id', Array.from(userIds));

    if (usersError) {
      console.error('[Messages REST] Error fetching users:', usersError);
      return c.json({ message: `Failed to fetch users: ${usersError.message}` }, 500);
    }

    if (!users) {
      console.log('[Messages REST] No users found');
      return c.json([]);
    }

    const usersMap = new Map(users.map(u => [u.id, u]));

    for (const msg of messages) {
      const otherUserId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      const otherUser = usersMap.get(otherUserId);

      if (!otherUser) {
        continue;
      }

      if (!conversationsMap.has(otherUserId)) {
        const unreadCount = messages.filter(
          (m) => m.sender_id === otherUserId && m.receiver_id === userId && !m.is_read
        ).length;

        conversationsMap.set(otherUserId, {
          id: otherUserId,
          recipientId: otherUserId,
          recipient: {
            id: otherUser.id,
            username: otherUser.username,
            displayName: otherUser.display_name || otherUser.username,
            avatarUrl: otherUser.avatar_url,
          },
          lastMessage: {
            id: msg.id,
            content: msg.content,
            senderId: msg.sender_id,
            createdAt: msg.created_at,
          },
          unreadCount,
          updatedAt: msg.created_at,
        });
      }
    }

    const conversations = Array.from(conversationsMap.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    console.log('[Messages REST] Returning', conversations.length, 'conversations');
    return c.json(conversations);
  } catch (error) {
    console.error('[Messages REST] Unexpected error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// REST API: Messages - Get Messages with a User
app.get("/api/messages/:userId", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ message: "No authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let currentUserId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
    currentUserId = typeof decoded.userId === 'number' ? decoded.userId : parseInt(String(decoded.userId));
    
    if (isNaN(currentUserId)) {
      return c.json({ message: 'Invalid token payload' }, 401);
    }
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  const otherUserId = parseInt(c.req.param('userId'));
  if (isNaN(otherUserId)) {
    return c.json({ message: "Invalid user ID" }, 400);
  }

  console.log('[Messages REST] Getting messages between', currentUserId, 'and', otherUserId);

  try {
    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Messages REST] Error fetching messages:', error);
      return c.json({ message: `Failed to fetch messages: ${error.message}` }, 500);
    }

    const formattedMessages = (messages || []).map(msg => ({
      id: msg.id,
      content: msg.content,
      senderId: msg.sender_id,
      receiverId: msg.receiver_id,
      createdAt: msg.created_at,
      isRead: msg.is_read,
    }));

    console.log('[Messages REST] Returning', formattedMessages.length, 'messages');
    return c.json(formattedMessages);
  } catch (error) {
    console.error('[Messages REST] Unexpected error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// REST API: Messages - Send Message
app.post("/api/messages", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ message: "No authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let senderId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
    senderId = typeof decoded.userId === 'number' ? decoded.userId : parseInt(String(decoded.userId));
    
    if (isNaN(senderId)) {
      return c.json({ message: 'Invalid token payload' }, 401);
    }
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  try {
    const body = await c.req.json();
    const { receiverId, content } = body;

    if (!receiverId || !content) {
      return c.json({ message: "Receiver ID and content are required" }, 400);
    }

    console.log('[Messages REST] Sending message from', senderId, 'to', receiverId);

    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        content,
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[Messages REST] Error sending message:', error);
      return c.json({ message: `Failed to send message: ${error.message}` }, 500);
    }

    const formattedMessage = {
      id: message.id,
      content: message.content,
      senderId: message.sender_id,
      receiverId: message.receiver_id,
      createdAt: message.created_at,
      isRead: message.is_read,
    };

    console.log('[Messages REST] Message sent successfully:', message.id);
    return c.json(formattedMessage);
  } catch (error) {
    console.error('[Messages REST] Unexpected error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// REST API: Messages - Start Conversation
app.post("/api/messages/start", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ message: "No authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let senderId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
    senderId = typeof decoded.userId === 'number' ? decoded.userId : parseInt(String(decoded.userId));
    
    if (isNaN(senderId)) {
      return c.json({ message: 'Invalid token payload' }, 401);
    }
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  try {
    const body = await c.req.json();
    const { username, content } = body;

    if (!username || !content) {
      return c.json({ message: "Username and content are required" }, 400);
    }

    console.log('[Messages REST] Starting conversation with', username);

    const { data: recipient, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, avatar_url')
      .eq('username', username)
      .single();

    if (userError || !recipient) {
      console.error('[Messages REST] User not found:', username);
      return c.json({ message: 'User not found' }, 404);
    }

    const { data: message, error: messageError } = await supabaseAdmin
      .from('messages')
      .insert({
        sender_id: senderId,
        receiver_id: recipient.id,
        content,
        is_read: false,
      })
      .select()
      .single();

    if (messageError) {
      console.error('[Messages REST] Error creating message:', messageError);
      return c.json({ message: `Failed to send message: ${messageError.message}` }, 500);
    }

    const conversation = {
      id: recipient.id,
      recipientId: recipient.id,
      recipient: {
        id: recipient.id,
        username: recipient.username,
        displayName: recipient.display_name || recipient.username,
        avatarUrl: recipient.avatar_url,
      },
      lastMessage: {
        id: message.id,
        content: message.content,
        senderId: message.sender_id,
        createdAt: message.created_at,
      },
      unreadCount: 0,
      updatedAt: message.created_at,
    };

    const formattedMessage = {
      id: message.id,
      content: message.content,
      senderId: message.sender_id,
      receiverId: message.receiver_id,
      createdAt: message.created_at,
      isRead: message.is_read,
    };

    console.log('[Messages REST] Conversation started successfully');
    return c.json({ conversation, message: formattedMessage });
  } catch (error) {
    console.error('[Messages REST] Unexpected error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// REST API: Messages - Delete Message
app.delete("/api/messages/:messageId", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ message: "No authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let userId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
    userId = typeof decoded.userId === 'number' ? decoded.userId : parseInt(String(decoded.userId));
    
    if (isNaN(userId)) {
      return c.json({ message: 'Invalid token payload' }, 401);
    }
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  const messageId = parseInt(c.req.param('messageId'));
  if (isNaN(messageId)) {
    return c.json({ message: "Invalid message ID" }, 400);
  }

  console.log('[Messages REST] Deleting message:', messageId);

  try {
    const { data: message, error: fetchError } = await supabaseAdmin
      .from('messages')
      .select('sender_id')
      .eq('id', messageId)
      .single();

    if (fetchError || !message) {
      return c.json({ message: 'Message not found' }, 404);
    }

    if (message.sender_id !== userId) {
      return c.json({ message: 'Unauthorized to delete this message' }, 403);
    }

    const { error: deleteError } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('id', messageId);

    if (deleteError) {
      console.error('[Messages REST] Error deleting message:', deleteError);
      return c.json({ message: `Failed to delete message: ${deleteError.message}` }, 500);
    }

    console.log('[Messages REST] Message deleted successfully');
    return c.json({ messageId });
  } catch (error) {
    console.error('[Messages REST] Unexpected error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// REST API: Messages - Delete Conversation
app.delete("/api/messages/conversations/:userId", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ message: "No authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let currentUserId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
    currentUserId = typeof decoded.userId === 'number' ? decoded.userId : parseInt(String(decoded.userId));
    
    if (isNaN(currentUserId)) {
      return c.json({ message: 'Invalid token payload' }, 401);
    }
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  const otherUserId = parseInt(c.req.param('userId'));
  if (isNaN(otherUserId)) {
    return c.json({ message: "Invalid user ID" }, 400);
  }

  console.log('[Messages REST] Deleting conversation between', currentUserId, 'and', otherUserId);

  try {
    const { error } = await supabaseAdmin
      .from('messages')
      .delete()
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`);

    if (error) {
      console.error('[Messages REST] Error deleting conversation:', error);
      return c.json({ message: `Failed to delete conversation: ${error.message}` }, 500);
    }

    console.log('[Messages REST] Conversation deleted successfully');
    return c.json({ success: true });
  } catch (error) {
    console.error('[Messages REST] Unexpected error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// REST API: Messages - Mark as Read
app.post("/api/messages/:userId/read", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ message: "No authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let currentUserId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
    currentUserId = typeof decoded.userId === 'number' ? decoded.userId : parseInt(String(decoded.userId));
    
    if (isNaN(currentUserId)) {
      return c.json({ message: 'Invalid token payload' }, 401);
    }
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  const otherUserId = parseInt(c.req.param('userId'));
  if (isNaN(otherUserId)) {
    return c.json({ message: "Invalid user ID" }, 400);
  }

  console.log('[Messages REST] Marking messages as read from', otherUserId);

  try {
    const { error } = await supabaseAdmin
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', otherUserId)
      .eq('receiver_id', currentUserId)
      .eq('is_read', false);

    if (error) {
      console.error('[Messages REST] Error marking messages as read:', error);
      return c.json({ message: `Failed to mark messages as read: ${error.message}` }, 500);
    }

    console.log('[Messages REST] Messages marked as read successfully');
    return c.json({ success: true });
  } catch (error) {
    console.error('[Messages REST] Unexpected error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// REST API: Users - Search Users
app.get("/api/users/search", async (c) => {
  const query = c.req.query('q');
  
  if (!query || query.trim().length === 0) {
    return c.json({ users: [] });
  }

  const searchTerm = query.trim();
  console.log('[Users REST] Searching for:', searchTerm);

  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, avatar_url, level, total_xp')
      .or(`username.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)
      .order('total_xp', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[Users REST] Error searching users:', error);
      return c.json({ users: [], error: error.message }, 500);
    }

    const formattedUsers = (users || []).map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name || u.username,
      avatarUrl: u.avatar_url,
      level: u.level ?? 1,
      totalXP: u.total_xp ?? 0,
    }));

    console.log('[Users REST] Found', formattedUsers.length, 'real users from database');
    return c.json({ users: formattedUsers });
  } catch (error) {
    console.error('[Users REST] Unexpected error:', error);
    return c.json({ users: [], error: 'Search failed' }, 500);
  }
});

// REST API: Users - Block User
app.post("/api/users/:userId/block", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ message: "No authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let currentUserId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
    currentUserId = typeof decoded.userId === 'number' ? decoded.userId : parseInt(String(decoded.userId));
    
    if (isNaN(currentUserId)) {
      return c.json({ message: 'Invalid token payload' }, 401);
    }
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  const blockedUserId = parseInt(c.req.param('userId'));
  if (isNaN(blockedUserId)) {
    return c.json({ message: "Invalid user ID" }, 400);
  }

  console.log('[Users REST] Blocking user:', blockedUserId);

  try {
    const { error } = await supabaseAdmin
      .from('blocked_users')
      .insert({
        blocker_id: currentUserId,
        blocked_id: blockedUserId,
      });

    if (error) {
      if (error.code === '23505') {
        return c.json({ success: true });
      }
      console.error('[Users REST] Error blocking user:', error);
      return c.json({ message: `Failed to block user: ${error.message}` }, 500);
    }

    console.log('[Users REST] User blocked successfully');
    return c.json({ success: true });
  } catch (error) {
    console.error('[Users REST] Unexpected error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// REST API: Users - Unblock User
app.post("/api/users/:userId/unblock", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ message: "No authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let currentUserId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
    currentUserId = typeof decoded.userId === 'number' ? decoded.userId : parseInt(String(decoded.userId));
    
    if (isNaN(currentUserId)) {
      return c.json({ message: 'Invalid token payload' }, 401);
    }
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  const blockedUserId = parseInt(c.req.param('userId'));
  if (isNaN(blockedUserId)) {
    return c.json({ message: "Invalid user ID" }, 400);
  }

  console.log('[Users REST] Unblocking user:', blockedUserId);

  try {
    const { error } = await supabaseAdmin
      .from('blocked_users')
      .delete()
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', blockedUserId);

    if (error) {
      console.error('[Users REST] Error unblocking user:', error);
      return c.json({ message: `Failed to unblock user: ${error.message}` }, 500);
    }

    console.log('[Users REST] User unblocked successfully');
    return c.json({ success: true });
  } catch (error) {
    console.error('[Users REST] Unexpected error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// REST API: Search - Clips
app.get("/api/search/clips", async (c) => {
  const query = c.req.query('q');
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  if (!query) {
    return c.json([]);
  }

  console.log('[Search REST] Searching clips for:', query);

  try {
    const { data: clips, error } = await supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('views', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Search REST] Error searching clips:', error);
      return c.json([]);
    }

    const formattedClips = await Promise.all((clips || []).map(async (clip: any) => {
      const { count: likesCount } = await supabaseAdmin
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      const { count: commentsCount } = await supabaseAdmin
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      return {
        id: clip.id,
        userId: clip.user_id,
        title: clip.title,
        description: clip.description || '',
        videoUrl: clip.video_url,
        thumbnailUrl: clip.thumbnail_url,
        videoType: clip.video_type,
        duration: clip.duration || 0,
        views: clip.views || 0,
        tags: clip.tags,
        shareCode: clip.share_code,
        createdAt: clip.created_at,
        user: {
          id: clip.user.id,
          username: clip.user.username,
          displayName: clip.user.display_name,
          avatarUrl: clip.user.avatar_url,
        },
        game: clip.game ? {
          id: clip.game.id,
          name: clip.game.name,
          imageUrl: clip.game.image_url,
        } : null,
        _count: {
          likes: likesCount || 0,
          comments: commentsCount || 0,
        }
      };
    }));

    console.log('[Search REST] Found', formattedClips.length, 'clips');
    return c.json(formattedClips);
  } catch (error) {
    console.error('[Search REST] Unexpected error:', error);
    return c.json([]);
  }
});

// REST API: Search - Reels
app.get("/api/search/reels", async (c) => {
  const query = c.req.query('q');
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  if (!query) {
    return c.json([]);
  }

  console.log('[Search REST] Searching reels for:', query);

  try {
    const { data: reels, error } = await supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .eq('video_type', 'reel')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('views', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Search REST] Error searching reels:', error);
      return c.json([]);
    }

    const formattedReels = await Promise.all((reels || []).map(async (reel: any) => {
      const { count: likesCount } = await supabaseAdmin
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', reel.id);

      const { count: commentsCount } = await supabaseAdmin
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', reel.id);

      return {
        id: reel.id,
        userId: reel.user_id,
        title: reel.title,
        videoUrl: reel.video_url,
        thumbnailUrl: reel.thumbnail_url,
        videoType: reel.video_type,
        duration: reel.duration || 0,
        views: reel.views || 0,
        createdAt: reel.created_at,
        user: {
          id: reel.user.id,
          username: reel.user.username,
          displayName: reel.user.display_name,
          avatarUrl: reel.user.avatar_url,
        },
        _count: {
          likes: likesCount || 0,
          comments: commentsCount || 0,
        }
      };
    }));

    console.log('[Search REST] Found', formattedReels.length, 'reels');
    return c.json(formattedReels);
  } catch (error) {
    console.error('[Search REST] Unexpected error:', error);
    return c.json([]);
  }
});

// REST API: Search - Screenshots
app.get("/api/search/screenshots", async (c) => {
  const query = c.req.query('q');
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  if (!query) {
    return c.json([]);
  }

  console.log('[Search REST] Searching screenshots for:', query);

  try {
    const { data: screenshots, error } = await supabaseAdmin
      .from('screenshots')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Search REST] Error searching screenshots:', error);
      return c.json([]);
    }

    const formattedScreenshots = (screenshots || []).map((ss: any) => ({
      id: ss.id,
      userId: ss.user_id,
      title: ss.title,
      imageUrl: ss.image_url,
      createdAt: ss.created_at,
      user: {
        id: ss.user.id,
        username: ss.user.username,
        displayName: ss.user.display_name,
        avatarUrl: ss.user.avatar_url,
      },
      game: ss.game ? {
        id: ss.game.id,
        name: ss.game.name,
      } : null,
    }));

    console.log('[Search REST] Found', formattedScreenshots.length, 'screenshots');
    return c.json(formattedScreenshots);
  } catch (error) {
    console.error('[Search REST] Unexpected error:', error);
    return c.json([]);
  }
});

// REST API: Trending - Clips by Likes
app.get("/api/trending/clips/likes", async (c) => {
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  console.log('[Trending REST] Fetching clips by likes');

  try {
    const { data: likeCounts, error: likeError } = await supabaseAdmin
      .from('likes')
      .select('clip_id')
      .not('clip_id', 'is', null);

    if (likeError) {
      console.error('[Trending REST] Error fetching likes:', likeError);
      return c.json([]);
    }

    const clipLikeCounts = new Map<number, number>();
    (likeCounts || []).forEach((like: any) => {
      const count = clipLikeCounts.get(like.clip_id) || 0;
      clipLikeCounts.set(like.clip_id, count + 1);
    });

    const topClipIds = Array.from(clipLikeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    if (topClipIds.length === 0) {
      return c.json([]);
    }

    const { data: clips, error } = await supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .in('id', topClipIds)
      .eq('video_type', 'clip');

    if (error) {
      console.error('[Trending REST] Error fetching clips:', error);
      return c.json([]);
    }

    const formattedClips = await Promise.all((clips || []).map(async (clip: any) => {
      const { count: commentsCount } = await supabaseAdmin
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      return {
        id: clip.id,
        userId: clip.user_id,
        title: clip.title,
        videoUrl: clip.video_url,
        thumbnailUrl: clip.thumbnail_url,
        duration: clip.duration || 0,
        views: clip.views || 0,
        createdAt: clip.created_at,
        user: {
          id: clip.user.id,
          username: clip.user.username,
          displayName: clip.user.display_name,
          avatarUrl: clip.user.avatar_url,
        },
        game: clip.game ? {
          id: clip.game.id,
          name: clip.game.name,
        } : null,
        _count: {
          likes: clipLikeCounts.get(clip.id) || 0,
          comments: commentsCount || 0,
        }
      };
    }));

    formattedClips.sort((a, b) => b._count.likes - a._count.likes);

    console.log('[Trending REST] Found', formattedClips.length, 'clips by likes');
    return c.json(formattedClips);
  } catch (error) {
    console.error('[Trending REST] Unexpected error:', error);
    return c.json([]);
  }
});

// REST API: Trending - Clips by Comments
app.get("/api/trending/clips/comments", async (c) => {
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  console.log('[Trending REST] Fetching clips by comments');

  try {
    const { data: commentCounts, error: commentError } = await supabaseAdmin
      .from('comments')
      .select('clip_id')
      .not('clip_id', 'is', null);

    if (commentError) {
      console.error('[Trending REST] Error fetching comments:', commentError);
      return c.json([]);
    }

    const clipCommentCounts = new Map<number, number>();
    (commentCounts || []).forEach((comment: any) => {
      const count = clipCommentCounts.get(comment.clip_id) || 0;
      clipCommentCounts.set(comment.clip_id, count + 1);
    });

    const topClipIds = Array.from(clipCommentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    if (topClipIds.length === 0) {
      return c.json([]);
    }

    const { data: clips, error } = await supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .in('id', topClipIds)
      .eq('video_type', 'clip');

    if (error) {
      console.error('[Trending REST] Error fetching clips:', error);
      return c.json([]);
    }

    const formattedClips = await Promise.all((clips || []).map(async (clip: any) => {
      const { count: likesCount } = await supabaseAdmin
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      return {
        id: clip.id,
        userId: clip.user_id,
        title: clip.title,
        videoUrl: clip.video_url,
        thumbnailUrl: clip.thumbnail_url,
        duration: clip.duration || 0,
        views: clip.views || 0,
        createdAt: clip.created_at,
        user: {
          id: clip.user.id,
          username: clip.user.username,
          displayName: clip.user.display_name,
          avatarUrl: clip.user.avatar_url,
        },
        game: clip.game ? {
          id: clip.game.id,
          name: clip.game.name,
        } : null,
        _count: {
          likes: likesCount || 0,
          comments: clipCommentCounts.get(clip.id) || 0,
        }
      };
    }));

    formattedClips.sort((a, b) => b._count.comments - a._count.comments);

    console.log('[Trending REST] Found', formattedClips.length, 'clips by comments');
    return c.json(formattedClips);
  } catch (error) {
    console.error('[Trending REST] Unexpected error:', error);
    return c.json([]);
  }
});

// REST API: Trending - Reels by Likes
app.get("/api/trending/reels/likes", async (c) => {
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  console.log('[Trending REST] Fetching reels by likes');

  try {
    const { data: likeCounts, error: likeError } = await supabaseAdmin
      .from('likes')
      .select('clip_id')
      .not('clip_id', 'is', null);

    if (likeError) {
      return c.json([]);
    }

    const reelLikeCounts = new Map<number, number>();
    (likeCounts || []).forEach((like: any) => {
      const count = reelLikeCounts.get(like.clip_id) || 0;
      reelLikeCounts.set(like.clip_id, count + 1);
    });

    const topReelIds = Array.from(reelLikeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    if (topReelIds.length === 0) {
      return c.json([]);
    }

    const { data: reels, error } = await supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .in('id', topReelIds)
      .eq('video_type', 'reel');

    if (error) {
      return c.json([]);
    }

    const formattedReels = (reels || []).map((reel: any) => ({
      id: reel.id,
      userId: reel.user_id,
      title: reel.title,
      videoUrl: reel.video_url,
      thumbnailUrl: reel.thumbnail_url,
      duration: reel.duration || 0,
      views: reel.views || 0,
      createdAt: reel.created_at,
      user: {
        id: reel.user.id,
        username: reel.user.username,
        displayName: reel.user.display_name,
        avatarUrl: reel.user.avatar_url,
      },
      _count: {
        likes: reelLikeCounts.get(reel.id) || 0,
      }
    }));

    formattedReels.sort((a, b) => b._count.likes - a._count.likes);

    return c.json(formattedReels);
  } catch (error) {
    console.error('[Trending REST] Unexpected error:', error);
    return c.json([]);
  }
});

// REST API: Games - Get All Games
app.get("/api/games", async (c) => {
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  console.log('[Games REST] Fetching all games');

  try {
    const { data: games, error } = await supabaseAdmin
      .from('games')
      .select('*')
      .order('name', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[Games REST] Error fetching games:', error);
      return c.json([]);
    }

    const formattedGames = (games || []).map((game: any) => ({
      id: game.id,
      name: game.name,
      imageUrl: game.image_url,
      twitchId: game.twitch_id,
    }));

    console.log('[Games REST] Found', formattedGames.length, 'games');
    return c.json(formattedGames);
  } catch (error) {
    console.error('[Games REST] Unexpected error:', error);
    return c.json([]);
  }
});

// REST API: Games - Get Trending Games
app.get("/api/games/trending", async (c) => {
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  console.log('[Games REST] Fetching trending games');

  try {
    const { data: clips, error } = await supabaseAdmin
      .from('clips')
      .select('game_id')
      .not('game_id', 'is', null)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      console.error('[Games REST] Error fetching clips:', error);
      return c.json([]);
    }

    const gameCounts = new Map<number, number>();
    (clips || []).forEach((clip: any) => {
      const count = gameCounts.get(clip.game_id) || 0;
      gameCounts.set(clip.game_id, count + 1);
    });

    const topGameIds = Array.from(gameCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    if (topGameIds.length === 0) {
      return c.json([]);
    }

    const { data: games, error: gamesError } = await supabaseAdmin
      .from('games')
      .select('*')
      .in('id', topGameIds);

    if (gamesError) {
      return c.json([]);
    }

    const formattedGames = (games || []).map((game: any) => ({
      id: game.id,
      name: game.name,
      imageUrl: game.image_url,
      twitchId: game.twitch_id,
      clipCount: gameCounts.get(game.id) || 0,
    }));

    formattedGames.sort((a, b) => b.clipCount - a.clipCount);

    return c.json(formattedGames);
  } catch (error) {
    console.error('[Games REST] Unexpected error:', error);
    return c.json([]);
  }
});

// REST API: Games - Get Game by ID
app.get("/api/games/:id", async (c) => {
  const gameId = c.req.param('id');

  console.log('[Games REST] Fetching game:', gameId);

  try {
    const { data: game, error } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (error || !game) {
      return c.json({ message: 'Game not found' }, 404);
    }

    return c.json({
      id: game.id,
      name: game.name,
      imageUrl: game.image_url,
      twitchId: game.twitch_id,
    });
  } catch (error) {
    console.error('[Games REST] Unexpected error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// REST API: Games - Get Clips by Game
app.get("/api/games/:id/clips", async (c) => {
  const gameId = c.req.param('id');
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  console.log('[Games REST] Fetching clips for game:', gameId);

  try {
    const { data: clips, error } = await supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .eq('game_id', gameId)
      .eq('video_type', 'clip')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Games REST] Error fetching clips:', error);
      return c.json([]);
    }

    const formattedClips = await Promise.all((clips || []).map(async (clip: any) => {
      const { count: likesCount } = await supabaseAdmin
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      const { count: commentsCount } = await supabaseAdmin
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      return {
        id: clip.id,
        userId: clip.user_id,
        title: clip.title,
        videoUrl: clip.video_url,
        thumbnailUrl: clip.thumbnail_url,
        duration: clip.duration || 0,
        views: clip.views || 0,
        createdAt: clip.created_at,
        user: {
          id: clip.user.id,
          username: clip.user.username,
          displayName: clip.user.display_name,
          avatarUrl: clip.user.avatar_url,
        },
        _count: {
          likes: likesCount || 0,
          comments: commentsCount || 0,
        }
      };
    }));

    return c.json(formattedClips);
  } catch (error) {
    console.error('[Games REST] Unexpected error:', error);
    return c.json([]);
  }
});

// REST API: Games - Get Screenshots by Game
app.get("/api/games/:gameId/screenshots", async (c) => {
  const gameId = c.req.param('gameId');
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  console.log('[Games REST] Fetching screenshots for game:', gameId);

  try {
    const { data: screenshots, error } = await supabaseAdmin
      .from('screenshots')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .eq('game_id', gameId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Games REST] Error fetching screenshots:', error);
      return c.json([]);
    }

    const formattedScreenshots = (screenshots || []).map((ss: any) => ({
      id: ss.id,
      userId: ss.user_id,
      title: ss.title,
      imageUrl: ss.image_url,
      createdAt: ss.created_at,
      user: {
        id: ss.user.id,
        username: ss.user.username,
        displayName: ss.user.display_name,
        avatarUrl: ss.user.avatar_url,
      },
    }));

    return c.json(formattedScreenshots);
  } catch (error) {
    console.error('[Games REST] Unexpected error:', error);
    return c.json([]);
  }
});

// REST API: Clips - Get Clips by Hashtag
app.get("/api/clips/hashtag/:hashtag", async (c) => {
  const hashtag = c.req.param('hashtag');
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  console.log('[Clips REST] Fetching clips with hashtag:', hashtag);

  try {
    const { data: clips, error } = await supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .contains('tags', [hashtag])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Clips REST] Error fetching clips:', error);
      return c.json([]);
    }

    const formattedClips = await Promise.all((clips || []).map(async (clip: any) => {
      const { count: likesCount } = await supabaseAdmin
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      const { count: commentsCount } = await supabaseAdmin
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      return {
        id: clip.id,
        userId: clip.user_id,
        title: clip.title,
        videoUrl: clip.video_url,
        thumbnailUrl: clip.thumbnail_url,
        duration: clip.duration || 0,
        views: clip.views || 0,
        tags: clip.tags,
        createdAt: clip.created_at,
        user: {
          id: clip.user.id,
          username: clip.user.username,
          displayName: clip.user.display_name,
          avatarUrl: clip.user.avatar_url,
        },
        game: clip.game ? {
          id: clip.game.id,
          name: clip.game.name,
        } : null,
        _count: {
          likes: likesCount || 0,
          comments: commentsCount || 0,
        }
      };
    }));

    return c.json(formattedClips);
  } catch (error) {
    console.error('[Clips REST] Unexpected error:', error);
    return c.json([]);
  }
});

// REST API: Clips - Get Clip by ID
app.get("/api/clips/:id", async (c) => {
  const clipId = c.req.param('id');

  console.log('[Clips REST] Fetching clip:', clipId);

  try {
    const { data: clip, error } = await supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .eq('id', clipId)
      .single();

    if (error || !clip) {
      return c.json({ message: 'Clip not found' }, 404);
    }

    const { count: likesCount } = await supabaseAdmin
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('clip_id', clip.id);

    const { count: commentsCount } = await supabaseAdmin
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('clip_id', clip.id);

    return c.json({
      id: clip.id,
      userId: clip.user_id,
      title: clip.title,
      description: clip.description,
      videoUrl: clip.video_url,
      thumbnailUrl: clip.thumbnail_url,
      duration: clip.duration || 0,
      views: clip.views || 0,
      tags: clip.tags,
      videoType: clip.video_type,
      createdAt: clip.created_at,
      user: {
        id: clip.user.id,
        username: clip.user.username,
        displayName: clip.user.display_name,
        avatarUrl: clip.user.avatar_url,
      },
      game: clip.game ? {
        id: clip.game.id,
        name: clip.game.name,
        imageUrl: clip.game.image_url,
      } : null,
      _count: {
        likes: likesCount || 0,
        comments: commentsCount || 0,
      }
    });
  } catch (error) {
    console.error('[Clips REST] Unexpected error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// REST API: Clips - Get Likes Count
app.get("/api/clips/:id/likes", async (c) => {
  const clipId = c.req.param('id');

  try {
    const { count, error } = await supabaseAdmin
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('clip_id', clipId);

    if (error) {
      return c.json({ count: 0 });
    }

    return c.json({ count: count || 0 });
  } catch {
    return c.json({ count: 0 });
  }
});

// REST API: Clips - Get Reactions
app.get("/api/clips/:id/reactions", async (c) => {
  const clipId = c.req.param('id');

  console.log('[Reactions REST] Getting reactions for clip:', clipId);

  try {
    const { data: reactions, error } = await supabaseAdmin
      .from('reactions')
      .select('id, clip_id, user_id, emoji, position_x, position_y, created_at')
      .eq('clip_id', clipId);

    if (error) {
      console.error('[Reactions REST] Error fetching reactions:', error);
      return c.json([]);
    }

    const formattedReactions = (reactions || []).map((r: any) => ({
      id: r.id,
      clipId: r.clip_id,
      userId: r.user_id,
      emoji: r.emoji,
      positionX: r.position_x || 50,
      positionY: r.position_y || 50,
      createdAt: r.created_at,
    }));

    console.log('[Reactions REST] Found', formattedReactions.length, 'reactions');
    return c.json(formattedReactions);
  } catch (error) {
    console.error('[Reactions REST] Unexpected error:', error);
    return c.json([]);
  }
});

// REST API: Clips - Add Reaction (Fire)
app.post("/api/clips/:id/reactions", async (c) => {
  const clipId = c.req.param('id');
  const authHeader = c.req.header("Authorization");
  
  if (!authHeader) {
    return c.json({ message: "Not authenticated" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let userId: number;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
    userId = typeof decoded.userId === 'number' ? decoded.userId : parseInt(String(decoded.userId));
    
    if (isNaN(userId)) {
      return c.json({ message: 'Invalid token payload' }, 401);
    }
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  try {
    const body = await c.req.json();
    const { emoji = '🔥', positionX = 50, positionY = 50 } = body;

    console.log('[Reactions REST] Adding reaction to clip:', clipId, 'emoji:', emoji, 'user:', userId);

    // Get the clip to find the owner
    const { data: clip, error: clipError } = await supabaseAdmin
      .from('clips')
      .select('user_id')
      .eq('id', parseInt(clipId, 10))
      .single();

    if (clipError || !clip) {
      console.error('[Reactions REST] Clip not found:', clipId);
      return c.json({ message: 'Clip not found' }, 404);
    }

    // Prevent users from firing their own content
    if (clip.user_id === userId) {
      console.log('[Reactions REST] User tried to fire their own content');
      return c.json({ message: 'Cannot react to your own content, casual!' }, 400);
    }

    // Check if user already has this reaction (fire reactions are permanent)
    const { data: existing } = await supabaseAdmin
      .from('reactions')
      .select('id')
      .eq('clip_id', parseInt(clipId, 10))
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .maybeSingle();

    if (existing) {
      console.log('[Reactions REST] User already has this reaction (permanent)');
      // Get current count for response
      const { count } = await supabaseAdmin
        .from('reactions')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', parseInt(clipId, 10))
        .eq('emoji', emoji);
      
      return c.json({ 
        id: existing.id,
        reacted: true, 
        count: count || 0,
        message: 'Already fired this clip'
      });
    }

    const { data: reaction, error } = await supabaseAdmin
      .from('reactions')
      .insert({
        clip_id: parseInt(clipId, 10),
        user_id: userId,
        emoji,
        position_x: positionX,
        position_y: positionY,
      })
      .select()
      .single();

    if (error) {
      console.error('[Reactions REST] Error adding reaction:', error);
      return c.json({ message: 'Failed to add reaction' }, 500);
    }

    console.log('[Reactions REST] Reaction added:', reaction.id);

    // Award 5 points to the giver (current user)
    const giverXPResult = await awardXP(userId, 5);
    if (giverXPResult.success) {
      console.log('[Reactions REST] Awarded 5 XP to giver (user:', userId, ')');
    }

    // Award 5 points to the content creator (clip owner)
    const creatorXPResult = await awardXP(clip.user_id, 5);
    if (creatorXPResult.success) {
      console.log('[Reactions REST] Awarded 5 XP to creator (user:', clip.user_id, ')');
    }

    // Get updated fire count
    const { count } = await supabaseAdmin
      .from('reactions')
      .select('*', { count: 'exact', head: true })
      .eq('clip_id', parseInt(clipId, 10))
      .eq('emoji', emoji);

    return c.json({
      id: reaction.id,
      clipId: reaction.clip_id,
      userId: reaction.user_id,
      emoji: reaction.emoji,
      reacted: true,
      count: count || 1,
      giverXPAwarded: giverXPResult.success ? 5 : 0,
      creatorXPAwarded: creatorXPResult.success ? 5 : 0,
    });
  } catch (error) {
    console.error('[Reactions REST] Unexpected error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// REST API: Delete Reaction
app.delete("/api/reactions/:id", async (c) => {
  const reactionId = c.req.param('id');
  const authHeader = c.req.header("Authorization");
  
  if (!authHeader) {
    return c.json({ message: "Not authenticated" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let userId: number;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
    userId = typeof decoded.userId === 'number' ? decoded.userId : parseInt(String(decoded.userId));
    
    if (isNaN(userId)) {
      return c.json({ message: 'Invalid token payload' }, 401);
    }
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  console.log('[Reactions REST] Deleting reaction:', reactionId, 'user:', userId);

  try {
    // Verify ownership
    const { data: reaction, error: fetchError } = await supabaseAdmin
      .from('reactions')
      .select('id, user_id')
      .eq('id', parseInt(reactionId, 10))
      .single();

    if (fetchError || !reaction) {
      console.error('[Reactions REST] Reaction not found:', reactionId);
      return c.json({ message: 'Reaction not found' }, 404);
    }

    if (reaction.user_id !== userId) {
      console.error('[Reactions REST] Unauthorized delete attempt');
      return c.json({ message: 'You can only delete your own reactions' }, 403);
    }

    const { error: deleteError } = await supabaseAdmin
      .from('reactions')
      .delete()
      .eq('id', parseInt(reactionId, 10));

    if (deleteError) {
      console.error('[Reactions REST] Error deleting reaction:', deleteError);
      return c.json({ message: 'Failed to delete reaction' }, 500);
    }

    console.log('[Reactions REST] Reaction deleted successfully');
    return c.json({ message: 'Reaction deleted successfully' });
  } catch (error) {
    console.error('[Reactions REST] Unexpected error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// REST API: Clips - Get Comments
app.get("/api/clips/:id/comments", async (c) => {
  const clipId = c.req.param('id');
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  try {
    const { data: comments, error } = await supabaseAdmin
      .from('comments')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url)
      `)
      .eq('clip_id', clipId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return c.json([]);
    }

    const formattedComments = (comments || []).map((comment: any) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.created_at,
      user: {
        id: comment.user.id,
        username: comment.user.username,
        displayName: comment.user.display_name,
        avatarUrl: comment.user.avatar_url,
      },
    }));

    return c.json(formattedComments);
  } catch {
    return c.json([]);
  }
});

// REST API: Clips - Add Comment
app.post("/api/clips/:id/comments", async (c) => {
  const clipId = c.req.param('id');
  const authHeader = c.req.header("Authorization");
  
  if (!authHeader) {
    return c.json({ message: "Not authenticated" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let userId: number;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    userId = decoded.userId;
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  try {
    const body = await c.req.json();
    const { content } = body;

    if (!content || content.trim().length === 0) {
      return c.json({ message: "Comment content is required" }, 400);
    }

    console.log('[Comments REST] Adding comment to clip:', clipId, 'by user:', userId);

    const { data: comment, error } = await supabaseAdmin
      .from('comments')
      .insert({
        clip_id: parseInt(clipId, 10),
        user_id: userId,
        content: content.trim(),
      })
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url)
      `)
      .single();

    if (error) {
      console.error('[Comments REST] Error adding comment:', error);
      return c.json({ message: "Failed to add comment" }, 500);
    }

    console.log('[Comments REST] Comment added successfully:', comment.id);

    return c.json({
      id: comment.id,
      content: comment.content,
      createdAt: comment.created_at,
      user: {
        id: comment.user.id,
        username: comment.user.username,
        displayName: comment.user.display_name,
        avatarUrl: comment.user.avatar_url,
      },
    });
  } catch (error) {
    console.error('[Comments REST] Unexpected error:', error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// REST API: Users - Get Featured Users
app.get("/api/users/featured", async (c) => {
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  console.log('[Users REST] Fetching featured users');

  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, avatar_url, level, total_xp, user_type, current_streak')
      .order('total_xp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Users REST] Error fetching featured users:', error);
      return c.json([]);
    }

    const formattedUsers = (users || []).map((u: any) => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name || u.username,
      avatarUrl: u.avatar_url,
      level: u.level ?? 1,
      totalXP: u.total_xp ?? 0,
      currentStreak: u.current_streak ?? 0,
      userType: u.user_type,
    }));

    console.log('[Users REST] Found', formattedUsers.length, 'featured users');
    return c.json(formattedUsers);
  } catch (error) {
    console.error('[Users REST] Unexpected error:', error);
    return c.json([]);
  }
});

// REST API: Users - Get User by Username
app.get("/api/users/:username", async (c) => {
  const username = c.req.param('username');

  console.log('[Users REST] Fetching user:', username);

  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) {
      return c.json({ message: 'User not found' }, 404);
    }

    return c.json({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      bannerUrl: user.banner_url,
      bio: user.bio,
      level: user.level ?? 1,
      totalXP: user.total_xp ?? 0,
      currentStreak: user.current_streak ?? 0,
      longestStreak: user.longest_streak ?? 0,
      userType: user.user_type,
    });
  } catch (error) {
    console.error('[Users REST] Unexpected error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// REST API: Users - Get User Clips by Username
app.get("/api/users/:username/clips", async (c) => {
  const username = c.req.param('username');
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  console.log('[Users REST] Fetching clips for user:', username);

  try {
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (userError || !user) {
      return c.json({ message: 'User not found' }, 404);
    }

    const { data: clips, error } = await supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Users REST] Error fetching clips:', error);
      return c.json([]);
    }

    const formattedClips = await Promise.all((clips || []).map(async (clip: any) => {
      const { count: likesCount } = await supabaseAdmin
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      const { count: commentsCount } = await supabaseAdmin
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      return {
        id: clip.id,
        title: clip.title,
        videoUrl: clip.video_url,
        thumbnailUrl: clip.thumbnail_url,
        duration: clip.duration || 0,
        views: clip.views || 0,
        videoType: clip.video_type,
        createdAt: clip.created_at,
        _count: {
          likes: likesCount || 0,
          comments: commentsCount || 0,
        }
      };
    }));

    return c.json(formattedClips);
  } catch (error) {
    console.error('[Users REST] Unexpected error:', error);
    return c.json([]);
  }
});

// REST API: Tags - Get Trending Tags
app.get("/api/tags/trending", async (c) => {
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  console.log('[Tags REST] Fetching trending tags');

  try {
    const { data: clips, error } = await supabaseAdmin
      .from('clips')
      .select('tags')
      .not('tags', 'is', null)
      .limit(1000);

    if (error) {
      console.error('[Tags REST] Error fetching clips with tags:', error);
      return c.json([]);
    }

    const tagCounts = new Map<string, number>();
    
    clips?.forEach((clip: any) => {
      if (Array.isArray(clip.tags)) {
        clip.tags.forEach((tag: string) => {
          if (tag && typeof tag === 'string') {
            const cleanTag = tag.toLowerCase().trim();
            tagCounts.set(cleanTag, (tagCounts.get(cleanTag) || 0) + 1);
          }
        });
      }
    });

    const sortedTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag]) => tag);

    console.log('[Tags REST] Found', sortedTags.length, 'trending tags');
    return c.json(sortedTags);
  } catch (error) {
    console.error('[Tags REST] Unexpected error:', error);
    return c.json([]);
  }
});

// REST API: Users - Get Trending Users
app.get("/api/users/trending", async (c) => {
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  console.log('[Users REST] Fetching trending users, limit:', limit);

  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        username,
        display_name,
        avatar_url,
        banner_url,
        total_xp,
        level,
        current_streak,
        accent_color
      `)
      .order('total_xp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Users REST] Error fetching trending users:', error);
      return c.json({ users: [] }, 500);
    }

    console.log('[Users REST] Found trending users:', users?.length);

    const formattedUsers = (users || []).map(user => ({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      bannerUrl: user.banner_url,
      totalXP: user.total_xp || 0,
      level: user.level || 1,
      currentStreak: user.current_streak || 0,
      accentColor: user.accent_color,
    }));

    return c.json({ users: formattedUsers });
  } catch (error) {
    console.error('[Users REST] Unexpected error:', error);
    return c.json({ users: [] }, 500);
  }
});

// REST API: Users - Get Blocked Users
app.get("/api/users/blocked", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ message: "No authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let currentUserId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
    currentUserId = typeof decoded.userId === 'number' ? decoded.userId : parseInt(String(decoded.userId));
    
    if (isNaN(currentUserId)) {
      return c.json({ message: 'Invalid token payload' }, 401);
    }
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  console.log('[Users REST] Getting blocked users for:', currentUserId);

  try {
    const { data: blocks, error } = await supabaseAdmin
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', currentUserId);

    if (error) {
      console.error('[Users REST] Error fetching blocked users:', error);
      return c.json({ blockedUsers: [] });
    }

    if (!blocks || blocks.length === 0) {
      return c.json({ blockedUsers: [] });
    }

    const blockedIds = blocks.map(b => b.blocked_id);

    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, avatar_url')
      .in('id', blockedIds);

    if (usersError) {
      console.error('[Users REST] Error fetching user details:', usersError);
      return c.json({ blockedUsers: [] });
    }

    const blockedUsers = (users || []).map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name || u.username,
      avatarUrl: u.avatar_url,
    }));

    console.log('[Users REST] Returning', blockedUsers.length, 'blocked users');
    return c.json({ blockedUsers });
  } catch (error) {
    console.error('[Users REST] Unexpected error:', error);
    return c.json({ blockedUsers: [] });
  }
});

// OAuth: Discord
app.get("/api/oauth/discord", async (c) => {
  const redirectUri = c.req.query("redirect_uri") || "";
  const state = Buffer.from(JSON.stringify({ redirectUri })).toString("base64");
  
  const discordAuthUrl = new URL("https://discord.com/api/oauth2/authorize");
  discordAuthUrl.searchParams.set("client_id", Env.DISCORD_CLIENT_ID);
  discordAuthUrl.searchParams.set("redirect_uri", `${getBaseUrl(c)}/api/oauth/discord/callback`);
  discordAuthUrl.searchParams.set("response_type", "code");
  discordAuthUrl.searchParams.set("scope", "identify email");
  discordAuthUrl.searchParams.set("state", state);
  
  console.log("[OAuth/Discord] Redirecting to Discord auth");
  return c.redirect(discordAuthUrl.toString());
});

app.get("/api/oauth/discord/callback", async (c) => {
  const code = c.req.query("code");
  const stateParam = c.req.query("state");
  
  if (!code) {
    console.error("[OAuth/Discord] No code received");
    return c.text("Authorization failed: No code received", 400);
  }
  
  let redirectUri = "";
  if (stateParam) {
    try {
      const stateData = JSON.parse(Buffer.from(stateParam, "base64").toString());
      redirectUri = stateData.redirectUri || "";
    } catch (e) {
      console.error("[OAuth/Discord] Failed to parse state", e);
    }
  }
  
  try {
    console.log("[OAuth/Discord] Exchanging code for token...");
    
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: Env.DISCORD_CLIENT_ID,
        client_secret: Env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${getBaseUrl(c)}/api/oauth/discord/callback`,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[OAuth/Discord] Token exchange failed:", errorText);
      return c.text("Authorization failed: Token exchange failed", 400);
    }
    
    const tokenData = await tokenResponse.json();
    
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });
    
    if (!userResponse.ok) {
      console.error("[OAuth/Discord] Failed to fetch user info");
      return c.text("Authorization failed: Failed to fetch user info", 400);
    }
    
    const discordUser = await userResponse.json() as {
      id: string;
      username: string;
      global_name?: string;
      email?: string;
      avatar?: string;
    };
    
    console.log("[OAuth/Discord] Got user:", discordUser.username);
    
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("discord_id", discordUser.id)
      .maybeSingle();
    
    let user;
    
    if (existingUser) {
      console.log("[OAuth/Discord] Found existing user:", existingUser.username);
      user = existingUser;
    } else {
      console.log("[OAuth/Discord] Creating new user for:", discordUser.username);
      
      let username = discordUser.username.replace(/[^a-zA-Z0-9_]/g, "");
      if (username.length < 3) username = `user_${discordUser.id.slice(-6)}`;
      
      const { data: existingUsername } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      
      if (existingUsername) {
        username = `${username}_${Date.now().toString(36)}`;
      }
      
      const avatarUrl = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null;
      
      const { data: newUser, error: createError } = await supabaseAdmin
        .from("users")
        .insert({
          username,
          display_name: discordUser.global_name || discordUser.username,
          email: discordUser.email || `discord_${discordUser.id}@placeholder.com`,
          discord_id: discordUser.id,
          avatar_url: avatarUrl,
          email_verified: !!discordUser.email,
          role: "user",
          messaging_enabled: true,
          is_private: false,
        })
        .select()
        .single();
      
      if (createError) {
        console.error("[OAuth/Discord] Failed to create user:", createError);
        return c.text("Authorization failed: Failed to create user", 500);
      }
      
      user = newUser;
    }
    
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: "30d" }
    );
    
    const userData = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      email: user.email,
      emailVerified: user.email_verified,
      role: user.role,
      totalXP: user.total_xp ?? 0,
      level: user.level ?? 1,
      currentStreak: user.current_streak ?? 0,
      longestStreak: user.longest_streak ?? 0,
      avatarUrl: user.avatar_url,
      bannerUrl: user.banner_url,
      bio: user.bio,
      messagingEnabled: user.messaging_enabled,
      isPrivate: user.is_private,
    };
    
    const callbackUrl = new URL(redirectUri || "/");
    callbackUrl.searchParams.set("token", accessToken);
    callbackUrl.searchParams.set("refresh_token", refreshToken);
    callbackUrl.searchParams.set("user", encodeURIComponent(JSON.stringify(userData)));
    
    console.log("[OAuth/Discord] Redirecting to:", callbackUrl.toString());
    return c.redirect(callbackUrl.toString());
  } catch (error) {
    console.error("[OAuth/Discord] Error:", error);
    return c.text("Authorization failed: Internal error", 500);
  }
});

// OAuth: Discord Mobile (POST endpoint for expo-auth-session)
app.post("/api/oauth/discord/callback", async (c) => {
  try {
    const body = await c.req.json();
    const { code, redirectUri } = body;
    
    if (!code) {
      console.error("[OAuth/Discord/Mobile] No code received");
      return c.json({ message: "Authorization code is required" }, 400);
    }
    
    if (!redirectUri) {
      console.error("[OAuth/Discord/Mobile] No redirect URI received");
      return c.json({ message: "Redirect URI is required" }, 400);
    }
    
    console.log("[OAuth/Discord/Mobile] Exchanging code for token...");
    console.log("[OAuth/Discord/Mobile] Redirect URI:", redirectUri);
    
    const discordClientId = Env.DISCORD_MOBILE_CLIENT_ID || Env.DISCORD_CLIENT_ID;
    const discordClientSecret = Env.DISCORD_MOBILE_CLIENT_SECRET || Env.DISCORD_CLIENT_SECRET;
    
    console.log("[OAuth/Discord/Mobile] Using client ID:", discordClientId);
    
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: discordClientId,
        client_secret: discordClientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[OAuth/Discord/Mobile] Token exchange failed:", errorText);
      return c.json({ message: "Token exchange failed", error: errorText }, 400);
    }
    
    const tokenData = await tokenResponse.json();
    
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });
    
    if (!userResponse.ok) {
      console.error("[OAuth/Discord/Mobile] Failed to fetch user info");
      return c.json({ message: "Failed to fetch user info from Discord" }, 400);
    }
    
    const discordUser = await userResponse.json() as {
      id: string;
      username: string;
      global_name?: string;
      email?: string;
      avatar?: string;
    };
    
    console.log("[OAuth/Discord/Mobile] Got user:", discordUser.username);
    
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("discord_id", discordUser.id)
      .maybeSingle();
    
    let user;
    let isNewUser = false;
    
    if (existingUser) {
      console.log("[OAuth/Discord/Mobile] Found existing user:", existingUser.username);
      user = existingUser;
    } else {
      console.log("[OAuth/Discord/Mobile] Creating new user for:", discordUser.username);
      isNewUser = true;
      
      // Generate temp username for social login users - they'll choose permanent one in onboarding
      const tempUsername = `temp_${discordUser.id.slice(0, 8)}_${Date.now().toString(36)}`;
      
      const avatarUrl = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null;
      
      const { data: newUser, error: createError } = await supabaseAdmin
        .from("users")
        .insert({
          username: tempUsername,
          display_name: discordUser.global_name || discordUser.username,
          email: discordUser.email || `discord_${discordUser.id}@placeholder.com`,
          discord_id: discordUser.id,
          avatar_url: avatarUrl,
          email_verified: true, // Discord accounts are pre-verified
          role: "user",
          messaging_enabled: true,
          is_private: false,
          auth_provider: "discord",
          user_type: null, // Force onboarding
          age_range: null, // Force onboarding
        })
        .select()
        .single();
      
      if (createError) {
        console.error("[OAuth/Discord/Mobile] Failed to create user:", createError);
        return c.json({ message: "Failed to create user" }, 500);
      }
      
      user = newUser;
    }
    
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: "30d" }
    );
    
    // Check if user needs onboarding
    const needsOnboarding = !user.user_type || !user.age_range || (user.username && user.username.startsWith('temp_'));
    
    console.log("[OAuth/Discord/Mobile] Login successful for:", user.username, "needsOnboarding:", needsOnboarding);
    
    return c.json({
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60,
      needsOnboarding,
      isNewUser,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        emailVerified: user.email_verified,
        role: user.role,
        totalXP: user.total_xp ?? 0,
        level: user.level ?? 1,
        currentStreak: user.current_streak ?? 0,
        longestStreak: user.longest_streak ?? 0,
        avatarUrl: user.avatar_url,
        bannerUrl: user.banner_url,
        bio: user.bio,
        messagingEnabled: user.messaging_enabled,
        isPrivate: user.is_private,
        userType: user.user_type,
        ageRange: user.age_range,
        gfTokenBalance: user.gf_token_balance,
        authProvider: user.auth_provider || 'discord',
      },
    });
  } catch (error) {
    console.error("[OAuth/Discord/Mobile] Error:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// OAuth: Google
app.get("/api/oauth/google", async (c) => {
  const redirectUri = c.req.query("redirect_uri") || "";
  const state = Buffer.from(JSON.stringify({ redirectUri })).toString("base64");
  
  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", Env.GOOGLE_CLIENT_ID || "");
  googleAuthUrl.searchParams.set("redirect_uri", `${getBaseUrl(c)}/api/oauth/google/callback`);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("state", state);
  googleAuthUrl.searchParams.set("access_type", "offline");
  googleAuthUrl.searchParams.set("prompt", "consent");
  
  console.log("[OAuth/Google] Redirecting to Google auth");
  return c.redirect(googleAuthUrl.toString());
});

app.get("/api/oauth/google/callback", async (c) => {
  const code = c.req.query("code");
  const stateParam = c.req.query("state");
  
  if (!code) {
    console.error("[OAuth/Google] No code received");
    return c.text("Authorization failed: No code received", 400);
  }
  
  let redirectUri = "";
  if (stateParam) {
    try {
      const stateData = JSON.parse(Buffer.from(stateParam, "base64").toString());
      redirectUri = stateData.redirectUri || "";
    } catch (e) {
      console.error("[OAuth/Google] Failed to parse state", e);
    }
  }
  
  try {
    console.log("[OAuth/Google] Exchanging code for token...");
    
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: Env.GOOGLE_CLIENT_ID || "",
        client_secret: Env.GOOGLE_CLIENT_SECRET || "",
        grant_type: "authorization_code",
        code,
        redirect_uri: `${getBaseUrl(c)}/api/oauth/google/callback`,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[OAuth/Google] Token exchange failed:", errorText);
      return c.text("Authorization failed: Token exchange failed", 400);
    }
    
    const tokenData = await tokenResponse.json();
    
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });
    
    if (!userResponse.ok) {
      console.error("[OAuth/Google] Failed to fetch user info");
      return c.text("Authorization failed: Failed to fetch user info", 400);
    }
    
    const googleUser = await userResponse.json() as {
      id: string;
      email: string;
      name?: string;
      given_name?: string;
      picture?: string;
    };
    
    console.log("[OAuth/Google] Got user:", googleUser.email);
    
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("google_id", googleUser.id)
      .maybeSingle();
    
    let user;
    let isNewUser = false;
    
    if (existingUser) {
      console.log("[OAuth/Google] Found existing user:", existingUser.username);
      user = existingUser;
    } else {
      const { data: existingEmail } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("email", googleUser.email)
        .maybeSingle();
      
      if (existingEmail) {
        console.log("[OAuth/Google] Found user by email, linking Google ID");
        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from("users")
          .update({ google_id: googleUser.id, auth_provider: existingEmail.auth_provider || 'google' })
          .eq("id", existingEmail.id)
          .select()
          .single();
        
        if (updateError) {
          console.error("[OAuth/Google] Failed to link Google ID:", updateError);
          return c.text("Authorization failed: Failed to link account", 500);
        }
        
        user = updatedUser;
      } else {
        console.log("[OAuth/Google] Creating new user for:", googleUser.email);
        isNewUser = true;
        
        // Generate temp username for social login users - they'll choose permanent one in onboarding
        const tempUsername = `temp_${googleUser.id.slice(0, 8)}_${Date.now().toString(36)}`;
        
        const { data: newUser, error: createError } = await supabaseAdmin
          .from("users")
          .insert({
            username: tempUsername,
            display_name: googleUser.name || googleUser.given_name || 'User',
            email: googleUser.email,
            google_id: googleUser.id,
            avatar_url: googleUser.picture || null,
            email_verified: true, // Google accounts are pre-verified
            role: "user",
            messaging_enabled: true,
            is_private: false,
            auth_provider: "google",
            user_type: null, // Force onboarding
            age_range: null, // Force onboarding
          })
          .select()
          .single();
        
        if (createError) {
          console.error("[OAuth/Google] Failed to create user:", createError);
          return c.text("Authorization failed: Failed to create user", 500);
        }
        
        user = newUser;
      }
    }
    
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: "30d" }
    );
    
    const needsOnboarding = !user.user_type || !user.age_range || (user.username && user.username.startsWith('temp_'));
    
    const userData = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      email: user.email,
      emailVerified: user.email_verified,
      role: user.role,
      totalXP: user.total_xp ?? 0,
      level: user.level ?? 1,
      currentStreak: user.current_streak ?? 0,
      longestStreak: user.longest_streak ?? 0,
      avatarUrl: user.avatar_url,
      bannerUrl: user.banner_url,
      bio: user.bio,
      messagingEnabled: user.messaging_enabled,
      isPrivate: user.is_private,
      userType: user.user_type,
      ageRange: user.age_range,
      authProvider: user.auth_provider || 'google',
    };
    
    const callbackUrl = new URL(redirectUri || "/");
    callbackUrl.searchParams.set("token", accessToken);
    callbackUrl.searchParams.set("refresh_token", refreshToken);
    callbackUrl.searchParams.set("user", encodeURIComponent(JSON.stringify(userData)));
    callbackUrl.searchParams.set("needs_onboarding", needsOnboarding.toString());
    callbackUrl.searchParams.set("is_new_user", isNewUser.toString());
    
    console.log("[OAuth/Google] Redirecting to:", callbackUrl.toString());
    return c.redirect(callbackUrl.toString());
  } catch (error) {
    console.error("[OAuth/Google] Error:", error);
    return c.text("Authorization failed: Internal error", 500);
  }
});

// OAuth: Google Mobile (POST endpoint for expo-auth-session)
app.post("/api/oauth/google/callback", async (c) => {
  try {
    const body = await c.req.json();
    const { idToken, accessToken: googleAccessToken } = body;
    
    if (!idToken && !googleAccessToken) {
      console.error("[OAuth/Google/Mobile] No token received");
      return c.json({ message: "ID token or access token is required" }, 400);
    }
    
    console.log("[OAuth/Google/Mobile] Processing Google auth...");
    
    let googleUser: {
      id: string;
      email: string;
      name?: string;
      given_name?: string;
      picture?: string;
    };
    
    if (idToken) {
      // Verify ID token with Google
      const tokenInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      
      if (!tokenInfoResponse.ok) {
        console.error("[OAuth/Google/Mobile] Invalid ID token");
        return c.json({ message: "Invalid ID token" }, 400);
      }
      
      const tokenInfo = await tokenInfoResponse.json() as {
        sub: string;
        email: string;
        name?: string;
        given_name?: string;
        picture?: string;
      };
      
      googleUser = {
        id: tokenInfo.sub,
        email: tokenInfo.email,
        name: tokenInfo.name,
        given_name: tokenInfo.given_name,
        picture: tokenInfo.picture,
      };
    } else {
      // Use access token to get user info
      const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
        },
      });
      
      if (!userResponse.ok) {
        console.error("[OAuth/Google/Mobile] Failed to fetch user info");
        return c.json({ message: "Failed to fetch user info from Google" }, 400);
      }
      
      googleUser = await userResponse.json();
    }
    
    console.log("[OAuth/Google/Mobile] Got user:", googleUser.email);
    
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("google_id", googleUser.id)
      .maybeSingle();
    
    let user;
    let isNewUser = false;
    
    if (existingUser) {
      console.log("[OAuth/Google/Mobile] Found existing user:", existingUser.username);
      user = existingUser;
    } else {
      const { data: existingEmail } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("email", googleUser.email)
        .maybeSingle();
      
      if (existingEmail) {
        console.log("[OAuth/Google/Mobile] Found user by email, linking Google ID");
        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from("users")
          .update({ google_id: googleUser.id, auth_provider: existingEmail.auth_provider || 'google' })
          .eq("id", existingEmail.id)
          .select()
          .single();
        
        if (updateError) {
          console.error("[OAuth/Google/Mobile] Failed to link Google ID:", updateError);
          return c.json({ message: "Failed to link account" }, 500);
        }
        
        user = updatedUser;
      } else {
        console.log("[OAuth/Google/Mobile] Creating new user for:", googleUser.email);
        isNewUser = true;
        
        const tempUsername = `temp_${googleUser.id.slice(0, 8)}_${Date.now().toString(36)}`;
        
        const { data: newUser, error: createError } = await supabaseAdmin
          .from("users")
          .insert({
            username: tempUsername,
            display_name: googleUser.name || googleUser.given_name || 'User',
            email: googleUser.email,
            google_id: googleUser.id,
            avatar_url: googleUser.picture || null,
            email_verified: true,
            role: "user",
            messaging_enabled: true,
            is_private: false,
            auth_provider: "google",
            user_type: null,
            age_range: null,
          })
          .select()
          .single();
        
        if (createError) {
          console.error("[OAuth/Google/Mobile] Failed to create user:", createError);
          return c.json({ message: "Failed to create user" }, 500);
        }
        
        user = newUser;
      }
    }
    
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: "30d" }
    );
    
    const needsOnboarding = !user.user_type || !user.age_range || (user.username && user.username.startsWith('temp_'));
    
    console.log("[OAuth/Google/Mobile] Login successful for:", user.username, "needsOnboarding:", needsOnboarding);
    
    return c.json({
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60,
      needsOnboarding,
      isNewUser,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        emailVerified: user.email_verified,
        role: user.role,
        totalXP: user.total_xp ?? 0,
        level: user.level ?? 1,
        currentStreak: user.current_streak ?? 0,
        longestStreak: user.longest_streak ?? 0,
        avatarUrl: user.avatar_url,
        bannerUrl: user.banner_url,
        bio: user.bio,
        messagingEnabled: user.messaging_enabled,
        isPrivate: user.is_private,
        userType: user.user_type,
        ageRange: user.age_range,
        gfTokenBalance: user.gf_token_balance,
        authProvider: user.auth_provider || 'google',
      },
    });
  } catch (error) {
    console.error("[OAuth/Google/Mobile] Error:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

function getBaseUrl(c: any): string {
  const host = c.req.header("host") || "";
  const protocol = c.req.header("x-forwarded-proto") || "https";
  return `${protocol}://${host}`;
}

// REST API: Claim Daily Lootbox
app.post("/api/user/claim-daily-lootbox", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ message: "No authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let userId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
    userId = typeof decoded.userId === 'number' ? decoded.userId : parseInt(String(decoded.userId));
    
    if (isNaN(userId)) {
      return c.json({ message: 'Invalid token payload' }, 401);
    }
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  console.log('[Lootbox REST] Claiming daily lootbox for user:', userId);

  try {
    const { data: currentUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('total_xp, last_lootbox_claim')
      .eq('id', userId)
      .single();

    if (fetchError || !currentUser) {
      console.error('[Lootbox REST] User fetch error:', fetchError);
      return c.json({ message: 'Failed to fetch user' }, 500);
    }

    const now = new Date();
    if (currentUser.last_lootbox_claim) {
      const lastClaim = new Date(currentUser.last_lootbox_claim);
      const timeDiff = now.getTime() - lastClaim.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        const nextClaimTime = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
        console.log('[Lootbox REST] Already claimed today. Next claim:', nextClaimTime);
        return c.json({ 
          message: 'Daily lootbox already claimed. Come back tomorrow!',
          nextClaimTime: nextClaimTime.toISOString()
        }, 400);
      }
    }

    // Generate rewards
    const rarityRoll = Math.random();
    let rarity: 'common' | 'rare' | 'epic' | 'legendary';
    
    if (rarityRoll < 0.6) {
      rarity = 'common';
    } else if (rarityRoll < 0.85) {
      rarity = 'rare';
    } else if (rarityRoll < 0.97) {
      rarity = 'epic';
    } else {
      rarity = 'legendary';
    }

    const xpMultiplier = { common: 1, rare: 1.5, epic: 2.5, legendary: 4 }[rarity];
    const coinsMultiplier = { common: 1, rare: 1.5, epic: 2.5, legendary: 4 }[rarity];

    const baseXP = Math.floor(Math.random() * 300) + 100;
    const baseCoins = Math.floor(Math.random() * 100) + 50;
    
    const xpAmount = Math.floor(baseXP * xpMultiplier);
    const coinsAmount = Math.floor(baseCoins * coinsMultiplier);

    const rewards = [
      { type: 'xp', amount: xpAmount, name: 'XP', rarity },
      { type: 'coins', amount: coinsAmount, name: 'Coins', rarity },
    ];

    if (rarity === 'epic' || rarity === 'legendary') {
      rewards.push({
        type: 'item',
        amount: 1,
        name: rarity === 'legendary' ? 'Legendary Badge' : 'Epic Boost',
        rarity,
      });
    }

    // Calculate new level
    const newTotalXP = (currentUser.total_xp || 0) + xpAmount;
    let level = 1;
    let xpNeeded = 0;
    while (xpNeeded <= newTotalXP) {
      xpNeeded += 1000 * level;
      if (xpNeeded <= newTotalXP) {
        level++;
      }
    }

    console.log('[Lootbox REST] Generated rewards:', { xpAmount, coinsAmount, rarity });

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        total_xp: newTotalXP,
        level: level,
        last_lootbox_claim: now.toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('[Lootbox REST] Update error:', updateError);
      return c.json({ message: 'Failed to claim lootbox' }, 500);
    }

    console.log('[Lootbox REST] Lootbox claimed successfully');
    return c.json({ 
      success: true,
      rewards,
      newXP: newTotalXP,
      newLevel: level,
      nextClaimTime: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error('[Lootbox REST] Unexpected error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// REST API: Get All Rewards
app.get("/api/rewards", async (c) => {
  const rarityParam = c.req.query('rarity');
  const typeParam = c.req.query('type');
  const activeParam = c.req.query('active');

  console.log('[Rewards REST] Fetching rewards');

  try {
    let query = supabaseAdmin
      .from('lootbox_rewards')
      .select('*')
      .order('rarity', { ascending: true })
      .order('name', { ascending: true });

    if (rarityParam) {
      query = query.eq('rarity', rarityParam);
    }

    if (typeParam) {
      query = query.eq('type', typeParam);
    }

    if (activeParam !== undefined) {
      query = query.eq('is_active', activeParam === 'true');
    }

    const { data: rewards, error } = await query;

    if (error) {
      console.error('[Rewards REST] Error fetching rewards:', error);
      return c.json({ rewards: [] });
    }

    const formattedRewards = (rewards || []).map((reward: any) => ({
      id: reward.id,
      name: reward.name,
      description: reward.description,
      type: reward.type,
      rarity: reward.rarity,
      imageUrl: reward.image_url,
      value: reward.value,
      isActive: reward.is_active,
      createdAt: reward.created_at,
    }));

    console.log('[Rewards REST] Found', formattedRewards.length, 'rewards');
    return c.json({ rewards: formattedRewards });
  } catch (error) {
    console.error('[Rewards REST] Unexpected error:', error);
    return c.json({ rewards: [] });
  }
});

// REST API: Get User Rewards
app.get("/api/user/rewards", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ message: "No authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let userId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
    userId = typeof decoded.userId === 'number' ? decoded.userId : parseInt(String(decoded.userId));
    
    if (isNaN(userId)) {
      return c.json({ message: 'Invalid token payload' }, 401);
    }
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  console.log('[UserRewards REST] Fetching rewards for user:', userId);

  try {
    const { data: userRewards, error } = await supabaseAdmin
      .from('user_rewards')
      .select(`
        id,
        claimed_at,
        quantity,
        reward:lootbox_rewards (
          id,
          name,
          description,
          type,
          rarity,
          image_url,
          value
        )
      `)
      .eq('user_id', userId)
      .order('claimed_at', { ascending: false });

    if (error) {
      console.error('[UserRewards REST] Error fetching user rewards:', error);
      return c.json({ rewards: [], stats: null });
    }

    const formattedRewards = (userRewards || []).map((ur: any) => ({
      id: ur.id,
      claimedAt: ur.claimed_at,
      quantity: ur.quantity || 1,
      reward: ur.reward ? {
        id: ur.reward.id,
        name: ur.reward.name,
        description: ur.reward.description,
        type: ur.reward.type,
        rarity: ur.reward.rarity,
        imageUrl: ur.reward.image_url,
        value: ur.reward.value,
      } : null,
    }));

    const stats = {
      totalItems: userRewards?.length || 0,
      legendaryCount: userRewards?.filter((ur: any) => ur.reward?.rarity === 'legendary').length || 0,
      epicCount: userRewards?.filter((ur: any) => ur.reward?.rarity === 'epic').length || 0,
      rareCount: userRewards?.filter((ur: any) => ur.reward?.rarity === 'rare').length || 0,
      commonCount: userRewards?.filter((ur: any) => ur.reward?.rarity === 'common').length || 0,
    };

    console.log('[UserRewards REST] Found', formattedRewards.length, 'rewards');
    return c.json({ rewards: formattedRewards, stats });
  } catch (error) {
    console.error('[UserRewards REST] Unexpected error:', error);
    return c.json({ rewards: [], stats: null });
  }
});

// REST API: Add Reward (Admin only)
app.post("/api/rewards", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ message: "No authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string; role: string };
    
    if (decoded.role !== 'admin') {
      return c.json({ message: 'Admin access required' }, 403);
    }
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  try {
    const body = await c.req.json();
    const { name, description, type, rarity, imageUrl, value, isActive } = body;

    if (!name || !type || !rarity) {
      return c.json({ message: "Name, type, and rarity are required" }, 400);
    }

    console.log('[Rewards REST] Adding reward:', name);

    const { data: reward, error } = await supabaseAdmin
      .from('lootbox_rewards')
      .insert({
        name,
        description: description || null,
        type,
        rarity,
        image_url: imageUrl || null,
        value: value || null,
        is_active: isActive !== false,
      })
      .select()
      .single();

    if (error) {
      console.error('[Rewards REST] Error adding reward:', error);
      return c.json({ message: 'Failed to add reward' }, 500);
    }

    console.log('[Rewards REST] Reward added:', reward.id);
    return c.json({
      success: true,
      reward: {
        id: reward.id,
        name: reward.name,
        description: reward.description,
        type: reward.type,
        rarity: reward.rarity,
        imageUrl: reward.image_url,
        value: reward.value,
        isActive: reward.is_active,
        createdAt: reward.created_at,
      },
    });
  } catch (error) {
    console.error('[Rewards REST] Unexpected error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// REST API: Get Top Games from Twitch
app.get("/api/twitch/games/top", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "20");
    const cursor = c.req.query("cursor");

    console.log(`[Twitch REST] Fetching top ${limit} games`);

    const accessToken = await getTwitchToken();

    const url = new URL("https://api.twitch.tv/helix/games/top");
    url.searchParams.set("first", limit.toString());
    if (cursor) {
      url.searchParams.set("after", cursor);
    }

    const response = await fetch(url.toString(), {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Client-Id": Env.TWITCH_CLIENT_ID,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Twitch REST] Get top games failed:", errorText);
      return c.json({ games: [], nextCursor: undefined });
    }

    const data: { data: TwitchGame[]; pagination?: { cursor?: string } } = await response.json();

    console.log(`[Twitch REST] Found ${data.data.length} top games`);

    const games = data.data.map((game) => ({
      id: game.id,
      name: game.name,
      boxArt: game.box_art_url
        .replace("{width}", "285")
        .replace("{height}", "380"),
      icon: game.box_art_url
        .replace("{width}", "100")
        .replace("{height}", "100"),
    }));

    return c.json({
      games,
      nextCursor: data.pagination?.cursor,
    });
  } catch (error) {
    console.error("[Twitch REST] Error getting top games:", error);
    return c.json({ games: [], nextCursor: undefined });
  }
});

// REST API: Search Games on Twitch
app.get("/api/twitch/games/search", async (c) => {
  try {
    const query = c.req.query("query");
    const limit = parseInt(c.req.query("limit") || "10");

    if (!query) {
      return c.json({ games: [] });
    }

    console.log(`[Twitch REST] Searching games for: "${query}"`);

    const accessToken = await getTwitchToken();

    const searchUrl = new URL("https://api.twitch.tv/helix/search/categories");
    searchUrl.searchParams.set("query", query);
    searchUrl.searchParams.set("first", limit.toString());

    const response = await fetch(searchUrl.toString(), {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Client-Id": Env.TWITCH_CLIENT_ID,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Twitch REST] Search failed:", errorText);
      return c.json({ games: [] });
    }

    const data: { data: TwitchGame[] } = await response.json();

    console.log(`[Twitch REST] Found ${data.data.length} games`);

    const games = data.data.map((game) => ({
      id: game.id,
      name: game.name,
      icon: game.box_art_url
        .replace("{width}", "100")
        .replace("{height}", "100"),
      boxArt: game.box_art_url
        .replace("{width}", "285")
        .replace("{height}", "380"),
      category: "Game",
    }));

    return c.json({ games });
  } catch (error) {
    console.error("[Twitch REST] Error searching games:", error);
    return c.json({ games: [] });
  }
});

// REST API: Delete Clip
app.delete("/api/clips/:id", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ message: "Not authenticated" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let userId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
    userId = typeof decoded.userId === 'number' ? decoded.userId : parseInt(String(decoded.userId));
    
    if (isNaN(userId)) {
      return c.json({ message: 'Invalid token payload' }, 401);
    }
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  const clipId = parseInt(c.req.param("id"));
  if (isNaN(clipId)) {
    return c.json({ message: "Invalid clip ID" }, 400);
  }

  console.log('[Clips REST] Deleting clip:', clipId, 'user:', userId);

  try {
    // Verify ownership
    const { data: clip, error: fetchError } = await supabaseAdmin
      .from('clips')
      .select('id, user_id')
      .eq('id', clipId)
      .single();

    if (fetchError || !clip) {
      console.error('[Clips REST] Clip not found:', clipId);
      return c.json({ message: 'Clip not found' }, 404);
    }

    if (clip.user_id !== userId) {
      console.error('[Clips REST] Unauthorized delete attempt:', userId, 'vs', clip.user_id);
      return c.json({ message: 'You can only delete your own clips' }, 403);
    }

    // Delete related records first
    await supabaseAdmin.from('likes').delete().eq('clip_id', clipId);
    await supabaseAdmin.from('comments').delete().eq('clip_id', clipId);
    await supabaseAdmin.from('reactions').delete().eq('clip_id', clipId);

    // Delete the clip
    const { error: deleteError } = await supabaseAdmin
      .from('clips')
      .delete()
      .eq('id', clipId);

    if (deleteError) {
      console.error('[Clips REST] Error deleting clip:', deleteError);
      return c.json({ message: 'Failed to delete clip' }, 500);
    }

    console.log('[Clips REST] Clip deleted successfully:', clipId);
    return c.json({ success: true, message: 'Clip deleted successfully' });
  } catch (error) {
    console.error('[Clips REST] Error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// REST API: Delete Screenshot
app.delete("/api/screenshots/:id", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ message: "Not authenticated" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  let userId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
    userId = typeof decoded.userId === 'number' ? decoded.userId : parseInt(String(decoded.userId));
    
    if (isNaN(userId)) {
      return c.json({ message: 'Invalid token payload' }, 401);
    }
  } catch {
    return c.json({ message: "Invalid token" }, 401);
  }

  const screenshotId = parseInt(c.req.param("id"));
  if (isNaN(screenshotId)) {
    return c.json({ message: "Invalid screenshot ID" }, 400);
  }

  console.log('[Screenshots REST] Deleting screenshot:', screenshotId, 'user:', userId);

  try {
    // Verify ownership
    const { data: screenshot, error: fetchError } = await supabaseAdmin
      .from('screenshots')
      .select('id, user_id')
      .eq('id', screenshotId)
      .single();

    if (fetchError || !screenshot) {
      console.error('[Screenshots REST] Screenshot not found:', screenshotId);
      return c.json({ message: 'Screenshot not found' }, 404);
    }

    if (screenshot.user_id !== userId) {
      console.error('[Screenshots REST] Unauthorized delete attempt:', userId, 'vs', screenshot.user_id);
      return c.json({ message: 'You can only delete your own screenshots' }, 403);
    }

    // Delete related records first
    await supabaseAdmin.from('screenshot_likes').delete().eq('screenshot_id', screenshotId);
    await supabaseAdmin.from('screenshot_comments').delete().eq('screenshot_id', screenshotId);
    await supabaseAdmin.from('screenshot_reactions').delete().eq('screenshot_id', screenshotId);

    // Delete the screenshot
    const { error: deleteError } = await supabaseAdmin
      .from('screenshots')
      .delete()
      .eq('id', screenshotId);

    if (deleteError) {
      console.error('[Screenshots REST] Error deleting screenshot:', deleteError);
      return c.json({ message: 'Failed to delete screenshot' }, 500);
    }

    console.log('[Screenshots REST] Screenshot deleted successfully:', screenshotId);
    return c.json({ success: true, message: 'Screenshot deleted successfully' });
  } catch (error) {
    console.error('[Screenshots REST] Error:', error);
    return c.json({ message: 'Internal server error' }, 500);
  }
});

// Hero Text API endpoint
app.get("/api/hero-text/experienced", async (c) => {
  console.log('[HeroText] Fetching hero text for experienced users');
  
  try {
    // Check if there's custom hero text in the database
    const { data: heroText, error } = await supabaseAdmin
      .from('hero_text')
      .select('*')
      .eq('target_audience', 'experienced_users')
      .eq('is_active', true)
      .maybeSingle();

    if (heroText && !error) {
      console.log('[HeroText] Found custom hero text:', heroText.title);
      return c.json({
        title: heroText.title,
        subtitle: heroText.subtitle,
        buttonText: heroText.button_text,
        buttonUrl: heroText.button_url,
        targetAudience: heroText.target_audience,
        isActive: heroText.is_active,
        backgroundUrl: heroText.background_url,
        backgroundType: heroText.background_type,
      });
    }

    // Return default hero text
    console.log('[HeroText] Using default hero text');
    return c.json({
      title: "Build Your Gamefolio",
      subtitle: "With Your Best Gaming Clips",
      buttonText: "Start Building Now",
      buttonUrl: "/upload",
      targetAudience: "experienced_users",
      isActive: true,
      backgroundUrl: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1200&auto=format&fit=crop&q=80",
      backgroundType: "image",
    });
  } catch (error) {
    console.error('[HeroText] Error fetching hero text:', error);
    // Return fallback on error
    return c.json({
      title: "Build Your Gamefolio",
      subtitle: "With Your Best Gaming Clips",
      buttonText: "Start Building Now",
      buttonUrl: "/upload",
      targetAudience: "experienced_users",
      isActive: true,
    });
  }
});

console.log('[Backend] 🚀 Mounting tRPC server at /api/trpc');
app.use(
  "/api/trpc/*",
  trpcServer({
    router: appRouter,
    createContext,
    onError({ path, error }) {
      console.error('[tRPC Error] ❌ Path:', path);
      console.error('[tRPC Error] ❌ Message:', error.message);
      console.error('[tRPC Error] ❌ Code:', error.code);
      console.error('[tRPC Error] ❌ Stack:', error.stack);
    },
  })
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

// Debug endpoint to check fire state for a clip/user
app.get("/api/debug/fire-state", async (c) => {
  try {
    const clipTitle = c.req.query('clipTitle');
    const username = c.req.query('username');

    console.log('[Debug] Checking fire state for clip:', clipTitle, 'user:', username);

    // Find the clip
    const { data: clip, error: clipError } = await supabaseAdmin
      .from('clips')
      .select('id, title')
      .ilike('title', `%${clipTitle}%`)
      .maybeSingle();

    if (clipError || !clip) {
      return c.json({ error: 'Clip not found', clipTitle }, 404);
    }

    // Find the user
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, username')
      .eq('username', username)
      .maybeSingle();

    if (userError || !user) {
      return c.json({ error: 'User not found', username }, 404);
    }

    // Check for fire reaction
    const { data: reaction } = await supabaseAdmin
      .from('reactions')
      .select('id, emoji, created_at')
      .eq('clip_id', clip.id)
      .eq('user_id', user.id)
      .eq('emoji', '🔥')
      .maybeSingle();

    // Get total fire count for clip
    const { count: totalFires } = await supabaseAdmin
      .from('reactions')
      .select('*', { count: 'exact', head: true })
      .eq('clip_id', clip.id)
      .eq('emoji', '🔥');

    const result = {
      clip: { id: clip.id, title: clip.title },
      user: { id: user.id, username: user.username },
      fireState: {
        hasFired: !!reaction,
        reactionId: reaction?.id || null,
        reactionCreatedAt: reaction?.created_at || null,
      },
      totalFiresOnClip: totalFires || 0,
    };

    console.log('[Debug] Fire state result:', JSON.stringify(result, null, 2));
    return c.json(result);
  } catch (error) {
    console.error('[Debug] Error:', error);
    return c.json({ error: 'Internal error' }, 500);
  }
});

export default app;
