import { Router, Request, Response } from 'express';
import passport from 'passport';
import { JWTService } from '../services/jwt-service';
import { storage } from '../storage';
import { StreakService } from '../streak-service';
import { getDemoUser } from '../demo-user';
import { scrypt, timingSafeEqual, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const router = Router();

// In-memory store for OAuth state tokens and auth codes (expires after 10 minutes)
const oauthStateStore = new Map<string, { createdAt: number; platform: string }>();
const mobileAuthCodes = new Map<string, { createdAt: number; tokens: { accessToken: string; refreshToken: string }; userId: number; needsOnboarding: boolean; isNewUser: boolean }>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const tenMinutes = 10 * 60 * 1000;
  
  for (const [key, value] of oauthStateStore.entries()) {
    if (now - value.createdAt > tenMinutes) {
      oauthStateStore.delete(key);
    }
  }
  
  for (const [key, value] of mobileAuthCodes.entries()) {
    if (now - value.createdAt > tenMinutes) {
      mobileAuthCodes.delete(key);
    }
  }
}, 5 * 60 * 1000);

function generateSecureCode(): string {
  return randomBytes(32).toString('hex');
}

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
      return res.status(401).json({ message: 'Incorrect username or password' });
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

    // Return tokens and user data
    const response = {
      ...tokens,
      user: streakInfo ? {
        ...userWithoutPassword,
        streakInfo: {
          currentStreak: streakInfo.currentStreak,
          bonusAwarded: streakInfo.bonusAwarded,
          dailyXP: streakInfo.dailyXP,
          longestStreak: userToReturn.longestStreak || 0,
          nextMilestone: streakInfo.currentStreak + (5 - (streakInfo.currentStreak % 5)),
          message: streakInfo.message,
          isNewMilestone: streakInfo.isNewMilestone,
        },
      } : userWithoutPassword,
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
        avatarUrl: photoURL || '/attached_assets/gamefolio social logo 3d circle web.png',
        bannerUrl: '/api/static/telegram-cloud-photo-size-4-5929334272504744521-y_1749637964973.jpg',
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
 * Initiate Discord OAuth for mobile app
 * Returns the Discord OAuth URL that the mobile app should open in a browser
 * Includes state parameter for CSRF protection
 */
router.get('/auth/mobile/discord/init', (req: Request, res: Response) => {
  const baseUrl = process.env.SITE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const redirectUri = `${baseUrl}/api/auth/mobile/discord/callback`;
  
  const discordClientId = process.env.DISCORD_CLIENT_ID;
  
  if (!discordClientId) {
    return res.status(500).json({ message: 'Discord client ID not configured' });
  }
  
  // Generate state token for CSRF protection
  const state = generateSecureCode();
  oauthStateStore.set(state, { createdAt: Date.now(), platform: 'discord' });
  
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?` +
    `client_id=${discordClientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent('identify email')}&` +
    `state=${state}`;
  
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
  try {
    const { code, error: oauthError, state } = req.query;
    
    if (oauthError) {
      return res.redirect(`${RORK_APP_SCHEME}auth/error?message=${encodeURIComponent(String(oauthError))}`);
    }

    if (!code) {
      return res.redirect(`${RORK_APP_SCHEME}auth/error?message=${encodeURIComponent('No authorization code received')}`);
    }

    // Validate state parameter for CSRF protection
    if (!state || !oauthStateStore.has(String(state))) {
      console.error('Invalid or missing OAuth state parameter');
      return res.redirect(`${RORK_APP_SCHEME}auth/error?message=${encodeURIComponent('Invalid authentication state')}`);
    }
    
    const stateData = oauthStateStore.get(String(state));
    oauthStateStore.delete(String(state)); // One-time use
    
    if (stateData?.platform !== 'discord') {
      return res.redirect(`${RORK_APP_SCHEME}auth/error?message=${encodeURIComponent('Invalid authentication state')}`);
    }

    const baseUrl = process.env.SITE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
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
        : '/attached_assets/gamefolio social logo 3d circle web.png';

      user = await storage.createUser({
        username: tempUsername.toLowerCase(),
        displayName,
        email: email.toLowerCase(),
        password: '', // Empty password for OAuth users
        emailVerified: true,
        avatarUrl,
        bannerUrl: '/api/static/telegram-cloud-photo-size-4-5929334272504744521-y_1749637964973.jpg',
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

    // Generate JWT tokens
    const tokens = JWTService.generateTokenPair(user);

    // Store tokens with a one-time auth code (more secure than putting tokens in URL)
    const authCode = generateSecureCode();
    mobileAuthCodes.set(authCode, {
      createdAt: Date.now(),
      tokens,
      userId: user.id,
      needsOnboarding,
      isNewUser
    });

    // Redirect to mobile app with one-time auth code (not the actual tokens)
    return res.redirect(`${RORK_APP_SCHEME}auth/callback?code=${authCode}`);

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
        : '/attached_assets/gamefolio social logo 3d circle web.png';

      user = await storage.createUser({
        username: tempUsername.toLowerCase(),
        displayName,
        email: email.toLowerCase(),
        password: '', // Empty password for OAuth users
        emailVerified: true,
        avatarUrl,
        bannerUrl: '/api/static/telegram-cloud-photo-size-4-5929334272504744521-y_1749637964973.jpg',
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

    const authData = mobileAuthCodes.get(code);
    
    if (!authData) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired auth code'
      });
    }

    // Delete the code after use (one-time only)
    mobileAuthCodes.delete(code);

    // Check if code has expired (10 minute validity)
    const tenMinutes = 10 * 60 * 1000;
    if (Date.now() - authData.createdAt > tenMinutes) {
      return res.status(400).json({
        success: false,
        message: 'Auth code has expired'
      });
    }

    // Fetch user data
    const user = await storage.getUserById(authData.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { password: _, ...userWithoutPassword } = user;

    return res.status(200).json({
      success: true,
      accessToken: authData.tokens.accessToken,
      refreshToken: authData.tokens.refreshToken,
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

export default router;