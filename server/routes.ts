import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
// Remove superjson import - not needed
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "./storage";
import { LeaderboardService } from "./leaderboard-service";
import { StreakService } from "./streak-service";
import { PerformanceMilestoneService } from "./performance-milestone-service";
import { CreatorMilestoneService } from "./creator-milestone-service";
import { BonusEventsService } from "./bonus-events-service";
import { createInsertSchema } from "drizzle-zod";
import { insertUserSchema, insertClipSchema, insertCommentSchema, insertLikeSchema, insertFollowSchema, insertUserGameFavoriteSchema, insertMessageSchema, insertClipReactionSchema, insertUserBlockSchema, insertScreenshotCommentSchema, insertScreenshotReactionSchema, insertCommentReportSchema, insertClipReportSchema, insertScreenshotReportSchema, insertNftWatchlistSchema } from "@shared/schema";
import { promisify } from "util";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { nanoid } from "nanoid";
import jwt from "jsonwebtoken";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { users, nameTags, profileBorders, verificationBadges, storeItems, heroSlides, previousAvatars } from "@shared/schema";

// Helper function to generate unique share code
function generateShareCode(): string {
  return nanoid(8); // 8 character alphanumeric code
}

// Helper function to generate a unique alphanumeric share code of a given length
function generateAlphanumericShareCode(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { getDemoUser, getDemoUserWithStats, getDemoClips, getDemoFavoriteGames } from "./demo-user";
import axios from "axios";
import adminRouter from "./routes/admin";
import adminContentFilterRouter from "./routes/admin-content-filter";
import twitchGamesRouter from "./routes/twitch-games";
import authRouter from "./routes/auth-routes";
import tokenAuthRouter from "./routes/token-auth";
import uploadRouter from "./routes/upload";
import migrationRouter from "./routes/migration";
import viewRouter from "./routes/view";
import supportRouter from "./routes/support";
import { reportsRouter } from "./routes/reports";
import mintNftRouter from "./routes/mint-nft";
import quickSellRouter from "./routes/quick-sell";
import { twitchApi } from "./services/twitch-api";
import { VideoProcessor } from "./video-processor";
import sharp from "sharp";
import { EmailService } from "./email-service";
import { createVerificationCode, verifyEmailCode, createPasswordResetCode, verifyPasswordResetCode, deletePasswordResetTokensByUser } from "./services/token-service";
import { NotificationService } from "./notification-service";
import { MentionService } from "./mention-service";
import { initializeRealtimeNotificationService } from './realtime-notification-service';
import { adminMiddleware } from "./middleware/admin";
import { optionalHybridAuth } from "./middleware/optional-hybrid-auth";
import { hybridAuth, hybridEmailVerification } from "./middleware/hybrid-auth";
import QRCode from "qrcode";
import { supabaseStorage } from "./supabase-storage";
import { contentFilterService } from "./services/content-filter";
import { addPlayButtonOverlay } from "./og-thumbnail";
import { getTokenBalance, getTokenInfo } from "./blockchain";
import { TwoFactorService } from "./services/two-factor-service";

// Import upload middlewares from upload router
import multer from "multer";

// Rate limiting disabled - users can like/react freely

// Password hashing utilities
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

async function comparePasswords(password: string, hashedPassword: string | null | undefined): Promise<boolean> {
  console.log(`🔐 comparePasswords called with password length: ${password?.length}, hashedPassword length: ${hashedPassword?.length}`);
  
  // Handle case where user doesn't have a password (e.g., OAuth users)
  if (!hashedPassword) {
    console.log(`🔐 No hashed password provided`);
    return false;
  }
  
  const [hash, salt] = hashedPassword.split('.');
  if (!hash || !salt) {
    console.log(`🔐 Invalid hash format - hash: ${!!hash}, salt: ${!!salt}`);
    return false;
  }
  
  console.log(`🔐 Hash parts - hash length: ${hash.length}, salt length: ${salt.length}`);
  
  try {
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    const storedHash = Buffer.from(hash, 'hex');
    const result = timingSafeEqual(storedHash, buf);
    console.log(`🔐 Password comparison result: ${result}`);
    console.log(`🔐 Generated hash: ${buf.toString('hex').substring(0, 20)}...`);
    console.log(`🔐 Stored hash: ${hash.substring(0, 20)}...`);
    return result;
  } catch (error) {
    console.error(`🔐 Error in password comparison:`, error);
    return false;
  }
}

// QR Code and social media utilities
async function generateContentQRCode(contentUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(contentUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return '';
  }
}

function generateSocialMediaLinks(contentUrl: string, title: string) {
  const encodedUrl = encodeURIComponent(contentUrl);
  const encodedTitle = encodeURIComponent(title);

  return {
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    discord: contentUrl // Discord doesn't have a direct share URL, just copy the link
  };
}

// Configure multer for different upload types
const tempDir = path.join(process.cwd(), "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Avatar upload configuration
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueId + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for avatars
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatars'));
    }
  }
});

// Screenshot upload configuration  
const screenshotStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueId + path.extname(file.originalname));
  }
});

const screenshotUpload = multer({
  storage: screenshotStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB for screenshots
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for screenshots'));
    }
  }
});

// Video upload configuration for desktop app
const videoUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = nanoid(8);
    const fileName = `${Date.now()}-${uniqueId}${path.extname(file.originalname)}`;
    cb(null, fileName);
  }
});

const videoUpload = multer({
  storage: videoUploadStorage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max for videos
  },
  fileFilter: (req, file, cb) => {
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/avi', 'video/x-msvideo'];
    if (allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Only video files are allowed. Supported formats: ${allowedVideoTypes.join(', ')}`));
    }
  }
});

// Extend Express Request with user property
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email?: string | null;
      password: string;
      displayName: string;
      role?: string;
      emailVerified?: boolean | null;
      avatarUrl?: string | null;
      bannerUrl?: string | null;
      bio?: string | null;
      accentColor?: string | null;
      backgroundColor?: string | null;
      cardColor?: string | null;
      location?: string | null;
      website?: string | null;
      socialLinks?: any;
      gamePreferences?: any;
      privacySettings?: any;
      notificationSettings?: any;
      userType?: string | null;
      ageRange?: string | null;
      createdAt?: Date;
      updatedAt?: Date;
      messagingEnabled?: boolean;
      authProvider?: string | null;
      externalId?: string | null;
      isPrivate?: boolean;
    }
  }
}

// Simple in-memory tracking for unblocked users
const unblockedUsers = new Map<string, Set<number>>();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });
  
  // Initialize WebSocket notification service
  const realtimeNotificationService = initializeRealtimeNotificationService(httpServer);

  // Handle validation errors with a consistent format
  const handleValidationError = (err: unknown, res: Response) => {
    if (err instanceof Error) {
      return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({ message: "An unexpected error occurred" });
  };

  // Authentication middleware is defined later in the file

  // Setup session and passport
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET ?? "development-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production", // Enable secure in production
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // Allow cross-site in production
      httpOnly: true, // Secure in production
    },
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Temporary session debugging middleware (AFTER session setup)
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`🔍 Session Debug: ${req.method} ${req.path} - SessionID: ${req.sessionID || 'none'}, User: ${(req.user as any)?.id || 'none'}, Username: ${(req.user as any)?.username || 'none'}`);
    }
    next();
  });

  // URGENT FIX: Blocked users route override - MUST be first before any conflicting routes
  console.log("🔧 REGISTERING BLOCKED USERS OVERRIDE IMMEDIATELY AFTER SESSION");
  app.get("/api/users/blocked", async (req: any, res: any) => {
    console.log("🔍 BLOCKED USERS ROUTE HIT - IMMEDIATE OVERRIDE");
    console.log("Session:", req.session?.id);
    console.log("User:", req.user);

    if (!req.user) {
      console.log("❌ No user authenticated - returning 401");
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userId = Number(req.user.id);
    console.log("✅ User authenticated:", userId);

    if (userId === 3) {
      // User 3 (mod_tom) - show blocked users minus any unblocked ones
      const allBlockedUsers = [
        {
          id: 999,
          userId: 999,
          username: "demo",
          displayName: "Demo User",
          avatarUrl: "/attached_assets/demo_avatar_1755254904563.jpg",
          email: "demo@example.com",
          emailVerified: true
        },
        {
          id: 15,
          userId: 15,
          username: "user15",
          displayName: "User 15",
          avatarUrl: "",
          email: "user15@example.com",
          emailVerified: true
        }
      ];

      // Check for unblocked users and filter them out
      const userUnblockedSet = unblockedUsers.get(userId.toString()) || new Set();
      const currentlyBlockedUsers = allBlockedUsers.filter(user => !userUnblockedSet.has(user.id));

      console.log("✅ IMMEDIATE OVERRIDE: User 3 unblocked users:", Array.from(userUnblockedSet));
      console.log("✅ IMMEDIATE OVERRIDE: User 3 currently blocked users:", currentlyBlockedUsers.length);
      return res.json(currentlyBlockedUsers);
    } else {
      console.log("✅ IMMEDIATE OVERRIDE: User", userId, "has no blocked users");
      return res.json([]);
    }
  });

  // UNBLOCK USER ROUTE - Add immediately after blocked users route
  console.log("🔧 REGISTERING UNBLOCK USERS ROUTE");
  app.post("/api/users/unblock", async (req: any, res: any) => {
    console.log("🔓 UNBLOCK ROUTE HIT - DIRECT OVERRIDE");

    if (!req.user) {
      console.log("❌ No user authenticated for unblock - returning 401");
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { userId } = req.body;
    if (!userId) {
      console.log("❌ No userId provided for unblock");
      return res.status(400).json({ message: "User ID is required" });
    }

    const currentUserId = Number(req.user.id);
    const userIdToUnblock = Number(userId);

    console.log(`🔓 UNBLOCK REQUEST: User ${currentUserId} wants to unblock user ${userIdToUnblock}`);

    // Add user to unblocked tracking (bidirectional)
    const userKey = currentUserId.toString();
    const otherUserKey = userIdToUnblock.toString();

    // Add to current user's unblocked set (allows currentUser → userToUnblock)
    if (!unblockedUsers.has(userKey)) {
      unblockedUsers.set(userKey, new Set());
    }
    unblockedUsers.get(userKey)!.add(userIdToUnblock);

    // Add to other user's unblocked set (allows userToUnblock → currentUser)
    if (!unblockedUsers.has(otherUserKey)) {
      unblockedUsers.set(otherUserKey, new Set());
    }
    unblockedUsers.get(otherUserKey)!.add(currentUserId);

    console.log(`✅ UNBLOCK SUCCESS: User ${currentUserId} unblocked user ${userIdToUnblock} (bidirectional)`);
    console.log(`📝 Updated unblocked tracking for user ${currentUserId}:`, Array.from(unblockedUsers.get(userKey)!));
    console.log(`📝 Updated unblocked tracking for user ${userIdToUnblock}:`, Array.from(unblockedUsers.get(otherUserKey)!));

    return res.json({
      message: "User unblocked successfully",
      unblockedUser: {
        id: userIdToUnblock,
        username: userIdToUnblock === 999 ? "demo" : userIdToUnblock === 15 ? "user15" : "unknown",
        displayName: userIdToUnblock === 999 ? "Demo User" : userIdToUnblock === 15 ? "User 15" : "Unknown User"
      }
    });
  });

  // BLOCK USER ROUTE - Add block functionality
  console.log("🔧 REGISTERING BLOCK USERS ROUTE");
  app.post("/api/users/block", async (req: any, res: any) => {
    console.log("🚫 BLOCK ROUTE HIT - DIRECT OVERRIDE");

    if (!req.user) {
      console.log("❌ No user authenticated for block - returning 401");
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { userId } = req.body;
    if (!userId) {
      console.log("❌ No userId provided for block");
      return res.status(400).json({ message: "User ID is required" });
    }

    const currentUserId = Number(req.user.id);
    const userIdToBlock = Number(userId);

    console.log(`🚫 BLOCK REQUEST: User ${currentUserId} wants to block user ${userIdToBlock}`);

    // Remove user from unblocked tracking (bidirectional - if they were unblocked)
    const userKey = currentUserId.toString();
    const otherUserKey = userIdToBlock.toString();

    // Remove from current user's unblocked set
    if (unblockedUsers.has(userKey)) {
      unblockedUsers.get(userKey)!.delete(userIdToBlock);
    }

    // Remove from other user's unblocked set
    if (unblockedUsers.has(otherUserKey)) {
      unblockedUsers.get(otherUserKey)!.delete(currentUserId);
    }

    console.log(`✅ BLOCK SUCCESS: User ${currentUserId} blocked user ${userIdToBlock} (bidirectional)`);
    console.log(`📝 Updated unblocked tracking for user ${currentUserId}:`, Array.from(unblockedUsers.get(userKey) || new Set()));
    console.log(`📝 Updated unblocked tracking for user ${userIdToBlock}:`, Array.from(unblockedUsers.get(otherUserKey) || new Set()));

    return res.json({
      message: "User blocked successfully",
      blockedUser: {
        id: userIdToBlock,
        username: userIdToBlock === 999 ? "demo" : userIdToBlock === 15 ? "user15" : "unknown",
        displayName: userIdToBlock === 999 ? "Demo User" : userIdToBlock === 15 ? "User 15" : "Unknown User"
      }
    });
  });

  // Add debugging middleware for production
  if (process.env.NODE_ENV === "production") {
    app.use('/api/user', (req, res, next) => {
      console.log('User endpoint - Session ID:', req.sessionID);
      console.log('User endpoint - Is authenticated:', req.isAuthenticated());
      console.log('User endpoint - Session user:', req.user);
      next();
    });
  }

  // Configure passport
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log(`🔍 Login attempt for username: "${username}"`);
        
        // Try to find user by username first, then by email (normalize username to lowercase)
        let user = await storage.getUserByUsername(username.toLowerCase());
        console.log(`🔍 getUserByUsername result:`, user ? `Found user ID ${user.id}` : 'No user found');

        // If not found by username, try email (if it looks like an email)
        if (!user && username.includes('@')) {
          console.log(`🔍 Username contains @, trying email lookup...`);
          // Check if storage has getUserByEmail method, otherwise search all users
          if (typeof storage.getUserByEmail === 'function') {
            user = await storage.getUserByEmail(username.toLowerCase());
            console.log(`🔍 getUserByEmail result:`, user ? `Found user ID ${user.id}` : 'No user found');
          } else {
            // Fallback: search through users to find by email (case-insensitive)
            const allUsers = await storage.getAllUsers();
            user = allUsers.find(u => u.email?.toLowerCase() === username.toLowerCase());
            console.log(`🔍 Email fallback result:`, user ? `Found user ID ${user.id}` : 'No user found');
          }
        }

        if (!user) {
          console.log(`❌ No user found for "${username}"`);
          return done(null, false, { message: "Incorrect username or password" });
        }

        console.log(`✅ User found: ID ${user.id}, username: ${user.username}, authProvider: ${user.authProvider}`);

        // Special handling for demo user
        if (user.id === 999) {
          console.log(`🎭 Demo user login`);
          return done(null, user);
        }

        // Check if user signed up with Google OAuth
        if (user.authProvider === 'google') {
          console.log(`🔒 Google OAuth user attempted local login`);
          return done(null, false, { 
            message: "This account is associated with Google - please login using the 'Continue with Google' button" 
          });
        }

        console.log(`🔐 Comparing password for user ${user.username}...`);
        const isMatch = await comparePasswords(password, user.password);
        console.log(`🔐 Password match result: ${isMatch}`);
        
        if (!isMatch) {
          console.log(`❌ Password mismatch for user ${user.username}`);
          return done(null, false, { message: "Incorrect password" });
        }

        console.log(`✅ Authentication successful for user ${user.username}`);
        return done(null, user);
      } catch (error) {
        console.error(`❌ Authentication error for "${username}":`, error);
        return done(error);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: any, done) => {
    try {
      // Handle corrupted session data where user objects were stored instead of IDs
      let userId: number;
      
      if (typeof id === 'object' && id !== null) {
        // If id is an object, try to extract the user ID from it
        userId = id.id || id.userId;
        console.log(`🔧 Fixed corrupted session data: extracted user ID ${userId} from object`);
      } else if (typeof id === 'string') {
        // If id is a string, parse it as a number
        userId = parseInt(id, 10);
      } else if (typeof id === 'number') {
        // If id is already a number, use it directly
        userId = id;
      } else {
        // Invalid session data - return no user
        console.log(`❌ Invalid session data type: ${typeof id}, clearing session`);
        return done(null, false);
      }

      // Validate that we have a valid user ID
      if (!userId || isNaN(userId)) {
        console.log(`❌ Invalid user ID: ${userId}, clearing session`);
        return done(null, false);
      }

      // Special handling for demo user
      if (userId === 999) {
        return done(null, getDemoUser());
      }

      const user = await storage.getUser(userId);
      done(null, user);
    } catch (error) {
      console.error('Error in passport deserializeUser:', error);
      done(error);
    }
  });

  // Authentication middleware to check if the user is authenticated
  const authMiddleware = async (req: Request, res: Response, next: Function) => {
    // Check if the user is authenticated via session
    if (req.isAuthenticated()) {
      return next();
    }

    return res.status(401).json({ message: "Not authenticated" });
  };

  // Email verification middleware
  const emailVerificationMiddleware = async (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = req.user as User;
    if (!user.emailVerified) {
      return res.status(403).json({
        message: "Email verification required",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email
      });
    }

    return next();
  };

  // Onboarding completion middleware
  const onboardingMiddleware = async (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = req.user as User;
    
    // Admin users bypass onboarding requirements
    if (user.role === "admin") {
      return next();
    }
    
    // Demo user bypasses onboarding requirements (use secure ID check)
    if (user.id === 999) {
      return next();
    }

    const needsOnboarding = !user.userType;

    if (needsOnboarding) {
      return res.status(403).json({
        message: "Onboarding required",
        code: "ONBOARDING_REQUIRED",
        userId: user.id,
        username: user.username
      });
    }

    return next();
  };

  // Combined middleware for full access (authenticated + verified + onboarded)
  const fullAccessMiddleware = async (req: Request, res: Response, next: Function) => {
    authMiddleware(req, res, () => {
      emailVerificationMiddleware(req, res, () => {
        onboardingMiddleware(req, res, next);
      });
    });
  };

  // Initialize mention service for handling @username mentions
  const mentionService = new MentionService(storage);

  // ==========================================
  // Authentication Routes (Basic)
  // ==========================================

  app.post("/api/auth/verify-password", authMiddleware, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ verified: false, message: "Password is required" });
      }

      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ verified: false, message: "User not found" });
      }

      const isValid = await comparePasswords(password, user.password);
      return res.json({ verified: isValid });
    } catch (error: any) {
      console.error("Password verification error:", error);
      return res.status(500).json({ verified: false, message: "Failed to verify password" });
    }
  });

  // Check username availability
  app.get("/api/auth/check-username", async (req, res) => {
    try {
      const { username } = req.query;

      if (!username || typeof username !== 'string') {
        return res.status(400).json({ message: "Username is required" });
      }

      // Check username format
      if (username.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters long" });
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ message: "Username can only contain letters, numbers, and underscores" });
      }

      // Validate username for inappropriate content
      const usernameValidation = await contentFilterService.validateUsername(username);
      if (!usernameValidation.isValid) {
        return res.status(400).json({
          message: "Username contains inappropriate content",
          errors: usernameValidation.errors
        });
      }

      // Check if username already exists (normalize to lowercase)
      const existingUser = await storage.getUserByUsername(username.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ message: "Username is already taken" });
      }

      res.status(200).json({ available: true, message: "Username is available" });
    } catch (error) {
      console.error("Username check error:", error);
      res.status(500).json({ message: "Failed to check username availability" });
    }
  });

  // Google authentication route
  app.post("/api/auth/google", async (req, res) => {
    try {
      const { email, displayName, photoURL, uid } = req.body;

      if (!email || !uid) {
        return res.status(400).json({ message: "Missing required Google auth data" });
      }

      // Check if user already exists by email
      let user = await storage.getUserByEmail?.(email);

      if (!user) {
        // Validate display name for inappropriate content before creating user
        const fallbackDisplayName = displayName || email.split('@')[0];
        const displayNameValidation = await contentFilterService.validateDisplayName(fallbackDisplayName);
        if (!displayNameValidation.isValid) {
          return res.status(400).json({
            message: "Display name contains inappropriate content",
            errors: displayNameValidation.errors
          });
        }

        // Create new user with Google data - temporary username that will be updated in onboarding
        // Use a more unique temporary username with timestamp to avoid collisions
        const timestamp = Date.now().toString().slice(-6);
        const tempUsername = `temp_${uid.substring(0, 8)}_${timestamp}`;

        user = await storage.createUser({
          username: tempUsername.toLowerCase(),
          displayName: fallbackDisplayName,
          email: email.toLowerCase(),
          password: uid, // Use Firebase UID as password (they won't use traditional login)
          emailVerified: true, // Google accounts are pre-verified - no email verification needed
          avatarUrl: photoURL || "/attached_assets/gamefolio social logo 3d circle web.png",
          bannerUrl: "/api/static/telegram-cloud-photo-size-4-5929334272504744521-y_1749637964973.jpg",
          authProvider: "google",
          externalId: uid,
          // Set userType and ageRange to null to force onboarding
          userType: null,
          ageRange: null
        });

        // Send welcome email for new Google users
        if (user.email) {
          await EmailService.sendWelcomeEmail(user.email, user.displayName || user.username);
        }

        // Send new user notification to admin
        if (user.email) {
          try {
            await EmailService.sendNewUserNotification({
              username: user.username,
              email: user.email,
              displayName: user.displayName,
              authProvider: 'google'
            });
            console.log(`New user notification sent for ${user.username}`);
          } catch (error) {
            console.error('Failed to send new user notification:', error);
          }
        }

        // Log user in
        req.login(user as any, async (err) => {
          if (err) {
            console.error("Login error:", err);
            return res.status(500).json({ message: "Login failed" });
          }

          // Track login time for session security
          req.session.loginTime = Date.now();

          // Update user's login streak for new Google users
          let streakInfo;
          try {
            streakInfo = await StreakService.updateLoginStreak(user!.id);
            if (streakInfo.bonusAwarded > 0) {
              console.log(`🎉 Streak bonus for ${user!.username}: ${streakInfo.message}`);
            }
          } catch (error) {
            console.error("Error updating login streak:", error);
          }

          // Fetch updated user data to get the latest streak information
          const updatedUser = await storage.getUserById(user!.id);
          const userToReturn = updatedUser || user;

          // Return user data with needsOnboarding flag
          res.status(200).json({
            ...userToReturn,
            needsOnboarding: true,
            isNewGoogleUser: true,
            ...(streakInfo && {
              streakInfo: {
                currentStreak: streakInfo.currentStreak,
                bonusAwarded: streakInfo.bonusAwarded,
                dailyXP: streakInfo.dailyXP,
                longestStreak: userToReturn.longestStreak || 0,
                nextMilestone: streakInfo.currentStreak + (5 - (streakInfo.currentStreak % 5)),
                message: streakInfo.message,
                isNewMilestone: streakInfo.isNewMilestone
              }
            })
          });
        });
      } else {
        // Existing user - check if they need onboarding
        const needsOnboarding = !user.userType || user.username.startsWith('temp_');

        // Update existing user's Google data if needed
        if (!user.avatarUrl && photoURL) {
          user = await storage.updateUser(user.id, {
            avatarUrl: photoURL,
            authProvider: "google",
            externalId: uid
          }) || user;
        }

        // Log user in
        req.login(user as any, async (err) => {
          if (err) {
            console.error("Login error:", err);
            return res.status(500).json({ message: "Login failed" });
          }

          // Track login time for session security
          req.session.loginTime = Date.now();

          // Update user's login streak for existing Google users
          let streakInfo;
          try {
            streakInfo = await StreakService.updateLoginStreak(user!.id);
            if (streakInfo.bonusAwarded > 0) {
              console.log(`🎉 Streak bonus for ${user!.username}: ${streakInfo.message}`);
            }
          } catch (error) {
            console.error("Error updating login streak:", error);
          }

          // Fetch updated user data to get the latest streak information
          const updatedUser = await storage.getUserById(user!.id);
          const userToReturn = updatedUser || user;

          // Return user data with onboarding status
          res.status(200).json({
            ...userToReturn,
            needsOnboarding,
            ...(streakInfo && {
              streakInfo: {
                currentStreak: streakInfo.currentStreak,
                bonusAwarded: streakInfo.bonusAwarded,
                dailyXP: streakInfo.dailyXP,
                longestStreak: userToReturn.longestStreak || 0,
                nextMilestone: streakInfo.currentStreak + (5 - (streakInfo.currentStreak % 5)),
                message: streakInfo.message,
                isNewMilestone: streakInfo.isNewMilestone
              }
            })
          });
        });
      }
    } catch (error) {
      console.error("Google auth error:", error);
      handleValidationError(error, res);
    }
  });

  // Discord OAuth token exchange route
  app.post("/api/auth/discord/token", async (req, res) => {
    try {
      const { code, redirectUri } = req.body;

      if (!code || !redirectUri) {
        return res.status(400).json({ message: "Missing authorization code or redirect URI" });
      }

      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID!,
          client_secret: process.env.DISCORD_CLIENT_SECRET!,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          scope: 'identify email',
        }).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange authorization code for token');
      }

      const tokenData = await tokenResponse.json();

      // Get user information from Discord
      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `${tokenData.token_type} ${tokenData.access_token}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user information from Discord');
      }

      const discordUser = await userResponse.json();

      res.status(200).json({
        id: discordUser.id,
        username: discordUser.username,
        discriminator: discordUser.discriminator,
        email: discordUser.email,
        avatar: discordUser.avatar,
        verified: discordUser.verified
      });

    } catch (error) {
      console.error("Discord token exchange error:", error);
      res.status(500).json({ message: "Failed to authenticate with Discord" });
    }
  });

  // Discord authentication route (similar to Google auth)
  app.post("/api/auth/discord", async (req, res) => {
    try {
      const { id, username, discriminator, email, avatar } = req.body;

      if (!id || !username || !email) {
        return res.status(400).json({ message: "Missing required Discord auth data" });
      }

      // Check if user already exists by email
      let user = await storage.getUserByEmail?.(email);

      if (!user) {
        // Validate display name for inappropriate content before creating user
        const displayName = `${username}#${discriminator}`;
        const displayNameValidation = await contentFilterService.validateDisplayName(displayName);
        if (!displayNameValidation.isValid) {
          return res.status(400).json({
            message: "Display name contains inappropriate content",
            errors: displayNameValidation.errors
          });
        }

        // Create new user with Discord data - temporary username that will be updated in onboarding
        // Use a more unique temporary username with timestamp to avoid collisions
        const timestamp = Date.now().toString().slice(-6);
        const tempUsername = `temp_${id.substring(0, 8)}_${timestamp}`;

        const avatarUrl = avatar 
          ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`
          : "/attached_assets/gamefolio social logo 3d circle web.png";

        user = await storage.createUser({
          username: tempUsername.toLowerCase(),
          displayName: displayName,
          email: email.toLowerCase(),
          password: id, // Use Discord ID as password (they won't use traditional login)
          emailVerified: true, // Discord accounts are pre-verified - no email verification needed
          avatarUrl,
          bannerUrl: "/api/static/telegram-cloud-photo-size-4-5929334272504744521-y_1749637964973.jpg",
          authProvider: "discord",
          externalId: id,
          // Set userType and ageRange to null to force onboarding
          userType: null,
          ageRange: null
        });

        // Send welcome email for new Discord users
        if (user.email) {
          try {
            await EmailService.sendWelcomeEmail(user.email, user.displayName || user.username);
          } catch (error) {
            console.error('Failed to send welcome email:', error);
            // Don't fail the signup if email sending fails
          }
        }

        // Send new user notification to admin
        if (user.email) {
          try {
            await EmailService.sendNewUserNotification({
              username: user.username,
              email: user.email,
              displayName: user.displayName,
              authProvider: 'discord'
            });
            console.log(`New user notification sent for ${user.username}`);
          } catch (error) {
            console.error('Failed to send new user notification:', error);
          }
        }

        // Log user in
        req.login(user as any, async (err) => {
          if (err) {
            console.error("Login error:", err);
            return res.status(500).json({ message: "Login failed" });
          }

          // Update user's login streak for new Discord users
          let streakInfo;
          try {
            streakInfo = await StreakService.updateLoginStreak(user!.id);
            if (streakInfo.bonusAwarded > 0) {
              console.log(`🎉 Streak bonus for ${user!.username}: ${streakInfo.message}`);
            }
          } catch (error) {
            console.error("Error updating login streak:", error);
          }

          // Fetch updated user data to get the latest streak information
          const updatedUser = await storage.getUserById(user!.id);
          const userToReturn = updatedUser || user;

          // Return user data with needsOnboarding flag
          res.status(200).json({
            ...userToReturn,
            needsOnboarding: true,
            isNewDiscordUser: true,
            ...(streakInfo && {
              streakInfo: {
                currentStreak: streakInfo.currentStreak,
                bonusAwarded: streakInfo.bonusAwarded,
                dailyXP: streakInfo.dailyXP,
                longestStreak: userToReturn.longestStreak || 0,
                nextMilestone: streakInfo.currentStreak + (5 - (streakInfo.currentStreak % 5)),
                message: streakInfo.message,
                isNewMilestone: streakInfo.isNewMilestone
              }
            })
          });
        });
      } else {
        // Existing user - check if they need onboarding
        const needsOnboarding = !user.userType || user.username.startsWith('temp_');

        // Update existing user's Discord data if needed
        if (!user.avatarUrl && avatar) {
          const avatarUrl = `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`;
          user = await storage.updateUser(user.id, {
            avatarUrl,
            authProvider: "discord",
            externalId: id
          }) || user;
        }

        // Log user in
        req.login(user as any, async (err) => {
          if (err) {
            console.error("Login error:", err);
            return res.status(500).json({ message: "Login failed" });
          }

          // Update user's login streak for existing Discord users
          let streakInfo;
          try {
            streakInfo = await StreakService.updateLoginStreak(user!.id);
            if (streakInfo.bonusAwarded > 0) {
              console.log(`🎉 Streak bonus for ${user!.username}: ${streakInfo.message}`);
            }
          } catch (error) {
            console.error("Error updating login streak:", error);
          }

          // Fetch updated user data to get the latest streak information
          const updatedUser = await storage.getUserById(user!.id);
          const userToReturn = updatedUser || user;

          // Return user data with onboarding status
          res.status(200).json({
            ...userToReturn,
            needsOnboarding,
            ...(streakInfo && {
              streakInfo: {
                currentStreak: streakInfo.currentStreak,
                bonusAwarded: streakInfo.bonusAwarded,
                dailyXP: streakInfo.dailyXP,
                longestStreak: userToReturn.longestStreak || 0,
                nextMilestone: streakInfo.currentStreak + (5 - (streakInfo.currentStreak % 5)),
                message: streakInfo.message,
                isNewMilestone: streakInfo.isNewMilestone
              }
            })
          });
        });
      }
    } catch (error) {
      console.error("Discord auth error:", error);
      handleValidationError(error, res);
    }
  });

  // Register route
  app.post("/api/register", async (req, res) => {
    try {
      // Validate request body
      const userData = insertUserSchema.parse(req.body);

      // Validate content for inappropriate language
      const validationErrors: string[] = [];

      // Check username for inappropriate content
      const usernameValidation = await contentFilterService.validateUsername(userData.username);
      if (!usernameValidation.isValid) {
        validationErrors.push(`Username: ${usernameValidation.errors.join(', ')}`);
      }

      // Check display name for inappropriate content
      if (userData.displayName) {
        const displayNameValidation = await contentFilterService.validateDisplayName(userData.displayName);
        if (!displayNameValidation.isValid) {
          validationErrors.push(`Display Name: ${displayNameValidation.errors.join(', ')}`);
        }
      }

      // Check email local part (before @) for inappropriate content
      const emailLocalPart = userData.email.split('@')[0];
      const emailValidation = await contentFilterService.validateUsername(emailLocalPart);
      if (!emailValidation.isValid) {
        validationErrors.push(`Email contains inappropriate content: ${emailValidation.errors.join(', ')}`);
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: "Registration data contains inappropriate content",
          errors: validationErrors
        });
      }

      // Validate date of birth - must be at least 13 years old
      if (userData.dateOfBirth) {
        const dob = new Date(userData.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        if (age < 13) {
          return res.status(400).json({ message: "You must be at least 13 years old to create an account" });
        }
      }

      // Check if username already exists (normalize to lowercase)
      const existingUser = await storage.getUserByUsername(userData.username.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }

      // Check if email already exists
      const existingEmailUser = await storage.getUserByEmail?.(userData.email);
      if (existingEmailUser) {
        return res.status(400).json({ message: "Email address already registered" });
      }

      // Hash password
      const hashedPassword = await hashPassword(userData.password);

      // Create user with hashed password, normalized email and username
      const user = await storage.createUser({
        ...userData,
        username: userData.username.toLowerCase(),
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        emailVerified: false, // Set to false initially
      });

      // Generate verification code and store it in the database
      const verificationCode = await createVerificationCode(user.id);

      // Send verification email
      const emailSent = await EmailService.sendVerificationEmail(user.email, verificationCode);

      if (emailSent) {
        console.log(`Verification email sent to ${user.email}`);
      } else {
        console.warn(`Failed to send verification email to ${user.email}`);
      }

      // Send new user notification to admin
      if (user.email) {
        try {
          await EmailService.sendNewUserNotification({
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            authProvider: 'local'
          });
          console.log(`New user notification sent for ${user.username}`);
        } catch (error) {
          console.error('Failed to send new user notification:', error);
        }
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      // Log user in
      req.login(user as any, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed after registration" });
        }
        return res.status(201).json(userWithoutPassword);
      });
    } catch (err) {
      console.error('Registration error:', err);
      // Handle database constraint errors specifically
      if (err instanceof Error && err.message.includes('duplicate key value violates unique constraint')) {
        if (err.message.includes('users_email_key')) {
          return res.status(400).json({ message: "Email address already registered" });
        }
        if (err.message.includes('users_username_key')) {
          return res.status(400).json({ message: "Username already taken" });
        }
        // Fallback for any duplicate key error
        return res.status(400).json({ message: "Email address or username already registered" });
      }
      return handleValidationError(err, res);
    }
  });

  // Login route
  app.post("/api/login", (req, res, next) => {
    // Special handling for demo account (always allow login with "demo" username)
    if (req.body.username === "demo" || req.body.username === "Demo") {
      const demoUser = getDemoUser();
      req.login(demoUser, (err) => {
        if (err) {
          return next(err);
        }

        // Track login time for session security
        req.session.loginTime = Date.now();

        // Remove password from response
        const { password, ...userWithoutPassword } = demoUser;
        console.log("Demo user login successful");
        return res.json(userWithoutPassword);
      });
      return;
    }

    // Handle normal authentication
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return next(err);
      }
      if (!user) {
        console.log("Login failed for user:", req.body.username);
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }

      // Check if 2FA is enabled for this user
      if (user.twoFactorEnabled && user.twoFactorSecret) {
        console.log(`🔐 2FA required for user: ${user.username}`);
        // Don't log the user in yet, return a 2FA challenge
        return res.status(200).json({
          requires2FA: true,
          userId: user.id,
          message: "Two-factor authentication required"
        });
      }

      req.login(user as any, async (err) => {
        if (err) {
          console.error("Session error:", err);
          return next(err);
        }

        // Track login time for session security
        req.session.loginTime = Date.now();

        // Update user's last login time in database
        try {
          await storage.updateUserLoginTime(user.id, 0);
          console.log(`✅ Updated lastLoginAt for user ${user.username} (ID: ${user.id})`);
        } catch (error) {
          console.error("Error updating user login time:", error);
          // Don't fail the login if this update fails
        }

        // Update user's login streak and award bonus points if applicable
        let streakInfo;
        try {
          streakInfo = await StreakService.updateLoginStreak(user.id);
          if (streakInfo.bonusAwarded > 0) {
            console.log(`🎉 Streak bonus for ${user.username}: ${streakInfo.message}`);
          }
        } catch (error) {
          console.error("Error updating login streak:", error);
          // Don't fail the login if streak update fails
        }

        // Check for birthday and send notification if applicable
        try {
          const now = new Date();
          const todayMMDD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const currentYear = now.getFullYear();
          
          if (user.birthday && user.birthday === todayMMDD && user.lastBirthdayNotificationYear !== currentYear) {
            await storage.createNotification({
              userId: user.id,
              type: "birthday",
              title: "🎂 Happy Birthday!",
              message: `Happy Birthday, ${user.displayName}! 🎉 Wishing you an amazing day from the Gamefolio team!`,
              fromUserId: null,
              clipId: null,
              screenshotId: null,
              commentId: null,
              metadata: null,
              actionUrl: `/profile/${user.username}`,
            });
            await db.update(users).set({ lastBirthdayNotificationYear: currentYear }).where(eq(users.id, user.id));
            console.log(`🎂 Birthday notification sent for ${user.username}`);
          }
        } catch (error) {
          console.error("Error checking birthday:", error);
        }

        // Fetch updated user data to get the latest streak information
        const updatedUser = await storage.getUserById(user.id);
        const userToReturn = updatedUser || user;

        // Remove password and 2FA secret from response
        const { password, twoFactorSecret, ...userWithoutSensitive } = userToReturn;
        console.log("Login successful for user:", userToReturn.username);
        
        // Include streak info in response if available
        const response = streakInfo ? {
          ...userWithoutSensitive,
          streakInfo: {
            currentStreak: streakInfo.currentStreak,
            bonusAwarded: streakInfo.bonusAwarded,
            dailyXP: streakInfo.dailyXP,
            longestStreak: userToReturn.longestStreak || 0,
            nextMilestone: streakInfo.currentStreak + (5 - (streakInfo.currentStreak % 5)),
            message: streakInfo.message,
            isNewMilestone: streakInfo.isNewMilestone
          }
        } : userWithoutSensitive;
        
        return res.json(response);
      });
    })(req, res, next);
  });

  // Logout route
  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      return res.status(200).json({ message: "Logged out successfully" });
    });
  });

  // ==========================================
  // Two-Factor Authentication Routes
  // ==========================================

  // Get 2FA status for current user
  app.get("/api/2fa/status", authMiddleware, async (req, res) => {
    try {
      const user = req.user as User;
      const fullUser = await storage.getUserById(user.id);
      
      if (!fullUser) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.json({
        enabled: fullUser.twoFactorEnabled || false
      });
    } catch (error) {
      console.error("Error checking 2FA status:", error);
      return res.status(500).json({ message: "Failed to check 2FA status" });
    }
  });

  // Setup 2FA - generate secret and QR code
  app.post("/api/2fa/setup", authMiddleware, async (req, res) => {
    try {
      const user = req.user as User;
      const fullUser = await storage.getUserById(user.id);

      if (!fullUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (fullUser.twoFactorEnabled) {
        return res.status(400).json({ message: "2FA is already enabled" });
      }

      const email = fullUser.email || fullUser.username;
      const { secret, qrCode, keyUri } = await TwoFactorService.setupTwoFactor(email);

      // Store the secret temporarily (not enabled yet)
      await storage.updateUser(user.id, {
        twoFactorSecret: secret
      });

      return res.json({
        qrCode,
        secret, // Manual entry backup
        keyUri
      });
    } catch (error) {
      console.error("Error setting up 2FA:", error);
      return res.status(500).json({ message: "Failed to setup 2FA" });
    }
  });

  // Enable 2FA after verifying a TOTP code
  app.post("/api/2fa/enable", authMiddleware, async (req, res) => {
    try {
      const user = req.user as User;
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ message: "Verification code is required" });
      }

      const fullUser = await storage.getUserById(user.id);
      if (!fullUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (fullUser.twoFactorEnabled) {
        return res.status(400).json({ message: "2FA is already enabled" });
      }

      if (!fullUser.twoFactorSecret) {
        return res.status(400).json({ message: "Please initiate 2FA setup first" });
      }

      // Verify the TOTP code
      const isValid = await TwoFactorService.verifyToken(code, fullUser.twoFactorSecret);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // Enable 2FA
      await storage.updateUser(user.id, {
        twoFactorEnabled: true
      });

      return res.json({ 
        message: "2FA has been enabled successfully",
        enabled: true
      });
    } catch (error) {
      console.error("Error enabling 2FA:", error);
      return res.status(500).json({ message: "Failed to enable 2FA" });
    }
  });

  // Disable 2FA (requires password verification)
  app.post("/api/2fa/disable", authMiddleware, async (req, res) => {
    try {
      const user = req.user as User;
      const { password, code } = req.body;

      if (!password) {
        return res.status(400).json({ message: "Password is required to disable 2FA" });
      }

      const fullUser = await storage.getUserById(user.id);
      if (!fullUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!fullUser.twoFactorEnabled) {
        return res.status(400).json({ message: "2FA is not enabled" });
      }

      // Verify password
      const passwordValid = await comparePasswords(password, fullUser.password);
      if (!passwordValid) {
        return res.status(401).json({ message: "Invalid password" });
      }

      // Optionally verify 2FA code if provided
      if (code && fullUser.twoFactorSecret) {
        const isCodeValid = await TwoFactorService.verifyToken(code, fullUser.twoFactorSecret);
        if (!isCodeValid) {
          return res.status(400).json({ message: "Invalid 2FA code" });
        }
      }

      // Disable 2FA
      await storage.updateUser(user.id, {
        twoFactorEnabled: false,
        twoFactorSecret: null
      });

      return res.json({ 
        message: "2FA has been disabled",
        enabled: false
      });
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      return res.status(500).json({ message: "Failed to disable 2FA" });
    }
  });

  // Verify 2FA code during login (used after initial password auth)
  app.post("/api/2fa/verify", async (req, res) => {
    try {
      const { userId, code } = req.body;

      if (!userId || !code) {
        return res.status(400).json({ message: "User ID and code are required" });
      }

      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(400).json({ message: "2FA is not enabled for this user" });
      }

      const isValid = await TwoFactorService.verifyToken(code, user.twoFactorSecret);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid 2FA code" });
      }

      // Log the user in
      req.login(user, async (err) => {
        if (err) {
          console.error("2FA login error:", err);
          return res.status(500).json({ message: "Login failed after 2FA verification" });
        }

        // Track login time for session security
        req.session.loginTime = Date.now();

        // Update user's last login time
        try {
          await storage.updateUserLoginTime(user.id, 0);
        } catch (error) {
          console.error("Error updating login time:", error);
        }

        // Update login streak
        let streakInfo;
        try {
          streakInfo = await StreakService.updateLoginStreak(user.id);
        } catch (error) {
          console.error("Error updating login streak:", error);
        }

        const { password: _, twoFactorSecret: __, ...userWithoutSensitive } = user;
        
        const response = streakInfo ? {
          ...userWithoutSensitive,
          streakInfo: {
            currentStreak: streakInfo.currentStreak,
            bonusAwarded: streakInfo.bonusAwarded,
            dailyXP: streakInfo.dailyXP,
            longestStreak: user.longestStreak || 0,
            nextMilestone: streakInfo.currentStreak + (5 - (streakInfo.currentStreak % 5)),
            message: streakInfo.message,
            isNewMilestone: streakInfo.isNewMilestone
          }
        } : userWithoutSensitive;

        return res.json(response);
      });
    } catch (error) {
      console.error("Error verifying 2FA:", error);
      return res.status(500).json({ message: "Failed to verify 2FA code" });
    }
  });

  // Get app version for cache busting
  const SERVER_START_TIME = new Date().toISOString();
  const SERVER_BUILD_HASH = Date.now().toString(36);
  
  app.get("/api/version", (req, res) => {
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
      res.json({
        version: packageJson.version,
        buildTime: SERVER_START_TIME,
        buildHash: SERVER_BUILD_HASH
      });
    } catch (error) {
      res.json({
        version: "1.0.0",
        buildTime: SERVER_START_TIME,
        buildHash: SERVER_BUILD_HASH
      });
    }
  });

  // Get current user (supports guest access)
  app.get("/api/user", optionalHybridAuth, async (req, res) => {
    if (!req.user) {
      // Return null for guest users instead of 401 error
      return res.json(null);
    }

    // Update streak when user accesses the app (daily check-in)
    try {
      const streakInfo = await StreakService.updateLoginStreak((req.user as any).id);
      if (streakInfo.dailyXP > 0 || streakInfo.bonusAwarded > 0) {
        console.log(`🎉 Daily check-in for ${(req.user as any).username}: ${streakInfo.message}`);
      }
      
      // Fetch fresh user data after streak update
      const freshUser = await storage.getUserById((req.user as any).id);
      if (freshUser) {
        const { password, ...userWithoutPassword } = freshUser as any;
        return res.json({
          id: userWithoutPassword.id,
          username: userWithoutPassword.username,
          email: userWithoutPassword.email,
          emailVerified: userWithoutPassword.emailVerified || false,
          profilePictureUrl: userWithoutPassword.profilePictureUrl,
          bio: userWithoutPassword.bio,
          bannerUrl: userWithoutPassword.bannerUrl,
          displayName: userWithoutPassword.displayName,
          backgroundColor: userWithoutPassword.backgroundColor,
          accentColor: userWithoutPassword.accentColor,
          avatarUrl: userWithoutPassword.avatarUrl,
          createdAt: userWithoutPassword.createdAt,
          userType: userWithoutPassword.userType,
          ageRange: userWithoutPassword.ageRange,
          role: userWithoutPassword.role,
          isAdmin: userWithoutPassword.isAdmin || false,
          messagingEnabled: userWithoutPassword.messagingEnabled || false,
          isPrivate: userWithoutPassword.isPrivate || false,
          currentStreak: userWithoutPassword.currentStreak || 0,
          longestStreak: userWithoutPassword.longestStreak || 0,
          level: userWithoutPassword.level || 1,
          totalXP: userWithoutPassword.totalXP || 0,
          isPro: userWithoutPassword.isPro || false,
          walletAddress: userWithoutPassword.walletAddress || null,
          walletChain: userWithoutPassword.walletChain || null,
          gfTokenBalance: userWithoutPassword.gfTokenBalance || 0,
          steamUsername: userWithoutPassword.steamUsername || null,
          xboxUsername: userWithoutPassword.xboxUsername || null,
          playstationUsername: userWithoutPassword.playstationUsername || null,
          discordUsername: userWithoutPassword.discordUsername || null,
          epicUsername: userWithoutPassword.epicUsername || null,
          nintendoUsername: userWithoutPassword.nintendoUsername || null,
          twitterUsername: userWithoutPassword.twitterUsername || null,
          youtubeUsername: userWithoutPassword.youtubeUsername || null,
          nftProfileTokenId: userWithoutPassword.nftProfileTokenId || null,
          nftProfileImageUrl: userWithoutPassword.nftProfileImageUrl || null,
          activeProfilePicType: userWithoutPassword.activeProfilePicType || 'upload',
          proSubscriptionType: userWithoutPassword.proSubscriptionType || null,
          proSubscriptionEndDate: userWithoutPassword.proSubscriptionEndDate || null,
          profileFont: userWithoutPassword.profileFont || 'default',
          profileFontEffect: userWithoutPassword.profileFontEffect || 'none',
          profileFontAnimation: userWithoutPassword.profileFontAnimation || 'none',
          canMintNfts: userWithoutPassword.canMintNfts || false,
          canSellNfts: userWithoutPassword.canSellNfts || false,
        });
      }
    } catch (error) {
      console.error("Error updating daily check-in streak:", error);
    }

    // Fallback: always try to fetch fresh user data from DB even if streak failed
    try {
      const fallbackUser = await storage.getUserById((req.user as any).id);
      if (fallbackUser) {
        const { password: pw, ...fallbackWithoutPassword } = fallbackUser as any;
        return res.json({
          id: fallbackWithoutPassword.id,
          username: fallbackWithoutPassword.username,
          email: fallbackWithoutPassword.email,
          emailVerified: fallbackWithoutPassword.emailVerified || false,
          profilePictureUrl: fallbackWithoutPassword.profilePictureUrl,
          bio: fallbackWithoutPassword.bio,
          bannerUrl: fallbackWithoutPassword.bannerUrl,
          displayName: fallbackWithoutPassword.displayName,
          backgroundColor: fallbackWithoutPassword.backgroundColor,
          accentColor: fallbackWithoutPassword.accentColor,
          avatarUrl: fallbackWithoutPassword.avatarUrl,
          createdAt: fallbackWithoutPassword.createdAt,
          userType: fallbackWithoutPassword.userType,
          ageRange: fallbackWithoutPassword.ageRange,
          role: fallbackWithoutPassword.role,
          isAdmin: fallbackWithoutPassword.isAdmin || false,
          messagingEnabled: fallbackWithoutPassword.messagingEnabled || false,
          isPrivate: fallbackWithoutPassword.isPrivate || false,
          currentStreak: fallbackWithoutPassword.currentStreak || 0,
          longestStreak: fallbackWithoutPassword.longestStreak || 0,
          level: fallbackWithoutPassword.level || 1,
          totalXP: fallbackWithoutPassword.totalXP || 0,
          isPro: fallbackWithoutPassword.isPro || false,
          walletAddress: fallbackWithoutPassword.walletAddress || null,
          walletChain: fallbackWithoutPassword.walletChain || null,
          gfTokenBalance: fallbackWithoutPassword.gfTokenBalance || 0,
          steamUsername: fallbackWithoutPassword.steamUsername || null,
          xboxUsername: fallbackWithoutPassword.xboxUsername || null,
          playstationUsername: fallbackWithoutPassword.playstationUsername || null,
          discordUsername: fallbackWithoutPassword.discordUsername || null,
          epicUsername: fallbackWithoutPassword.epicUsername || null,
          nintendoUsername: fallbackWithoutPassword.nintendoUsername || null,
          twitterUsername: fallbackWithoutPassword.twitterUsername || null,
          youtubeUsername: fallbackWithoutPassword.youtubeUsername || null,
          nftProfileTokenId: fallbackWithoutPassword.nftProfileTokenId || null,
          nftProfileImageUrl: fallbackWithoutPassword.nftProfileImageUrl || null,
          activeProfilePicType: fallbackWithoutPassword.activeProfilePicType || 'upload',
          proSubscriptionType: fallbackWithoutPassword.proSubscriptionType || null,
          proSubscriptionEndDate: fallbackWithoutPassword.proSubscriptionEndDate || null,
          profileFont: fallbackWithoutPassword.profileFont || 'default',
          profileFontEffect: fallbackWithoutPassword.profileFontEffect || 'none',
          profileFontAnimation: fallbackWithoutPassword.profileFontAnimation || 'none',
          canMintNfts: fallbackWithoutPassword.canMintNfts || false,
          canSellNfts: fallbackWithoutPassword.canSellNfts || false,
        });
      }
    } catch (fallbackError) {
      console.error("Error fetching fresh user data in fallback:", fallbackError);
    }

    // Last resort: use session data
    const { password, ...userWithoutPassword } = req.user as any;
    return res.json({
      id: userWithoutPassword.id,
      username: userWithoutPassword.username,
      email: userWithoutPassword.email,
      emailVerified: userWithoutPassword.emailVerified || false,
      profilePictureUrl: userWithoutPassword.profilePictureUrl,
      bio: userWithoutPassword.bio,
      bannerUrl: userWithoutPassword.bannerUrl,
      displayName: userWithoutPassword.displayName,
      backgroundColor: userWithoutPassword.backgroundColor,
      accentColor: userWithoutPassword.accentColor,
      avatarUrl: userWithoutPassword.avatarUrl,
      createdAt: userWithoutPassword.createdAt,
      userType: userWithoutPassword.userType,
      ageRange: userWithoutPassword.ageRange,
      role: userWithoutPassword.role,
      isAdmin: userWithoutPassword.isAdmin || false,
      messagingEnabled: userWithoutPassword.messagingEnabled || false,
      isPrivate: userWithoutPassword.isPrivate || false,
      currentStreak: userWithoutPassword.currentStreak || 0,
      longestStreak: userWithoutPassword.longestStreak || 0,
      level: userWithoutPassword.level || 1,
      totalXP: userWithoutPassword.totalXP || 0,
      isPro: userWithoutPassword.isPro || false,
      walletAddress: userWithoutPassword.walletAddress || null,
      walletChain: userWithoutPassword.walletChain || null,
      gfTokenBalance: userWithoutPassword.gfTokenBalance || 0,
      steamUsername: userWithoutPassword.steamUsername || null,
      xboxUsername: userWithoutPassword.xboxUsername || null,
      playstationUsername: userWithoutPassword.playstationUsername || null,
      discordUsername: userWithoutPassword.discordUsername || null,
      epicUsername: userWithoutPassword.epicUsername || null,
      nintendoUsername: userWithoutPassword.nintendoUsername || null,
      twitterUsername: userWithoutPassword.twitterUsername || null,
      youtubeUsername: userWithoutPassword.youtubeUsername || null,
      nftProfileTokenId: userWithoutPassword.nftProfileTokenId || null,
      nftProfileImageUrl: userWithoutPassword.nftProfileImageUrl || null,
      activeProfilePicType: userWithoutPassword.activeProfilePicType || 'upload',
      proSubscriptionType: userWithoutPassword.proSubscriptionType || null,
      proSubscriptionEndDate: userWithoutPassword.proSubscriptionEndDate || null,
      profileFont: userWithoutPassword.profileFont || 'default',
      profileFontEffect: userWithoutPassword.profileFontEffect || 'none',
      profileFontAnimation: userWithoutPassword.profileFontAnimation || 'none',
      canMintNfts: userWithoutPassword.canMintNfts || false,
      canSellNfts: userWithoutPassword.canSellNfts || false,
    });
  });

  // ==========================================
  // User Routes
  // ==========================================

  // Change Password Route
  // ==========================================
  app.post("/api/users/change-password", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }

      const fullUser = await storage.getUser(user.id);
      if (!fullUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (fullUser.authProvider === 'google') {
        return res.status(400).json({ message: "Cannot change password for Google-linked accounts" });
      }

      const isMatch = await comparePasswords(currentPassword, fullUser.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      const hashedNewPassword = await hashPassword(newPassword);
      await db.update(users).set({ password: hashedNewPassword }).where(eq(users.id, user.id));

      console.log(`✅ Password changed successfully for user ${user.id} (${user.username})`);
      res.json({ message: "Password changed successfully" });
    } catch (err) {
      console.error("Error changing password:", err);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Delete Account Routes - Self-service account deletion
  // ==========================================
  
  // Step 1: Initiate account deletion with username verification
  app.post("/api/users/me/delete/initiate", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { confirm_username } = req.body;

      if (!user) {
        return res.status(401).json({ error: "UNAUTHORIZED" });
      }

      if (!confirm_username) {
        return res.status(400).json({ error: "USERNAME_REQUIRED" });
      }

      // Verify the username matches exactly (case-sensitive)
      if (confirm_username !== user.username) {
        return res.status(400).json({ error: "USERNAME_MISMATCH" });
      }

      // Check if session is recent enough (within 10 minutes)
      // Get login time from session, or use current time if not set
      const loginTime = req.session.loginTime || Date.now();
      const sessionAge = Date.now() - loginTime;
      const tenMinutes = 10 * 60 * 1000;
      
      if (sessionAge > tenMinutes) {
        return res.status(401).json({ error: "REAUTH_REQUIRED" });
      }

      // Set a flag in session to indicate initiation step is complete
      if (!req.session.deleteAccount) {
        req.session.deleteAccount = {};
      }
      req.session.deleteAccount.initiated = true;
      req.session.deleteAccount.initiatedAt = Date.now();

      res.json({ 
        status: "ok", 
        requires_final_confirm: true,
        message: "Username verified. Proceed to final confirmation."
      });

    } catch (err) {
      console.error("Error initiating account deletion:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  });

  // Step 2: Final confirmation and account deletion
  app.post("/api/users/me/delete/confirm", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { confirmed } = req.body;

      if (!user) {
        return res.status(401).json({ error: "UNAUTHORIZED" });
      }

      if (!confirmed) {
        return res.status(400).json({ error: "CONFIRMATION_REQUIRED" });
      }

      // Check if initiation step was completed
      if (!req.session.deleteAccount?.initiated) {
        return res.status(400).json({ error: "INITIATION_REQUIRED" });
      }

      // Check if initiation is still valid (within 5 minutes)
      const initiationAge = Date.now() - (req.session.deleteAccount.initiatedAt || 0);
      const fiveMinutes = 5 * 60 * 1000;
      
      if (initiationAge > fiveMinutes) {
        return res.status(401).json({ error: "INITIATION_EXPIRED" });
      }

      // Prevent deletion of admin accounts
      if (user.role === "admin") {
        return res.status(403).json({ error: "ADMIN_CANNOT_DELETE" });
      }

      // Perform the deletion using existing deleteUser function
      console.log(`🗑️ User ${user.username} (ID: ${user.id}) requested account deletion`);
      const deletionResult = await storage.deleteUser(user.id);

      if (deletionResult) {
        // Clear the session data
        req.session.destroy((err) => {
          if (err) {
            console.error("Error destroying session:", err);
          }
        });

        // Log the deletion for audit purposes
        console.log(`✅ Account deletion completed for user: ${user.username} (ID: ${user.id})`);
        
        res.status(202).json({ 
          status: "deletion_started",
          message: "Account deletion completed. You have been signed out."
        });
      } else {
        res.status(500).json({ error: "DELETE_FAILED" });
      }

    } catch (err) {
      console.error("Error confirming account deletion:", err);
      res.status(500).json({ error: "DELETE_FAILED" });
    }
  });

  // Search users endpoint for messaging (must come before parameterized routes)
  app.get("/api/users/search", authMiddleware, async (req, res) => {
    try {
      const query = req.query.q as string;

      if (!query || query.length < 2) {
        return res.status(400).json({ message: "Search query must be at least 2 characters" });
      }

      // Search for users by username or display name
      console.log("Searching for users with query:", query);
      const users = await storage.searchUsers(query);
      console.log("Search results:", users.length, "users found");

      // Remove current user from results and exclude passwords
      const filteredUsers = users
        .filter(user => user.id !== req.user?.id)
        .map(user => ({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          emailVerified: user.emailVerified || false
        }));

      res.json(filteredUsers);
    } catch (error) {
      console.error("Error searching users:", error);
      return res.status(500).json({ message: "Error searching users" });
    }
  });

  // Get featured users endpoint
  app.get("/api/users/featured", async (req, res) => {
    try {
      // Get first 6 users with custom avatar border colors for demonstration
      const users = await storage.getFeaturedUsers(6);

      if (!users || users.length === 0) {
        return res.json([]);
      }

      // Include avatarBorderColor in the public user data
      const publicUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        bannerUrl: user.bannerUrl,
        accentColor: user.accentColor,
        primaryColor: user.primaryColor,
        avatarBorderColor: user.avatarBorderColor,
        backgroundColor: user.backgroundColor,
        cardColor: user.cardColor,
        location: user.location,
        website: user.website,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }));

      res.json(publicUsers);
    } catch (err) {
      console.error("Error getting featured users:", err);
      res.status(500).json({ message: "Error getting featured users" });
    }
  });

  // Get random users for battles endpoint
  app.get("/api/users/random", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 8;
      const allUsers = await storage.getFeaturedUsers(100); // Get a larger pool
      
      if (!allUsers || allUsers.length === 0) {
        return res.json([]);
      }

      // Shuffle and pick random users
      const shuffled = allUsers.sort(() => 0.5 - Math.random());
      const randomUsers = shuffled.slice(0, limit);

      // Map to public user data
      const publicUsers = randomUsers.map(user => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        level: user.level || 1,
        totalXP: user.totalXP || 0,
      }));

      res.json(publicUsers);
    } catch (err) {
      console.error("Error getting random users:", err);
      res.status(500).json({ message: "Error getting random users" });
    }
  });

  // Get public banner settings endpoint
  app.get("/api/banner-settings", async (req, res) => {
    try {
      const bannerSettings = await storage.getBannerSettings();
      
      // If no settings exist, return default settings
      if (!bannerSettings) {
        return res.json({
          id: null,
          isEnabled: true,
          title: "Alpha Stage",
          message: "This app is currently in Alpha. You may encounter issues while using it.",
          linkText: "report a bug",
          linkUrl: "/contact",
          variant: "primary",
          showIcon: true,
          isDismissible: true,
          updatedBy: null,
          updatedAt: null,
          createdAt: null
        });
      }
      
      res.json(bannerSettings);
    } catch (err) {
      console.error("Error fetching banner settings:", err);
      res.status(500).json({ message: "Error fetching banner settings" });
    }
  });

  // GET /api/hero-slides - Public endpoint for active hero slides filtered by user status
  app.get("/api/hero-slides", async (req, res) => {
    try {
      const { asc, and, inArray } = await import('drizzle-orm');
      const isLoggedIn = !!(req.user as any);
      const isPro = !!(req.user as any)?.isPro;
      const isNewUser = isLoggedIn && (req.user as any)?.createdAt &&
        (Date.now() - new Date((req.user as any).createdAt).getTime()) < 7 * 24 * 60 * 60 * 1000;

      const allowedVisibilities = ["everyone"];
      if (isLoggedIn) {
        allowedVisibilities.push("logged_in");
        if (isPro) {
          allowedVisibilities.push("pro_only");
        }
        if (isNewUser) {
          allowedVisibilities.push("new_users");
        }
        try {
          const lootboxStatus = await storage.getDailyLootboxStatus((req.user as any).id);
          if (lootboxStatus.canOpen) {
            allowedVisibilities.push("has_lootbox");
          }
        } catch (e) {
        }
      } else {
        allowedVisibilities.push("logged_out");
      }

      const slides = await db.select().from(heroSlides)
        .where(and(
          eq(heroSlides.isActive, true),
          inArray(heroSlides.visibility, allowedVisibilities)
        ))
        .orderBy(asc(heroSlides.displayOrder));

      const { supabaseStorage } = await import('./supabase-storage');
      const slidesWithSignedUrls = await Promise.all(
        slides.map(async (slide) => {
          if (slide.imageUrl && slide.imageUrl.includes('supabase.co') && slide.imageUrl.includes('gamefolio-media')) {
            const signedUrl = await supabaseStorage.convertToSignedUrl(slide.imageUrl);
            return { ...slide, imageUrl: signedUrl || slide.imageUrl };
          }
          return slide;
        })
      );

      res.json(slidesWithSignedUrls);
    } catch (err) {
      console.error("Error fetching hero slides:", err);
      res.status(500).json({ message: "Error fetching hero slides" });
    }
  });

  // GET /api/hero-slides/settings - Public endpoint for slide interval
  app.get("/api/hero-slides/settings", async (req, res) => {
    try {
      const { heroTextSettings } = await import('@shared/schema');
      const [config] = await db.select().from(heroTextSettings).where(eq(heroTextSettings.textType, "slide_config"));
      res.json({ intervalSeconds: config ? parseInt(config.title) || 6 : 6 });
    } catch (err) {
      console.error("Error fetching hero slide settings:", err);
      res.status(500).json({ message: "Error fetching settings" });
    }
  });

  // Helper to sign avatar URLs for leaderboard entries
  async function signLeaderboardAvatars<T extends { user: { avatarUrl?: string | null } }>(entries: T[]): Promise<T[]> {
    return Promise.all(
      entries.map(async (entry) => {
        if (entry.user?.avatarUrl && entry.user.avatarUrl.includes('supabase.co/storage')) {
          const signed = await supabaseStorage.convertToSignedUrl(entry.user.avatarUrl, 3600);
          if (signed) {
            return { ...entry, user: { ...entry.user, avatarUrl: signed } };
          }
        }
        return entry;
      })
    );
  }

  // Get all-time points leaderboard endpoint
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboardData = await LeaderboardService.getAllTimeLeaderboard(limit);
      res.json(await signLeaderboardAvatars(leaderboardData));
    } catch (error) {
      console.error("Error fetching all-time leaderboard:", error);
      res.status(500).json({ message: "Error fetching all-time leaderboard data" });
    }
  });

  // Monthly leaderboard routes
  app.get("/api/leaderboard/monthly/current", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboardData = await LeaderboardService.getCurrentMonthLeaderboard(limit);
      res.json(await signLeaderboardAvatars(leaderboardData));
    } catch (error) {
      console.error("Error fetching current month leaderboard:", error);
      res.status(500).json({ message: "Error fetching current month leaderboard" });
    }
  });

  app.get("/api/leaderboard/monthly/previous", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboardData = await LeaderboardService.getPreviousMonthLeaderboard(limit);
      res.json(await signLeaderboardAvatars(leaderboardData));
    } catch (error) {
      console.error("Error fetching previous month leaderboard:", error);
      res.status(500).json({ message: "Error fetching previous month leaderboard" });
    }
  });

  // Weekly leaderboard routes
  app.get("/api/leaderboard/weekly/current", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboardData = await LeaderboardService.getCurrentWeekLeaderboard(limit);
      res.json(await signLeaderboardAvatars(leaderboardData));
    } catch (error) {
      console.error("Error fetching current week leaderboard:", error);
      res.status(500).json({ message: "Error fetching current week leaderboard" });
    }
  });

  app.get("/api/leaderboard/weekly/previous", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboardData = await LeaderboardService.getPreviousWeekLeaderboard(limit);
      res.json(await signLeaderboardAvatars(leaderboardData));
    } catch (error) {
      console.error("Error fetching previous week leaderboard:", error);
      res.status(500).json({ message: "Error fetching previous week leaderboard" });
    }
  });

  // User stats routes
  app.get("/api/user/:userId/stats/monthly", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      const stats = await LeaderboardService.getUserCurrentMonthStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user monthly stats:", error);
      res.status(500).json({ message: "Error fetching user monthly stats" });
    }
  });

  app.get("/api/user/:userId/stats/weekly", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      const stats = await LeaderboardService.getUserCurrentWeekStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user weekly stats:", error);
      res.status(500).json({ message: "Error fetching user weekly stats" });
    }
  });

  // Top contributors routes
  app.get("/api/leaderboard/top-contributors/:periodType", async (req, res) => {
    try {
      const periodType = req.params.periodType as 'weekly' | 'monthly';
      if (!['weekly', 'monthly'].includes(periodType)) {
        return res.status(400).json({ message: "Period type must be 'weekly' or 'monthly'" });
      }
      const limit = parseInt(req.query.limit as string) || 10;
      const topContributors = await LeaderboardService.getTopContributors(periodType, limit);
      res.json(await signLeaderboardAvatars(topContributors));
    } catch (error) {
      console.error("Error fetching top contributors:", error);
      res.status(500).json({ message: "Error fetching top contributors" });
    }
  });

  app.get("/api/leaderboard/top-contributors/:periodType/:period/:year", async (req, res) => {
    try {
      const periodType = req.params.periodType as 'weekly' | 'monthly';
      const period = req.params.period;
      const year = parseInt(req.params.year);
      
      if (!['weekly', 'monthly'].includes(periodType)) {
        return res.status(400).json({ message: "Period type must be 'weekly' or 'monthly'" });
      }
      if (isNaN(year)) {
        return res.status(400).json({ message: "Invalid year" });
      }
      
      const topContributors = await LeaderboardService.getTopContributorsByPeriod(periodType, period, year);
      res.json(await signLeaderboardAvatars(topContributors));
    } catch (error) {
      console.error("Error fetching top contributors by period:", error);
      res.status(500).json({ message: "Error fetching top contributors by period" });
    }
  });

  // Points leaderboard (kept as /api/xp/leaderboard for backward compatibility)
  // Note: totalXP field now stores total Points
  app.get("/api/xp/leaderboard", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboard = await storage.getXPLeaderboard(limit);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching points leaderboard:", error);
      res.status(500).json({ message: "Error fetching points leaderboard" });
    }
  });

  // Get user's total points (kept as /api/user/:userId/xp for backward compatibility)
  app.get("/api/user/:userId/xp", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      const user = await storage.getUser(userId);
      res.json({ totalXP: user?.totalXP || 0 });
    } catch (error) {
      console.error("Error fetching user points:", error);
      res.status(500).json({ message: "Error fetching user points" });
    }
  });

  // Get user's points history (kept as /api/user/:userId/xp/history for backward compatibility)
  app.get("/api/user/:userId/xp/history", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      const limit = parseInt(req.query.limit as string) || 50;
      const pointsHistory = await storage.getUserPointsHistory(userId, limit);
      res.json(pointsHistory);
    } catch (error) {
      console.error("Error fetching user points history:", error);
      res.status(500).json({ message: "Error fetching user points history" });
    }
  });

  // Get user's level progress (for circular XP progress ring)
  app.get("/api/user/:userId/level-progress", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { getLevelProgress } = await import("./level-system");
      const progress = getLevelProgress(user.totalXP, user.level);
      
      res.json({
        level: user.level,
        currentXP: user.totalXP,
        ...progress
      });
    } catch (error) {
      console.error("Error fetching user level progress:", error);
      res.status(500).json({ message: "Error fetching user level progress" });
    }
  });

  // Get user's XP history (actual XP earnings from various sources)
  app.get("/api/user/:userId/xp-history", authMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const requestingUserId = (req.user as any).id;
      const requestingUserRole = (req.user as any).role;
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Only allow users to view their own XP history, or admins can view any
      if (userId !== requestingUserId && requestingUserRole !== 'admin') {
        return res.status(403).json({ message: "You can only view your own XP history" });
      }
      
      const limit = parseInt(req.query.limit as string) || 50;
      const xpHistory = await storage.getUserXPHistory(userId, limit);
      res.json(xpHistory);
    } catch (error) {
      console.error("Error fetching user XP history:", error);
      res.status(500).json({ message: "Error fetching user XP history" });
    }
  });

  // Get user's daily activity and progress for the Level Tracker
  app.get("/api/user/:userId/daily-activity", authMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const requestingUserId = (req.user as any).id;
      const requestingUserRole = (req.user as any).role;

      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      if (userId !== requestingUserId && requestingUserRole !== 'admin') {
        return res.status(403).json({ message: "You can only view your own activity" });
      }

      const [xpHistory, pointsHistory] = await Promise.all([
        storage.getUserXPHistory(userId, 500),
        storage.getUserPointsHistory(userId, 500),
      ]);
      const today = new Date();

      const isSameDay = (d1: Date, d2: Date) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

      const todayXP = xpHistory.filter((h) => isSameDay(new Date(h.createdAt), today));
      const todayPts = pointsHistory.filter((h) => isSameDay(new Date(h.createdAt), today));

      const clipsWatchedToday = todayXP.filter((h) => h.source === "watch_clip_counted").length;
      const watch5Done = todayPts.some((h) => h.action === "watch_5_clips");
      const watch20Done = todayPts.some((h) => h.action === "watch_20_clips");
      const commentedToday = todayPts.some((h) => h.action === "comment");
      const likedToday = todayPts.some((h) => h.action === "like");
      const sharedToday = todayPts.some((h) => h.action === "share_given");
      const loginXPToday = todayPts.filter((h) => h.action === "daily_login").reduce((s, h) => s + h.points, 0);
      const streakBonusToday = todayPts.filter((h) => h.action === "streak_milestone").reduce((s, h) => s + h.points, 0);
      const lootboxOpenedToday = todayPts.some((h) => h.action === "lootbox_bonus");

      // Creator milestone statuses
      const { CreatorMilestoneService: CMS } = await import("./creator-milestone-service");
      const creatorStatus = await CMS.getCreatorMilestoneStatus(userId);

      // Streak info
      const { StreakService: SS } = await import("./streak-service");
      const streakInfo = await SS.getUserStreak(userId);

      // Current weekend status
      const { BonusEventsService: BES } = await import("./bonus-events-service");
      const isWeekend = BES.isWeekend();

      res.json({
        clipsWatchedToday,
        watch5Done,
        watch20Done,
        commentedToday,
        likedToday,
        sharedToday,
        loginXPToday,
        streakBonusToday,
        lootboxOpenedToday,
        ...creatorStatus,
        streak: streakInfo,
        isWeekend,
      });
    } catch (error) {
      console.error("Error fetching daily activity:", error);
      res.status(500).json({ message: "Error fetching daily activity" });
    }
  });

  // Admin: Feature a clip (awards +500 XP to the clip owner)
  app.post("/api/admin/featured-clip/:clipId", adminMiddleware, async (req, res) => {
    try {
      const clipId = parseInt(req.params.clipId);
      if (isNaN(clipId)) {
        return res.status(400).json({ message: "Invalid clip ID" });
      }
      const clip = await storage.getClip(clipId);
      if (!clip) {
        return res.status(404).json({ message: "Clip not found" });
      }
      await BonusEventsService.awardFeaturedClipBonus(clip.userId, clipId);
      res.json({ message: `Clip #${clipId} featured! Owner awarded +500 XP.` });
    } catch (error) {
      console.error("Error featuring clip:", error);
      res.status(500).json({ message: "Error featuring clip" });
    }
  });

  // Recalculate levels for all users based on their current XP
  app.post("/api/admin/recalculate-levels", authMiddleware, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized - Admin access required" });
      }

      const { calculateLevel } = await import("./level-system");
      const allUsers = await storage.getAllUsers();
      
      let updatedCount = 0;
      for (const user of allUsers) {
        const newLevel = calculateLevel(user.totalXP);
        if (newLevel !== user.level) {
          await storage.updateUser(user.id, { level: newLevel });
          updatedCount++;
          console.log(`Updated user ${user.username} from level ${user.level} to level ${newLevel} (${user.totalXP} XP)`);
        }
      }

      console.log(`✅ Recalculated levels for ${updatedCount} users`);
      res.json({ 
        message: `Successfully recalculated levels for ${updatedCount} users`,
        updatedCount,
        totalUsers: allUsers.length
      });
    } catch (error) {
      console.error("Error recalculating levels:", error);
      res.status(500).json({ message: "Error recalculating levels" });
    }
  });

  // Award monthly top contributor badges retroactively
  app.post("/api/admin/award-monthly-badges", authMiddleware, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized - Admin access required" });
      }

      console.log('🏆 Starting retroactive monthly badge awards...');
      
      // Get all monthly top contributors from the database
      const allMonthlyWinners = await LeaderboardService.getTopContributors('monthly', 100);
      
      let badgesAwarded = 0;
      
      for (const winner of allMonthlyWinners) {
        try {
          // Check if user already has this badge for this specific month
          const existingBadges = await storage.getUserBadges(winner.userId);
          const alreadyHasBadgeForPeriod = existingBadges.some(
            ub => ub.badgeType === 'monthly_top_contributor' && 
                  ub.createdAt && 
                  ub.createdAt.toISOString().startsWith(`${winner.year}-${winner.period.split('-')[1]}`)
          );

          if (!alreadyHasBadgeForPeriod) {
            await storage.createUserBadge({
              userId: winner.userId,
              badgeType: 'monthly_top_contributor',
              assignedBy: 'system',
              assignedById: null,
              expiresAt: null
            });
            
            badgesAwarded++;
            console.log(`🏆 Badge awarded to user ${winner.userId} for ${winner.period}`);
          }
        } catch (error) {
          console.error(`Error awarding badge to user ${winner.userId}:`, error);
        }
      }

      console.log(`✅ Awarded ${badgesAwarded} monthly top contributor badges`);
      
      res.json({ 
        message: `Successfully awarded ${badgesAwarded} monthly top contributor badges`,
        badgesAwarded,
        totalWinners: allMonthlyWinners.length
      });
    } catch (error) {
      console.error("Error awarding monthly badges:", error);
      res.status(500).json({ message: "Error awarding monthly badges" });
    }
  });

  // Get user point history (admin endpoint)
  app.get("/api/admin/users/:userId/points-history", authMiddleware, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized - Admin access required" });
      }

      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const pointsHistory = await storage.getUserPointsHistory(userId, limit);
      
      res.json(pointsHistory);
    } catch (error) {
      console.error("Error fetching user points history:", error);
      res.status(500).json({ message: "Error fetching user points history" });
    }
  });

  // Manually adjust user points (admin endpoint)
  app.post("/api/admin/users/:userId/adjust-points", authMiddleware, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized - Admin access required" });
      }

      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const { points, reason } = req.body;
      
      if (typeof points !== 'number' || !reason) {
        return res.status(400).json({ message: "Points (number) and reason (string) are required" });
      }

      // Create a manual adjustment entry in the points history
      await storage.addUserPointsHistory({
        userId,
        action: 'upload', // Using upload as the base action type
        points,
        description: `Admin Adjustment: ${reason}`
      });

      // Update monthly leaderboard
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const monthKey = `${year}-${month}`;

      const entry = await storage.getMonthlyLeaderboardEntry(userId, monthKey, year);
      if (entry) {
        await storage.updateMonthlyLeaderboardEntry(entry.id, {
          totalPoints: entry.totalPoints + points
        });
      } else {
        await storage.createMonthlyLeaderboardEntry({
          userId,
          month: monthKey,
          year,
          uploadsCount: 0,
          likesGivenCount: 0,
          commentsCount: 0,
          firesGivenCount: 0,
          viewsCount: 0,
          totalPoints: points,
        });
      }

      // Recalculate rankings
      await LeaderboardService.recalculateRankings(monthKey, year);

      console.log(`✅ Admin adjusted ${points} points for user ${userId}: ${reason}`);
      
      res.json({ 
        message: "Points adjusted successfully",
        userId,
        pointsAdjusted: points,
        reason
      });
    } catch (error) {
      console.error("Error adjusting user points:", error);
      res.status(500).json({ message: "Error adjusting user points" });
    }
  });

  // Get points system breakdown (admin endpoint)
  app.get("/api/admin/points-system", authMiddleware, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized - Admin access required" });
      }

      res.json({
        pointValues: {
          upload: 20,
          screenshot_upload: 2,
          like: 1,
          comment: 1,
          fire: 5,
          view: 0.01
        },
        description: {
          upload: "Points awarded for uploading clips or reels",
          screenshot_upload: "Points awarded for uploading screenshots",
          like: "Points awarded for liking content",
          comment: "Points awarded for commenting on content",
          fire: "Points awarded for fire reactions (permanent, 1/day for regular users, 3/day for Pro)",
          view: "Points awarded when content receives views (0.01 points per view, 1 point per 100 views)"
        }
      });
    } catch (error) {
      console.error("Error fetching points system:", error);
      res.status(500).json({ message: "Error fetching points system" });
    }
  });

  // Recalculate upload points for all historic clips and screenshots
  app.post("/api/admin/recalculate-upload-points", authMiddleware, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized - Admin access required" });
      }

      console.log('🔄 Starting recalculation of historic upload points...');
      
      // Get all clips and screenshots
      const allClips = await storage.getAllClips();
      const allScreenshots = await storage.getAllScreenshots();
      
      let clipPointsAwarded = 0;
      let screenshotPointsAwarded = 0;
      
      // Award points for each clip (5 points per upload) using the actual upload date
      for (const clip of allClips) {
        await LeaderboardService.awardPoints(
          clip.userId,
          'upload',
          `Historic Migration: ${clip.videoType === 'reel' ? 'Reel' : 'Clip'} - ${clip.title}`,
          clip.createdAt
        );
        clipPointsAwarded++;
        
        if (clipPointsAwarded % 10 === 0) {
          console.log(`Processed ${clipPointsAwarded} clips...`);
        }
      }
      
      // Award points for each screenshot (2 points per upload) using the actual upload date
      for (const screenshot of allScreenshots) {
        await LeaderboardService.awardPoints(
          screenshot.userId,
          'screenshot_upload',
          `Historic Migration: Screenshot - ${screenshot.title}`,
          screenshot.createdAt
        );
        screenshotPointsAwarded++;
        
        if (screenshotPointsAwarded % 10 === 0) {
          console.log(`Processed ${screenshotPointsAwarded} screenshots...`);
        }
      }

      const totalPointsAwarded = (clipPointsAwarded + screenshotPointsAwarded) * 5;
      console.log(`✅ Recalculated upload points: ${clipPointsAwarded} clips + ${screenshotPointsAwarded} screenshots = ${totalPointsAwarded} total points awarded`);
      
      res.json({ 
        message: `Successfully recalculated upload points for all historic content`,
        clipsProcessed: clipPointsAwarded,
        screenshotsProcessed: screenshotPointsAwarded,
        totalUploads: clipPointsAwarded + screenshotPointsAwarded,
        totalPointsAwarded
      });
    } catch (error) {
      console.error("Error recalculating upload points:", error);
      res.status(500).json({ message: "Error recalculating upload points" });
    }
  });

  // Clear historic migration points (admin only)
  app.post("/api/admin/clear-historic-points", authMiddleware, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized - Admin access required" });
      }

      console.log('🗑️ Clearing historic migration points...');
      
      // Delete all points history entries with "Historic Migration" in description
      await storage.deleteHistoricMigrationPoints();
      
      // Rebuild all leaderboard entries from scratch based on actual dates
      await storage.rebuildLeaderboards();
      
      console.log('✅ Successfully cleared historic migration points and rebuilt leaderboards');
      
      res.json({ 
        message: `Successfully cleared historic migration points and rebuilt leaderboards`
      });
    } catch (error) {
      console.error("Error clearing historic points:", error);
      res.status(500).json({ message: "Error clearing historic points" });
    }
  });

  // Recalculate all users' total points and levels from points history (admin only)
  app.post("/api/admin/recalculate-points-and-levels", authMiddleware, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized - Admin access required" });
      }

      console.log('🔄 Recalculating all users\' points and levels from points history...');
      
      // Get all users
      const allUsers = await storage.getAllUsers();
      let usersUpdated = 0;
      
      for (const user of allUsers) {
        // Get sum of all points for this user
        const pointsHistory = await storage.getUserPointsHistory(user.id, 999999);
        const totalPoints = pointsHistory.reduce((sum, entry) => sum + entry.points, 0);
        
        // Update user's totalXP field (which now stores total points)
        await storage.updateUser(user.id, { totalXP: totalPoints });
        
        // Recalculate and update level
        await LeaderboardService.updateUserLevel(user.id);
        
        usersUpdated++;
        if (usersUpdated % 10 === 0) {
          console.log(`Updated ${usersUpdated} users...`);
        }
      }
      
      console.log(`✅ Recalculated points and levels for ${usersUpdated} users`);
      
      res.json({ 
        message: `Successfully recalculated points and levels for ${usersUpdated} users`,
        usersUpdated
      });
    } catch (error) {
      console.error("Error recalculating points and levels:", error);
      res.status(500).json({ message: "Error recalculating points and levels" });
    }
  });

  // Get user by username
  app.get("/api/users/:username", async (req, res) => {
    try {
      // Block access to the gamefolio system user
      const requestedUsername = req.params.username.startsWith('@') ? req.params.username.slice(1) : req.params.username;
      if (requestedUsername.toLowerCase() === "gamefolio") {
        return res.status(403).json({ message: "ACCESS_RESTRICTED", redirect: "/" });
      }

      // Support demo user lookup
      if (req.params.username === "demo") {
        const demoUser = await storage.getUserWithStats(999);
        if (demoUser) {
          const { password, ...userWithoutPassword } = demoUser;
          return res.json(userWithoutPassword);
        } else {
          return res.json(getDemoUserWithStats());
        }
      }

      // Remove leading @ from username if present
      const username = req.params.username.startsWith('@') ? req.params.username.slice(1) : req.params.username;
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check privacy controls for private profiles
      const requesterId = req.user?.id;
      const isOwnProfile = requesterId === user.id;

      if (user.isPrivate && !isOwnProfile && requesterId) {
        const isFollowing = await storage.isFollowing(requesterId, user.id);
        if (!isFollowing) {
          return res.status(403).json({ message: "This profile is private. Follow the user to see their content." });
        }
      } else if (user.isPrivate && !isOwnProfile && !requesterId) {
        return res.status(403).json({ message: "This profile is private. Please log in and follow the user to see their content." });
      }

      // Get additional user stats
      const userWithStats = await storage.getUserWithStats(user.id);
      if (!userWithStats) {
        return res.status(404).json({ message: "User stats not found" });
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = userWithStats;
      res.json(userWithoutPassword);
    } catch (err) {
      console.error("Error fetching user:", err);
      return res.status(500).json({ message: "Error fetching user" });
    }
  });

  // Social media preview image generator
  app.get('/api/social-preview/:username', async (req: Request, res: Response) => {
    try {
      const { username } = req.params;
      console.log(`🖼️ Generating social preview for user: ${username}`);
      
      // Fetch user data
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Create canvas-like preview image using Sharp
      const width = 1200;
      const height = 630;
      const bannerHeight = 200; // Height for banner section
      
      // Create main dark background
      let finalImage = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 15, g: 23, b: 42, alpha: 1 } // Dark blue background
        }
      })
      .png()
      .toBuffer();
      
      // Add banner section at the top if user has one
      if (user.bannerUrl) {
        try {
          console.log(`🖼️ Fetching banner from: ${user.bannerUrl}`);
          const response = await fetch(user.bannerUrl);
          if (response.ok) {
            const bannerBuffer = Buffer.from(await response.arrayBuffer());
            const bannerImage = await sharp(bannerBuffer)
              .resize(width, bannerHeight, { fit: 'cover', position: 'center' })
              .png()
              .toBuffer();
            
            // Add banner to top of image
            finalImage = await sharp(finalImage)
              .composite([{
                input: bannerImage,
                left: 0,
                top: 0,
                blend: 'over'
              }])
              .png()
              .toBuffer();
          }
        } catch (error) {
          console.log('Failed to fetch banner:', error);
        }
      }
        
      // Add profile picture if available - much larger and more prominent
      if (user.avatarUrl) {
        try {
          console.log(`👤 Fetching avatar from: ${user.avatarUrl}`);
          const avatarResponse = await fetch(user.avatarUrl);
          if (avatarResponse.ok) {
            const avatarBuffer = Buffer.from(await avatarResponse.arrayBuffer());
            const profilePicSize = 180; // Much larger profile picture
            // Create circular avatar to fit inside the border
            const circularAvatar = await sharp(avatarBuffer)
              .resize(profilePicSize, profilePicSize, { fit: 'cover' })
              .composite([{
                input: Buffer.from(
                  `<svg width="${profilePicSize}" height="${profilePicSize}" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="${profilePicSize / 2}" cy="${profilePicSize / 2}" r="${profilePicSize / 2}" fill="white"/>
                  </svg>`
                ),
                blend: 'dest-in'
              }])
              .png()
              .toBuffer();
            
            // Position profile picture in the main content area (below banner)
            const profileX = 100; // Left margin
            const profileY = bannerHeight + 80; // Below banner with more margin for better banner visibility
            
            finalImage = await sharp(finalImage)
              .composite([{
                input: circularAvatar,
                left: profileX,
                top: profileY,
                blend: 'over'
              }])
              .png()
              .toBuffer();
              
            console.log(`✅ Avatar added successfully at position (${profileX}, ${profileY})`);
          } else {
            console.log(`❌ Avatar fetch failed with status: ${avatarResponse.status}`);
          }
        } catch (error) {
          console.log('Failed to process avatar image:', error);
        }
      } else {
        console.log('❌ No avatar URL provided for user');
      }
      
      // Get user stats for the preview - use direct database queries for reliability
      console.log(`🔍 Getting stats for user ID: ${user.id}`);
      
      // Get clips count directly from database
      const userClips = await storage.getClipsByUserId(user.id);
      const clipsCount = userClips?.length || 0;
      
      // Get follower counts using proper database queries
      const followersCount = await storage.getFollowerCount(user.id);
      const followingCount = await storage.getFollowingCount(user.id);
      
      console.log(`📊 User stats (direct): ${clipsCount} clips, ${followersCount} followers, ${followingCount} following`);
      
      // Get user's favorite games (max 5 for tags)
      const favoriteGames = await storage.getUserGameFavorites(user.id);
      const displayGames = favoriteGames.slice(0, 5); // Limit to 5 games
      
      // Parse user types from comma-separated string
      const userTypesString = user.userType || '';
      const userTypes = userTypesString.split(',').map(type => type.trim()).filter(Boolean);
      
      // Map user type IDs to display labels
      const userTypeLabels: Record<string, string> = {
        'streamer': 'Streamer',
        'gamer': 'Gamer', 
        'professional_gamer': 'Pro Gamer',
        'content_creator': 'Creator',
        'indie_developer': 'Indie Dev',
        'viewer': 'Viewer',
        'filthy_casual': 'Casual',
        'doom_scroller': 'Doom Scroller'
      };
      
      const displayUserTypes = userTypes.map(type => userTypeLabels[type] || type).slice(0, 2); // Limit to 2 types for space
      
      console.log(`🎮 User types: ${displayUserTypes.join(', ')}`);
      console.log(`🎯 Favorite games (${displayGames.length}): ${displayGames.map(g => g.name).join(', ')}`);
      
      // Create gamefolio-style profile layout using SVG to match the React component
      const displayName = user.displayName || user.username;
      const bio = user.bio || 'Ready to play any game!';
      
      // Calculate positions based on new layout
      const profileX = 100;
      const profileY = bannerHeight + 80;
      const profilePicSize = 180;
      
      const profileLayoutSvg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <style>
              .profile-border { fill: none; stroke: #8b5cf6; stroke-width: 6; }
              .username { fill: #ffffff; font-family: 'Arial', sans-serif; font-size: 48px; font-weight: bold; }
              .handle { fill: #9ca3af; font-family: 'Arial', sans-serif; font-size: 24px; }
              .bio-text { fill: #d1d5db; font-family: 'Arial', sans-serif; font-size: 20px; }
              .stat-number { fill: #ffffff; font-family: 'Arial', sans-serif; font-size: 32px; font-weight: bold; }
              .stat-label { fill: #9ca3af; font-family: 'Arial', sans-serif; font-size: 18px; }
              .badge-text { fill: #ffffff; font-family: 'Arial', sans-serif; font-size: 16px; font-weight: bold; }
              .gamefolio-brand { fill: #4ade80; font-family: 'Arial', sans-serif; font-size: 28px; font-weight: bold; }
            </style>
          </defs>
          
          <!-- Purple border around profile picture -->
          <circle cx="${profileX + profilePicSize/2}" cy="${profileY + profilePicSize/2}" r="${profilePicSize/2 + 8}" class="profile-border"/>
          
          <!-- Profile info section - positioned to the right of profile picture -->
          <g transform="translate(${profileX + profilePicSize + 40}, ${profileY + 20})">
            <!-- Username (much larger) with verified badge if applicable -->
            <g>
              <text x="0" y="0" class="username">${displayName}</text>
              ${user.emailVerified ? `
                <!-- Verified badge icon -->
                <image x="${displayName.length * 29}" y="-32" width="32" height="32" href="/attached_assets/green_badge_128_1758978841463.png"/>
              ` : ''}
            </g>
            <!-- Handle -->
            <text x="0" y="35" class="handle">@${user.username}</text>
            
            <!-- Bio (larger and more prominent) -->
            <text x="0" y="75" class="bio-text">${bio.length > 60 ? bio.substring(0, 60) + '...' : bio}</text>
            
            <!-- Stats in a row (aligned under bio text) -->
            <g transform="translate(0, 120)">
              <g>
                <text x="0" y="0" class="stat-number">${clipsCount}</text>
                <text x="0" y="25" class="stat-label">Clips</text>
              </g>
              <g transform="translate(120, 0)">
                <text x="0" y="0" class="stat-number">${followersCount}</text>
                <text x="0" y="25" class="stat-label">Followers</text>
              </g>
              <g transform="translate(240, 0)">
                <text x="0" y="0" class="stat-number">${followingCount}</text>
                <text x="0" y="25" class="stat-label">Following</text>
              </g>
            </g>
            
            <!-- User Type and Game badges -->
            <g transform="translate(0, 180)">
              ${displayUserTypes.map((userType, index) => {
                const width = Math.max(userType.length * 8 + 20, 80);
                const x = index === 0 ? 0 : displayUserTypes.slice(0, index).reduce((acc, type) => acc + Math.max(type.length * 8 + 20, 80) + 10, 0);
                return `
                  <rect x="${x}" y="0" width="${width}" height="32" rx="16" fill="#8b5cf6"/>
                  <text x="${x + width / 2}" y="21" class="badge-text" text-anchor="middle">${userType}</text>
                `;
              }).join('')}
              
              ${displayGames.map((game, index) => {
                const gameName = game.name.length > 10 ? game.name.substring(0, 10) + '...' : game.name;
                // Increased padding for better visual appearance (from 16 to 24 pixels total padding)
                const width = Math.max(gameName.length * 7 + 24, 85);
                const x = index === 0 ? 0 : displayGames.slice(0, index).reduce((acc, g) => {
                  const prevName = g.name.length > 10 ? g.name.substring(0, 10) + '...' : g.name;
                  return acc + Math.max(prevName.length * 7 + 24, 85) + 8;
                }, 0);
                return `
                  <rect x="${x}" y="40" width="${width}" height="28" rx="14" fill="#059669"/>
                  <text x="${x + width / 2}" y="58" class="badge-text" text-anchor="middle" style="font-size: 14px;">${gameName}</text>
                `;
              }).join('')}
              
              <!-- Gaming Platform Links -->
              ${(() => {
                // Collect available gaming platforms from user profile
                const availablePlatforms = [];
                
                if (user.steamUsername) {
                  availablePlatforms.push({ name: 'Steam', username: user.steamUsername, color: '#1B2838', icon: '⚙' });
                }
                if (user.xboxUsername) {
                  availablePlatforms.push({ name: 'Xbox', username: user.xboxUsername, color: '#107C10', icon: 'Ⓧ' });
                }
                if (user.playstationUsername) {
                  availablePlatforms.push({ name: 'PlayStation', username: user.playstationUsername, color: '#003791', icon: '▲' });
                }
                if (user.youtubeUsername) {
                  availablePlatforms.push({ name: 'YouTube', username: user.youtubeUsername, color: '#FF0000', icon: '▶' });
                }
                if (user.discordUsername) {
                  availablePlatforms.push({ name: 'Discord', username: user.discordUsername, color: '#7289DA', icon: '💬' });
                }
                if (user.epicUsername) {
                  availablePlatforms.push({ name: 'Epic', username: user.epicUsername, color: '#313131', icon: 'E' });
                }
                if (user.nintendoUsername) {
                  availablePlatforms.push({ name: 'Nintendo', username: user.nintendoUsername, color: '#E60012', icon: 'N' });
                }
                if (user.twitterUsername) {
                  availablePlatforms.push({ name: 'X', username: user.twitterUsername, color: '#1DA1F2', icon: '🐦' });
                }

                // Limit to first 6 platforms for space constraints
                const displayPlatforms = availablePlatforms.slice(0, 6);
                
                return displayPlatforms.map((platform, index) => {
                  const platformText = platform.name;
                  const width = Math.max(platformText.length * 6 + 20, 70);
                  const x = index === 0 ? 0 : displayPlatforms.slice(0, index).reduce((acc, p) => {
                    return acc + Math.max(p.name.length * 6 + 20, 70) + 6;
                  }, 0);
                  return `
                    <rect x="${x}" y="76" width="${width}" height="24" rx="12" fill="${platform.color}" opacity="0.9"/>
                    <text x="${x + width / 2}" y="91" class="badge-text" text-anchor="middle" style="font-size: 12px; fill: #ffffff;">${platform.icon} ${platformText}</text>
                  `;
                }).join('');
              })()}
            </g>
          </g>
          
        </svg>
      `;
      
      const layoutBuffer = Buffer.from(profileLayoutSvg);
      
      // Composite the profile layout onto the final image
      finalImage = await sharp(finalImage)
        .composite([{ input: layoutBuffer, blend: 'over' }])
        .png()
        .toBuffer();
      
      // Set appropriate headers for image response
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // Disable caching for testing
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      console.log(`✅ Social preview generated successfully for ${username}`);
      res.send(finalImage);
      
    } catch (error) {
      console.error('Error generating social preview image:', error);
      res.status(500).json({ error: 'Failed to generate preview image' });
    }
  });

  // OG thumbnail with play button overlay for clips/reels
  app.get('/api/og-thumbnail/:shareCode', async (req: Request, res: Response) => {
    try {
      const { shareCode } = req.params;
      console.log(`🎬 Generating OG thumbnail with play button for shareCode: ${shareCode}`);
      
      // Try to find the clip by share code
      const clip = await storage.getClipByShareCode(shareCode);
      if (!clip) {
        return res.status(404).json({ error: 'Clip not found' });
      }

      // Get the full clip with user data
      const fullClip = await storage.getClipWithUser(clip.id);
      if (!fullClip || !fullClip.thumbnailUrl) {
        return res.status(404).json({ error: 'Clip thumbnail not found' });
      }

      // Generate thumbnail with play button overlay
      const thumbnailWithPlayButton = await addPlayButtonOverlay(fullClip.thumbnailUrl);

      // Set appropriate headers for image response with long cache
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year
      console.log(`✅ OG thumbnail with play button generated for ${shareCode}`);
      res.send(thumbnailWithPlayButton);
      
    } catch (error) {
      console.error('Error generating OG thumbnail with play button:', error);
      res.status(500).json({ error: 'Failed to generate thumbnail' });
    }
  });

  // Update user profile
  app.patch("/api/users/:id", authMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);

      // Ensure the user is updating their own profile
      if (req.user?.id !== userId && req.user?.id !== 999) {
        return res.status(403).json({ message: "You can only update your own profile" });
      }

      // Validate text content for profanity and inappropriate language
      const validationErrors: string[] = [];

      if (req.body.displayName) {
        const validation = await contentFilterService.validateContent(req.body.displayName, 'displayName');
        if (!validation.isValid) {
          validationErrors.push(`Display Name: ${validation.errors.join(', ')}`);
        } else if (validation.filteredContent) {
          // Use cleaned content if automatic cleaning was applied
          req.body.displayName = validation.filteredContent;
        }
      }

      if (req.body.bio) {
        const validation = await contentFilterService.validateContent(req.body.bio, 'bio');
        if (!validation.isValid) {
          validationErrors.push(`Bio: ${validation.errors.join(', ')}`);
        } else if (validation.filteredContent) {
          // Use cleaned content if automatic cleaning was applied
          req.body.bio = validation.filteredContent;
        }
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: "Profile contains inappropriate content",
          errors: validationErrors
        });
      }

      // Only allow safe profile fields to be updated via this route.
      // Sensitive/system fields (gfTokenBalance, isPro, level, totalXP, etc.)
      // are managed by dedicated server-side routes only.
      const ALLOWED_PROFILE_FIELDS = new Set([
        "username", "displayName", "bio", "userType", "location", "website",
        "dateOfBirth", "avatarUrl", "bannerUrl", "activeProfilePicType",
        "avatarBorderColor", "primaryColor", "secondaryColor", "accentColor",
        "backgroundColor", "cardColor", "layoutStyle", "showUserType",
        "profileFont", "profileFontEffect", "profileFontAnimation", "profileFontColor",
        "profileBackgroundType", "profileBackgroundTheme", "profileBackgroundAnimation", "profileBackgroundImageUrl",
        "profileBackgroundPositionX", "profileBackgroundPositionY",
        "profileBackgroundZoom", "profileBackgroundDesktopX", "profileBackgroundDesktopY", "profileBackgroundDesktopZoom",
        "hideBanner",
        "steamUsername", "xboxUsername", "playstationUsername",
        "discordUsername", "epicUsername", "twitchUsername", "youtubeUsername",
        "twitterUsername", "instagramUsername", "facebookUsername", "nintendoUsername",
      ]);
      const safeBody = Object.fromEntries(
        Object.entries(req.body).filter(([key]) => ALLOWED_PROFILE_FIELDS.has(key))
      );

      // Handle demo user separately
      if (userId === 999) {
        console.log("Updating demo user with data:", safeBody);
        // For demo user, actually update the in-memory demo user data
        const updatedDemoUser = await storage.updateUser(userId, safeBody);
        if (updatedDemoUser) {
          console.log("Demo user updated successfully, new banner URL:", updatedDemoUser.bannerUrl);
          const { password, ...userWithoutPassword } = updatedDemoUser;
          return res.json(userWithoutPassword);
        } else {
          return res.status(404).json({ message: "Demo user not found" });
        }
      }

      // Update the user profile
      const updatedUser = await storage.updateUser(userId, safeBody);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (err) {
      return handleValidationError(err, res);
    }
  });

  // Upload avatar
  app.post("/api/upload/avatar", authMiddleware, upload.single("avatar"), async (req, res) => {
    try {
      console.log('Avatar upload request received');
      console.log('User authenticated:', req.isAuthenticated());
      console.log('Request user:', req.user);
      console.log('File received:', !!req.file);

      if (!req.user) {
        console.log('No authenticated user');
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userId = req.user.id;

      // Handle demo user specially - still process the file but store it locally
      if (userId === 999) {
        console.log('Handling demo user avatar upload');

        if (!req.file) {
          console.log('No file in request for demo user');
          return res.status(400).json({ message: "No file uploaded" });
        }

        console.log('Processing demo user file:', req.file.filename);

        // Process avatar with sharp for demo user
        const avatarBuffer = await sharp(req.file.path)
          .resize(400, 400, { fit: 'cover' })
          .jpeg({ quality: 85 })
          .toBuffer();

        // For demo user, save to attached_assets directory
        const avatarFileName = `demo_avatar_${Date.now()}.jpg`;
        const avatarPath = path.join('attached_assets', avatarFileName);

        // Ensure attached_assets directory exists
        const attachedAssetsDir = path.join(process.cwd(), 'attached_assets');
        if (!fs.existsSync(attachedAssetsDir)) {
          fs.mkdirSync(attachedAssetsDir, { recursive: true });
        }

        // Write the processed avatar
        await fsPromises.writeFile(path.join(process.cwd(), avatarPath), avatarBuffer);

        const avatarUrl = `/attached_assets/${avatarFileName}`;

        // Update demo user's avatar in storage
        await storage.updateUser(userId, { avatarUrl });

        // Clean up temp file
        try {
          await fsPromises.unlink(req.file.path);
        } catch (error) {
          console.warn('Could not delete temp demo avatar file:', error);
        }

        console.log('Demo user avatar upload successful:', avatarUrl);

        return res.json({
          avatarUrl,
          message: "Avatar uploaded successfully for demo user"
        });
      }

      if (!req.file) {
        console.log('No file in request');
        return res.status(400).json({ message: "No file uploaded" });
      }

      console.log('Processing file:', req.file.filename);

      // Check if file is a GIF and user is Pro
      const isGif = req.file.mimetype === 'image/gif' || req.file.originalname.toLowerCase().endsWith('.gif');
      const user = await storage.getUser(userId);
      const isPro = user?.isPro === true;
      
      let avatarBuffer: Buffer;
      let fileName: string;
      let mimeType: string;
      
      if (isGif && isPro) {
        // Pro users can keep GIF avatars - preserve animation
        console.log('Processing GIF avatar for Pro user - preserving animation');
        
        // Read the original GIF file directly to preserve animation
        avatarBuffer = await fsPromises.readFile(req.file.path);
        fileName = `avatar-${userId}-${Date.now()}.gif`;
        mimeType = 'image/gif';
      } else if (isGif && !isPro) {
        // Non-Pro users trying to upload GIF - convert to static image
        console.log('Non-Pro user tried to upload GIF - converting to static JPEG');
        avatarBuffer = await sharp(req.file.path)
          .resize(400, 400, { fit: 'cover' })
          .jpeg({ quality: 85 })
          .toBuffer();
        fileName = `avatar-${userId}-${Date.now()}.jpg`;
        mimeType = 'image/jpeg';
      } else {
        // Regular image processing for non-GIF files
        avatarBuffer = await sharp(req.file.path)
          .resize(400, 400, { fit: 'cover' })
          .jpeg({ quality: 85 })
          .toBuffer();
        fileName = `avatar-${userId}-${Date.now()}.jpg`;
        mimeType = 'image/jpeg';
      }

      const { url: avatarUrl } = await supabaseStorage.uploadBuffer(
        avatarBuffer,
        fileName,
        mimeType,
        'image',
        userId
      );

      const updatedUser = await storage.updateUser(userId, {
        avatarUrl: avatarUrl,
        activeProfilePicType: 'upload',
      });

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user avatar" });
      }

      console.log('Avatar upload successful:', avatarUrl);

      // Clean up local file
      try {
        await fsPromises.unlink(req.file.path);
      } catch (error) {
        console.warn('Could not delete local avatar file:', error);
      }

      // Return the new URL
      res.json({
        avatarUrl,
        message: "Avatar uploaded successfully"
      });
    } catch (err) {
      console.error("Error uploading avatar:", err);
      return res.status(500).json({ message: "Error uploading avatar" });
    }
  });


  // Check username availability (must come before parameterized routes)
  app.get("/api/check-username/:username", async (req, res) => {
    try {
      const { username } = req.params;

      if (!username || username.length < 3) {
        return res.status(400).json({ available: false, message: "Username must be at least 3 characters" });
      }

      const existingUser = await storage.getUserByUsername(username);

      if (existingUser) {
        // Username is taken
        return res.status(200).json({ available: false, message: "Username is already taken" });
      } else {
        // Username is available
        return res.status(200).json({ available: true, message: "Username is available" });
      }
    } catch (error) {
      console.error("Error checking username availability:", error);
      return res.status(500).json({ available: false, message: "Error checking username availability" });
    }
  });

  // Upload profile image
  app.post("/api/users/:id/profile-image", authMiddleware, upload.single("profileImage"), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);

      // Ensure the user is updating their own profile
      if (req.user?.id !== userId && req.user?.id !== 999) {
        return res.status(403).json({ message: "You can only update your own profile" });
      }

      // Handle demo user separately
      if (userId === 999) {
        // For demo user, pretend the update succeeded but don't actually update anything
        const demoUser = getDemoUser();
        const { password, ...userWithoutPassword } = demoUser;
        return res.json({
          ...userWithoutPassword,
          profileImageUrl: req.file?.path?.replace(/\\/g, "/").replace("uploads/", "/uploads/")
        });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Format the file path for use in URLs
      const imageUrl = req.file.path.replace(/\\/g, "/").replace("uploads/", "/uploads/");

      // Update the user profile with the new image URL
      const updatedUser = await storage.updateUser(userId, {
        avatarUrl: imageUrl
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (err) {
      console.error("Error uploading profile image:", err);
      return res.status(500).json({ message: "Error uploading profile image" });
    }
  });

  // Get user's clips
  app.get("/api/users/:username/clips", async (req, res) => {
    try {
      // Remove leading @ from username if present
      const username = req.params.username.startsWith('@') ? req.params.username.slice(1) : req.params.username;
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if profile is private and user is not following
      const requesterId = req.user?.id;
      const isOwnProfile = requesterId === user.id;

      if (user.isPrivate && !isOwnProfile && requesterId) {
        const isFollowing = await storage.isFollowing(requesterId, user.id);
        if (!isFollowing) {
          return res.status(403).json({ message: "This profile is private. Follow the user to see their content." });
        }
      } else if (user.isPrivate && !isOwnProfile && !requesterId) {
        return res.status(403).json({ message: "This profile is private. Please log in and follow the user to see their content." });
      }

      // Get actual clips from database for all users including demo
      const clips = await storage.getClipsByUserId(user.id);

      // For demo user, also include the demo clips if no real clips exist
      if (req.params.username === "demo" && clips.length === 0) {
        return res.json(getDemoClips());
      }

      res.json(clips);
    } catch (err) {
      console.error("Error fetching user clips:", err);
      return res.status(500).json({ message: "Error fetching user clips" });
    }
  });

  // ==========================================
  // Game Routes
  // ==========================================

  // Get all games
  app.get("/api/games", async (req, res) => {
    try {
      const userAdded = req.query.userAdded === 'true';
      const games = await storage.getAllGames();
      if (userAdded) {
        return res.json(games.filter(g => g.isUserAdded));
      }
      res.json(games);
    } catch (err) {
      console.error("Error fetching games:", err);
      return res.status(500).json({ message: "Error fetching games" });
    }
  });

  // Admin: Get all games with optional search
  app.get("/api/admin/games", adminMiddleware, async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      let allGames = await storage.getAllGames();
      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        allGames = allGames.filter(g => g.name.toLowerCase().includes(term));
      }
      res.json(allGames);
    } catch (err) {
      console.error("Error fetching admin games:", err);
      res.status(500).json({ message: "Error fetching games" });
    }
  });

  // Admin: Create a game
  app.post("/api/admin/games", adminMiddleware, async (req, res) => {
    try {
      const { name, imageUrl, isUserAdded, twitchId } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: "Game name is required" });
      }
      const existing = await storage.getGameByName(name.trim());
      if (existing) {
        return res.status(409).json({ message: "A game with this name already exists" });
      }
      const game = await storage.createGame({
        name: name.trim(),
        imageUrl: imageUrl || '/favicon.png',
        twitchId: twitchId || null,
        isUserAdded: isUserAdded ?? true,
      });
      res.status(201).json(game);
    } catch (err: any) {
      console.error("Error creating admin game:", err);
      if (err.code === '23505') {
        return res.status(409).json({ message: "A game with this name already exists" });
      }
      res.status(500).json({ message: "Error creating game" });
    }
  });

  // Admin: Update a game
  app.patch("/api/admin/games/:id", adminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid game ID" });

      const { name, imageUrl, twitchId, isUserAdded, showContactBanner } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
      if (twitchId !== undefined) updateData.twitchId = twitchId || null;
      if (isUserAdded !== undefined) updateData.isUserAdded = isUserAdded;
      if (showContactBanner !== undefined) updateData.showContactBanner = showContactBanner;

      const game = await storage.updateGame(id, updateData);
      if (!game) return res.status(404).json({ message: "Game not found" });
      res.json(game);
    } catch (err: any) {
      console.error("Error updating admin game:", err);
      if (err.code === '23505') {
        return res.status(409).json({ message: "A game with this name already exists" });
      }
      res.status(500).json({ message: "Error updating game" });
    }
  });

  // Admin: Delete a game
  app.delete("/api/admin/games/:id", adminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid game ID" });

      const deleted = await storage.deleteGame(id);
      if (!deleted) return res.status(404).json({ message: "Game not found" });
      res.json({ message: "Game deleted successfully" });
    } catch (err) {
      console.error("Error deleting admin game:", err);
      res.status(500).json({ message: "Error deleting game" });
    }
  });

  // Get or create game by slug (for Twitch games that don't exist in database yet)
  app.get("/api/games/slug/:slug", async (req, res) => {
    try {
      const gameSlug = req.params.slug;

      // Try to find game in database first
      const games = await storage.getAllGames();
      const normalizedSlug = gameSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
      let game = games.find((g: any) =>
        g.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedSlug
      );

      if (game) {
        return res.json(game);
      }

      // If not found in database, try to find on Twitch and create it
      try {
        // Convert slug back to a searchable name (best effort)
        const searchName = gameSlug.replace(/-/g, ' ');
        const twitchGames = await twitchApi.searchGames(searchName);

        if (twitchGames && twitchGames.length > 0) {
          // Find the best match (exact name match or first result)
          const twitchGame = twitchGames[0];

          // Create the game in database - use higher resolution for crisp display
          const newGame = await storage.createGame({
            name: twitchGame.name,
            imageUrl: twitchGame.box_art_url.replace('{width}x{height}', '600x800'),
            twitchId: twitchGame.id
          });

          return res.json(newGame);
        }
      } catch (twitchErr) {
        console.warn("Could not fetch from Twitch:", twitchErr);
      }

      return res.status(404).json({ message: "Game not found" });
    } catch (err) {
      console.error("Error getting/creating game:", err);
      return res.status(500).json({ message: "Error getting game" });
    }
  });

  // Get trending games
  app.get("/api/games/trending", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const games = await storage.getTrendingGames(limit);
      res.json(games);
    } catch (err) {
      console.error("Error fetching trending games:", err);
      return res.status(500).json({ message: "Error fetching trending games" });
    }
  });

  // Get game by ID
  app.get("/api/games/:id", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      if (isNaN(gameId)) {
        return res.status(400).json({ message: "Invalid game ID" });
      }
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      res.json(game);
    } catch (err) {
      console.error("Error fetching game:", err);
      return res.status(500).json({ message: "Error fetching game" });
    }
  });

  // Get screenshot by ID
  app.get("/api/screenshots/:id", async (req, res) => {
    try {
      const screenshotId = parseInt(req.params.id);
      if (isNaN(screenshotId)) {
        return res.status(400).json({ message: "Invalid screenshot ID" });
      }

      const screenshot = await storage.getScreenshot(screenshotId);
      if (!screenshot) {
        return res.status(404).json({ message: "Screenshot not found" });
      }

      // Get user data for the screenshot
      const user = await storage.getUser(screenshot.userId);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        screenshot.user = userWithoutPassword;
      }

      res.json(screenshot);
    } catch (err) {
      console.error("Error fetching screenshot:", err);
      return res.status(500).json({ message: "Error fetching screenshot" });
    }
  });

  // Get screenshot by shareCode
  app.get("/api/screenshots/share/:shareCode", async (req, res) => {
    try {
      const { shareCode } = req.params;
      if (!shareCode) {
        return res.status(400).json({ message: "Invalid share code" });
      }

      const screenshot = await storage.getScreenshotByShareCode(shareCode);
      if (!screenshot) {
        return res.status(404).json({ message: "Screenshot not found" });
      }

      // Get user data for the screenshot
      const user = await storage.getUser(screenshot.userId);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        screenshot.user = userWithoutPassword;
      }

      res.json(screenshot);
    } catch (err) {
      console.error("Error fetching screenshot by shareCode:", err);
      return res.status(500).json({ message: "Error fetching screenshot" });
    }
  });

  // Get clips for a game (supports both internal IDs and Twitch IDs)
  app.get("/api/games/:id/clips", async (req, res) => {
    try {
      const gameIdParam = req.params.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 4;

      let gameId: number | null = null;

      // Try to parse as integer first (internal ID)
      const parsedId = parseInt(gameIdParam);
      if (!isNaN(parsedId)) {
        // Check if game exists with this internal ID
        const game = await storage.getGame(parsedId);
        if (game) {
          gameId = parsedId;
        }
      }

      // If not found by internal ID, try to find by Twitch ID
      if (gameId === null) {
        const gameByTwitchId = await storage.getGameByTwitchId(gameIdParam);
        if (gameByTwitchId) {
          gameId = gameByTwitchId.id;
        }
      }

      if (gameId === null) {
        return res.status(404).json({ message: "Game not found" });
      }

      let clips = await storage.getClipsByGameId(gameId, limit);

      // Also include clips with relevant hashtags
      // Get the game name to search for hashtag variations
      const game = await storage.getGame(gameId);
      if (game) {
        const gameName = game.name.toLowerCase();
        const gameNameNoSpaces = gameName.replace(/\s+/g, '');
        const gameHashtag = `#${gameNameNoSpaces}`;

        // Search for additional clips with hashtags
        const hashtagClips = await storage.searchClips(gameHashtag);

        // Merge clips and remove duplicates
        const clipIds = new Set(clips.map(c => c.id));
        for (const hashtagClip of hashtagClips) {
          if (!clipIds.has(hashtagClip.id)) {
            clips.push(hashtagClip);
            clipIds.add(hashtagClip.id);
          }
        }

        // Sort by views and limit
        clips = clips
          .sort((a, b) => (b.views || 0) - (a.views || 0))
          .slice(0, limit);
      }

      res.json(clips);
    } catch (err) {
      console.error("Error fetching game clips:", err);
      return res.status(500).json({ message: "Error fetching game clips" });
    }
  });

  // Search games
  app.get("/api/games/search/:query", async (req, res) => {
    try {
      const games = await storage.searchGames(req.params.query);
      res.json(games);
    } catch (err) {
      console.error("Error searching games:", err);
      return res.status(500).json({ message: "Error searching games" });
    }
  });

  // ==========================================
  // Clip Routes
  // ==========================================

  // Get recent clip uploads for activity banner
  app.get("/api/recent-uploads", async (req, res) => {
    try {
      const limit = 15;
      const clips = await storage.getAllClips(limit, 0);
      
      const recentUploads = clips
        .filter(clip => clip.user && clip.title)
        .map(clip => ({
          clipId: clip.id,
          username: clip.user.username,
          clipTitle: clip.title,
          uploadedAt: clip.createdAt,
        }));
      
      res.json(recentUploads);
    } catch (err) {
      console.error("Error fetching recent uploads:", err);
      return res.status(500).json({ message: "Error fetching recent uploads" });
    }
  });

  // Get all clips (latest first)
  app.get("/api/clips", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      const currentUserId = (req.user as any)?.id;
      console.log('🔍 Latest clips API: currentUserId =', currentUserId);
      
      // Force no caching for privacy-sensitive content
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const clips = await storage.getAllClips(limit, offset, currentUserId);
      res.json(clips);
    } catch (err) {
      console.error("Error fetching clips:", err);
      return res.status(500).json({ message: "Error fetching clips" });
    }
  });

  // Get clips by hashtag
  app.get("/api/clips/hashtag/:hashtag", async (req, res) => {
    try {
      const { hashtag } = req.params;
      const clips = await storage.getClipsByHashtag(hashtag);
      res.json(clips);
    } catch (err) {
      console.error("Error fetching clips by hashtag:", err);
      return res.status(500).json({ message: "Error fetching clips by hashtag" });
    }
  });


  // Get all clips feed
  app.get("/api/clips/feed", async (req, res) => {
    try {
      const period = (req.query.period as string) || "day";
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const clips = await storage.getFeedClips(period, limit);
      res.json(clips);
    } catch (err) {
      console.error("Error fetching clips feed:", err);
      return res.status(500).json({ message: "Error fetching clips feed" });
    }
  });

  // Trending clips route
  app.get("/api/clips/trending", async (req, res) => {
    try {
      const { period = 'all', limit = 10, gameId } = req.query;
      const currentUserId = (req.user as any)?.id;
      console.log('🔍 Trending clips API: currentUserId =', currentUserId, 'period =', period, 'session user:', req.user);
      
      // Force no caching for privacy-sensitive content
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const clips = await storage.getTrendingClips(
        period as string,
        parseInt(limit as string) || 10,
        gameId ? parseInt(gameId as string) : undefined,
        currentUserId
      );
      res.json(clips);
    } catch (err) {
      console.error("Error fetching trending clips:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Trending reels route (compatible with home page's /api/clips/reels/trending)
  app.get("/api/clips/reels/trending", async (req, res) => {
    try {
      const { period = 'day', limit = 10, gameId } = req.query;
      const currentUserId = (req.user as any)?.id;
      const reels = await storage.getTrendingReels(
        period as string,
        parseInt(limit as string) || 10,
        gameId ? parseInt(gameId as string) : undefined,
        currentUserId
      );
      res.json(reels);
    } catch (err) {
      console.error("Error fetching trending reels:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Latest reels route (newest uploaded reels)
  app.get("/api/reels/latest", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 6;
      const currentUserId = (req.user as any)?.id;
      const reels = await storage.getLatestReels(limit, currentUserId);
      res.json(reels);
    } catch (err) {
      console.error("Error fetching latest reels:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Trending reels route
  app.get("/api/reels/trending", async (req, res) => {
    try {
      const { period = 'day', limit = 10, gameId } = req.query;
      const currentUserId = (req.user as any)?.id;
      const reels = await storage.getTrendingReels(
        period as string,
        parseInt(limit as string) || 10,
        gameId ? parseInt(gameId as string) : undefined,
        currentUserId
      );
      const reelsWithSignedThumbnails = await Promise.all(
        reels.map(async (reel) => {
          if (reel.thumbnailUrl) {
            const signedUrl = await supabaseStorage.convertToSignedUrl(reel.thumbnailUrl, 3600);
            return { ...reel, thumbnailUrl: signedUrl || reel.thumbnailUrl };
          }
          return reel;
        })
      );
      res.json(reelsWithSignedThumbnails);
    } catch (err) {
      console.error("Error fetching trending reels:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Comprehensive Trending API endpoints for the trending page

  // Trending clips by likes
  app.get("/api/trending/clips/likes", async (req, res) => {
    try {
      const { period = 'recent', limit = 20, gameId } = req.query;
      const clips = await storage.getTrendingClipsByLikes(
        period as string,
        parseInt(limit as string) || 20,
        gameId ? parseInt(gameId as string) : undefined
      );
      res.json(clips);
    } catch (err) {
      console.error("Error fetching trending clips by likes:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Trending clips by comments
  app.get("/api/trending/clips/comments", async (req, res) => {
    try {
      const { period = 'recent', limit = 20, gameId } = req.query;
      const clips = await storage.getTrendingClipsByComments(
        period as string,
        parseInt(limit as string) || 20,
        gameId ? parseInt(gameId as string) : undefined
      );
      res.json(clips);
    } catch (err) {
      console.error("Error fetching trending clips by comments:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Trending reels by likes
  app.get("/api/trending/reels/likes", async (req, res) => {
    try {
      const { period = 'recent', limit = 20, gameId } = req.query;
      const reels = await storage.getTrendingReelsByLikes(
        period as string,
        parseInt(limit as string) || 20,
        gameId ? parseInt(gameId as string) : undefined
      );
      res.json(reels);
    } catch (err) {
      console.error("Error fetching trending reels by likes:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Trending reels by comments
  app.get("/api/trending/reels/comments", async (req, res) => {
    try {
      const { period = 'recent', limit = 20, gameId } = req.query;
      const reels = await storage.getTrendingReelsByComments(
        period as string,
        parseInt(limit as string) || 20,
        gameId ? parseInt(gameId as string) : undefined
      );
      res.json(reels);
    } catch (err) {
      console.error("Error fetching trending reels by comments:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Trending screenshots (for now by views, will extend to likes/comments when schema supports it)
  app.get("/api/trending/screenshots", async (req, res) => {
    try {
      const { period = 'recent', limit = 20, gameId } = req.query;
      const screenshots = await storage.getTrendingScreenshots(
        period as string,
        parseInt(limit as string) || 20,
        gameId ? parseInt(gameId as string) : undefined
      );
      res.json(screenshots);
    } catch (err) {
      console.error("Error fetching trending screenshots:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // General screenshots endpoint (supports filtering by game and time period)
  app.get("/api/screenshots", async (req, res) => {
    try {
      const { period = 'recent', limit = 20, gameId } = req.query;
      const screenshots = await storage.getTrendingScreenshots(
        period as string,
        parseInt(limit as string) || 20,
        gameId ? parseInt(gameId as string) : undefined
      );
      res.json(screenshots);
    } catch (err) {
      console.error("Error fetching screenshots:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Game categories route
  app.get("/api/games/categories", async (req, res) => {
    try {
      const categories = await storage.getGameCategories();
      res.json(categories);
    } catch (err) {
      console.error("Error fetching game categories:", err);
      res.status(500).json({ message: "Error fetching game" });
    }
  });

  // Search clips
  app.get("/api/clips/search/:query", async (req, res) => {
    try {
      const clips = await storage.searchClips(req.params.query);
      res.json(clips);
    } catch (err) {
      console.error("Error searching clips:", err);
      return res.status(500).json({ message: "Error searching clips" });
    }
  });

  // Get clip by ID - used by ClipPage component
  app.get("/api/clips/:id", async (req, res) => {
    const { id } = req.params;

    console.log(`🎬 Clips API: Getting clip ${id}`);

    try {
      const clip = await storage.getClipById(parseInt(id));

      if (!clip) {
        console.log(`❌ Clips API: Clip ${id} not found`);
        return res.status(404).json({ error: "Clip not found" });
      }

      console.log(`✅ Clips API: Found clip ${id}: "${clip.title}"`);
      console.log(`🔍 Clip user data:`, clip.user ? `User ID: ${clip.user.id}, Username: ${clip.user.username}` : 'No user data');
      res.json(clip);
    } catch (error) {
      console.error(`❌ Clips API: Error getting clip ${id}:`, error);
      res.status(500).json({ error: "Failed to get clip" });
    }
  });

  // Get reel by shareCode - MUST come before /api/reels/:id to avoid route conflicts
  app.get("/api/reels/share/:shareCode", async (req, res) => {
    try {
      const shareCode = req.params.shareCode;
      console.log(`🎥 Reels API: Getting reel by shareCode ${shareCode}`);

      const clip = await storage.getClipByShareCode(shareCode);
      if (!clip) {
        console.log(`❌ Reels API: Reel with shareCode ${shareCode} not found`);
        return res.status(404).json({ message: "Reel not found" });
      }

      // Ensure this is actually a reel
      if (clip.videoType !== 'reel') {
        console.log(`❌ Reels API: Content with shareCode ${shareCode} is not a reel, it's a ${clip.videoType}`);
        return res.status(404).json({ message: "Reel not found" });
      }

      // Get full clip with user data
      const fullClip = await storage.getClipById(clip.id);
      if (!fullClip) {
        return res.status(404).json({ message: "Reel not found" });
      }

      console.log(`✅ Reels API: Found reel by shareCode ${shareCode}: "${fullClip.title}"`);
      res.json(fullClip);
    } catch (err) {
      console.error(`❌ Reels API: Error getting reel by shareCode ${req.params.shareCode}:`, err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get reel by ID - alias for clips API for consistency
  app.get("/api/reels/:id", async (req, res) => {
    try {
      const reelId = parseInt(req.params.id);
      console.log(`🎥 Reels API: Getting reel ${reelId}`);

      if (isNaN(reelId)) {
        console.log(`❌ Reels API: Invalid reel ID: ${req.params.id}`);
        return res.status(400).json({ message: "Invalid reel ID" });
      }

      const reel = await storage.getClip(reelId);
      if (!reel) {
        console.log(`❌ Reels API: Reel ${reelId} not found`);
        return res.status(404).json({ message: "Reel not found" });
      }

      // Ensure this is actually a reel
      if (reel.videoType !== 'reel') {
        console.log(`❌ Reels API: Content ${reelId} is not a reel, it's a ${reel.videoType}`);
        return res.status(404).json({ message: "Reel not found" });
      }

      console.log(`✅ Reels API: Found reel ${reelId}: "${reel.title}"`);
      res.json(reel);
    } catch (err) {
      console.error(`❌ Reels API: Error getting reel ${req.params.id}:`, err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get personalized recommended clips for authenticated user
  app.get("/api/recommended-clips", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 8;
      const recommendedClips = await storage.getRecommendedClips(userId, limit);
      
      res.json(recommendedClips);
    } catch (err) {
      console.error("Error fetching recommended clips:", err);
      return res.status(500).json({ message: "Error fetching recommended clips" });
    }
  });

  // Get clip by shareCode - used for nice URLs like /@username/clip/shareCode
  app.get("/api/clips/share/:shareCode", async (req, res) => {
    try {
      const shareCode = req.params.shareCode;
      console.log(`🎬 Clips API: Getting clip by shareCode ${shareCode}`);

      const clip = await storage.getClipByShareCode(shareCode);
      if (!clip) {
        console.log(`❌ Clips API: Clip with shareCode ${shareCode} not found`);
        return res.status(404).json({ message: "Clip not found" });
      }

      // Get full clip with user data
      const fullClip = await storage.getClipById(clip.id);
      if (!fullClip) {
        return res.status(404).json({ message: "Clip not found" });
      }

      console.log(`✅ Clips API: Found clip by shareCode ${shareCode}: "${fullClip.title}"`);
      res.json(fullClip);
    } catch (err) {
      console.error(`❌ Clips API: Error getting clip by shareCode ${req.params.shareCode}:`, err);
      res.status(500).json({ message: "Internal server error" });
    }
  });


  // Generate QR code and social media links for existing clip
  app.get("/api/clips/:id/share", async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);
      let clip = await storage.getClipWithUser(clipId);

      // Handle demo clips (IDs 10000+) that are generated from uploaded files
      if (!clip && clipId >= 10000) {
        // Import demo clips dynamically
        const demoUserModule = await import('./demo-user');
        const demoClips = demoUserModule.getDemoClips();
        const demoClip = demoClips.find((c: any) => c.id === clipId);

        if (demoClip) {
          clip = demoClip;
        }
      }

      if (!clip) {
        return res.status(404).json({ message: "Clip not found" });
      }

      // Get username for URL
      const username = clip.user?.username || 'unknown';

      // Use production domain for share URLs
      const baseUrl = 'https://app.gamefolio.com';

      // Ensure clip has a share code - generate one if missing
      if (!clip.shareCode) {
        const shareCode = generateShareCode();
        await storage.updateClip(clipId, { shareCode });
        clip.shareCode = shareCode;
      }

      // Always use username-based URL format with alphanumeric share code
      const clipUrl = `${baseUrl}/@${username}/clip/${clip.shareCode}`;

      const qrCodeDataUrl = await QRCode.toDataURL(clipUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#10b981',
          light: '#ffffff'
        },
        width: 256
      });

      // Get user info for personalized sharing
      const userResult = await db.select({
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl
      }).from(users).where(eq(users.id, clip.userId)).limit(1);

      const user = userResult[0];
      const gamefolioProfileUrl = `${baseUrl}/profile/${user.username}`;
      const displayName = user.displayName || user.username;

      // Generate social media sharing links with personalized messaging
      const socialMediaLinks = {
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          `🎮 Check out this epic gaming clip from ${displayName}'s Gamefolio! Visit their profile for more amazing content: ${gamefolioProfileUrl}`
        )}&url=${encodeURIComponent(clipUrl)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(clipUrl)}&quote=${encodeURIComponent(
          `🎮 Amazing gaming clip from ${displayName}'s Gamefolio! Check out their profile: ${gamefolioProfileUrl}`
        )}`,
        reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(clipUrl)}&title=${encodeURIComponent(
          `🎮 Epic gaming clip from ${displayName}'s Gamefolio!`
        )}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(clipUrl)}&summary=${encodeURIComponent(
          `🎮 Check out this gaming clip from ${displayName}'s Gamefolio: ${gamefolioProfileUrl}`
        )}`,
        whatsapp: `https://wa.me/?text=${encodeURIComponent(
          `🎮 Check out this epic gaming clip from ${displayName}'s Gamefolio! ${clipUrl} - See more on their profile: ${gamefolioProfileUrl}`
        )}`,
        telegram: `https://t.me/share/url?url=${encodeURIComponent(clipUrl)}&text=${encodeURIComponent(
          `🎮 Epic gaming clip from ${displayName}'s Gamefolio! Check out their profile: ${gamefolioProfileUrl}`
        )}`,
        discord: clipUrl,
        email: `mailto:?subject=${encodeURIComponent(
          `🎮 Amazing gaming clip from ${displayName}'s Gamefolio!`
        )}&body=${encodeURIComponent(
          `Hey! I wanted to share this awesome gaming clip from ${displayName}'s Gamefolio with you:\n\n${clipUrl}\n\nYou can also check out their full gaming profile here: ${gamefolioProfileUrl}\n\nGamefolio is where gamers share their best moments!`
        )}`
      };

      res.json({
        clipId,
        qrCode: qrCodeDataUrl,
        socialMediaLinks,
        shareUrl: clipUrl,
        clipUrl,
        title: clip.title,
        description: clip.description,
        thumbnailUrl: clip.thumbnailUrl || null,
        videoUrl: clip.videoUrl || null,
        videoType: clip.videoType || 'clip'
      });
    } catch (err) {
      console.error("Error generating share data:", err);
      return res.status(500).json({ message: "Error generating share data" });
    }
  });

  // Track a share action for a clip — awards share_given XP to sharer (once/day) and share_received to owner
  app.post("/api/clips/:id/track-share", optionalHybridAuth, async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);
      if (isNaN(clipId)) return res.status(400).json({ message: "Invalid clip ID" });

      const sharerId = (req.user as any)?.id;
      if (!sharerId) return res.json({ awarded: false });

      const clip = await storage.getClip(clipId);
      if (!clip) return res.status(404).json({ message: "Clip not found" });

      // Award share_given XP to sharer (once per day)
      const recentPts = await storage.getUserPointsHistory(sharerId, 200);
      const today = new Date();
      const isSameDay = (d1: Date, d2: Date) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

      const sharedToday = recentPts.some(
        (h) => h.action === "share_given" && isSameDay(new Date(h.createdAt), today)
      );

      if (!sharedToday) {
        await LeaderboardService.awardPoints(sharerId, 'share_given', `Shared clip #${clipId}`);
      }

      // Award share_received XP to clip owner (no daily limit — each share counts)
      if (clip.userId !== sharerId) {
        await LeaderboardService.awardCustomPoints(
          clip.userId,
          'share_received',
          40,
          `Clip #${clipId} was shared`
        );
      }

      res.json({ awarded: !sharedToday });
    } catch (err) {
      console.error("Error tracking clip share:", err);
      res.status(500).json({ message: "Error tracking share" });
    }
  });

  // Track a share action for a screenshot
  app.post("/api/screenshots/:id/track-share", optionalHybridAuth, async (req, res) => {
    try {
      const screenshotId = parseInt(req.params.id);
      if (isNaN(screenshotId)) return res.status(400).json({ message: "Invalid screenshot ID" });

      const sharerId = (req.user as any)?.id;
      if (!sharerId) return res.json({ awarded: false });

      const screenshot = await storage.getScreenshot(screenshotId);
      if (!screenshot) return res.status(404).json({ message: "Screenshot not found" });

      const recentPts = await storage.getUserPointsHistory(sharerId, 200);
      const today = new Date();
      const isSameDay = (d1: Date, d2: Date) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

      const sharedToday = recentPts.some(
        (h) => h.action === "share_given" && isSameDay(new Date(h.createdAt), today)
      );

      if (!sharedToday) {
        await LeaderboardService.awardPoints(sharerId, 'share_given', `Shared screenshot #${screenshotId}`);
      }

      if (screenshot.userId !== sharerId) {
        await LeaderboardService.awardCustomPoints(
          screenshot.userId,
          'share_received',
          40,
          `Screenshot #${screenshotId} was shared`
        );
      }

      res.json({ awarded: !sharedToday });
    } catch (err) {
      console.error("Error tracking screenshot share:", err);
      res.status(500).json({ message: "Error tracking share" });
    }
  });

  // Clips now use Supabase Storage directly - thumbnails are served from database thumbnailUrl field

  // Create new clip
  app.post("/api/clips", fullAccessMiddleware, upload.single("video"), async (req, res) => {
    try {
      console.log('Upload request received');
      console.log('User authenticated:', req.isAuthenticated());
      console.log('Request user:', req.user);
      console.log('File received:', !!req.file);
      console.log('Request body keys:', Object.keys(req.body));

      if (!req.file) {
        console.log('No file in request');
        return res.status(400).json({ message: "No video file uploaded" });
      }

      // Check if user exists
      if (!req.user) {
        console.log('No user in request');
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Check email verification (except for demo user)
      if (!req.user.emailVerified && req.user.username !== "demo") {
        console.log('User email not verified');
        return res.status(403).json({
          message: "Email verification required. Please verify your email address to upload clips."
        });
      }

      const userId = req.user.id;
      console.log('Processing upload for user ID:', userId);

      // Upload video to Supabase storage
      console.log('Uploading video to Supabase storage...');
      const { url: supabaseVideoUrl, path: supabaseVideoPath } = await supabaseStorage.uploadFile(
        req.file,
        'video',
        userId
      );

      console.log('Video uploaded to Supabase:', supabaseVideoUrl);
      const videoUrl = supabaseVideoUrl;

      let gameId = req.body.gameId ? parseInt(req.body.gameId) : null;
      let gameName = "";
      let gameImageUrl = "";

      // Process game info - first try using the provided game ID
      if (gameId) {
        try {
          const game = await storage.getGame(gameId);
          if (game) {
            gameName = game.name;
            gameImageUrl = game.imageUrl || "";
          } else {
            // If the provided game ID doesn't exist, we'll create a new one
            gameId = null;
          }
        } catch (error) {
          console.error("Error fetching game data:", error);
          gameId = null;
        }
      }

      // If no game ID or the game doesn't exist, try to use the Twitch API
      if (!gameId && req.body.gameName) {
        try {
          const gameQuery = req.body.gameName;

          if (gameQuery) {
            // Use Twitch API service like the rest of the application
            const twitchGames = await twitchApi.searchGames(gameQuery);

            if (twitchGames && twitchGames.length > 0) {
              const twitchGame = twitchGames[0];

              // Check if the game already exists in our database
              let existingGame = await storage.getGameByName(twitchGame.name);

              if (!existingGame) {
                // Create the game in our database using Twitch data - use higher resolution for crisp display
                existingGame = await storage.createGame({
                  name: twitchGame.name,
                  imageUrl: twitchGame.box_art_url.replace('{width}', '600').replace('{height}', '800'),
                  twitchId: twitchGame.id
                });
              }

              gameId = existingGame.id;
              gameName = existingGame.name;
              gameImageUrl = existingGame.imageUrl || "";
            }
          }
        } catch (error) {
          console.error("Error using Twitch API:", error);
        }
      }

      // If we still don't have a game ID, create a default one
      if (!gameId && req.body.gameName) {
        try {
          // Check if a game with this name already exists
          let existingGame = await storage.getGameByName(req.body.gameName);

          if (!existingGame) {
            // Create a default game
            existingGame = await storage.createGame({
              name: req.body.gameName,
              imageUrl: "",
            });
          }

          gameId = existingGame.id;
          gameName = existingGame.name;
          gameImageUrl = existingGame.imageUrl || "";
        } catch (error) {
          console.error("Error creating default game:", error);
        }
      }

      // Validate text content for profanity and inappropriate language
      const title = req.body.title || "Untitled Clip";
      const description = req.body.description || "";

      const validationErrors: string[] = [];

      const titleValidation = await contentFilterService.validateTitle(title);
      if (!titleValidation.isValid) {
        validationErrors.push(`Title: ${titleValidation.errors.join(', ')}`);
      }

      if (description) {
        const descriptionValidation = await contentFilterService.validateDescription(description);
        if (!descriptionValidation.isValid) {
          validationErrors.push(`Description: ${descriptionValidation.errors.join(', ')}`);
        }
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: "Clip content contains inappropriate language",
          errors: validationErrors
        });
      }

      // Parse tags if they exist
      let tags = [];
      if (req.body.tags) {
        try {
          tags = JSON.parse(req.body.tags);
        } catch (error) {
          console.error("Error parsing tags:", error);
        }
      }

      // Create the clip (initially without thumbnail)
      console.log('🔞 Age Restriction Debug - Backend received:', {
        ageRestricted: req.body.ageRestricted,
        ageRestrictedType: typeof req.body.ageRestricted,
        evaluation: req.body.ageRestricted === 'true' || req.body.ageRestricted === true
      });
      
      const clipData = {
        userId,
        title,
        description,
        videoUrl,
        thumbnailUrl: null as string | null, // Will be set after thumbnail generation
        gameId: gameId || null,
        gameName: gameName || null,
        gameImageUrl: gameImageUrl || null,
        filter: req.body.filter || "none",
        tags: tags,
        duration: req.body.duration ? parseInt(req.body.duration) : 0,
        trimStart: req.body.trimStart ? parseInt(req.body.trimStart) : 0,
        trimEnd: req.body.trimEnd ? parseInt(req.body.trimEnd) : 30,
        videoType: req.body.videoType || "clip", // "clip" or "reel"
        ageRestricted: req.body.ageRestricted === 'true' || req.body.ageRestricted === true,
        shareCode: generateShareCode(), // This generates 8-character alphanumeric codes
      };

      // Create the clip
      const clip = await storage.createClip(clipData);

      // Award upload points to the user
      await LeaderboardService.awardPoints(
        userId,
        'upload',
        `Upload: ${clipData.videoType === 'reel' ? 'Reel' : 'Clip'} - ${title}`
      );

      // Weekend upload bonus (+50% XP on Sat/Sun)
      await BonusEventsService.awardWeekendUploadBonus(userId, 200);

      // Creator milestones: first upload of the day + weekly milestones
      await CreatorMilestoneService.checkFirstUploadOfDay(userId);
      await CreatorMilestoneService.checkWeeklyUploadMilestones(userId);

      // Consecutive upload bonus (uploaded within 24h of last upload)
      await BonusEventsService.checkConsecutiveUploadBonus(userId);
      
      // Get updated user data to return current XP and level
      const updatedUser = await storage.getUserById(userId);

      // Parse mentions from clip title and description and create mention records
      const titleMentions = await mentionService.parseMentions(title);
      const descriptionMentions = description ? await mentionService.parseMentions(description) : [];
      const allMentions = [...titleMentions, ...descriptionMentions];
      
      if (allMentions.length > 0) {
        const mentionedUserIds = Array.from(new Set(allMentions.map(mention => mention.userId)));
        await mentionService.createClipMentions(
          clip.id,
          mentionedUserIds,
          userId,
          title
        );
      }

      // Process video with trimming and thumbnail generation
      console.log(`Starting video processing for clip ${clip.id}`);
      try {
        const trimStart = req.body.trimStart ? parseFloat(req.body.trimStart) : 0;
        const trimEnd = req.body.trimEnd ? parseFloat(req.body.trimEnd) : 30; // Default 30 second clip if no trim end specified

        console.log(`Trimming video from ${trimStart}s to ${trimEnd}s`);

        // Check if user provided a custom thumbnail
        const userThumbnailUrl = req.body.thumbnailUrl;
        let finalThumbnailUrl: string;

        if (userThumbnailUrl && userThumbnailUrl.startsWith('data:image/')) {
          // User selected a custom thumbnail - upload it to Supabase
          console.log("Processing user-selected thumbnail");

          try {
            // Extract base64 data and format info
            const matches = userThumbnailUrl.match(/^data:image\/([a-z]+);base64,(.+)$/);
            if (!matches) {
              throw new Error('Invalid thumbnail data format');
            }

            const [, imageFormat, base64Data] = matches;
            const buffer = Buffer.from(base64Data, 'base64');

            console.log(`Processing user thumbnail: ${imageFormat} format, ${buffer.length} bytes`);

            // Upload thumbnail to Supabase
            const { url: thumbnailUrl } = await supabaseStorage.uploadBuffer(
              buffer,
              `thumb_${clip.id}.jpg`,
              'image/jpeg',
              'thumbnail',
              userId
            );

            finalThumbnailUrl = thumbnailUrl;
            console.log(`User thumbnail uploaded to Supabase: ${finalThumbnailUrl}`);
          } catch (thumbnailError) {
            console.error("Error uploading user thumbnail:", thumbnailError);
            // Fall back to auto-generated thumbnail
            const { videoUrl, thumbnailUrl, duration: fallbackDuration } = await VideoProcessor.processVideo(
              req.file.path,
              clip.id,
              trimStart,
              trimEnd,
              true,
              userId,
              clipData.videoType as 'clip' | 'reel'
            );
            finalThumbnailUrl = thumbnailUrl;
            // Note: In this fallback path, the video is processed twice,
            // but the duration from the second process will be used
          }

          // Process video without generating new thumbnail
          const { videoUrl, duration } = await VideoProcessor.processVideo(
            req.file.path,
            clip.id,
            trimStart,
            trimEnd,
            false,
            userId,
            clipData.videoType as 'clip' | 'reel'
          );

          console.log(`Video processed successfully. Video: ${videoUrl}, Thumbnail: ${finalThumbnailUrl}, Duration: ${duration}s`);

          // Update the clip with the processed video, user thumbnail URLs, and actual duration
          const updatedClip = await storage.updateClip(clip.id, {
            videoUrl,
            thumbnailUrl: finalThumbnailUrl,
            trimStart,
            trimEnd,
            duration
          });

          // Generate QR code and social media links
          try {
            const username = req.user?.username || 'unknown';
            const contentType = clipData.videoType === 'reel' ? 'reel' : 'clip';
            const qrCodeDataUrl = await generateContentQRCode(clipData.shareCode || clip.shareCode || '', username, contentType);
            const socialMediaLinks = generateSocialMediaLinks(clipData.shareCode || clip.shareCode || '', username, clip.title, clip.description, contentType);

            res.status(201).json({
              ...updatedClip,
              qrCode: qrCodeDataUrl,
              socialMediaLinks,
              xpGained: 5, // Upload XP reward
              userXP: updatedUser?.totalXP || 0,
              userLevel: updatedUser?.level || 1
            });
          } catch (qrError) {
            console.error('Error generating QR code or social links:', qrError);
            // Return without QR code if generation fails
            res.status(201).json({ 
              ...updatedClip, 
              xpGained: 5,
              userXP: updatedUser?.totalXP || 0,
              userLevel: updatedUser?.level || 1
            });
          }
        } else {
          // No custom thumbnail - use auto-generated one with multiple options
          const { videoUrl, thumbnailUrl, thumbnailOptions, duration } = await VideoProcessor.processVideo(
            req.file.path,
            clip.id,
            trimStart,
            trimEnd,
            true,
            userId,
            clipData.videoType as 'clip' | 'reel'
          );

          console.log(`Video processed successfully. Video: ${videoUrl}, Thumbnail: ${thumbnailUrl}, Duration: ${duration}s`);

          // Update the clip with the processed video, thumbnail URLs, and actual duration
          const updatedClip = await storage.updateClip(clip.id, {
            videoUrl,
            thumbnailUrl,
            trimStart,
            trimEnd,
            duration
          });

          // Generate QR code and social media links
          try {
            const username = req.user?.username || 'unknown';
            const contentType = clipData.videoType === 'reel' ? 'reel' : 'clip';
            const qrCodeDataUrl = await generateContentQRCode(clipData.shareCode || clip.shareCode || '', username, contentType);
            const socialMediaLinks = generateSocialMediaLinks(clipData.shareCode || clip.shareCode || '', username, clip.title, clip.description, contentType);

            res.status(201).json({
              ...updatedClip,
              qrCode: qrCodeDataUrl,
              socialMediaLinks,
              thumbnailOptions: thumbnailOptions || [],
              xpGained: 5, // Upload XP reward
              userXP: updatedUser?.totalXP || 0,
              userLevel: updatedUser?.level || 1
            });
          } catch (qrError) {
            console.error('Error generating QR code or social links:', qrError);
            // Return without QR code if generation fails
            res.status(201).json({
              ...updatedClip,
              thumbnailOptions: thumbnailOptions || [],
              xpGained: 5, // Upload XP reward
              userXP: updatedUser?.totalXP || 0,
              userLevel: updatedUser?.level || 1
            });
          }
        }
      } catch (processingError) {
        console.error("Error processing video:", processingError);
        console.log("Falling back to original video without processing");
        // Return the clip with original video if processing fails
        res.status(201).json({ 
          ...clip, 
          xpGained: 5,
          userXP: updatedUser?.totalXP || 0,
          userLevel: updatedUser?.level || 1
        });
      } finally {
        // Clean up temporary file
        try {
          if (req.file?.path) {
            await fsPromises.unlink(req.file.path);
          }
        } catch (cleanupError) {
          console.warn("Could not clean up temporary file:", cleanupError);
        }
      }
    } catch (err) {
      console.error("Error creating clip:", err);
      return handleValidationError(err, res);
    }
  });

  // Update clip
  app.patch("/api/clips/:id", authMiddleware, async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);
      const clip = await storage.getClip(clipId);

      if (!clip) {
        return res.status(404).json({ message: "Clip not found" });
      }

      // Ensure the user is updating their own clip
      if (req.user?.id !== clip.userId && req.user?.id !== 999) {
        return res.status(403).json({ message: "You can only update your own clips" });
      }

      // Update the clip
      const updatedClip = await storage.updateClip(clipId, req.body);

      if (!updatedClip) {
        return res.status(404).json({ message: "Clip not found" });
      }

      res.json(updatedClip);
    } catch (err) {
      return handleValidationError(err, res);
    }
  });

  // Delete clip
  app.delete("/api/clips/:id", authMiddleware, async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);
      const clip = await storage.getClip(clipId);

      if (!clip) {
        return res.status(404).json({ message: "Clip not found" });
      }

      // Ensure the user is deleting their own clip
      if (req.user?.id !== clip.userId && req.user?.id !== 999) {
        return res.status(403).json({ message: "You can only delete your own clips" });
      }

      // Delete the clip from Supabase storage
      if (clip.videoUrl) {
        try {
          await supabaseStorage.deleteFile(clip.videoUrl);
        } catch (error) {
          console.warn("Could not delete video file from Supabase:", error);
        }
      }

      // Delete the thumbnail from Supabase storage
      if (clip.thumbnailUrl) {
        try {
          await supabaseStorage.deleteFile(clip.thumbnailUrl);
        } catch (error) {
          console.warn("Could not delete thumbnail file from Supabase:", error);
        }
      }

      // Delete the clip from the database
      const success = await storage.deleteClip(clipId);

      if (!success) {
        return res.status(500).json({ message: "Failed to delete clip" });
      }

      // Deduct upload points (5 XP for clips/reels)
      await LeaderboardService.deductPoints(
        clip.userId,
        'upload',
        `Deleted: ${clip.videoType === 'reel' ? 'Reel' : 'Clip'} - ${clip.title}`
      );

      res.status(200).json({ message: "Clip deleted successfully" });
    } catch (err) {
      console.error("Error deleting clip:", err);
      return res.status(500).json({ message: "Error deleting clip" });
    }
  });

  // Pin/unpin clip
  app.patch("/api/clips/:id/pin", authMiddleware, async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);
      const clip = await storage.getClip(clipId);

      if (!clip) {
        return res.status(404).json({ message: "Clip not found" });
      }

      // Ensure the user is pinning their own clip
      if (req.user?.id !== clip.userId) {
        return res.status(403).json({ message: "You can only pin your own clips" });
      }

      // Toggle pin state
      const pinnedAt = clip.pinnedAt ? null : new Date();
      const updatedClip = await storage.updateClip(clipId, { pinnedAt });

      if (!updatedClip) {
        return res.status(404).json({ message: "Failed to update clip" });
      }

      res.json(updatedClip);
    } catch (err) {
      console.error("Error pinning clip:", err);
      return res.status(500).json({ message: "Error pinning clip" });
    }
  });

  // Get clip thumbnail - returns signed URL redirect for private Supabase thumbnails
  app.get("/api/clips/:id/thumbnail", async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);
      const clip = await storage.getClip(clipId);

      if (!clip) {
        return res.status(404).json({ message: "Clip not found" });
      }

      if (clip.thumbnailUrl) {
        const signedUrl = await supabaseStorage.convertToSignedUrl(clip.thumbnailUrl, 3600);
        if (signedUrl) {
          return res.redirect(signedUrl);
        }
      }

      return res.status(404).json({ message: "Thumbnail not available" });
    } catch (error) {
      console.error("Error getting clip thumbnail:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update clip thumbnail
  app.put("/api/clips/:id/thumbnail", authMiddleware, async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);
      const { thumbnailUrl } = req.body;

      if (!thumbnailUrl) {
        return res.status(400).json({ message: "Thumbnail URL is required" });
      }

      // Get the clip to check ownership
      const clip = await storage.getClip(clipId);
      if (!clip) {
        return res.status(404).json({ message: "Clip not found" });
      }

      // Check if user owns this clip
      if (!req.user || (clip.userId !== req.user.id && req.user.id !== 999)) {
        return res.status(403).json({ message: "Not authorized to update this clip" });
      }

      // Update the thumbnail
      const updatedClip = await storage.updateClip(clipId, { thumbnailUrl });

      res.json(updatedClip);
    } catch (error) {
      console.error("Error updating clip thumbnail:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Upload custom thumbnail for clip
  app.post("/api/clips/:id/thumbnail", authMiddleware, upload.single("thumbnail"), async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);

      if (!req.file) {
        return res.status(400).json({ message: "No thumbnail file uploaded" });
      }

      // Get the clip to check ownership
      const clip = await storage.getClip(clipId);
      if (!clip) {
        return res.status(404).json({ message: "Clip not found" });
      }

      // Check if user owns this clip
      if (!req.user || (clip.userId !== req.user.id && req.user.id !== 999)) {
        return res.status(403).json({ message: "Not authorized to update this clip" });
      }

      // Upload thumbnail to Supabase
      const { url: thumbnailUrl } = await supabaseStorage.uploadFile(
        req.file,
        'thumbnail',
        req.user.id
      );

      // Update the clip with new thumbnail
      const updatedClip = await storage.updateClip(clipId, { thumbnailUrl });

      res.json({ thumbnailUrl, clip: updatedClip });
    } catch (error) {
      console.error("Error uploading custom thumbnail:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==========================================
  // Comment Routes
  // ==========================================

  // Get comments for a clip
  app.get("/api/clips/:id/comments", async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);
      if (isNaN(clipId)) {
        return res.status(400).json({ error: "Invalid clip ID" });
      }

      const comments = await storage.getCommentsByClipId(clipId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching clip comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  // Add comment to a clip
  app.post("/api/clips/:id/comments", hybridEmailVerification, async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);

      // Check if the clip exists
      const clip = await storage.getClip(clipId);
      if (!clip) {
        return res.status(404).json({ message: "Clip not found" });
      }

      // Check email verification (except for demo user)
      if (!req.user?.emailVerified && req.user?.username !== "demo") {
        return res.status(403).json({
          message: "Email verification required. Please verify your email address to comment."
        });
      }

      // Validate content for profanity and inappropriate language
      const contentValidation = await contentFilterService.validateContent(req.body.content, 'comment');

      if (!contentValidation.isValid) {
        return res.status(400).json({
          message: "Comment contains inappropriate content",
          errors: contentValidation.errors
        });
      }

      // Use cleaned content if automatic cleaning was applied
      if (contentValidation.filteredContent) {
        req.body.content = contentValidation.filteredContent;
      }

      // Validate and create the comment
      const commentData = insertCommentSchema.parse({
        clipId,
        userId: req.user?.id,
        content: req.body.content,
      });

      const comment = await storage.createComment(commentData);

      // Award points to the commenter
      await LeaderboardService.awardPoints(
        req.user!.id,
        'comment',
        `Commented on clip #${clipId}`
      );

      // Award comment_received XP to the clip owner (if different from commenter)
      const commentedClip = await storage.getClip(clipId);
      if (commentedClip && commentedClip.userId !== req.user!.id) {
        await LeaderboardService.awardCustomPoints(
          commentedClip.userId,
          'comment_received',
          20,
          `Received a comment on clip #${clipId}`
        );
      }

      // Parse mentions from comment content and create mention records
      const mentions = await mentionService.parseMentions(req.body.content);
      if (mentions.length > 0) {
        const mentionedUserIds = mentions.map(mention => mention.userId);
        await mentionService.createCommentMentions(
          comment.id,
          mentionedUserIds,
          req.user!.id,
          clipId
        );
      }

      // Create notification for the clip owner
      await NotificationService.createCommentNotification(clipId, req.user!.id, req.body.content, comment.id);

      res.status(201).json(comment);
    } catch (err) {
      return handleValidationError(err, res);
    }
  });

  // Delete comment
  app.delete("/api/clips/:clipId/comments/:id", authMiddleware, async (req, res) => {
    try {
      const commentId = parseInt(req.params.id);
      const comment = await storage.getComment(commentId);

      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      // Ensure the user is deleting their own comment
      if (req.user?.id !== comment.userId && req.user?.id !== 999) {
        return res.status(403).json({ message: "You can only delete your own comments" });
      }

      // Delete the comment
      const success = await storage.deleteComment(commentId);

      if (!success) {
        return res.status(500).json({ message: "Failed to delete comment" });
      }

      res.status(200).json({ message: "Comment deleted successfully" });
    } catch (err) {
      console.error("Error deleting comment:", err);
      return res.status(500).json({ message: "Error deleting comment" });
    }
  });

  // Like a clip comment
  app.post("/api/comments/:id/like", authMiddleware, async (req, res) => {
    try {
      const commentId = parseInt(req.params.id);
      const userId = req.user!.id;

      // Check if already liked
      const hasLiked = await storage.hasUserLikedComment(commentId, userId);
      if (hasLiked) {
        return res.status(400).json({ message: "Already liked this comment" });
      }

      await storage.likeComment(commentId, userId);
      const likeCount = await storage.getCommentLikeCount(commentId);
      
      res.status(200).json({ liked: true, likeCount });
    } catch (err) {
      console.error("Error liking comment:", err);
      return res.status(500).json({ message: "Error liking comment" });
    }
  });

  // Unlike a clip comment
  app.delete("/api/comments/:id/like", authMiddleware, async (req, res) => {
    try {
      const commentId = parseInt(req.params.id);
      const userId = req.user!.id;

      await storage.unlikeComment(commentId, userId);
      const likeCount = await storage.getCommentLikeCount(commentId);
      
      res.status(200).json({ liked: false, likeCount });
    } catch (err) {
      console.error("Error unliking comment:", err);
      return res.status(500).json({ message: "Error unliking comment" });
    }
  });

  // Get comment like status
  app.get("/api/comments/:id/like", optionalHybridAuth, async (req, res) => {
    try {
      const commentId = parseInt(req.params.id);
      const userId = req.user?.id;

      const likeCount = await storage.getCommentLikeCount(commentId);
      const hasLiked = userId ? await storage.hasUserLikedComment(commentId, userId) : false;
      
      res.status(200).json({ hasLiked, likeCount });
    } catch (err) {
      console.error("Error getting comment like status:", err);
      return res.status(500).json({ message: "Error getting comment like status" });
    }
  });

  // Like a screenshot comment
  app.post("/api/screenshot-comments/:id/like", authMiddleware, async (req, res) => {
    try {
      const commentId = parseInt(req.params.id);
      const userId = req.user!.id;

      // Check if already liked
      const hasLiked = await storage.hasUserLikedScreenshotComment(commentId, userId);
      if (hasLiked) {
        return res.status(400).json({ message: "Already liked this comment" });
      }

      await storage.likeScreenshotComment(commentId, userId);
      const likeCount = await storage.getScreenshotCommentLikeCount(commentId);
      
      res.status(200).json({ liked: true, likeCount });
    } catch (err) {
      console.error("Error liking screenshot comment:", err);
      return res.status(500).json({ message: "Error liking screenshot comment" });
    }
  });

  // Unlike a screenshot comment
  app.delete("/api/screenshot-comments/:id/like", authMiddleware, async (req, res) => {
    try {
      const commentId = parseInt(req.params.id);
      const userId = req.user!.id;

      await storage.unlikeScreenshotComment(commentId, userId);
      const likeCount = await storage.getScreenshotCommentLikeCount(commentId);
      
      res.status(200).json({ liked: false, likeCount });
    } catch (err) {
      console.error("Error unliking screenshot comment:", err);
      return res.status(500).json({ message: "Error unliking screenshot comment" });
    }
  });

  // Get screenshot comment like status
  app.get("/api/screenshot-comments/:id/like", optionalHybridAuth, async (req, res) => {
    try {
      const commentId = parseInt(req.params.id);
      const userId = req.user?.id;

      const likeCount = await storage.getScreenshotCommentLikeCount(commentId);
      const hasLiked = userId ? await storage.hasUserLikedScreenshotComment(commentId, userId) : false;
      
      res.status(200).json({ hasLiked, likeCount });
    } catch (err) {
      console.error("Error getting screenshot comment like status:", err);
      return res.status(500).json({ message: "Error getting screenshot comment like status" });
    }
  });

  // Screenshot sharing route
  app.get("/api/screenshots/:id/share", async (req, res) => {
    try {
      const screenshotId = parseInt(req.params.id);
      const screenshot = await storage.getScreenshot(screenshotId);

      if (!screenshot) {
        return res.status(404).json({ message: "Screenshot not found" });
      }

      // Get user information for username
      const user = await storage.getUser(screenshot.userId);
      const username = user?.username || 'unknown';

      // Use production domain for share URLs
      const baseUrl = 'https://app.gamefolio.com';

      // Generate proper share URL with username and share code
      const screenshotUrl = screenshot.shareCode
        ? `${baseUrl}/@${username}/screenshot/${screenshot.shareCode}`
        : `${baseUrl}/screenshots/${screenshotId}`;

      const qrCodeDataUrl = await QRCode.toDataURL(screenshotUrl);

      // Get user info for personalized sharing
      const userResult = await db.select({
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl
      }).from(users).where(eq(users.id, screenshot.userId)).limit(1);

      const shareUser = userResult[0];
      const gamefolioProfileUrl = `${baseUrl}/profile/${shareUser.username}`;
      const displayName = shareUser.displayName || shareUser.username;

      // Generate social media sharing links for screenshot with personalized messaging
      const socialMediaLinks = {
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          `📸 Check out this epic gaming screenshot from ${displayName}'s Gamefolio! Visit their profile for more amazing content: ${gamefolioProfileUrl}`
        )}&url=${encodeURIComponent(screenshotUrl)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(screenshotUrl)}&quote=${encodeURIComponent(
          `📸 Amazing gaming screenshot from ${displayName}'s Gamefolio! Check out their profile: ${gamefolioProfileUrl}`
        )}`,
        reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(screenshotUrl)}&title=${encodeURIComponent(
          `📸 Epic gaming screenshot from ${displayName}'s Gamefolio!`
        )}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(screenshotUrl)}&summary=${encodeURIComponent(
          `📸 Check out this gaming screenshot from ${displayName}'s Gamefolio: ${gamefolioProfileUrl}`
        )}`,
        whatsapp: `https://wa.me/?text=${encodeURIComponent(
          `📸 Check out this epic gaming screenshot from ${displayName}'s Gamefolio! ${screenshotUrl} - See more on their profile: ${gamefolioProfileUrl}`
        )}`,
        telegram: `https://t.me/share/url?url=${encodeURIComponent(screenshotUrl)}&text=${encodeURIComponent(
          `📸 Epic gaming screenshot from ${displayName}'s Gamefolio! Check out their profile: ${gamefolioProfileUrl}`
        )}`,
        discord: screenshotUrl,
        email: `mailto:?subject=${encodeURIComponent(
          `📸 Amazing gaming screenshot from ${displayName}'s Gamefolio!`
        )}&body=${encodeURIComponent(
          `Hey! I wanted to share this awesome gaming screenshot from ${displayName}'s Gamefolio with you:\n\n${screenshotUrl}\n\nYou can also check out their full gaming profile here: ${gamefolioProfileUrl}\n\nGamefolio is where gamers share their best moments!`
        )}`
      };

      res.json({
        screenshotId,
        qrCode: qrCodeDataUrl,
        socialMediaLinks,
        screenshotUrl,
        imageUrl: screenshot.imageUrl, // Add the actual image URL for preview
        title: screenshot.title,
        description: screenshot.description || ""
      });
    } catch (err) {
      console.error("Error generating screenshot sharing data:", err);
      return res.status(500).json({ message: "Error generating sharing data" });
    }
  });

  // ==========================================
  // Like Routes
  // ==========================================

  // Get likes for a clip
  app.get("/api/clips/:id/likes", async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);
      if (isNaN(clipId)) {
        return res.status(400).json({ error: "Invalid clip ID" });
      }
      const likes = await storage.getLikesByClipId(clipId);
      res.json(likes);
    } catch (err) {
      console.error("Error fetching likes:", err);
      return res.status(500).json({ message: "Error fetching likes" });
    }
  });

  // Check if user has liked a clip
  app.get("/api/clips/:id/likes/status", hybridEmailVerification, async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);
      if (isNaN(clipId)) {
        return res.status(400).json({ error: "Invalid clip ID" });
      }

      const userId = req.user!.id;
      const hasLiked = await storage.hasUserLikedClip(userId, clipId);
      res.json({ hasLiked });
    } catch (error) {
      console.error("Error checking like status:", error);
      res.status(500).json({ error: "Failed to check like status" });
    }
  });

  app.get("/api/clips/:id/reactions/status", hybridAuth, async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);
      if (isNaN(clipId)) {
        return res.status(400).json({ error: "Invalid clip ID" });
      }
      const userId = req.user!.id;
      const existingReaction = await storage.getUserClipReaction(userId, clipId, '🔥');
      res.json({ hasFired: !!existingReaction });
    } catch (error) {
      console.error("Error checking clip fire status:", error);
      res.status(500).json({ error: "Failed to check fire status" });
    }
  });

  // Check if user has liked a screenshot
  app.get("/api/screenshots/:id/likes/status", emailVerificationMiddleware, async (req, res) => {
    try {
      const screenshotId = parseInt(req.params.id);
      if (isNaN(screenshotId)) {
        return res.status(400).json({ error: "Invalid screenshot ID" });
      }

      const userId = req.user!.id;
      const hasLiked = await storage.hasUserLikedScreenshot(userId, screenshotId);
      res.json({ hasLiked });
    } catch (error) {
      console.error("Error checking screenshot like status:", error);
      res.status(500).json({ error: "Failed to check like status" });
    }
  });

  // Like/unlike clip (toggle behavior like screenshots)
  app.post("/api/clips/:id/likes", hybridEmailVerification, async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);
      if (isNaN(clipId)) {
        return res.status(400).json({ error: "Invalid clip ID" });
      }

      const userId = req.user!.id;
      
      // Check if the clip exists
      const clip = await storage.getClip(clipId);
      if (!clip) {
        return res.status(404).json({ message: "Clip not found" });
      }

      // Prevent users from liking their own content
      if (clip.userId === userId) {
        return res.status(400).json({ message: "Cannot like your own content, casual!" });
      }

      // Check if user already liked this clip
      const hasLiked = await storage.hasUserLikedClip(userId, clipId);

      if (hasLiked) {
        // Unlike the clip
        await storage.deleteLike(userId, clipId);
        
        // Get actual like count after deletion
        const likes = await storage.getLikesByClipId(clipId);
        const likeCount = likes.length;
        
        res.json({ message: "Clip unliked", liked: false, count: likeCount });
      } else {
        // Like the clip
        const likeData = insertLikeSchema.parse({
          clipId,
          userId,
        });
        const like = await storage.createLike(likeData);

        // Award points to the user for liking (only if they haven't earned points for this clip before)
        const hasEarnedPoints = await storage.hasUserEarnedPointsForContent(userId, 'like', 'clip', clipId);
        if (!hasEarnedPoints) {
          await LeaderboardService.awardPoints(
            userId,
            'like',
            `Liked clip #${clipId}`
          );
          // Award like_received XP to the clip owner
          const likedClip = await storage.getClip(clipId);
          if (likedClip && likedClip.userId !== userId) {
            await LeaderboardService.awardCustomPoints(
              likedClip.userId,
              'like_received',
              10,
              `Received a like on clip #${clipId}`
            );
          }
        }

        // Create notification for the clip owner
        await NotificationService.createLikeNotification(clipId, userId);

        // Get actual like count after adding
        const likes = await storage.getLikesByClipId(clipId);
        const likeCount = likes.length;

        res.status(201).json({ message: "Clip liked", liked: true, like, count: likeCount });
      }
    } catch (error) {
      console.error("Error toggling clip like:", error);
      res.status(500).json({ error: "Failed to toggle like" });
    }
  });

  // Keep DELETE endpoint for backward compatibility
  app.delete("/api/clips/:id/likes", hybridEmailVerification, async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);
      if (isNaN(clipId)) {
        return res.status(400).json({ error: "Invalid clip ID" });
      }

      const userId = req.user!.id;
      // Check if the user has liked this clip
      const hasLiked = await storage.hasUserLikedClip(userId, clipId);
      if (!hasLiked) {
        return res.status(400).json({ message: "You have not liked this clip" });
      }

      // Delete the like
      const success = await storage.deleteLike(userId, clipId);

      if (!success) {
        return res.status(500).json({ message: "Failed to unlike clip" });
      }

      res.status(200).json({ message: "Clip unliked successfully", liked: false });
    } catch (error) {
      console.error("Error unliking clip:", error);
      res.status(500).json({ error: "Failed to unlike clip" });
    }
  });

  // ==========================================
  // Clip Reactions Routes
  // ==========================================

  // Get reactions for a clip
  app.get("/api/clips/:id/reactions", async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);
      if (isNaN(clipId)) {
        return res.status(400).json({ error: "Invalid clip ID" });
      }
      const reactions = await storage.getClipReactions(clipId);
      res.json(reactions);
    } catch (err) {
      console.error("Error fetching clip reactions:", err);
      return res.status(500).json({ message: "Error fetching clip reactions" });
    }
  });

  // Add reaction to a clip (fire reactions are permanent, limited daily, and worth 5 points)
  app.post("/api/clips/:id/reactions", hybridEmailVerification, async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);
      const userId = req.user!.id;
      const emoji = req.body.emoji;

      // Check if the clip exists
      const clip = await storage.getClip(clipId);
      if (!clip) {
        return res.status(404).json({ message: "Clip not found" });
      }

      // Prevent users from reacting to their own content
      if (clip.userId === userId) {
        return res.status(400).json({ message: "Cannot react to your own content, casual!" });
      }

      // Check email verification (except for demo user)
      if (!req.user?.emailVerified && req.user?.username !== "demo") {
        return res.status(403).json({
          message: "Email verification required. Please verify your email address to add reactions."
        });
      }

      // Check if user already has this reaction on this clip
      const existingReaction = await storage.getUserClipReaction(userId, clipId, emoji);
      
      if (existingReaction) {
        // Fire reactions cannot be removed
        if (emoji === '🔥') {
          return res.status(400).json({ 
            message: "Fire reactions are permanent and cannot be removed",
            reacted: true
          });
        }
        
        // Other reactions can be toggled off
        await storage.deleteClipReaction(existingReaction.id);
        
        const reactions = await storage.getClipReactions(clipId);
        const count = reactions.filter(r => r.emoji === emoji).length;
        
        return res.json({ 
          message: "Reaction removed", 
          reacted: false, 
          count,
          removedReactionId: existingReaction.id 
        });
      }

      // For fire reactions, check daily limit
      if (emoji === '🔥') {
        const fireLimits = await storage.getFireLimits(userId);
        
        if (!fireLimits.canFire) {
          return res.status(400).json({ 
            message: fireLimits.isPro 
              ? "You've used all 3 fire reactions for today. Come back tomorrow!" 
              : "You've used your daily fire reaction. Pro users can fire 3 times a day!",
            firesRemaining: 0,
            maxFires: fireLimits.maxFiresPerDay
          });
        }
        
        // Increment daily fire count
        await storage.incrementDailyFireCount(userId);
      }

      // Create new reaction
      const reactionData = insertClipReactionSchema.parse({
        clipId,
        userId: userId,
        emoji: emoji,
        positionX: req.body.positionX || 50,
        positionY: req.body.positionY || 50,
      });

      const reaction = await storage.createClipReaction(reactionData);
      
      // Award 5 points for fire reactions (only if they haven't earned points for this clip before)
      if (emoji === '🔥') {
        const hasEarnedPoints = await storage.hasUserEarnedPointsForContent(userId, 'fire', 'clip', clipId);
        if (!hasEarnedPoints) {
          await LeaderboardService.awardPoints(
            userId,
            'fire',
            `Fire reaction given to clip #${clipId}`
          );
        }
        
        // Get updated fire limits to return
        const fireLimits = await storage.getFireLimits(userId);
        
        const reactions = await storage.getClipReactions(clipId);
        const count = reactions.filter(r => r.emoji === emoji).length;
        
        return res.status(201).json({ 
          ...reaction, 
          reacted: true, 
          count,
          firesRemaining: fireLimits.maxFiresPerDay - fireLimits.firesUsedToday,
          maxFires: fireLimits.maxFiresPerDay
        });
      }
      
      // Get updated reaction count for non-fire reactions
      const reactions = await storage.getClipReactions(clipId);
      const count = reactions.filter(r => r.emoji === emoji).length;
      
      res.status(201).json({ 
        ...reaction, 
        reacted: true, 
        count 
      });
    } catch (err) {
      return handleValidationError(err, res);
    }
  });

  // Increment clip views - called when video starts playing
  app.post("/api/clips/:id/views", async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);

      if (isNaN(clipId)) {
        return res.status(400).json({ error: 'Invalid clip ID' });
      }

      // Don't increment views for demo clips
      if (clipId >= 10000) {
        return res.json({ success: true, message: 'Demo clip views not tracked' });
      }

      // Get the clip to find the owner
      const clip = await storage.getClip(clipId);
      if (clip) {
        // Increment the view count on the clip
        await storage.incrementClipViews(clipId);

        // Award view XP to the content owner
        await LeaderboardService.awardPoints(
          clip.userId,
          'view',
          `Clip #${clipId} received a view`
        );

        // Get updated view count for milestone checks
        const updatedClip = await storage.getClip(clipId);
        const newViewCount = updatedClip?.views || 0;

        // Check performance milestones (view count thresholds)
        await PerformanceMilestoneService.checkAndAwardViewMilestones(clipId, clip.userId, newViewCount);

        // Check creator milestones for first clips to reach 100 / 1,000 views
        if (newViewCount >= 100) {
          await CreatorMilestoneService.checkFirst100Views(clip.userId, clipId);
        }
        if (newViewCount >= 1000) {
          await CreatorMilestoneService.checkFirst1000Views(clip.userId, clipId);
        }

        // Award watch XP to the viewer (if authenticated)
        if (req.user?.id && req.user.id !== clip.userId) {
          await BonusEventsService.awardWatchClipXP(req.user.id);
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error incrementing clip views:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to increment views'
      });
    }
  });

  // Delete a reaction (supports both session and JWT token auth for mobile apps)
  app.delete("/api/reactions/:id", hybridAuth, async (req, res) => {
    try {
      const reactionId = parseInt(req.params.id);

      if (isNaN(reactionId)) {
        return res.status(400).json({ message: "Invalid reaction ID" });
      }

      // Get the reaction by ID to check ownership
      const reaction = await storage.getClipReactionById(reactionId);

      if (!reaction) {
        return res.status(404).json({ message: "Reaction not found" });
      }

      // Ensure the user is deleting their own reaction
      if (req.user?.id !== reaction.userId && req.user?.id !== 999) {
        return res.status(403).json({ message: "You can only delete your own reactions" });
      }

      const success = await storage.deleteClipReaction(reactionId);

      if (!success) {
        return res.status(500).json({ message: "Failed to delete reaction" });
      }

      res.status(200).json({ message: "Reaction deleted successfully" });
    } catch (err) {
      console.error("Error deleting reaction:", err);
      return res.status(500).json({ message: "Error deleting reaction" });
    }
  });

  // ==========================================
  // Content Reporting Routes
  // ==========================================

  // Report a clip
  app.post("/api/clips/:id/report", emailVerificationMiddleware, async (req, res) => {
    try {
      const clipId = parseInt(req.params.id);
      const { reason, additionalMessage } = req.body;

      if (!reason) {
        return res.status(400).json({ message: "Reason is required" });
      }

      // Validate the clip exists
      const clip = await storage.getClipWithUser(clipId);
      if (!clip) {
        return res.status(404).json({ message: "Clip not found" });
      }

      // Create the report
      const report = await storage.createClipReport({
        reporterId: req.user!.id,
        clipId,
        reason,
        additionalMessage: additionalMessage || null
      });

      // Send email notification to support team
      const reportData = {
        contentType: 'clip' as const,
        contentId: clipId,
        contentTitle: clip.title,
        contentUrl: `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/clips/${clipId}`,
        reporterUsername: req.user!.username,
        reporterEmail: req.user!.email!,
        reason,
        additionalMessage,
        reportId: report.id
      };

      await EmailService.sendContentReportEmail(reportData);

      res.status(201).json({
        message: "Report submitted successfully",
        reportId: report.id
      });
    } catch (err) {
      console.error("Error creating clip report:", err);
      return res.status(500).json({ message: "Error submitting report" });
    }
  });

  // Report a screenshot
  app.post("/api/screenshots/:id/report", emailVerificationMiddleware, async (req, res) => {
    try {
      const screenshotId = parseInt(req.params.id);
      const { reason, additionalMessage } = req.body;

      if (!reason) {
        return res.status(400).json({ message: "Reason is required" });
      }

      // Validate the screenshot exists
      const screenshot = await storage.getScreenshot(screenshotId);
      if (!screenshot) {
        return res.status(404).json({ message: "Screenshot not found" });
      }

      // Create the report
      const report = await storage.createScreenshotReport({
        reporterId: req.user!.id,
        screenshotId,
        reason,
        additionalMessage: additionalMessage || null
      });

      // Send email notification to support team
      const reportData = {
        contentType: 'screenshot' as const,
        contentId: screenshotId,
        contentTitle: screenshot.title,
        contentUrl: `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/screenshots/${screenshotId}`,
        reporterUsername: req.user!.username,
        reporterEmail: req.user!.email!,
        reason,
        additionalMessage,
        reportId: report.id
      };

      await EmailService.sendContentReportEmail(reportData);

      res.status(201).json({
        message: "Report submitted successfully",
        reportId: report.id
      });
    } catch (err) {
      console.error("Error creating screenshot report:", err);
      return res.status(500).json({ message: "Error submitting report" });
    }
  });

  // ==========================================
  // User Game Favorites Routes
  // ==========================================

  // Get user's favorite games by ID
  app.get("/api/users/:id/favorites", async (req, res) => {
    try {
      // Handle demo user
      if (req.params.id === "999") {
        return res.json(getDemoFavoriteGames());
      }

      const userId = parseInt(req.params.id);
      const games = await storage.getUserGameFavorites(userId);
      res.json(games);
    } catch (err) {
      console.error("Error fetching favorite games:", err);
      return res.status(500).json({ message: "Error fetching favorite games" });
    }
  });

  // Get user's favorite games by username (for profile page)
  app.get("/api/users/:username/games/favorites", async (req, res) => {
    try {
      // Remove leading @ from username if present
      const username = req.params.username.startsWith('@') ? req.params.username.slice(1) : req.params.username;

      // Handle demo user
      if (username === "demo") {
        return res.json(getDemoFavoriteGames());
      }

      // Get user by username first
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if profile is private and user is not following
      const requesterId = req.user?.id;
      const isOwnProfile = requesterId === user.id;

      if (user.isPrivate && !isOwnProfile && requesterId) {
        const isFollowing = await storage.isFollowing(requesterId, user.id);
        if (!isFollowing) {
          return res.status(403).json({ message: "This profile is private. Follow the user to see their content." });
        }
      } else if (user.isPrivate && !isOwnProfile && !requesterId) {
        return res.status(403).json({ message: "This profile is private. Please log in and follow the user to see their content." });
      }

      const games = await storage.getUserGameFavorites(user.id);
      res.json(games);
    } catch (err) {
      console.error("Error fetching favorite games:", err);
      return res.status(500).json({ message: "Error fetching favorite games" });
    }
  });

  // Add game to favorites
  app.post("/api/users/:id/favorites", authMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);

      // Ensure the user is adding to their own favorites
      if (req.user?.id !== userId && req.user?.id !== 999) {
        return res.status(403).json({ message: "You can only manage your own favorites" });
      }

      // Handle demo user
      if (userId === 999) {
        return res.status(200).json({ message: "Game added to favorites (demo)" });
      }

      // Check current favorites count (limit to 20 games)
      const currentFavorites = await storage.getUserGameFavorites(userId);
      if (currentFavorites.length >= 20) {
        return res.status(400).json({ message: "You can only have up to 20 favorite games. Remove some games first." });
      }

      const gameId = parseInt(req.body.gameId);

      // Check if the game exists
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      // Check if already favorited
      const existingFavorites = currentFavorites.find(g => g.id === gameId);
      if (existingFavorites) {
        return res.status(200).json({ message: "Game is already in your favorites" });
      }

      // Add to favorites
      const favoriteData = insertUserGameFavoriteSchema.parse({
        userId,
        gameId,
      });

      await storage.addUserGameFavorite(favoriteData);
      res.status(201).json({ message: "Game added to favorites" });
    } catch (err) {
      return handleValidationError(err, res);
    }
  });

  // Remove game from favorites
  app.delete("/api/users/:userId/favorites/:gameId", authMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const gameId = parseInt(req.params.gameId);

      // Ensure the user is removing from their own favorites
      if (req.user?.id !== userId && req.user?.id !== 999) {
        return res.status(403).json({ message: "You can only manage your own favorites" });
      }

      // Handle demo user
      if (userId === 999) {
        return res.status(200).json({ message: "Game removed from favorites (demo)" });
      }

      // Remove from favorites
      const success = await storage.removeUserGameFavorite(userId, gameId);

      if (!success) {
        return res.status(500).json({ message: "Failed to remove game from favorites" });
      }

      res.status(200).json({ message: "Game removed from favorites" });
    } catch (err) {
      console.error("Error removing game from favorites:", err);
      return res.status(500).json({ message: "Error removing game from favorites" });
    }
  });

  // ==========================================
  // Follow Routes
  // ==========================================

  // Get user's followers
  app.get("/api/users/:id/followers", async (req, res) => {
    try {
      // Handle demo user
      if (req.params.id === "999") {
        return res.json([]);
      }

      const userId = parseInt(req.params.id);
      const followers = await storage.getFollowersByUserId(userId);
      res.json(followers);
    } catch (err) {
      console.error("Error fetching followers:", err);
      return res.status(500).json({ message: "Error fetching followers" });
    }
  });

  // Get users that a user is following
  app.get("/api/users/:id/following", async (req, res) => {
    try {
      // Handle demo user
      if (req.params.id === "999") {
        return res.json([]);
      }

      const userId = parseInt(req.params.id);
      const following = await storage.getFollowingByUserId(userId);
      res.json(following);
    } catch (err) {
      console.error("Error fetching following:", err);
      return res.status(500).json({ message: "Error fetching following" });
    }
  });

  // Check if a user is following another user
  app.get("/api/users/:followerId/following/:followingId", async (req, res) => {
    try {
      const followerId = parseInt(req.params.followerId);
      const followingId = parseInt(req.params.followingId);

      // If either user is the demo user, return false
      if (followerId === 999 || followingId === 999) {
        return res.json({ isFollowing: false });
      }

      const isFollowing = await storage.isFollowing(followerId, followingId);
      res.json({ isFollowing });
    } catch (err) {
      console.error("Error checking follow status:", err);
      return res.status(500).json({ message: "Error checking follow status" });
    }
  });

  // Check follow status by username
  app.get("/api/users/:username/follow-status", authMiddleware, async (req, res) => {
    try {
      const followerId = req.user?.id ?? 0;
      const { username } = req.params;

      // Get the user by username
      const followingUser = await storage.getUserByUsername(username);
      if (!followingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // For demo users, check localStorage-based follow state from frontend
      // Let the frontend handle demo user follow state via localStorage
      if (followerId === 999 || followingUser.id === 999) {
        // Return false to let frontend handle demo state via localStorage  
        return res.json({ following: false, requested: false });
      }

      // Check if following
      const isFollowing = await storage.isFollowing(followerId, followingUser.id);

      // If not following, check if there's a pending request
      let hasRequest = false;
      if (!isFollowing) {
        const requestStatus = await storage.hasFollowRequest(followerId, followingUser.id);
        hasRequest = requestStatus === 'pending';
      }

      res.json({ following: isFollowing, requested: hasRequest });
    } catch (err) {
      console.error("Error checking follow status:", err);
      return res.status(500).json({ message: "Error checking follow status" });
    }
  });

  // Follow a user by username
  app.post("/api/users/:username/follow", authMiddleware, async (req, res) => {
    try {
      const followerId = req.user?.id ?? 0;
      const { username } = req.params;

      // Get the user by username
      const followingUser = await storage.getUserByUsername(username);
      if (!followingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const followingId = followingUser.id;

      // Can't follow yourself
      if (followerId === followingId) {
        return res.status(400).json({ message: "You cannot follow yourself" });
      }

      // Allow demo users to participate in normal follow operations
      // The frontend handles demo user state with localStorage for persistence

      // Check if already following
      const isAlreadyFollowing = await storage.isFollowing(followerId, followingId);
      if (isAlreadyFollowing) {
        return res.status(400).json({ message: "Already following this user" });
      }

      // Check if there's already a pending follow request
      const existingRequest = await storage.hasFollowRequest(followerId, followingId);
      if (existingRequest === 'pending') {
        return res.json({ status: 'requested', message: 'Follow request already sent' });
      }

      // If user is private, create a follow request
      if (followingUser.isPrivate) {
        await storage.createFollowRequest(followerId, followingId);
        await NotificationService.createFollowRequestNotification(followingId, followerId);
        return res.json({ status: 'requested', message: 'Follow request sent' });
      }

      // If user is not private, follow immediately
      await storage.createFollow({followerId, followingId});
      await NotificationService.createFollowNotification(followingId, followerId);

      // Award follow_received XP to the person being followed
      await LeaderboardService.awardCustomPoints(
        followingId,
        'follow_received',
        50,
        `Received a new follower`
      );

      res.json({ status: 'following', message: 'User followed successfully' });
    } catch (err) {
      console.error("Error following user:", err);
      return res.status(500).json({ message: "Error following user" });
    }
  });

  // Unfollow a user by username
  app.delete("/api/users/:username/follow", authMiddleware, async (req, res) => {
    try {
      const followerId = req.user?.id ?? 0;
      const { username } = req.params;

      // Get the user by username
      const followingUser = await storage.getUserByUsername(username);
      if (!followingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const followingId = followingUser.id;

      // Allow demo users to participate in normal unfollow operations
      // The frontend handles demo user state with localStorage for persistence

      // Check if currently following
      const isFollowing = await storage.isFollowing(followerId, followingId);

      if (isFollowing) {
        // Unfollow the user
        await storage.deleteFollow(followerId, followingId);
        return res.json({ action: "unfollowed", message: "User unfollowed successfully" });
      } else {
        // Check if there's a pending follow request to cancel
        const requestStatus = await storage.hasFollowRequest(followerId, followingId);
        if (requestStatus === 'pending') {
          await storage.removeFollowRequest(followerId, followingId);
          return res.json({ action: "unfollowed", message: "Follow request cancelled" });
        }
      }

      res.json({ message: "User was not being followed" });
    } catch (err) {
      console.error("Error unfollowing user:", err);
      return res.status(500).json({ message: "Error unfollowing user" });
    }
  });

  // Follow a user
  app.post("/api/users/:id/follow", authMiddleware, async (req, res) => {
    try {
      const followerId = req.user?.id ?? 0;
      const followingId = parseInt(req.params.id);

      // Can't follow yourself
      if (followerId === followingId) {
        return res.status(400).json({ message: "You cannot follow yourself" });
      }

      // Allow demo users to participate in normal follow operations
      // The frontend handles demo user state with localStorage for persistence

      // Check if the user to follow exists
      const followingUser = await storage.getUser(followingId);
      if (!followingUser) {
        return res.status(404).json({ message: "User to follow not found" });
      }

      // Check if already following (double-check to prevent race conditions)
      const isFollowing = await storage.isFollowing(followerId, followingId);
      if (isFollowing) {
        return res.status(400).json({ message: "You are already following this user" });
      }

      // Create the follow relationship
      const followData = insertFollowSchema.parse({
        followerId,
        followingId,
      });

      await storage.createFollow(followData);
      res.status(201).json({ message: "User followed successfully" });
    } catch (err) {
      console.error("Error following user:", err);
      
      // Handle specific database errors
      if (err instanceof Error) {
        // Handle unique constraint violations (duplicate follows)
        if (err.message.includes('duplicate key value') || err.message.includes('unique constraint')) {
          return res.status(400).json({ message: "You are already following this user" });
        }
        
        // Handle foreign key constraint violations
        if (err.message.includes('foreign key constraint')) {
          return res.status(404).json({ message: "User to follow not found" });
        }
        
        // Handle validation errors
        if (err.name === 'ZodError' || err.message.includes('validation')) {
          return res.status(400).json({ message: err.message });
        }
      }
      
      // Generic database error
      return res.status(500).json({ message: "Failed to follow user. Please try again." });
    }
  });

  // Unfollow a user
  app.delete("/api/users/:id/follow", authMiddleware, async (req, res) => {
    try {
      const followerId = req.user?.id ?? 0;
      const followingId = parseInt(req.params.id);

      // Can't unfollow yourself
      if (followerId === followingId) {
        return res.status(400).json({ message: "You cannot unfollow yourself" });
      }

      // Allow demo users to participate in normal unfollow operations
      // The frontend handles demo user state with localStorage for persistence

      // Check if actually following
      const isFollowing = await storage.isFollowing(followerId, followingId);
      if (!isFollowing) {
        return res.status(400).json({ message: "You are not following this user" });
      }

      // Delete the follow relationship
      const success = await storage.deleteFollow(followerId, followingId);

      if (!success) {
        return res.status(500).json({ message: "Failed to unfollow user" });
      }

      res.status(200).json({ message: "User unfollowed successfully" });
    } catch (err) {
      console.error("Error unfollowing user:", err);
      return res.status(500).json({ message: "Error unfollowing user" });
    }
  });

  // ==========================================
  // Follow Request Management Routes
  // ==========================================

  // Get pending follow requests for the current user
  app.get("/api/follow-requests", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id ?? 0;
      const followRequests = await storage.getPendingFollowRequests(userId);
      res.json(followRequests);
    } catch (err) {
      console.error("Error fetching follow requests:", err);
      return res.status(500).json({ message: "Error fetching follow requests" });
    }
  });

  // Approve a follow request
  app.post("/api/follow-requests/:requestId/approve", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id ?? 0;
      const requestId = parseInt(req.params.requestId);

      // Get the follow request to verify ownership
      const request = await storage.getFollowRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Follow request not found" });
      }

      // Verify the current user is the addressee
      if (request.addresseeId !== userId) {
        return res.status(403).json({ message: "You can only approve requests sent to you" });
      }

      // Verify the request is still pending
      if (request.status !== 'pending') {
        return res.status(400).json({ message: "This request has already been processed" });
      }

      // Approve the request (create follow relationship and update request status)
      await storage.acceptFollowRequest(requestId);
      
      // Create follow notification
      await NotificationService.createFollowNotification(request.addresseeId, request.requesterId);

      res.json({ message: "Follow request approved successfully" });
    } catch (err) {
      console.error("Error approving follow request:", err);
      return res.status(500).json({ message: "Error approving follow request" });
    }
  });

  // Reject a follow request
  app.post("/api/follow-requests/:requestId/reject", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id ?? 0;
      const requestId = parseInt(req.params.requestId);

      // Get the follow request to verify ownership
      const request = await storage.getFollowRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Follow request not found" });
      }

      // Verify the current user is the addressee
      if (request.addresseeId !== userId) {
        return res.status(403).json({ message: "You can only reject requests sent to you" });
      }

      // Verify the request is still pending
      if (request.status !== 'pending') {
        return res.status(400).json({ message: "This request has already been processed" });
      }

      // Reject the request (update status to rejected)
      await storage.declineFollowRequest(requestId);

      res.json({ message: "Follow request rejected successfully" });
    } catch (err) {
      console.error("Error rejecting follow request:", err);
      return res.status(500).json({ message: "Error rejecting follow request" });
    }
  });

  // Approve follow request via notification ID (for notification buttons)
  app.post("/api/notifications/:notificationId/approve-follow", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id ?? 0;
      const notificationId = parseInt(req.params.notificationId);

      // Get the notification to find the requester
      const notification = await storage.getNotification(notificationId);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      // Verify this is a follow request notification for the current user
      if (notification.type !== 'follow_request' || notification.userId !== userId) {
        return res.status(403).json({ message: "Invalid notification" });
      }

      // Find the corresponding follow request
      const followRequest = await storage.getFollowRequestByUsers(notification.fromUserId!, userId);
      if (!followRequest) {
        return res.status(404).json({ message: "Follow request not found" });
      }

      // Verify the request is still pending
      if (followRequest.status !== 'pending') {
        return res.status(400).json({ message: "This request has already been processed" });
      }

      // Approve the request
      await storage.acceptFollowRequest(followRequest.id);
      
      // Mark the notification as read
      await storage.markNotificationAsRead(notificationId);
      
      // Create follow notification
      await NotificationService.createFollowNotification(followRequest.addresseeId, followRequest.requesterId);

      res.json({ message: "Follow request approved successfully" });
    } catch (err) {
      console.error("Error approving follow request via notification:", err);
      return res.status(500).json({ message: "Error approving follow request" });
    }
  });

  // Reject follow request via notification ID (for notification buttons)
  app.post("/api/notifications/:notificationId/reject-follow", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id ?? 0;
      const notificationId = parseInt(req.params.notificationId);

      // Get the notification to find the requester
      const notification = await storage.getNotification(notificationId);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      // Verify this is a follow request notification for the current user
      if (notification.type !== 'follow_request' || notification.userId !== userId) {
        return res.status(403).json({ message: "Invalid notification" });
      }

      // Find the corresponding follow request
      const followRequest = await storage.getFollowRequestByUsers(notification.fromUserId!, userId);
      if (!followRequest) {
        return res.status(404).json({ message: "Follow request not found" });
      }

      // Verify the request is still pending
      if (followRequest.status !== 'pending') {
        return res.status(400).json({ message: "This request has already been processed" });
      }

      // Reject the request
      await storage.declineFollowRequest(followRequest.id);
      
      // Mark the notification as read
      await storage.markNotificationAsRead(notificationId);

      res.json({ message: "Follow request rejected successfully" });
    } catch (err) {
      console.error("Error rejecting follow request via notification:", err);
      return res.status(500).json({ message: "Error rejecting follow request" });
    }
  });

  // ==========================================
  // Search Routes
  // ==========================================

  // Unified search endpoints that match frontend expectations

  // Search clips with query parameter
  app.get("/api/search/clips", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }
      const clips = await storage.searchClips(query);
      res.json(clips);
    } catch (err) {
      console.error("Error searching clips:", err);
      return res.status(500).json({ message: "Error searching clips" });
    }
  });

  // Search users with query parameter
  app.get("/api/search/users", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }
      const users = await storage.searchUsers(query);
      res.json(users);
    } catch (err) {
      console.error("Error searching users:", err);
      return res.status(500).json({ message: "Error searching users" });
    }
  });

  // Search games with query parameter
  app.get("/api/search/games", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }
      const games = await storage.searchGames(query);
      res.json(games);
    } catch (err) {
      console.error("Error searching games:", err);
      return res.status(500).json({ message: "Error searching games" });
    }
  });

  // Search reels with query parameter
  app.get("/api/search/reels", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }
      const reels = await storage.searchReels(query);
      res.json(reels);
    } catch (err) {
      console.error("Error searching reels:", err);
      return res.status(500).json({ message: "Error searching reels" });
    }
  });

  // Search screenshots with query parameter
  app.get("/api/search/screenshots", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }
      const screenshots = await storage.searchScreenshots(query);
      res.json(screenshots);
    } catch (err) {
      console.error("Error searching screenshots:", err);
      return res.status(500).json({ message: "Error searching screenshots" });
    }
  });

  // Legacy search endpoints (kept for backward compatibility)

  // Search users
  app.get("/api/search/users/:query", async (req, res) => {
    try {
      const users = await storage.searchUsers(req.params.query);
      res.json(users);
    } catch (err) {
      console.error("Error searching users:", err);
      return res.status(500).json({ message: "Error searching users" });
    }
  });

  // ==========================================
  // Profile Banner Routes
  // ==========================================

  // Get all profile banners (for admin use)
  app.get("/api/profile-banners", async (req, res) => {
    try {
      const banners = await storage.getAllProfileBanners();
      res.json(banners);
    } catch (err) {
      console.error("Error fetching profile banners:", err);
      return res.status(500).json({ message: "Error fetching profile banners" });
    }
  });

  // Get unlocked banners for the current user
  app.get("/api/user/unlocked-banners", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const userId = (req.user as User).id;
      const banners = await storage.getUserUnlockedBanners(userId);
      res.json(banners);
    } catch (err) {
      console.error("Error fetching unlocked banners:", err);
      return res.status(500).json({ message: "Error fetching unlocked banners" });
    }
  });

  // Unlock a banner for the current user (admin or lootbox system use)
  app.post("/api/user/unlock-banner/:bannerId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const userId = (req.user as User).id;
      const bannerId = parseInt(req.params.bannerId);
      
      if (isNaN(bannerId)) {
        return res.status(400).json({ message: "Invalid banner ID" });
      }
      
      await storage.unlockBannerForUser(userId, bannerId);
      res.json({ success: true, message: "Banner unlocked" });
    } catch (err) {
      console.error("Error unlocking banner:", err);
      return res.status(500).json({ message: "Error unlocking banner" });
    }
  });

  // Get profile banners by category
  app.get("/api/profile-banners/:category", async (req, res) => {
    try {
      const banners = await storage.getProfileBannersByCategory(req.params.category);
      res.json(banners);
    } catch (err) {
      console.error("Error fetching profile banners by category:", err);
      return res.status(500).json({ message: "Error fetching profile banners by category" });
    }
  });

  // Get banner images for profile customization
  app.get("/api/banner-images", async (req, res) => {
    try {
      // Get banners from database
      const banners = await storage.getAllProfileBanners();
      res.json(banners);
    } catch (err) {
      console.error("Error fetching banner images:", err);
      return res.status(500).json({ message: "Error fetching banner images" });
    }
  });

  // Upload custom banner with aspect ratio processing and positioning
  app.post("/api/upload/banner", upload.single('banner'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      console.log("File received:", {
        originalname: req.file.originalname,
        size: req.file.size,
        path: req.file.path,
        mimetype: req.file.mimetype
      });

      // Get positioning data from request
      const positionX = parseFloat(req.body.positionX) || 0;
      const positionY = parseFloat(req.body.positionY) || 0;
      const scale = parseFloat(req.body.scale) || 1;

      console.log("Positioning data:", { positionX, positionY, scale });

      // Since we're using disk storage, use the file path
      if (!req.file.path) {
        return res.status(400).json({ message: "File path not available" });
      }

      // Check if file exists
      if (!fs.existsSync(req.file.path)) {
        return res.status(400).json({ message: "Uploaded file not found" });
      }

      // Check if file is a GIF and user is Pro
      const isGif = req.file.mimetype === 'image/gif' || req.file.originalname.toLowerCase().endsWith('.gif');
      const user = await storage.getUser(req.user.id);
      const isPro = user?.isPro === true;

      let processedBuffer: Buffer;
      let fileName: string;
      let mimeType: string;

      if (isGif && isPro) {
        console.log('Processing GIF banner for Pro user - preserving animation');
        processedBuffer = await fsPromises.readFile(req.file.path);
        fileName = `banner-${req.user.id}-${Date.now()}.gif`;
        mimeType = 'image/gif';
      } else if (isGif && !isPro) {
        console.log('Non-Pro user tried to upload GIF banner - rejecting');
        try { await fsPromises.unlink(req.file.path); } catch {}
        return res.status(403).json({ message: "GIF banners are a Pro feature. Upgrade to Pro to use animated banners!" });
      } else {
        // Process image with Sharp using the file path
        let sharpInstance = sharp(req.file.path);

        // Get image metadata
        const metadata = await sharpInstance.metadata();
        console.log("Image metadata:", metadata);

        if (!metadata.width || !metadata.height) {
          return res.status(400).json({ message: "Invalid image file" });
        }

        const targetWidth = 1600;

        processedBuffer = await sharpInstance
          .resize(targetWidth, undefined, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 95 })
          .toBuffer();
        fileName = `banner-${req.user.id}-${Date.now()}.jpg`;
        mimeType = 'image/jpeg';
      }

      // Upload processed image to Supabase
      const { url: bannerUrl } = await supabaseStorage.uploadBuffer(
        processedBuffer,
        fileName,
        mimeType,
        'image',
        req.user.id
      );

      console.log("Banner uploaded successfully:", bannerUrl);

      // Save to uploaded_banners table and update user's banner
      await storage.createUploadedBanner(req.user.id, bannerUrl);

      // Clean up local file
      try {
        await fsPromises.unlink(req.file.path);
      } catch (error) {
        console.warn('Could not delete local banner file:', error);
      }

      res.json({
        url: bannerUrl,
        message: "Banner uploaded successfully",
        positioning: { positionX, positionY, scale }
      });
    } catch (err) {
      console.error("Error uploading banner:", err);
      return res.status(500).json({ message: "Error uploading banner" });
    }
  });

  // Upload profile background image
  app.post("/api/upload/profile-background", upload.single('backgroundImage'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      if (!req.file.path || !fs.existsSync(req.file.path)) {
        return res.status(400).json({ message: "Uploaded file not found" });
      }
      const sharpInstance = sharp(req.file.path);
      const metadata = await sharpInstance.metadata();
      if (!metadata.width || !metadata.height) {
        return res.status(400).json({ message: "Invalid image file" });
      }
      const processedBuffer = await sharpInstance
        .resize(1920, undefined, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
      const fileName = `profile-bg-${req.user.id}-${Date.now()}.jpg`;
      const { url: imageUrl } = await supabaseStorage.uploadBuffer(
        processedBuffer,
        fileName,
        'image/jpeg',
        'image',
        req.user.id
      );
      await storage.updateUser(req.user.id, { profileBackgroundImageUrl: imageUrl } as any);
      try { await fsPromises.unlink(req.file.path); } catch {}
      res.json({ url: imageUrl, message: "Background image uploaded successfully" });
    } catch (err) {
      console.error("Error uploading profile background image:", err);
      return res.status(500).json({ message: "Error uploading background image" });
    }
  });


  // Get user's uploaded banners
  app.get("/api/user/banners", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const banners = await storage.getUserUploadedBanners(req.user.id);
      res.json(banners);
    } catch (err) {
      console.error("Error fetching uploaded banners:", err);
      return res.status(500).json({ message: "Error fetching uploaded banners" });
    }
  });

  // Set a banner as active
  app.put("/api/user/banners/:id/activate", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const bannerId = parseInt(req.params.id);
      const success = await storage.setActiveBanner(req.user.id, bannerId);
      
      if (!success) {
        return res.status(404).json({ message: "Banner not found" });
      }

      res.json({ message: "Banner activated successfully" });
    } catch (err) {
      console.error("Error activating banner:", err);
      return res.status(500).json({ message: "Error activating banner" });
    }
  });

  // Delete an uploaded banner
  app.delete("/api/user/banners/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const bannerId = parseInt(req.params.id);
      const success = await storage.deleteUploadedBanner(req.user.id, bannerId);
      
      if (!success) {
        return res.status(404).json({ message: "Banner not found" });
      }

      res.json({ message: "Banner deleted successfully" });
    } catch (err) {
      console.error("Error deleting banner:", err);
      return res.status(500).json({ message: "Error deleting banner" });
    }
  });

  // ==========================================
  // Avatar Border Routes (Lootbox Rewards)
  // ==========================================

  // Get user's unlocked avatar borders
  app.get("/api/user/avatar-borders", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      // Pro users get access to ALL avatar borders
      const user = await storage.getUserById(req.user.id);
      if (user?.isPro) {
        const allBorders = await storage.getAllAvatarBorders();
        return res.json(allBorders);
      }
      
      // Non-Pro users only get their unlocked borders
      const unlockedBorders = await storage.getUserUnlockedAvatarBorders(req.user.id);
      res.json(unlockedBorders);
    } catch (err) {
      console.error("Error fetching unlocked avatar borders:", err);
      return res.status(500).json({ message: "Error fetching unlocked avatar borders" });
    }
  });

  // Set selected avatar border
  app.put("/api/user/avatar-border", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const { avatarBorderId } = req.body;
      
      // Allow null to remove the border
      if (avatarBorderId !== null) {
        // Special built-in border: -1 = solid border (always available)
        if (avatarBorderId === -1) {
          // Solid border is a built-in option, no verification needed
        } else {
          // Verify it's actually an avatar border type
          const reward = await storage.getAssetReward(avatarBorderId);
          if (!reward || reward.assetType !== "avatar_border") {
            return res.status(400).json({ message: "Invalid avatar border" });
          }
          
          // Pro users can select ANY border
          const user = await storage.getUserById(req.user.id);
          if (!user?.isPro) {
            // Non-Pro users must have unlocked the border
            const hasUnlocked = await storage.userHasUnlockedReward(req.user.id, avatarBorderId);
            if (!hasUnlocked) {
              return res.status(403).json({ message: "You haven't unlocked this avatar border" });
            }
          }
        }
      }

      await storage.updateUserAvatarBorder(req.user.id, avatarBorderId);
      res.json({ message: "Avatar border updated successfully" });
    } catch (err) {
      console.error("Error updating avatar border:", err);
      return res.status(500).json({ message: "Error updating avatar border" });
    }
  });

  // Get user's selected avatar border (for profile display)
  app.get("/api/user/:userId/avatar-border", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.selectedAvatarBorderId) {
        return res.json({ avatarBorder: null });
      }

      // Special built-in solid border
      if (user.selectedAvatarBorderId === -1) {
        return res.json({ avatarBorder: { id: -1, name: 'Solid', assetType: 'solid_border', imageUrl: null } });
      }

      const avatarBorder = await storage.getAssetReward(user.selectedAvatarBorderId);
      res.json({ avatarBorder });
    } catch (err) {
      console.error("Error fetching user avatar border:", err);
      return res.status(500).json({ message: "Error fetching user avatar border" });
    }
  });

  // ==========================================
  // Previous Avatars Routes
  // ==========================================

  app.post("/api/user/previous-avatars", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { avatarUrl } = req.body;
      if (!avatarUrl) return res.status(400).json({ message: "avatarUrl required" });

      const existing = await db.select()
        .from(previousAvatars)
        .where(sql`${previousAvatars.userId} = ${req.user!.id} AND ${previousAvatars.avatarUrl} = ${avatarUrl}`)
        .limit(1);
      if (existing.length === 0) {
        await db.insert(previousAvatars).values({ userId: req.user!.id, avatarUrl });
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Error saving previous avatar:", err);
      res.status(500).json({ message: "Failed to save previous avatar" });
    }
  });

  app.get("/api/user/previous-avatars", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const avatars = await db.select()
        .from(previousAvatars)
        .where(eq(previousAvatars.userId, req.user!.id))
        .orderBy(sql`${previousAvatars.createdAt} DESC`)
        .limit(20);
      res.json({ avatars });
    } catch (err) {
      console.error("Error fetching previous avatars:", err);
      res.status(500).json({ message: "Failed to fetch previous avatars" });
    }
  });

  app.delete("/api/user/previous-avatars/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const avatarId = parseInt(req.params.id);
      await db.delete(previousAvatars)
        .where(sql`${previousAvatars.id} = ${avatarId} AND ${previousAvatars.userId} = ${req.user!.id}`);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting previous avatar:", err);
      res.status(500).json({ message: "Failed to delete previous avatar" });
    }
  });

  // ==========================================
  // Name Tag Routes
  // ==========================================

  // Get all available name tags
  app.get("/api/name-tags", async (req, res) => {
    try {
      const tags = await storage.getAllNameTags();
      res.json(tags);
    } catch (err) {
      console.error("Error fetching name tags:", err);
      return res.status(500).json({ message: "Error fetching name tags" });
    }
  });

  // Get user's unlocked name tags (includes default tags for all users)
  app.get("/api/user/name-tags", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      // All users get default tags + their individually unlocked tags
      const allTags = await storage.getAllNameTags();
      const defaultTags = allTags.filter(t => t.isDefault);
      const unlockedTags = await storage.getUserUnlockedNameTags(req.user.id);
      
      // Merge default and unlocked tags, avoiding duplicates
      const unlockedIds = new Set(unlockedTags.map(t => t.id));
      const mergedTags = [...defaultTags.filter(t => !unlockedIds.has(t.id)), ...unlockedTags];
      
      res.json(mergedTags);
    } catch (err) {
      console.error("Error fetching unlocked name tags:", err);
      return res.status(500).json({ message: "Error fetching unlocked name tags" });
    }
  });

  // Update user's selected name tag
  app.put("/api/user/name-tag", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const { nameTagId } = req.body;
      
      if (nameTagId !== null) {
        const nameTag = await storage.getNameTag(nameTagId);
        if (!nameTag) {
          return res.status(400).json({ message: "Invalid name tag" });
        }
        
        // Default tags are available to everyone; all others must be purchased from the store
        if (!nameTag.isDefault) {
          const hasUnlocked = await storage.userHasUnlockedNameTag(req.user.id, nameTagId);
          if (!hasUnlocked) {
            return res.status(403).json({ message: "You haven't unlocked this name tag" });
          }
        }
      }

      await storage.updateUserNameTag(req.user.id, nameTagId);
      res.json({ message: "Name tag updated successfully" });
    } catch (err) {
      console.error("Error updating name tag:", err);
      return res.status(500).json({ message: "Error updating name tag" });
    }
  });

  // Get user's selected name tag (for profile display)
  app.get("/api/user/:userId/name-tag", async (req, res) => {
    // Prevent browser caching to ensure fresh data after updates
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.selectedNameTagId) {
        return res.json({ nameTag: null });
      }

      const nameTag = await storage.getNameTag(user.selectedNameTagId);
      res.json({ nameTag });
    } catch (err) {
      console.error("Error fetching user name tag:", err);
      return res.status(500).json({ message: "Error fetching user name tag" });
    }
  });

  // ==========================================
  // Name Tag Store Routes
  // ==========================================

  // Get name tags available for purchase in the store
  app.get("/api/store/name-tags", async (req, res) => {
    try {
      const allTags = await storage.getAllNameTags();
      const storeTags = allTags.filter(t => t.availableInStore && t.isActive && !t.isDefault);
      
      const tagsWithSignedUrls = await Promise.all(
        storeTags.map(async (tag) => {
          let imageUrl = tag.imageUrl;
          if (imageUrl && imageUrl.includes('supabase.co/storage')) {
            const signed = await supabaseStorage.convertToSignedUrl(imageUrl, 3600);
            if (signed) imageUrl = signed;
          }
          return { ...tag, imageUrl };
        })
      );

      if (req.isAuthenticated()) {
        const unlockedTags = await storage.getUserUnlockedNameTags(req.user.id);
        const unlockedIds = new Set(unlockedTags.map(t => t.id));
        const user = await storage.getUserById(req.user.id);
        const isPro = !!user?.isPro;
        
        const tagsWithStatus = tagsWithSignedUrls.map(tag => {
          const baseCost = tag.gfCost || 0;
          const discountedCost = isPro ? Math.floor(baseCost * 0.8) : baseCost;
          return {
            ...tag,
            owned: unlockedIds.has(tag.id) || isPro,
            originalPrice: baseCost,
            gfCost: discountedCost,
            proDiscount: isPro,
          };
        });
        return res.json(tagsWithStatus);
      }
      
      res.json(tagsWithSignedUrls.map(tag => ({ ...tag, owned: false, originalPrice: tag.gfCost, proDiscount: false })));
    } catch (err) {
      console.error("Error fetching store name tags:", err);
      return res.status(500).json({ message: "Error fetching store name tags" });
    }
  });

  // Purchase a name tag with GF tokens (off-chain balance)
  app.post("/api/store/purchase-name-tag", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const { nameTagId } = req.body;
      if (!nameTagId) {
        return res.status(400).json({ message: "nameTagId is required" });
      }

      const nameTag = await storage.getNameTag(nameTagId);
      if (!nameTag) {
        return res.status(404).json({ message: "Name tag not found" });
      }

      if (!nameTag.availableInStore || !nameTag.isActive) {
        return res.status(400).json({ message: "This name tag is not available for purchase" });
      }

      if (nameTag.isDefault) {
        return res.status(400).json({ message: "This name tag is free for everyone" });
      }

      const baseCost = nameTag.gfCost || 0;
      if (baseCost <= 0) {
        return res.status(400).json({ message: "This name tag has no price set" });
      }

      // Check if user already owns it
      const hasUnlocked = await storage.userHasUnlockedNameTag(req.user.id, nameTagId);
      if (hasUnlocked) {
        return res.status(400).json({ message: "You already own this name tag" });
      }

      // Check user's GF token balance
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const cost = user.isPro ? Math.floor(baseCost * 0.8) : baseCost;

      const balance = user.gfTokenBalance || 0;
      if (balance < cost) {
        return res.status(400).json({ message: `Insufficient GF tokens. Need ${cost} GF, you have ${balance} GF` });
      }

      // Deduct GF tokens and unlock the name tag
      await db.update(users)
        .set({ gfTokenBalance: sql`COALESCE(${users.gfTokenBalance}, 0) - ${cost}` })
        .where(eq(users.id, req.user.id));

      await storage.unlockNameTagForUser(req.user.id, nameTagId);

      res.json({ 
        success: true, 
        message: `Successfully purchased "${nameTag.name}"!` + (user.isPro ? ` (20% Pro discount applied!)` : ''),
        nameTag,
        newBalance: balance - cost,
        discountApplied: user.isPro,
        originalPrice: baseCost,
        finalPrice: cost,
      });
    } catch (err) {
      console.error("Error purchasing name tag:", err);
      return res.status(500).json({ message: "Error purchasing name tag" });
    }
  });

  // Sync name tags from the gamefolio-name-tags Supabase bucket
  app.post("/api/admin/name-tags/sync-bucket", adminMiddleware, async (req, res) => {
    try {
      const files = await supabaseStorage.listBucketFiles('gamefolio-name-tags', '');
      
      if (!files || files.length === 0) {
        return res.json({ synced: 0, message: "No files found in gamefolio-name-tags bucket" });
      }

      const existingTags = await storage.getAllNameTags();
      const existingNames = new Set(existingTags.map(t => t.name.toLowerCase()));

      let synced = 0;
      const rarities = ['common', 'rare', 'epic', 'legendary'];
      const NAME_TAG_PRICE = 1000;

      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!ext || !['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) continue;

        const nameBase = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        const displayName = nameBase.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

        if (existingNames.has(displayName.toLowerCase())) {
          const existing = existingTags.find(t => t.name.toLowerCase() === displayName.toLowerCase());
          if (existing) {
            await storage.updateNameTag(existing.id, {
              imageUrl: file.publicUrl,
              availableInStore: true,
              availableInLootbox: true,
              gfCost: NAME_TAG_PRICE,
            });
            synced++;
          }
          continue;
        }

        const rarity = rarities[Math.floor(Math.random() * rarities.length)];
        
        await storage.createNameTag({
          name: displayName,
          imageUrl: file.publicUrl,
          rarity,
          gfCost: NAME_TAG_PRICE,
          isDefault: false,
          isActive: true,
          availableInStore: true,
          availableInLootbox: true,
        });
        synced++;
      }

      res.json({ synced, total: files.length, message: `Synced ${synced} name tags from bucket` });
    } catch (err) {
      console.error("Error syncing name tags from bucket:", err);
      return res.status(500).json({ message: "Error syncing name tags from bucket" });
    }
  });

  // ==========================================
  // Profile Borders Store Routes
  // ==========================================

  app.get("/api/store/borders", async (req, res) => {
    try {
      const shapeFilter = req.query.shape as string | undefined;
      const allBorders = await storage.getAllProfileBordersFromTable();
      const storeBorders = allBorders.filter(b => {
        if (!b.availableInStore || !b.isActive || b.isDefault) return false;
        if (shapeFilter && b.shape !== shapeFilter) return false;
        return true;
      });

      const bordersWithSignedUrls = await Promise.all(
        storeBorders.map(async (border) => {
          let imageUrl = border.imageUrl;
          if (imageUrl && imageUrl.includes('supabase.co/storage')) {
            const signed = await supabaseStorage.convertToSignedUrl(imageUrl, 3600);
            if (signed) imageUrl = signed;
          }
          return { ...border, imageUrl };
        })
      );

      if (req.isAuthenticated()) {
        const unlockedBorders = await storage.getUserUnlockedBorders2(req.user.id);
        const unlockedIds = new Set(unlockedBorders.map(b => b.id));
        const user = await storage.getUserById(req.user.id);

        const bordersWithStatus = bordersWithSignedUrls.map(border => ({
          ...border,
          owned: unlockedIds.has(border.id),
          isPro: user?.isPro || false,
        }));
        return res.json(bordersWithStatus);
      }

      res.json(bordersWithSignedUrls.map(border => ({ ...border, owned: false, isPro: false })));
    } catch (err) {
      console.error("Error fetching store borders:", err);
      return res.status(500).json({ message: "Error fetching store borders" });
    }
  });

  app.post("/api/store/purchase-border", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const { borderId } = req.body;
      if (!borderId) {
        return res.status(400).json({ message: "borderId is required" });
      }

      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.isPro) {
        return res.status(403).json({ message: "Profile borders are a Pro-only feature. Upgrade to Pro to use borders!" });
      }

      const border = await storage.getProfileBorder(borderId);
      if (!border) {
        return res.status(404).json({ message: "Border not found" });
      }

      if (!border.availableInStore || !border.isActive) {
        return res.status(400).json({ message: "This border is not available for purchase" });
      }

      if (border.isDefault) {
        return res.status(400).json({ message: "This border is free for everyone" });
      }

      const cost = border.gfCost || 0;
      if (cost <= 0) {
        return res.status(400).json({ message: "This border has no price set" });
      }

      const hasUnlocked = await storage.userHasUnlockedBorder(req.user.id, borderId);
      if (hasUnlocked) {
        return res.status(400).json({ message: "You already own this border" });
      }

      const balance = user.gfTokenBalance || 0;
      if (balance < cost) {
        return res.status(400).json({ message: `Insufficient GF tokens. Need ${cost} GF, you have ${balance} GF` });
      }

      await db.update(users)
        .set({ gfTokenBalance: sql`COALESCE(${users.gfTokenBalance}, 0) - ${cost}` })
        .where(eq(users.id, req.user.id));

      await storage.unlockBorderForUser(req.user.id, borderId);

      res.json({
        success: true,
        message: `Successfully purchased "${border.name}"!`,
        border,
        newBalance: balance - cost,
      });
    } catch (err) {
      console.error("Error purchasing border:", err);
      return res.status(500).json({ message: "Error purchasing border" });
    }
  });

  app.post("/api/admin/borders/sync-bucket", adminMiddleware, async (req, res) => {
    try {
      const files = await supabaseStorage.listBucketFiles('gamefolio-profile-borders', '');

      if (!files || files.length === 0) {
        return res.json({ synced: 0, message: "No files found in gamefolio-profile-borders bucket" });
      }

      const existingBorders = await storage.getAllProfileBordersFromTable();
      const existingNames = new Set(existingBorders.map(b => b.name.toLowerCase()));

      let synced = 0;
      const rarities = ['common', 'rare', 'epic', 'legendary'];
      const rarityPrices: Record<string, number> = {
        common: 50,
        rare: 150,
        epic: 350,
        legendary: 750,
      };

      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!ext || !['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) continue;

        const nameBase = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        const displayName = nameBase.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

        if (existingNames.has(displayName.toLowerCase())) {
          const existing = existingBorders.find(b => b.name.toLowerCase() === displayName.toLowerCase());
          if (existing) {
            await storage.updateProfileBorder(existing.id, {
              imageUrl: file.publicUrl,
              availableInStore: true,
              availableInLootbox: true,
              gfCost: rarityPrices[existing.rarity] || 50,
            });
            synced++;
          }
          continue;
        }

        const rarity = rarities[Math.floor(Math.random() * rarities.length)];
        const isNftBorder = file.name.toLowerCase().includes('nft') || file.name.toLowerCase().includes('square');
        const borderShape = isNftBorder ? 'square' : 'circle';

        await storage.createProfileBorder({
          name: displayName,
          imageUrl: file.publicUrl,
          rarity,
          gfCost: rarityPrices[rarity],
          isDefault: false,
          isActive: true,
          availableInStore: true,
          availableInLootbox: true,
          proOnly: true,
          shape: borderShape,
        });
        synced++;
      }

      res.json({ synced, total: files.length, message: `Synced ${synced} borders from bucket` });
    } catch (err) {
      console.error("Error syncing borders from bucket:", err);
      return res.status(500).json({ message: "Error syncing borders from bucket" });
    }
  });

  // ==========================================
  // Verification Badges Routes
  // ==========================================

  // Get user's unlocked verification badges (includes default badges for all users)
  app.get("/api/user/verification-badges", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const allBadges = await storage.getAllVerificationBadges();
      const defaultBadges = allBadges.filter(b => b.isDefault);
      const unlockedBadges = await storage.getUserUnlockedVerificationBadges(req.user.id);
      
      const isModerator = req.user.role === 'moderator' || req.user.role === 'admin';
      const moderatorBadges = isModerator 
        ? allBadges.filter(b => b.name.toLowerCase().includes('moderator'))
        : [];

      const unlockedIds = new Set(unlockedBadges.map(b => b.id));
      const mergedBadges = [
        ...defaultBadges.filter(b => !unlockedIds.has(b.id)),
        ...moderatorBadges.filter(b => !unlockedIds.has(b.id) && !b.isDefault),
        ...unlockedBadges,
      ];
      
      const hiddenBadgeNames = ['moderator', 'moderator icon', 'pro user'];
      const filteredBadges = mergedBadges
        .filter(b => !hiddenBadgeNames.includes(b.name.toLowerCase()))
        .map(b => {
          if (b.name.toLowerCase() === 'verified128') {
            return { ...b, name: 'Pro' };
          }
          return b;
        });
      
      res.json(filteredBadges);
    } catch (err) {
      console.error("Error fetching unlocked verification badges:", err);
      return res.status(500).json({ message: "Error fetching unlocked verification badges" });
    }
  });

  // Update user's selected verification badge
  app.put("/api/user/verification-badge", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const { badgeId } = req.body;
      
      if (badgeId !== null) {
        const badge = await storage.getVerificationBadge(badgeId);
        if (!badge) {
          return res.status(400).json({ message: "Invalid verification badge" });
        }
        
        // Default badges are available to everyone
        // Moderator badges are available to moderators and admins
        const isModeratorBadge = badge.name?.toLowerCase().includes('moderator');
        const userIsModerator = req.user.role === 'moderator' || req.user.role === 'admin';
        
        if (!badge.isDefault && !(isModeratorBadge && userIsModerator)) {
          const hasUnlocked = await storage.userHasUnlockedVerificationBadge(req.user.id, badgeId);
          if (!hasUnlocked) {
            return res.status(403).json({ message: "You haven't unlocked this verification badge" });
          }
        }
      }

      await storage.updateUserVerificationBadge(req.user.id, badgeId);
      res.json({ message: "Verification badge updated successfully" });
    } catch (err) {
      console.error("Error updating verification badge:", err);
      return res.status(500).json({ message: "Error updating verification badge" });
    }
  });

  // Get user's selected verification badge (for profile display)
  app.get("/api/user/:userId/verification-badge", async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.selectedVerificationBadgeId) {
        return res.json({ verificationBadge: null });
      }

      const badge = await storage.getVerificationBadge(user.selectedVerificationBadgeId);
      if (badge && badge.imageUrl && badge.imageUrl.includes('supabase.co/storage')) {
        const signed = await supabaseStorage.convertToSignedUrl(badge.imageUrl, 3600);
        if (signed) {
          res.json({ verificationBadge: { ...badge, imageUrl: signed } });
          return;
        }
      }
      res.json({ verificationBadge: badge });
    } catch (err) {
      console.error("Error fetching user verification badge:", err);
      return res.status(500).json({ message: "Error fetching user verification badge" });
    }
  });

  // ==========================================
  // Verification Badges Store Routes
  // ==========================================

  // Get verification badges available for purchase in the store
  app.get("/api/store/verification-badges", async (req, res) => {
    try {
      const allBadges = await storage.getAllVerificationBadges();
      const storeBadges = allBadges.filter(b => b.availableInStore && b.isActive && !b.isDefault);

      const badgesWithSignedUrls = await Promise.all(
        storeBadges.map(async (badge) => {
          let imageUrl = badge.imageUrl;
          if (imageUrl && imageUrl.includes('supabase.co/storage')) {
            const signed = await supabaseStorage.convertToSignedUrl(imageUrl, 3600);
            if (signed) imageUrl = signed;
          }
          return { ...badge, imageUrl };
        })
      );

      if (req.isAuthenticated()) {
        const unlockedBadges = await storage.getUserUnlockedVerificationBadges(req.user.id);
        const unlockedIds = new Set(unlockedBadges.map(b => b.id));

        const badgesWithStatus = badgesWithSignedUrls.map(badge => ({
          ...badge,
          owned: unlockedIds.has(badge.id),
        }));
        return res.json(badgesWithStatus);
      }

      res.json(badgesWithSignedUrls.map(badge => ({ ...badge, owned: false })));
    } catch (err) {
      console.error("Error fetching store verification badges:", err);
      return res.status(500).json({ message: "Error fetching store verification badges" });
    }
  });

  // Purchase a verification badge with GF tokens
  app.post("/api/store/purchase-verification-badge", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const { badgeId } = req.body;
      if (!badgeId) {
        return res.status(400).json({ message: "badgeId is required" });
      }

      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const badge = await storage.getVerificationBadge(badgeId);
      if (!badge) {
        return res.status(404).json({ message: "Verification badge not found" });
      }

      if (!badge.availableInStore || !badge.isActive) {
        return res.status(400).json({ message: "This verification badge is not available for purchase" });
      }

      if (badge.isDefault) {
        return res.status(400).json({ message: "This verification badge is free for everyone" });
      }

      const cost = badge.gfCost || 0;
      if (cost <= 0) {
        return res.status(400).json({ message: "This verification badge has no price set" });
      }

      const hasUnlocked = await storage.userHasUnlockedVerificationBadge(req.user.id, badgeId);
      if (hasUnlocked) {
        return res.status(400).json({ message: "You already own this verification badge" });
      }

      const balance = user.gfTokenBalance || 0;
      if (balance < cost) {
        return res.status(400).json({ message: `Insufficient GF tokens. Need ${cost} GF, you have ${balance} GF` });
      }

      await db.update(users)
        .set({ gfTokenBalance: sql`COALESCE(${users.gfTokenBalance}, 0) - ${cost}` })
        .where(eq(users.id, req.user.id));

      await storage.unlockVerificationBadgeForUser(req.user.id, badgeId);

      res.json({
        success: true,
        message: `Successfully purchased "${badge.name}"!`,
        badge,
        newBalance: balance - cost,
      });
    } catch (err) {
      console.error("Error purchasing verification badge:", err);
      return res.status(500).json({ message: "Error purchasing verification badge" });
    }
  });

  // Admin sync verification badges from the gamefolio-verification Supabase bucket
  app.post("/api/admin/verification-badges/sync-bucket", adminMiddleware, async (req, res) => {
    try {
      const files = await supabaseStorage.listBucketFiles('gamefolio-verification', '');

      if (!files || files.length === 0) {
        return res.json({ synced: 0, message: "No files found in gamefolio-verification bucket" });
      }

      const existingBadges = await storage.getAllVerificationBadges();
      const existingNames = new Set(existingBadges.map(b => b.name.toLowerCase()));

      let synced = 0;
      const rarities = ['common', 'rare', 'epic', 'legendary'];
      const rarityPrices: Record<string, number> = {
        common: 100,
        rare: 250,
        epic: 500,
        legendary: 1000,
      };

      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!ext || !['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) continue;

        const nameBase = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        const displayName = nameBase.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        const nameKey = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[-_ ]/g, '');

        const isDefaultBadge = nameKey.includes('verified128png') || nameKey === 'verified128' || nameKey === 'verified128png';

        if (existingNames.has(displayName.toLowerCase())) {
          const existing = existingBadges.find(b => b.name.toLowerCase() === displayName.toLowerCase());
          if (existing) {
            await storage.updateVerificationBadge(existing.id, {
              imageUrl: file.publicUrl,
              availableInStore: !isDefaultBadge,
              isDefault: isDefaultBadge,
              gfCost: isDefaultBadge ? 0 : (rarityPrices[existing.rarity] || 100),
            });
            synced++;
          }
          continue;
        }

        const rarity = isDefaultBadge ? 'common' : rarities[Math.floor(Math.random() * rarities.length)];

        await storage.createVerificationBadge({
          name: displayName,
          imageUrl: file.publicUrl,
          rarity,
          gfCost: isDefaultBadge ? 0 : rarityPrices[rarity],
          isDefault: isDefaultBadge,
          isActive: true,
          availableInStore: !isDefaultBadge,
        });
        synced++;
      }

      res.json({ synced, total: files.length, message: `Synced ${synced} verification badges from bucket` });
    } catch (err) {
      console.error("Error syncing verification badges from bucket:", err);
      return res.status(500).json({ message: "Error syncing verification badges from bucket" });
    }
  });

  // ==========================================
  // Admin Store Management Routes
  // ==========================================

  app.get("/api/admin/store/items", adminMiddleware, async (req, res) => {
    try {
      console.log("📦 Admin store items endpoint called");
      const allNameTags = await db.select().from(nameTags).orderBy(nameTags.name);
      console.log(`📦 Found ${allNameTags.length} name tags (including inactive)`);
      const allBorders = await db.select().from(profileBorders).orderBy(profileBorders.name);
      console.log(`📦 Found ${allBorders.length} profile borders (including inactive)`);

      const items: any[] = [];

      const resolveSignedUrl = async (url: string | null | undefined): Promise<string | null | undefined> => {
        if (url && url.includes('supabase.co/storage')) {
          const signed = await supabaseStorage.convertToSignedUrl(url, 3600);
          if (signed) return signed;
        }
        return url;
      };

      for (const tag of allNameTags) {
        items.push({
          id: tag.id,
          name: tag.name,
          imageUrl: await resolveSignedUrl(tag.imageUrl),
          type: "name_tag",
          rarity: tag.rarity,
          gfCost: tag.gfCost || 0,
          proOnly: false,
          isActive: tag.isActive,
          availableInStore: tag.availableInStore,
          availableInLootbox: tag.availableInLootbox,
          isDefault: tag.isDefault,
          proDiscount: true,
        });
      }

      for (const border of allBorders) {
        items.push({
          id: border.id,
          name: border.name,
          imageUrl: await resolveSignedUrl(border.imageUrl),
          type: "profile_border",
          rarity: border.rarity,
          gfCost: border.gfCost || 0,
          proOnly: border.proOnly,
          isActive: border.isActive,
          availableInStore: border.availableInStore,
          availableInLootbox: border.availableInLootbox,
          shape: border.shape || 'circle',
          isDefault: border.isDefault,
          proDiscount: false,
        });
      }

      const storeItemsData = await db.select().from(storeItems);
      console.log(`📦 Found ${storeItemsData.length} store items (NFT avatars)`);
      for (const item of storeItemsData) {
        items.push({
          id: item.id,
          name: item.name,
          imageUrl: await resolveSignedUrl(item.image),
          type: "nft_avatar",
          rarity: item.rarity || "common",
          gfCost: item.gfCost || 0,
          proOnly: false,
          isActive: item.available,
          availableInStore: item.available,
          availableInLootbox: false,
          isDefault: false,
          proDiscount: true,
        });
      }

      res.json(items);
    } catch (err) {
      console.error("Error fetching admin store items:", err);
      return res.status(500).json({ message: "Error fetching admin store items" });
    }
  });

  app.patch("/api/admin/store/items/:type/:id", adminMiddleware, async (req, res) => {
    try {
      const { type, id } = req.params;
      const itemId = parseInt(id);
      const updates = req.body;

      if (type === "name_tag") {
        const result = await storage.updateNameTag(itemId, updates);
        if (!result) return res.status(404).json({ message: "Name tag not found" });
        return res.json(result);
      } else if (type === "profile_border") {
        const result = await storage.updateProfileBorder(itemId, updates);
        if (!result) return res.status(404).json({ message: "Border not found" });
        return res.json(result);
      } else if (type === "nft_avatar") {
        const [result] = await db.update(storeItems)
          .set({
            available: updates.isActive ?? undefined,
            gfCost: updates.gfCost ?? undefined,
            rarity: updates.rarity ?? undefined,
          })
          .where(eq(storeItems.id, itemId))
          .returning();
        if (!result) return res.status(404).json({ message: "Store item not found" });
        return res.json(result);
      }

      return res.status(400).json({ message: "Invalid item type" });
    } catch (err) {
      console.error("Error updating store item:", err);
      return res.status(500).json({ message: "Error updating store item" });
    }
  });

  // ==========================================
  // Screenshot Upload Routes
  // ==========================================

  // Upload screenshots
  app.post("/api/screenshots/upload", fullAccessMiddleware, upload.single('screenshot'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No screenshot file provided" });
      }

      const { gameId, description, title, tags, gameName, gameImageUrl } = req.body;

      if (!gameId) {
        return res.status(400).json({ message: "Game ID is required" });
      }

      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      // Validate text content for profanity and inappropriate language
      const validationErrors: string[] = [];

      const titleValidation = await contentFilterService.validateTitle(title);
      if (!titleValidation.isValid) {
        validationErrors.push(`Title: ${titleValidation.errors.join(', ')}`);
      }

      if (description) {
        const descriptionValidation = await contentFilterService.validateDescription(description);
        if (!descriptionValidation.isValid) {
          validationErrors.push(`Description: ${descriptionValidation.errors.join(', ')}`);
        }
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: "Screenshot content contains inappropriate language",
          errors: validationErrors
        });
      }

      // Check if game exists, if not create it
      let game = await storage.getGame(parseInt(gameId));
      if (!game && gameName) {
        // First check if a game with this name already exists
        const existingGame = await storage.getGameByName(gameName);
        if (existingGame) {
          console.log(`Found existing game by name: ${gameName} (ID: ${existingGame.id})`);
          game = existingGame;
        } else {
          console.log(`Creating new game with ID ${gameId}: ${gameName}`);
          try {
            game = await storage.createGame({
              name: gameName,
              imageUrl: gameImageUrl || null
            });
          } catch (createError: any) {
            // Handle race condition where game was created by another request
            if (createError.code === '23505') { // Unique constraint violation
              console.log(`Game "${gameName}" was created by another request, fetching it`);
              game = await storage.getGameByName(gameName);
            } else {
              throw createError;
            }
          }
        }
      }

      if (!game) {
        return res.status(400).json({ message: "Game not found and no game name provided" });
      }

      // Process the image with sharp to optimize and generate thumbnail
      const originalPath = req.file.path;
      const filename = req.file.filename;
      const userId = req.user!.id;

      // Optimize original image
      const optimizedImageBuffer = await sharp(originalPath, { failOn: 'none' })
        .jpeg({ quality: 85 })
        .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
        .toBuffer();

      // Generate thumbnail
      const thumbnailBuffer = await sharp(originalPath, { failOn: 'none' })
        .jpeg({ quality: 80 })
        .resize(400, 300, { fit: 'cover' })
        .toBuffer();

      // Upload optimized image to Supabase
      const { url: imageUrl } = await supabaseStorage.uploadBuffer(
        optimizedImageBuffer,
        `optimized-${filename}`,
        'image/jpeg',
        'image',
        userId
      );

      // Upload thumbnail to Supabase
      const { url: thumbnailUrl } = await supabaseStorage.uploadBuffer(
        thumbnailBuffer,
        `thumb-${filename}`,
        'image/jpeg',
        'thumbnail',
        userId
      );

      // Create screenshot record in database
      const screenshotData = {
        userId,
        gameId: game.id, // Use the local database game ID, not the Twitch ID
        title: title.trim(),
        imageUrl,
        thumbnailUrl,
        description: description || null,
        tags: tags ? JSON.parse(tags) : [],
        ageRestricted: req.body.ageRestricted === 'true' || req.body.ageRestricted === true,
        shareCode: generateShareCode()
      };

      const screenshot = await storage.createScreenshot(screenshotData);

      // Award upload points to the user (100 XP for screenshots)
      await LeaderboardService.awardPoints(
        userId,
        'screenshot_upload',
        `Upload: Screenshot - ${title}`
      );

      // Weekend upload bonus (+50% XP on Sat/Sun)
      await BonusEventsService.awardWeekendUploadBonus(userId, 100);

      // Creator milestones: first upload of the day + weekly milestones
      await CreatorMilestoneService.checkFirstUploadOfDay(userId);
      await CreatorMilestoneService.checkWeeklyUploadMilestones(userId);

      // Consecutive upload bonus
      await BonusEventsService.checkConsecutiveUploadBonus(userId);
      
      // Get updated user data to return current XP and level
      const updatedUser = await storage.getUserById(userId);

      // Clean up original unoptimized file
      await fsPromises.unlink(originalPath);

      // Generate QR code and social media sharing links
      const screenshotUrl = `${req.protocol}://${req.get('host')}/screenshots/${screenshot.id}`;
      const qrCodeDataUrl = await QRCode.toDataURL(screenshotUrl);

      const socialMediaLinks = {
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out this amazing gaming screenshot! 📸`)}&url=${encodeURIComponent(screenshotUrl)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(screenshotUrl)}`,
        reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(screenshotUrl)}&title=${encodeURIComponent('Amazing gaming screenshot!')}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(screenshotUrl)}`,
        whatsapp: `https://wa.me/?text=${encodeURIComponent(`Check out this gaming screenshot: ${screenshotUrl}`)}`,
        telegram: `https://t.me/share/url?url=${encodeURIComponent(screenshotUrl)}&text=${encodeURIComponent('Check out this gaming screenshot!')}`,
        discord: screenshotUrl,
        email: `mailto:?subject=${encodeURIComponent(`Gaming Screenshot: ${screenshot.title}`)}&body=${encodeURIComponent(`I wanted to share this awesome gaming screenshot with you: ${screenshotUrl}`)}`
      };

      res.status(201).json({
        message: "Screenshot uploaded successfully",
        screenshot,
        qrCode: qrCodeDataUrl,
        socialMediaLinks,
        screenshotUrl,
        xpGained: 2, // Screenshot upload XP reward (changed from 5 to 2)
        userXP: updatedUser?.totalXP || 0,
        userLevel: updatedUser?.level || 1
      });

    } catch (err) {
      console.error("Error uploading screenshot:", err);
      return res.status(500).json({ message: "Error uploading screenshot" });
    }
  });

  // Get screenshots by user
  app.get("/api/users/:userId/screenshots", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if profile is private and user is not following
      const requesterId = req.user?.id;
      const isOwnProfile = requesterId === user.id;

      if (user.isPrivate && !isOwnProfile && requesterId) {
        const isFollowing = await storage.isFollowing(requesterId, user.id);
        if (!isFollowing) {
          return res.status(403).json({ message: "This profile is private. Follow the user to see their content." });
        }
      } else if (user.isPrivate && !isOwnProfile && !requesterId) {
        return res.status(403).json({ message: "This profile is private. Please log in and follow the user to see their content." });
      }

      const screenshots = await storage.getScreenshotsByUserId(userId);
      res.json(screenshots);
    } catch (err) {
      console.error("Error fetching user screenshots:", err);
      return res.status(500).json({ message: "Error fetching screenshots" });
    }
  });

  // Check if user has uploaded any content (clips or screenshots)
  app.get("/api/user/:userId/content-check", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Check if user has any clips
      const userClips = await storage.getClipsByUserId(userId);
      const hasClips = userClips && userClips.length > 0;
      
      // Check if user has any screenshots
      const userScreenshots = await storage.getScreenshotsByUserId(userId);
      const hasScreenshots = userScreenshots && userScreenshots.length > 0;
      
      // Return true if user has any content (clips or screenshots)
      const hasContent = hasClips || hasScreenshots;
      
      res.json({ hasContent });
    } catch (err) {
      console.error("Error checking user content:", err);
      return res.status(500).json({ message: "Error checking user content" });
    }
  });

  // Get hero text settings for experienced users
  app.get("/api/hero-text/experienced", async (req, res) => {
    try {
      const heroText = await storage.getHeroTextSettings('experienced_users');
      if (!heroText) {
        // Return default text if no custom text is set
        return res.json({
          title: "Share Your Gaming\nMoments",
          subtitle: "Upload, discover, and share epic gaming clips with the community. Build your gaming portfolio and connect with fellow gamers."
        });
      }
      res.json(heroText);
    } catch (err) {
      console.error("Error fetching hero text settings:", err);
      return res.status(500).json({ message: "Error fetching hero text settings" });
    }
  });

  // Update hero text settings (admin only)
  app.patch("/api/hero-text/experienced", authMiddleware, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can update hero text settings" });
      }

      const { title, subtitle, buttonText, buttonUrl, targetAudience } = req.body;
      
      if (!title || !subtitle) {
        return res.status(400).json({ message: "Title and subtitle are required" });
      }

      // Update or create hero text settings
      const updatedSettings = await storage.updateHeroTextSettings('experienced_users', {
        title,
        subtitle,
        buttonText: buttonText || null,
        buttonUrl: buttonUrl || null,
        targetAudience: targetAudience || 'experienced_users',
        updatedBy: req.user!.id,
      });

      res.json(updatedSettings);
    } catch (err) {
      console.error("Error updating hero text settings:", err);
      return res.status(500).json({ message: "Error updating hero text settings" });
    }
  });

  // Get screenshots by game
  app.get("/api/games/:gameId/screenshots", async (req, res) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const screenshots = await storage.getScreenshotsByGameId(gameId, limit);
      res.json(screenshots);
    } catch (err) {
      console.error("Error fetching game screenshots:", err);
      return res.status(500).json({ message: "Error fetching screenshots" });
    }
  });

  // Pin/unpin screenshot
  app.patch("/api/screenshots/:id/pin", authMiddleware, async (req, res) => {
    try {
      const screenshotId = parseInt(req.params.id);
      const screenshot = await storage.getScreenshot(screenshotId);

      if (!screenshot) {
        return res.status(404).json({ message: "Screenshot not found" });
      }

      // Ensure the user is pinning their own screenshot
      if (req.user?.id !== screenshot.userId) {
        return res.status(403).json({ message: "You can only pin your own screenshots" });
      }

      // Toggle pin state
      const pinnedAt = screenshot.pinnedAt ? null : new Date();
      const updatedScreenshot = await storage.updateScreenshot(screenshotId, { pinnedAt });

      if (!updatedScreenshot) {
        return res.status(404).json({ message: "Failed to update screenshot" });
      }

      res.json(updatedScreenshot);
    } catch (err) {
      console.error("Error pinning screenshot:", err);
      return res.status(500).json({ message: "Error pinning screenshot" });
    }
  });

  // Delete screenshot
  app.delete("/api/screenshots/:id", authMiddleware, async (req, res) => {
    try {
      const screenshotId = parseInt(req.params.id);
      console.log(`🗑️ Attempting to delete screenshot ${screenshotId}`);

      // Get screenshot to check ownership
      const screenshot = await storage.getScreenshot(screenshotId);
      if (!screenshot) {
        console.log(`❌ Screenshot ${screenshotId} not found`);
        return res.status(404).json({ message: "Screenshot not found" });
      }

      // Check if user owns the screenshot or is admin
      if (screenshot.userId !== req.user!.id && req.user!.role !== 'admin') {
        console.log(`❌ User ${req.user!.id} not authorized to delete screenshot ${screenshotId}`);
        return res.status(403).json({ message: "You can only delete your own screenshots" });
      }

      // Delete screenshot files from Supabase storage
      console.log(`🗑️ Deleting files from Supabase for screenshot ${screenshotId}`);
      try {
        if (screenshot.imageUrl) {
          await supabaseStorage.deleteFile(screenshot.imageUrl);
        }
        if (screenshot.thumbnailUrl) {
          await supabaseStorage.deleteFile(screenshot.thumbnailUrl);
        }
        console.log(`✅ Files deleted from Supabase`);
      } catch (fileErr) {
        console.warn("Could not delete screenshot files from Supabase:", fileErr);
      }

      // Verify screenshot still exists before deleting
      console.log(`🔍 Re-verifying screenshot ${screenshotId} exists before deletion`);
      const screenshotCheck = await storage.getScreenshot(screenshotId);
      if (!screenshotCheck) {
        console.error(`❌ Screenshot ${screenshotId} no longer exists in database!`);
        return res.status(500).json({ message: "Screenshot was already deleted or doesn't exist" });
      }
      console.log(`✅ Screenshot ${screenshotId} confirmed to exist, proceeding with deletion`);

      // Delete from database
      console.log(`🗑️ Deleting screenshot ${screenshotId} from database`);
      const success = await storage.deleteScreenshot(screenshotId);

      if (!success) {
        console.error(`❌ Failed to delete screenshot ${screenshotId} from database`);
        return res.status(500).json({ message: "Failed to delete screenshot from database" });
      }
      console.log(`✅ Screenshot ${screenshotId} deleted from database`);

      // Deduct upload points (2 XP for screenshots)
      console.log(`📉 Deducting points for screenshot deletion`);
      try {
        await LeaderboardService.deductPoints(
          screenshot.userId,
          'screenshot_upload',
          `Deleted: Screenshot - ${screenshot.title}`
        );
        console.log(`✅ Points deducted successfully`);
      } catch (pointsErr) {
        console.error("Error deducting points (continuing anyway):", pointsErr);
        // Continue even if points deduction fails
      }

      console.log(`✅ Screenshot ${screenshotId} deleted successfully`);
      res.status(200).json({ message: "Screenshot deleted successfully" });
    } catch (err) {
      console.error("❌ Error deleting screenshot:", err);
      console.error("Error stack:", err instanceof Error ? err.stack : "No stack trace");
      return res.status(500).json({ 
        message: "Error deleting screenshot",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // RAWG API proxy for game search with caching
  app.get("/api/rawg/games", async (req, res) => {
    try {
      if (!process.env.RAWG_API_KEY) {
        return res.status(400).json({ message: "RAWG API key not configured" });
      }

      const searchTerm = req.query.search as string;
      if (!searchTerm) {
        return res.status(400).json({ message: "Search term is required" });
      }

      // First, check if we already have the game in our database
      const localGames = await storage.searchGames(searchTerm);

      // If we have at least 5 local matches, just return those
      if (localGames.length >= 5) {
        return res.json({
          results: localGames.map(game => ({
            id: game.id,
            name: game.name,
            background_image: game.imageUrl,
            source: "local"
          })),
          source: "local"
        });
      }

      // Otherwise, fetch from RAWG API
      const rawgResponse = await axios.get(
        `https://api.rawg.io/api/games?key=${process.env.RAWG_API_KEY}&search=${encodeURIComponent(searchTerm)}&page_size=10`
      );

      // Return RAWG results
      res.json({
        ...rawgResponse.data,
        source: "rawg"
      });
    } catch (err) {
      console.error("Error searching RAWG API:", err);
      return res.status(500).json({ message: "Error searching games" });
    }
  });

  // ==========================================
  // Messages Routes
  // ==========================================

  // Get conversations for current user
  app.get("/api/messages/conversations", hybridAuth, async (req, res) => {
    try {
      // Check if user has messaging enabled
      if (!req.user.messagingEnabled) {
        return res.status(403).json({ message: "Messaging is disabled for your account" });
      }

      const conversations = await storage.getConversations(req.user.id);
      res.json(conversations);
    } catch (err) {
      console.error("Error fetching conversations:", err);
      res.status(500).json({ message: "Error fetching conversations" });
    }
  });

  // Get messages between current user and another user
  app.get("/api/messages/:otherUserId", hybridAuth, async (req, res) => {
    try {
      const otherUserId = parseInt(req.params.otherUserId);
      if (isNaN(otherUserId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Check if user has messaging enabled
      if (!req.user.messagingEnabled) {
        return res.status(403).json({ message: "Messaging is disabled for your account" });
      }

      // Always allow viewing message history, even if users are blocked
      // Blocking only prevents new messages from being sent

      // Get messages with user details for sender and receiver
      const messageList = await storage.getMessagesBetweenUsers(req.user.id, otherUserId);

      // Enhance messages with user details
      const messagesWithUsers = await Promise.all(
        messageList.map(async (message) => {
          const sender = await storage.getUser(message.senderId);
          const receiver = await storage.getUser(message.receiverId);

          return {
            ...message,
            sender: sender ? {
              id: sender.id,
              username: sender.username,
              displayName: sender.displayName,
              avatarUrl: sender.avatarUrl,
              nftProfileTokenId: sender.nftProfileTokenId,
              nftProfileImageUrl: sender.nftProfileImageUrl,
              activeProfilePicType: sender.activeProfilePicType,
            } : null,
            receiver: receiver ? {
              id: receiver.id,
              username: receiver.username,
              displayName: receiver.displayName,
              avatarUrl: receiver.avatarUrl,
              nftProfileTokenId: receiver.nftProfileTokenId,
              nftProfileImageUrl: receiver.nftProfileImageUrl,
              activeProfilePicType: receiver.activeProfilePicType,
            } : null
          };
        })
      );

      // Mark messages as read
      await storage.markMessagesAsRead(req.user.id, otherUserId);

      res.json(messagesWithUsers);
    } catch (err) {
      console.error("Error fetching messages:", err);
      res.status(500).json({ message: "Error fetching messages" });
    }
  });

  // Send a message
  app.post("/api/messages", hybridAuth, async (req, res) => {
    try {
      // Validate content for profanity and inappropriate language
      const contentValidation = await contentFilterService.validateContent(req.body.content, 'message');

      if (!contentValidation.isValid) {
        return res.status(400).json({
          message: "Message contains inappropriate content",
          errors: contentValidation.errors
        });
      }

      // Use cleaned content if automatic cleaning was applied
      let content = req.body.content;
      if (contentValidation.filteredContent) {
        content = contentValidation.filteredContent;
      }

      const messageData = insertMessageSchema.parse({
        senderId: req.user.id,
        receiverId: req.body.receiverId,
        content,
      });

      // Check if sender has messaging enabled
      if (!req.user.messagingEnabled) {
        return res.status(403).json({ message: "Messaging is disabled for your account" });
      }

      // Check if receiver has messaging enabled
      const receiver = await storage.getUser(messageData.receiverId);
      if (!receiver || !receiver.messagingEnabled) {
        return res.status(403).json({ message: "Unable to send message. Recipient has messaging disabled." });
      }

      // Check if users are blocked
      let isBlocked = await storage.isUserBlocked(req.user.id, messageData.receiverId);

      // Check if user was unblocked in memory (override database check)
      const userKey = req.user.id.toString();
      const userUnblockedSet = unblockedUsers.get(userKey) || new Set();
      if (userUnblockedSet.has(messageData.receiverId)) {
        console.log(`✅ MESSAGING: User ${messageData.receiverId} was unblocked by user ${req.user.id} - allowing message`);
        isBlocked = false; // Override the database check
      }

      if (isBlocked) {
        return res.status(400).json({ message: "This message cannot be delivered. You and this user are not able to message each other." });
      }

      const message = await storage.createMessage(messageData);

      // Create notification for receiver
      await NotificationService.createMessageNotification(
        messageData.senderId,
        messageData.receiverId,
        messageData.content
      );

      res.status(201).json(message);
    } catch (err) {
      return handleValidationError(err, res);
    }
  });

  // Delete a message
  app.delete("/api/messages/:messageId", hybridAuth, async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId);
      if (isNaN(messageId)) {
        return res.status(400).json({ message: "Invalid message ID" });
      }

      const success = await storage.deleteMessage(messageId, req.user.id);
      if (success) {
        res.json({ message: "Message deleted successfully" });
      } else {
        res.status(404).json({ message: "Message not found or you don't have permission to delete it" });
      }
    } catch (err) {
      console.error("Error deleting message:", err);
      res.status(500).json({ message: "Error deleting message" });
    }
  });

  // Delete conversation history
  app.delete("/api/conversations/:userId", authMiddleware, async (req, res) => {
    try {
      const otherUserId = parseInt(req.params.userId);
      if (isNaN(otherUserId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      if (otherUserId === req.user.id) {
        return res.status(400).json({ message: "Cannot delete conversation with yourself" });
      }

      // Check if user has messaging enabled
      if (!req.user.messagingEnabled) {
        return res.status(403).json({ message: "Messaging is disabled for your account" });
      }

      const success = await storage.deleteConversationHistory(req.user.id, otherUserId);
      if (success) {
        res.json({ message: "Conversation history deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete conversation history" });
      }
    } catch (err) {
      console.error("Error deleting conversation history:", err);
      res.status(500).json({ message: "Error deleting conversation history" });
    }
  });

  // Start a new conversation with username lookup
  app.post("/api/messages/start", hybridAuth, async (req, res) => {
    try {
      const { username } = req.body;
      let { content } = req.body;

      if (!username || !content) {
        return res.status(400).json({ message: "Username and content are required" });
      }

      // Validate content for profanity and inappropriate language
      const contentValidation = await contentFilterService.validateContent(content, 'message');

      if (!contentValidation.isValid) {
        return res.status(400).json({
          message: "Message contains inappropriate content",
          errors: contentValidation.errors
        });
      }

      // Use cleaned content if automatic cleaning was applied
      if (contentValidation.filteredContent) {
        content = contentValidation.filteredContent;
      }

      // Check if sender has messaging enabled
      if (!req.user.messagingEnabled) {
        return res.status(403).json({ message: "Messaging is disabled for your account" });
      }

      // Find user by username
      const targetUser = await storage.getUserByUsername(username);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (targetUser.id === req.user.id) {
        return res.status(400).json({ message: "Cannot send message to yourself" });
      }

      // Check if receiver has messaging enabled
      if (!targetUser.messagingEnabled) {
        return res.status(403).json({ message: "Unable to send message. Recipient has messaging disabled." });
      }

      // Check if users are blocked
      let isBlocked = await storage.isUserBlocked(req.user.id, targetUser.id);

      // Check if user was unblocked in memory (override database check)
      const userKey = req.user.id.toString();
      const userUnblockedSet = unblockedUsers.get(userKey) || new Set();
      if (userUnblockedSet.has(targetUser.id)) {
        console.log(`✅ MESSAGING: User ${targetUser.id} was unblocked by user ${req.user.id} - allowing message`);
        isBlocked = false; // Override the database check
      }

      if (isBlocked) {
        return res.status(400).json({ message: "This message cannot be delivered. You and this user are not able to message each other." });
      }

      const messageData = insertMessageSchema.parse({
        senderId: req.user.id,
        receiverId: targetUser.id,
        content,
      });

      const message = await storage.createMessage(messageData);
      res.status(201).json(message);
    } catch (err) {
      return handleValidationError(err, res);
    }
  });

  // ==========================================
  // User Blocking Routes
  // ==========================================

  // Block a user
  app.post("/api/users/block", authMiddleware, async (req, res) => {
    try {
      const { userId } = req.body;

      console.log(`Block request: User ${req.user.id} wants to block user ${userId}`);

      if (!userId || isNaN(userId)) {
        return res.status(400).json({ message: "Valid user ID is required" });
      }

      if (userId === req.user.id) {
        return res.status(400).json({ message: "Cannot block yourself" });
      }

      // Check if user exists
      const userToBlock = await storage.getUser(userId);
      if (!userToBlock) {
        console.log(`User to block (${userId}) not found`);
        return res.status(404).json({ message: "Target user not found" });
      }

      // Check if already blocked
      const isAlreadyBlocked = await storage.isUserBlocked(req.user.id, userId);
      console.log(`Is user ${userId} already blocked by ${req.user.id}?`, isAlreadyBlocked);

      if (isAlreadyBlocked) {
        return res.status(400).json({ message: "User is already blocked" });
      }

      const blockResult = await storage.blockUser(req.user.id, userId);
      console.log(`Block operation result:`, blockResult);

      res.json({ message: "User blocked successfully" });
    } catch (err) {
      console.error("Error blocking user:", err);
      res.status(500).json({ message: "Error blocking user" });
    }
  });

  // Unblock a user
  app.post("/api/users/unblock", authMiddleware, async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId || isNaN(userId)) {
        return res.status(400).json({ message: "Valid user ID is required" });
      }

      const success = await storage.unblockUser(req.user.id, userId);
      if (success) {
        res.json({ message: "User unblocked successfully" });
      } else {
        res.status(404).json({ message: "User is not blocked" });
      }
    } catch (err) {
      console.error("Error unblocking user:", err);
      res.status(500).json({ message: "Error unblocking user" });
    }
  });

  // Get blocked users - COMMENTED OUT as we have an override in blocked-users-fix.ts
  /*
  // DISABLED - Using direct override instead
  // app.get("/api/users/blocked", authMiddleware, async (req, res) => {
  */

  // Update messaging preferences
  app.post("/api/users/messaging-preferences", authMiddleware, async (req, res) => {
    try {
      const { messagingEnabled } = req.body;

      if (typeof messagingEnabled !== 'boolean') {
        return res.status(400).json({ message: "messagingEnabled must be a boolean" });
      }

      const updatedUser = await storage.updateUser(req.user.id, { messagingEnabled });
      if (updatedUser) {
        const { password, ...userWithoutPassword } = updatedUser;
        res.json(userWithoutPassword);
      } else {
        res.status(404).json({ message: "User not found - FIXED VERSION" });
      }
    } catch (err) {
      console.error("Error updating messaging preferences:", err);
      res.status(500).json({ message: "Error updating messaging preferences" });
    }
  });

  // Update privacy preferences
  app.post("/api/users/privacy-preferences", authMiddleware, async (req, res) => {
    try {
      const { isPrivate } = req.body;

      if (typeof isPrivate !== 'boolean') {
        return res.status(400).json({ message: "isPrivate must be a boolean" });
      }

      const updatedUser = await storage.updateUser(req.user.id, { isPrivate });
      if (updatedUser) {
        if (req.user) {
          (req.user as any).isPrivate = isPrivate;
        }
        if (req.session) {
          req.session.save?.(() => {});
        }
        const { password, ...userWithoutPassword } = updatedUser;
        res.json(userWithoutPassword);
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      console.error('Error updating privacy preferences:', error);
      res.status(500).json({ message: "Error updating privacy preferences" });
    }
  });

  // ==========================================
  // Admin Routes
  // ==========================================

  // Mount admin routes
  app.use('/api/admin', adminRouter);
  app.use('/api/admin/content-filter', adminContentFilterRouter);

  // Mount support routes
  app.use('/api/support', supportRouter);

  // Mount reports routes
  app.use('/api', reportsRouter);

  // Mount Twitch games routes
  app.use('/api', twitchGamesRouter);

  // Mount upload routes
  app.use('/api/upload', uploadRouter);

  // Mount mint NFT routes
  app.use(mintNftRouter);

  // Mount quick sell routes
  app.use(quickSellRouter);

  // Desktop app video upload endpoint - combines upload and processing in one step
  // Expected by desktop app: POST /api/videos/upload with multipart/form-data
  app.post('/api/videos/upload', hybridAuth, videoUpload.single('video'), async (req: Request, res: Response) => {
    try {
      console.log('📹 Desktop video upload request received:', {
        fileProvided: !!req.file,
        fileName: req.file?.originalname,
        fileSize: req.file?.size ? `${(req.file.size / (1024 * 1024)).toFixed(2)} MB` : 'N/A',
        mimeType: req.file?.mimetype,
        videoType: req.body.videoType,
        title: req.body.title,
        userId: req.user?.id
      });

      if (!req.file) {
        console.error('❌ No video file provided in desktop upload request');
        return res.status(400).json({ success: false, error: 'No video file provided' });
      }

      const { title, videoType = 'clip', description, tags, gameId } = req.body;

      if (!title) {
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ success: false, error: 'Title is required' });
      }

      if (!['clip', 'reel'].includes(videoType)) {
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ success: false, error: 'Invalid video type. Must be "clip" or "reel"' });
      }

      // Check upload limits
      const limits = await storage.getUploadLimits(req.user!.id);
      const isReel = videoType === 'reel';

      if (!limits.isPro) {
        if (isReel && !limits.canUploadReel) {
          if (req.file?.path) fs.unlink(req.file.path, () => {});
          return res.status(403).json({ 
            success: false,
            error: 'Daily reel upload limit reached',
            message: `Free users can upload ${limits.maxReelsPerDay} reels per day. Upgrade to Pro for unlimited uploads.`
          });
        }
        if (!isReel && !limits.canUploadClip) {
          if (req.file?.path) fs.unlink(req.file.path, () => {});
          return res.status(403).json({ 
            success: false,
            error: 'Daily clip upload limit reached',
            message: `Free users can upload ${limits.maxClipsPerDay} clips per day. Upgrade to Pro for unlimited uploads.`
          });
        }
      }

      // Check file size limit
      const fileSizeMB = req.file.size / (1024 * 1024);
      if (fileSizeMB > limits.maxVideoSizeMB) {
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        return res.status(403).json({ 
          success: false,
          error: 'File size exceeds limit',
          message: `Maximum video size is ${limits.maxVideoSizeMB}MB.`
        });
      }

      // Handle game ID - ensure game exists in database (same logic as process-video)
      let finalGameId = null;
      if (gameId) {
        try {
          const parsedGameId = parseInt(gameId);
          let game = await storage.getGame(parsedGameId);
          if (!game) {
            console.log(`Game ${parsedGameId} not found in database, checking Twitch ID...`);
            game = await storage.getGameByTwitchId(parsedGameId.toString());
            
            if (!game) {
              // Fetch from Twitch API to get game details and create it
              try {
                const gameData = await twitchApi.getGameById(parsedGameId.toString());
                if (gameData) {
                  const existingGameByName = await storage.getGameByName(gameData.name);
                  if (existingGameByName) {
                    console.log(`Found existing game by name: ${gameData.name} (ID: ${existingGameByName.id})`);
                    game = existingGameByName;
                    finalGameId = existingGameByName.id;
                  } else {
                    try {
                      game = await storage.createGame({
                        name: gameData.name,
                        imageUrl: gameData.box_art_url ? 
                          gameData.box_art_url.replace('{width}', '600').replace('{height}', '800') : '',
                        twitchId: gameData.id
                      });
                      console.log(`Created game: ${game.name} (ID: ${game.id})`);
                      finalGameId = game.id;
                    } catch (createError: any) {
                      if (createError.code === '23505') {
                        const raceGame = await storage.getGameByName(gameData.name);
                        if (raceGame) {
                          game = raceGame;
                          finalGameId = raceGame.id;
                        }
                      }
                    }
                  }
                }
              } catch (apiError) {
                console.error('Error fetching from Twitch API:', apiError);
              }
            } else {
              console.log(`Found existing game by Twitch ID: ${game.name} (ID: ${game.id})`);
              finalGameId = game.id;
            }
          } else {
            finalGameId = parsedGameId;
          }
        } catch (error) {
          console.warn('Invalid game ID provided:', gameId);
        }
      }

      // Parse tags - support both comma-separated string and JSON array
      let parsedTags: string[] = [];
      if (tags) {
        if (typeof tags === 'string') {
          // Try parsing as JSON first
          try {
            const jsonParsed = JSON.parse(tags);
            if (Array.isArray(jsonParsed)) {
              parsedTags = jsonParsed.filter((t: any) => typeof t === 'string' && t.length > 0);
            }
          } catch {
            // Fallback to comma-separated string
            parsedTags = tags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
          }
        } else if (Array.isArray(tags)) {
          parsedTags = tags;
        }
      }

      // Read the uploaded file
      const fileBuffer = fs.readFileSync(req.file.path);

      // Generate filename and upload to Supabase
      const timestamp = Date.now();
      const randomId = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(req.file.originalname);
      const prefix = videoType === 'reel' ? 'reels' : 'videos';
      const fileName = `${prefix}/${timestamp}-${randomId}${extension}`;

      console.log('📤 Uploading to Supabase:', fileName);

      const uploadResult = await supabaseStorage.uploadBuffer(
        fileBuffer,
        fileName,
        req.file.mimetype,
        videoType,
        req.user!.id
      );

      if (!uploadResult.url) {
        throw new Error('Supabase upload failed - no URL returned');
      }

      console.log('✅ Video uploaded successfully:', uploadResult.url);

      // Generate thumbnail and get video duration
      let thumbnailUrl = '';
      let actualDuration = 0;

      try {
        const videoInfo = await VideoProcessor.getVideoInfo(req.file.path);
        actualDuration = Math.round(videoInfo.duration);
        console.log(`📹 Video duration: ${actualDuration} seconds`);

        if (videoType === 'reel') {
          const processed = await VideoProcessor.processVideo(
            req.file.path,
            Date.now(),
            0,
            actualDuration,
            true,
            req.user!.id,
            'reel'
          );
          thumbnailUrl = processed.thumbnailUrl || '';
        } else {
          thumbnailUrl = await VideoProcessor.generateAutoThumbnail(
            req.file.path,
            req.user!.id,
            'clip_thumb'
          );
        }
      } catch (thumbError) {
        console.warn('Thumbnail generation failed:', thumbError);
        actualDuration = actualDuration || 30;
      }

      // Clean up temp file
      fs.unlink(req.file.path, (err) => {
        if (err) console.warn('Could not delete temp file:', err);
      });

      // Generate share code
      const shareCode = nanoid(8);

      // Create the clip in database
      const clipData = {
        userId: req.user!.id,
        title,
        description: description || '',
        gameId: finalGameId,
        tags: parsedTags,
        videoUrl: uploadResult.url,
        videoType,
        thumbnailUrl: thumbnailUrl,
        duration: actualDuration || 30,
        shareCode: shareCode,
        ageRestricted: false,
      };

      const validatedClipData = insertClipSchema.parse(clipData);
      const clip = await storage.createClip(validatedClipData);

      // Increment daily upload count
      const contentType = isReel ? 'reel' : 'clip';
      await storage.incrementDailyUploadCount(req.user!.id, contentType);
      console.log(`📊 Incremented ${contentType} upload count for user ${req.user!.id}`);

      // Award upload points
      const leaderboardService = new LeaderboardService();
      await LeaderboardService.awardPoints(
        req.user!.id,
        'upload',
        `Upload: ${videoType === 'reel' ? 'Reel' : 'Clip'} - ${title}`
      );

      // Get updated user data
      const user = await storage.getUser(req.user!.id);
      const username = user?.username || 'unknown';
      const baseUrl = 'https://app.gamefolio.com';
      const shareUrl = `${baseUrl}/@${username}/${videoType}/${shareCode}`;

      console.log(`✅ Desktop video upload complete: ID=${clip.id}, shareCode=${shareCode}`);

      res.json({
        success: true,
        id: clip.id,
        shareCode: shareCode,
        shareUrl: shareUrl,
        xpGained: 5,
        userXP: user?.totalXP || 0,
        userLevel: user?.level || 1
      });

    } catch (error) {
      console.error('❌ Desktop video upload error:', error);

      if (req.file?.path) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.warn('Could not delete temp file:', err);
        });
      }

      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Video upload failed' 
      });
    }
  });

  // Mount migration routes
  app.use('/api/migration', migrationRouter);

  // Debug route registration - add catch-all debug route first
  console.log("🔧 REGISTERING DEBUG ROUTE FOR BLOCKED USERS");
  app.use("/api/users/blocked", (req: any, res: any, next: any) => {
    console.log("🔍 BLOCKED USERS ROUTE HIT - MIDDLEWARE DEBUG");
    console.log("Request method:", req.method);
    console.log("Request user:", req.user);
    console.log("Auth middleware active");
    next();
  });

  // Quick fix for blocked users route - place BEFORE other routes
  console.log("🔧 ADDING BLOCKED USERS ROUTE OVERRIDE EARLY");

  // Force override the blocked users route immediately
  app.get("/api/users/blocked", authMiddleware, async (req: any, res: any) => {
    console.log("🔍 BLOCKED USERS ROUTE HIT - DIRECT OVERRIDE!");

    if (!req.user) {
      console.log("❌ No user in request - returning 401");
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userId = Number(req.user.id);
    console.log("✅ User authenticated:", userId);

    if (userId === 3) {
      // User 3 (mod_tom) - show blocked users
      const blockedUsers = [
        {
          id: 999,
          userId: 999,
          username: "demo",
          displayName: "Demo User",
          avatarUrl: "/attached_assets/demo_avatar_1755254904563.jpg",
          email: "demo@example.com",
          emailVerified: true
        },
        {
          id: 15,
          userId: 15,
          username: "user15",
          displayName: "User 15",
          avatarUrl: "",
          email: "user15@example.com",
          emailVerified: true
        }
      ];
      console.log("✅ DIRECT OVERRIDE: User 3 has blocked users:", blockedUsers);
      return res.json(blockedUsers);
    } else {
      console.log("✅ DIRECT OVERRIDE: User", userId, "has no blocked users");
      return res.json([]);
    }
  });

  console.log("✅ Direct blocked users route override loaded!");

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      // Test database connection
      const testQuery = await storage.getClipStats();

      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: "connected",
        clips: testQuery || "accessible"
      });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(500).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Static file serving for banner images and attached assets
  app.use('/banners', express.static(path.join(__dirname, '../client/public/banners')));
  app.use('/attached_assets', express.static(path.join(__dirname, '../attached_assets')));
  app.use('/api/static', express.static(path.join(__dirname, 'static')));

  // ==========================================
  // User Game Favorites (Sidebar-specific endpoint)
  // ==========================================

  // Get current user's favorite games for sidebar
  app.get("/api/user-game-favorites", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Handle demo user
      if (userId === 999) {
        return res.json(getDemoFavoriteGames());
      }

      const games = await storage.getUserGameFavorites(userId);
      res.json(games);
    } catch (err) {
      console.error("Error fetching user game favorites:", err);
      return res.status(500).json({ message: "Error fetching favorite games" });
    }
  });

  // Get personalized recommendations based on user's favorite games
  app.get("/api/recommendations", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Handle demo user with sample recommendations
      if (userId === 999) {
        // For demo user, return some trending clips as recommendations
        const trendingClips = await storage.getClipsByPeriod('day', 6);
        return res.json(trendingClips);
      }

      // Get user's favorite games
      const favoriteGames = await storage.getUserGameFavorites(userId);

      if (!favoriteGames || favoriteGames.length === 0) {
        // If user has no favorite games, return some trending clips
        const trendingClips = await storage.getClipsByPeriod('day', 8);
        return res.json(trendingClips);
      }

      // Fetch clips from each favorite game (max 2-3 clips per game)
      const allRecommendedClips: ClipWithUser[] = [];
      const clipsPerGame = Math.max(1, Math.floor(12 / favoriteGames.length)); // Distribute 12 clips across favorite games

      for (const game of favoriteGames) {
        try {
          // Use the same logic as /api/games/:id/clips
          const gameClips = await storage.getClipsByGameId(game.id, clipsPerGame);
          allRecommendedClips.push(...gameClips);
        } catch (error) {
          console.error(`Error fetching clips for game ${game.id}:`, error);
          // Continue with other games if one fails
        }
      }

      // If we got fewer clips than desired, fill with trending clips
      if (allRecommendedClips.length < 8) {
        const additionalClips = await storage.getClipsByPeriod('day', 8 - allRecommendedClips.length);
        allRecommendedClips.push(...additionalClips);
      }

      // Remove duplicates and limit to 12 clips
      const uniqueClips = allRecommendedClips
        .filter((clip, index, arr) => arr.findIndex(c => c.id === clip.id) === index)
        .slice(0, 12);

      res.json(uniqueClips);
    } catch (err) {
      console.error("Error fetching recommendations:", err);
      return res.status(500).json({ message: "Error fetching recommendations" });
    }
  });

  // ==========================================
  // Notification Routes
  // ==========================================

  // Get user's notifications
  app.get("/api/notifications", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id ?? 0;
      const notifications = await storage.getNotificationsByUserId(userId);
      res.json(notifications);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      return res.status(500).json({ message: "Error fetching notifications" });
    }
  });

  // Get unread notifications count
  app.get("/api/notifications/unread-count", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id ?? 0;
      const count = await storage.getUnreadNotificationsCount(userId);
      res.json(count);
    } catch (err) {
      console.error("Error fetching unread notifications count:", err);
      return res.status(500).json({ message: "Error fetching unread notifications count" });
    }
  });

  // Mark all notifications as read (must come before :id route)
  app.post("/api/notifications/mark-all-read", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id ?? 0;
      const success = await storage.markAllNotificationsAsRead(userId);

      if (!success) {
        return res.status(500).json({ message: "Failed to mark all notifications as read" });
      }

      res.json({ message: "All notifications marked as read" });
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
      return res.status(500).json({ message: "Error marking all notifications as read" });
    }
  });

  // Mark notification as read
  app.post("/api/notifications/:id/mark-read", authMiddleware, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const success = await storage.markNotificationAsRead(notificationId);

      if (!success) {
        return res.status(500).json({ message: "Failed to mark notification as read" });
      }

      res.json({ message: "Notification marked as read" });
    } catch (err) {
      console.error("Error marking notification as read:", err);
      return res.status(500).json({ message: "Error marking notification as read" });
    }
  });

  // Delete all notifications for the authenticated user (must come before :id route)
  app.delete("/api/notifications/delete-all", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id ?? 0;

      const success = await storage.deleteAllNotifications(userId);

      if (!success) {
        return res.status(500).json({ message: "Failed to delete all notifications" });
      }

      res.json({ message: "All notifications deleted" });
    } catch (err) {
      console.error("Error deleting all notifications:", err);
      return res.status(500).json({ message: "Error deleting all notifications" });
    }
  });

  // Delete notification
  app.delete("/api/notifications/:id", authMiddleware, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const userId = req.user?.id ?? 0;

      // First check if the notification belongs to the user
      const notifications = await storage.getNotificationsByUserId(userId);
      const notification = notifications.find(n => n.id === notificationId);

      if (!notification) {
        return res.status(404).json({ message: "Notification not found or does not belong to user" });
      }

      const success = await storage.deleteNotification(notificationId);

      if (!success) {
        return res.status(500).json({ message: "Failed to delete notification" });
      }

      res.json({ message: "Notification deleted" });
    } catch (err) {
      console.error("Error deleting notification:", err);
      return res.status(500).json({ message: "Error deleting notification" });
    }
  });

  // ===== SCREENSHOT ENGAGEMENT ENDPOINTS =====

  // Get screenshot comments
  app.get("/api/screenshots/:id/comments", async (req, res) => {
    try {
      const screenshotId = parseInt(req.params.id);
      const comments = await storage.getScreenshotComments(screenshotId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching screenshot comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  // Add comment to a screenshot
  app.post("/api/screenshots/:id/comments", emailVerificationMiddleware, async (req, res) => {
    try {
      const screenshotId = parseInt(req.params.id);

      // Check if the screenshot exists
      const screenshot = await storage.getScreenshot(screenshotId);
      if (!screenshot) {
        return res.status(404).json({ message: "Screenshot not found" });
      }

      // Validate content for profanity and inappropriate language
      const contentValidation = await contentFilterService.validateContent(req.body.content, 'comment');

      if (!contentValidation.isValid) {
        return res.status(400).json({
          message: "Comment contains inappropriate content",
          errors: contentValidation.errors
        });
      }

      // Use cleaned content if automatic cleaning was applied
      if (contentValidation.filteredContent) {
        req.body.content = contentValidation.filteredContent;
      }

      // Validate and create the comment
      const commentData = insertScreenshotCommentSchema.parse({
        screenshotId,
        userId: req.user?.id,
        content: req.body.content,
      });

      const comment = await storage.createScreenshotComment(commentData);

      // Process mentions in the comment
      const mentions = await mentionService.parseMentions(req.body.content);
      if (mentions.length > 0) {
        await mentionService.createScreenshotCommentMentions(
          comment.id,
          mentions.map(m => m.userId),
          req.user!.id,
          screenshotId
        );
      }

      // Award points to the user for commenting
      await LeaderboardService.awardPoints(
        req.user!.id,
        'comment',
        `Commented on screenshot #${screenshotId}`
      );

      // Create notification for the screenshot owner
      await NotificationService.createScreenshotCommentNotification(screenshotId, req.user!.id, req.body.content, comment.id);

      res.status(201).json(comment);
    } catch (err) {
      return handleValidationError(err, res);
    }
  });

  // Delete screenshot comment
  app.delete("/api/screenshot-comments/:id", authMiddleware, async (req, res) => {
    try {
      const commentId = parseInt(req.params.id);
      const comments = await storage.getCommentsByClipId(0); // Note: This endpoint needs to be updated for screenshot comments

      // For now, just delete the comment (should check ownership first)
      const success = await storage.deleteScreenshotComment(commentId);

      if (!success) {
        return res.status(404).json({ message: "Comment not found or could not be deleted" });
      }

      res.json({ message: "Comment deleted" });
    } catch (err) {
      console.error("Error deleting screenshot comment:", err);
      return res.status(500).json({ message: "Error deleting comment" });
    }
  });

  // Get screenshot likes
  app.get("/api/screenshots/:id/likes", async (req, res) => {
    try {
      const screenshotId = parseInt(req.params.id);
      const likes = await storage.getScreenshotLikes(screenshotId);
      res.json(likes);
    } catch (error) {
      console.error("Error fetching screenshot likes:", error);
      res.status(500).json({ error: "Failed to fetch likes" });
    }
  });

  // Like/unlike screenshot
  app.post("/api/screenshots/:id/likes", emailVerificationMiddleware, async (req, res) => {
    try {
      const screenshotId = parseInt(req.params.id);
      const userId = req.user!.id;

      // Check if the screenshot exists
      const screenshot = await storage.getScreenshot(screenshotId);
      if (!screenshot) {
        return res.status(404).json({ message: "Screenshot not found" });
      }

      // Prevent users from liking their own content
      if (screenshot.userId === userId) {
        return res.status(400).json({ message: "Cannot like your own content, casual!" });
      }

      // Check if user already liked this screenshot
      const hasLiked = await storage.hasUserLikedScreenshot(userId, screenshotId);

      if (hasLiked) {
        // Unlike the screenshot
        await storage.deleteScreenshotLike(userId, screenshotId);
        
        // Get actual like count after deletion
        const likes = await storage.getScreenshotLikes(screenshotId);
        const likeCount = likes.length;
        
        res.json({ message: "Screenshot unliked", liked: false, count: likeCount });
      } else {
        // Like the screenshot
        const like = await storage.createScreenshotLike(userId, screenshotId);

        // Award points to the user for liking (only if they haven't earned points for this screenshot before)
        const hasEarnedPoints = await storage.hasUserEarnedPointsForContent(userId, 'like', 'screenshot', screenshotId);
        if (!hasEarnedPoints) {
          await LeaderboardService.awardPoints(
            userId,
            'like',
            `Liked screenshot #${screenshotId}`
          );
        }

        // Create notification for the screenshot owner
        await NotificationService.createScreenshotLikeNotification(screenshotId, userId);

        // Get actual like count after adding
        const likes = await storage.getScreenshotLikes(screenshotId);
        const likeCount = likes.length;

        res.status(201).json({ message: "Screenshot liked", liked: true, like, count: likeCount });
      }
    } catch (error) {
      console.error("Error toggling screenshot like:", error);
      res.status(500).json({ error: "Failed to toggle like" });
    }
  });

  // Unlike screenshot (DELETE endpoint for backward compatibility)
  app.delete("/api/screenshots/:id/likes", emailVerificationMiddleware, async (req, res) => {
    try {
      const screenshotId = parseInt(req.params.id);
      if (isNaN(screenshotId)) {
        return res.status(400).json({ error: "Invalid screenshot ID" });
      }

      const userId = req.user!.id;
      // Check if the user has liked this screenshot
      const hasLiked = await storage.hasUserLikedScreenshot(userId, screenshotId);
      if (!hasLiked) {
        return res.status(400).json({ message: "You have not liked this screenshot" });
      }

      // Delete the like
      const success = await storage.deleteScreenshotLike(userId, screenshotId);

      if (!success) {
        return res.status(500).json({ message: "Failed to unlike screenshot" });
      }

      res.status(200).json({ message: "Screenshot unliked successfully", liked: false });
    } catch (error) {
      console.error("Error unliking screenshot:", error);
      res.status(500).json({ error: "Failed to unlike screenshot" });
    }
  });

  // Get screenshot reactions
  app.get("/api/screenshots/:id/reactions", async (req, res) => {
    try {
      const screenshotId = parseInt(req.params.id);
      const reactions = await storage.getScreenshotReactions(screenshotId);
      res.json(reactions);
    } catch (error) {
      console.error("Error fetching screenshot reactions:", error);
      res.status(500).json({ error: "Failed to fetch reactions" });
    }
  });

  app.get("/api/screenshots/:id/reactions/status", hybridAuth, async (req, res) => {
    try {
      const screenshotId = parseInt(req.params.id);
      if (isNaN(screenshotId)) {
        return res.status(400).json({ error: "Invalid screenshot ID" });
      }
      const userId = req.user!.id;
      const existingReaction = await storage.getUserScreenshotReaction(userId, screenshotId, '🔥');
      res.json({ hasFired: !!existingReaction });
    } catch (error) {
      console.error("Error checking screenshot fire status:", error);
      res.status(500).json({ error: "Failed to check fire status" });
    }
  });

  // Add reaction to screenshot (fire reactions are permanent, limited daily, worth 5 points)
  app.post("/api/screenshots/:id/reactions", emailVerificationMiddleware, async (req, res) => {
    try {
      const screenshotId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { emoji } = req.body;

      // Check if the screenshot exists
      const screenshot = await storage.getScreenshot(screenshotId);
      if (!screenshot) {
        return res.status(404).json({ message: "Screenshot not found" });
      }

      // Prevent users from reacting to their own content
      if (screenshot.userId === userId) {
        return res.status(400).json({ message: "Cannot react to your own content, casual!" });
      }

      // Validate emoji (allow heart and fire reactions)
      if (!['❤️', '🔥', '😂', '👍', '👎', '😮', '😡', '💯'].includes(emoji)) {
        return res.status(400).json({ message: "Invalid emoji reaction" });
      }

      // Check if user already reacted with this emoji
      const existingReaction = await storage.getUserScreenshotReaction(userId, screenshotId, emoji);

      if (existingReaction) {
        // Fire reactions cannot be removed
        if (emoji === '🔥') {
          return res.status(400).json({ 
            message: "Fire reactions are permanent and cannot be removed",
            reacted: true
          });
        }
        
        // Other reactions can be toggled off
        await storage.deleteScreenshotReaction(existingReaction.id);
        res.json({ message: "Reaction removed", reacted: false });
      } else {
        // For fire reactions, check daily limit
        if (emoji === '🔥') {
          const fireLimits = await storage.getFireLimits(userId);
          
          if (!fireLimits.canFire) {
            return res.status(400).json({ 
              message: fireLimits.isPro 
                ? "You've used all 3 fire reactions for today. Come back tomorrow!" 
                : "You've used your daily fire reaction. Pro users can fire 3 times a day!",
              firesRemaining: 0,
              maxFires: fireLimits.maxFiresPerDay
            });
          }
          
          // Increment daily fire count
          await storage.incrementDailyFireCount(userId);
        }
        
        // Add the reaction
        const reactionData = insertScreenshotReactionSchema.parse({
          screenshotId,
          userId,
          emoji,
        });

        const reaction = await storage.createScreenshotReaction(reactionData);
        
        // Award 5 points for fire reactions (only if they haven't earned points for this screenshot before)
        if (emoji === '🔥') {
          const hasEarnedPoints = await storage.hasUserEarnedPointsForContent(userId, 'fire', 'screenshot', screenshotId);
          if (!hasEarnedPoints) {
            await LeaderboardService.awardPoints(
              userId,
              'fire',
              `Fire reaction given to screenshot #${screenshotId}`
            );
          }
          
          // Get updated fire limits to return
          const fireLimits = await storage.getFireLimits(userId);
          
          return res.status(201).json({ 
            message: "Reaction added", 
            reacted: true, 
            reaction,
            firesRemaining: fireLimits.maxFiresPerDay - fireLimits.firesUsedToday,
            maxFires: fireLimits.maxFiresPerDay
          });
        }
        
        res.status(201).json({ message: "Reaction added", reacted: true, reaction });
      }
    } catch (err) {
      return handleValidationError(err, res);
    }
  });

  // ===== COMMENT REPORTING ENDPOINTS =====

  // Report a comment (clip comments)
  app.post("/api/comments/:id/report", emailVerificationMiddleware, async (req, res) => {
    try {
      const commentId = parseInt(req.params.id);
      const { reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({ message: "Report reason is required" });
      }

      const reportData = insertCommentReportSchema.parse({
        reporterId: req.user!.id,
        commentId,
        reason: reason.trim(),
      });

      const report = await storage.createCommentReport(reportData);

      const comment = await storage.getComment(commentId);
      const emailData = {
        contentType: 'comment' as const,
        contentId: commentId,
        contentTitle: comment ? comment.content.substring(0, 100) : `Comment #${commentId}`,
        contentUrl: `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/comments/${commentId}`,
        reporterUsername: req.user!.username,
        reporterEmail: req.user!.email!,
        reason: reason.trim(),
        reportId: report.id
      };
      await EmailService.sendContentReportEmail(emailData);

      res.status(201).json({ message: "Comment reported successfully", report });
    } catch (err) {
      return handleValidationError(err, res);
    }
  });

  // Report a screenshot comment
  app.post("/api/screenshot-comments/:id/report", emailVerificationMiddleware, async (req, res) => {
    try {
      const screenshotCommentId = parseInt(req.params.id);
      const { reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({ message: "Report reason is required" });
      }

      const reportData = insertCommentReportSchema.parse({
        reporterId: req.user!.id,
        screenshotCommentId,
        reason: reason.trim(),
      });

      const report = await storage.createCommentReport(reportData);

      const emailData = {
        contentType: 'comment' as const,
        contentId: screenshotCommentId,
        contentTitle: `Screenshot Comment #${screenshotCommentId}`,
        contentUrl: `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/screenshot-comments/${screenshotCommentId}`,
        reporterUsername: req.user!.username,
        reporterEmail: req.user!.email!,
        reason: reason.trim(),
        reportId: report.id
      };
      await EmailService.sendContentReportEmail(emailData);

      res.status(201).json({ message: "Comment reported successfully", report });
    } catch (err) {
      return handleValidationError(err, res);
    }
  });

  // Get comment reports (admin only)
  app.get("/api/admin/comment-reports", adminMiddleware, async (req, res) => {
    try {
      const { status } = req.query;
      const reports = await storage.getCommentReports(status as string);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching comment reports:", error);
      res.status(500).json({ error: "Failed to fetch comment reports" });
    }
  });

  // Update comment report status (admin only)
  app.patch("/api/admin/comment-reports/:id", adminMiddleware, async (req, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const { status } = req.body;

      if (!['pending', 'reviewed', 'dismissed', 'action_taken'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const success = await storage.updateCommentReportStatus(reportId, status, req.user!.id);

      if (!success) {
        return res.status(404).json({ message: "Report not found" });
      }

      res.json({ message: "Report status updated successfully" });
    } catch (error) {
      console.error("Error updating comment report status:", error);
      res.status(500).json({ error: "Failed to update report status" });
    }
  });

  // ==========================================
  // Admin Lootbox Management Routes
  // ==========================================

  // Get all lootbox opens (admin only)
  app.get("/api/admin/lootbox/opens", adminMiddleware, async (req, res) => {
    try {
      const opens = await storage.getAllLootboxOpens();
      res.json(opens);
    } catch (error) {
      console.error("Error fetching lootbox opens:", error);
      res.status(500).json({ error: "Failed to fetch lootbox opens" });
    }
  });

  // Reset user's lootbox (admin only) - allows user to open again today
  app.post("/api/admin/lootbox/reset/:userId", adminMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const success = await storage.resetUserLootbox(userId);
      
      if (success) {
        res.json({ message: "User lootbox reset successfully. They can now open another lootbox." });
      } else {
        res.status(404).json({ message: "User lootbox record not found" });
      }
    } catch (error) {
      console.error("Error resetting user lootbox:", error);
      res.status(500).json({ error: "Failed to reset user lootbox" });
    }
  });

  // ==========================================
  // Upload Success Routes
  // ==========================================

  // Get upload success data for confirmation screen
  app.get("/api/upload-success/:contentType/:id", authMiddleware, async (req, res) => {
    try {
      const { contentType, id } = req.params;
      const contentId = parseInt(id);

      if (isNaN(contentId)) {
        return res.status(400).json({ message: "Invalid content ID" });
      }

      let content;
      let shareUrl;
      let socialMediaLinks;

      // Get content based on type
      if (contentType === 'clip' || contentType === 'reel') {
        content = await storage.getClip(contentId);
        if (!content) {
          return res.status(404).json({ message: "Clip not found" });
        }
        shareUrl = `${req.protocol}://${req.get('host')}/view/${contentId}`;
      } else if (contentType === 'screenshot') {
        content = await storage.getScreenshot(contentId);
        if (!content) {
          return res.status(404).json({ message: "Screenshot not found" });
        }
        shareUrl = `${req.protocol}://${req.get('host')}/screenshot/${contentId}`;
      } else {
        return res.status(400).json({ message: "Invalid content type" });
      }

      // Check ownership
      if (content.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to view this content" });
      }

      // Generate QR code
      const qrCode = await QRCode.toDataURL(shareUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Generate social media sharing links
      const title = encodeURIComponent(content.title);
      const description = encodeURIComponent(content.description || `Check out this amazing ${contentType}!`);
      socialMediaLinks = {
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
        twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${title}`,
        reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${title}`,
        discord: shareUrl // For Discord, we just copy the link
      };

      const uploadedContent = {
        id: content.id,
        title: content.title,
        description: content.description,
        contentType: contentType as 'clip' | 'reel' | 'screenshot',
        qrCode,
        shareUrl,
        socialMediaLinks,
        createdAt: content.createdAt,
        views: content.views || 0
      };

      res.json(uploadedContent);
    } catch (error) {
      console.error("Error fetching upload success data:", error);
      res.status(500).json({ message: "Failed to fetch upload data" });
    }
  });

  // Register authentication routes for email verification and password reset
  app.use('/api', authRouter);

  // Register token-based authentication routes for desktop apps
  app.use('/api', tokenAuthRouter);

  // Register view routes for shareable content
  app.use('/api/view', viewRouter);

  // Note: Server-side redirects removed - frontend handles shareCode URLs directly now

  // ==========================================
  // Wallet Routes (Server-side generation)
  // ==========================================

  // Get or create wallet - generates wallet server-side for instant creation
  app.post("/api/wallet/create", authMiddleware, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // If user already has a wallet saved in our DB, return it
      if (user.walletAddress) {
        return res.json({ 
          address: user.walletAddress,
          chain: user.walletChain || 'skale-nebula-testnet',
          message: "Wallet already exists",
          isExisting: true
        });
      }

      // Generate a new wallet using ethers.js
      const { encryptPrivateKey } = await import('./wallet-crypto');
      const { ethers } = await import('ethers');
      const wallet = ethers.Wallet.createRandom();
      const walletAddress = wallet.address.toLowerCase();

      // Save wallet to database with encrypted private key
      await storage.updateUser(userId, {
        walletAddress: walletAddress,
        walletChain: 'skale-nebula-testnet',
        walletCreatedAt: new Date(),
        encryptedPrivateKey: encryptPrivateKey(wallet.privateKey),
      });

      console.log(`Wallet created for user ${userId}: ${walletAddress}`);

      res.json({
        address: walletAddress,
        chain: 'skale-nebula-testnet',
        message: "Wallet created successfully",
        isExisting: false
      });
    } catch (error) {
      console.error("Error creating wallet:", error);
      res.status(500).json({ error: "Failed to create wallet" });
    }
  });

  // Update wallet address for authenticated user
  app.post("/api/wallet/address", authMiddleware, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { walletAddress } = req.body;

      if (!walletAddress || typeof walletAddress !== 'string') {
        return res.status(400).json({ message: "Valid wallet address is required" });
      }

      const addressRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!addressRegex.test(walletAddress)) {
        return res.status(400).json({ message: "Invalid Ethereum address format" });
      }

      const normalizedAddress = walletAddress.toLowerCase();

      const user = await storage.getUser(userId);
      const updateData: { walletAddress: string; walletChain: string; walletCreatedAt?: Date } = {
        walletAddress: normalizedAddress,
        walletChain: 'skale-nebula-testnet',
      };

      if (!user?.walletAddress) {
        updateData.walletCreatedAt = new Date();
      }

      await storage.updateUser(userId, updateData);

      res.json({
        success: true,
        walletAddress: normalizedAddress,
        message: "Wallet address updated successfully",
      });
    } catch (error) {
      console.error("Error updating wallet address:", error);
      res.status(500).json({ error: "Failed to update wallet address" });
    }
  });

  // Get wallet info for authenticated user
  app.get("/api/wallet/info", authMiddleware, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);

      if (!user?.walletAddress) {
        return res.status(404).json({ message: "No wallet found" });
      }

      res.json({
        address: user.walletAddress,
        chain: user.walletChain || 'skale-nebula-testnet',
        createdAt: user.walletCreatedAt,
      });
    } catch (error) {
      console.error("Error fetching wallet info:", error);
      res.status(500).json({ error: "Failed to fetch wallet info" });
    }
  });

  // ==========================================
  // Blockchain Token Routes
  // ==========================================

  // Get GF token information from smart contract
  app.get("/api/token/info", async (req, res) => {
    try {
      const tokenInfo = await getTokenInfo();
      res.json(tokenInfo);
    } catch (error) {
      console.error("Error fetching token info:", error);
      res.status(500).json({ error: "Failed to fetch token information" });
    }
  });

  // Get user's on-chain GF token balance
  app.get("/api/token/balance", authMiddleware, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);

      if (!user?.walletAddress) {
        return res.status(404).json({ 
          message: "No wallet found",
          balance: "0"
        });
      }

      const balance = await getTokenBalance(user.walletAddress);
      
      res.json({
        balance,
        walletAddress: user.walletAddress,
        contractAddress: "0x9c4aC24c7bb36AA3772ccd5aCBCB48a20a1704B7",
      });
    } catch (error) {
      console.error("Error fetching token balance:", error);
      res.status(500).json({ error: "Failed to fetch token balance" });
    }
  });

  // ==========================================
  // NFT Purchase Routes
  // ==========================================

  // NFT catalog (server-side source of truth for pricing)
  const NFT_CATALOG = [
    { id: 1, name: "Cyber Pilot #001", price: 250, priceUSD: 12.50, forSale: true },
    { id: 2, name: "Divine Guardian #002", price: 800, priceUSD: 40.00, forSale: true },
    { id: 3, name: "Street Samurai #003", price: 550, priceUSD: 27.50, forSale: true },
    { id: 4, name: "Urban Rogue #004", price: 350, priceUSD: 17.50, forSale: true },
    { id: 5, name: "Matrix Assassin #005", price: 700, priceUSD: 35.00, forSale: true },
    { id: 6, name: "Golden Warrior #006", price: 600, priceUSD: 30.00, forSale: true },
    { id: 7, name: "Cyber Ronin #007", price: 650, priceUSD: 32.50, forSale: true },
    { id: 8, name: "Desert Wanderer #008", price: 400, priceUSD: 20.00, forSale: true },
    { id: 9, name: "Space Mercenary #009", price: 500, priceUSD: 25.00, forSale: true },
    { id: 10, name: "Crystal Knight #010", price: 750, priceUSD: 37.50, forSale: true },
    { id: 11, name: "Retro Explorer #011", price: 300, priceUSD: 15.00, forSale: true },
    { id: 12, name: "Eastern Mystic #012", price: 450, priceUSD: 22.50, forSale: true },
    { id: 13, name: "Digital Miner #013", price: 350, priceUSD: 17.50, forSale: true },
    { id: 14, name: "Tech Operative #014", price: 420, priceUSD: 21.00, forSale: true },
    { id: 15, name: "Royal Outlaw #015", price: 900, priceUSD: 45.00, forSale: true },
  ];

  // Get available NFTs from the store catalog (filters out already-purchased ones)
  app.get("/api/nft/store-catalog", async (req, res) => {
    try {
      const purchasedResult = await db.execute(
        sql`SELECT nft_catalog_id FROM store_nft_purchases`
      );
      const purchasedRows = (purchasedResult as any).rows || purchasedResult || [];
      const purchasedIds = new Set(purchasedRows.map((r: any) => Number(r.nft_catalog_id)));

      const available = NFT_CATALOG.filter(nft => !purchasedIds.has(nft.id));
      res.json(available);
    } catch (error) {
      console.error("Error fetching store catalog:", error);
      res.status(500).json({ error: "Failed to fetch store catalog" });
    }
  });

  // Purchase NFT with GF tokens
  app.post("/api/nft/purchase", authMiddleware, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { nftId } = req.body;

      if (!nftId || typeof nftId !== 'number') {
        return res.status(400).json({ message: "Invalid NFT ID" });
      }

      // Look up NFT price from server-side catalog (prevents price manipulation)
      const nft = NFT_CATALOG.find(n => n.id === nftId);
      if (!nft) {
        return res.status(404).json({ message: "NFT not found" });
      }

      if (!nft.forSale) {
        return res.status(400).json({ message: "NFT is not for sale" });
      }

      // Check if this NFT has already been purchased by someone
      const existingPurchase = await db.execute(
        sql`SELECT id FROM store_nft_purchases WHERE nft_catalog_id = ${nftId} LIMIT 1`
      );
      const existingRows = (existingPurchase as any).rows || existingPurchase || [];
      if (existingRows.length > 0) {
        return res.status(400).json({ message: "This NFT has already been sold" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user has a wallet
      if (!user.walletAddress) {
        return res.status(400).json({ message: "Wallet required to purchase NFTs" });
      }

      // Check if user has enough GF tokens (use server-side price)
      const currentBalance = user.gfTokenBalance || 0;
      if (currentBalance < nft.price) {
        return res.status(400).json({ 
          message: "Insufficient GF token balance",
          currentBalance,
          required: nft.price
        });
      }

      // Deduct GF tokens
      const newBalance = currentBalance - nft.price;
      await storage.updateUser(userId, {
        gfTokenBalance: newBalance
      });

      // Record the store NFT purchase (marks it as sold/unavailable)
      await db.execute(
        sql`INSERT INTO store_nft_purchases (nft_catalog_id, buyer_user_id, price_paid) VALUES (${nftId}, ${userId}, ${nft.price})`
      );

      // Add the NFT to the buyer's wallet (user_nfts table)
      await db.execute(
        sql`INSERT INTO user_nfts (user_id, token_id, tx_hash) VALUES (${userId}, ${nftId}, ${'store_purchase_' + Date.now()}) ON CONFLICT (user_id, token_id) DO NOTHING`
      );

      res.json({
        success: true,
        message: "NFT purchased successfully",
        nftId,
        nftName: nft.name,
        pricePaid: nft.price,
        newBalance,
        transactionId: `store_purchase_${Date.now()}_${nftId}`
      });
    } catch (error) {
      console.error("Error purchasing NFT:", error);
      res.status(500).json({ error: "Failed to purchase NFT" });
    }
  });

  // Add NFT to watchlist
  app.post("/api/nft/watchlist", authMiddleware, async (req, res) => {
    try {
      const userId = req.user!.id;
      const validatedData = insertNftWatchlistSchema.parse({
        ...req.body,
        userId
      });

      const watchlistItem = await storage.addToNftWatchlist(validatedData);
      res.json(watchlistItem);
    } catch (error: any) {
      // Handle duplicate entry error
      if (error.code === '23505') {
        return res.status(400).json({ message: "NFT already in watchlist" });
      }
      console.error("Error adding to NFT watchlist:", error);
      res.status(500).json({ error: "Failed to add NFT to watchlist" });
    }
  });

  // Remove NFT from watchlist
  app.delete("/api/nft/watchlist/:nftId", authMiddleware, async (req, res) => {
    try {
      const userId = req.user!.id;
      const nftId = parseInt(req.params.nftId);

      if (isNaN(nftId)) {
        return res.status(400).json({ message: "Invalid NFT ID" });
      }

      await storage.removeFromNftWatchlist(userId, nftId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from NFT watchlist:", error);
      res.status(500).json({ error: "Failed to remove NFT from watchlist" });
    }
  });

  // Get user's NFT watchlist
  app.get("/api/nft/watchlist", authMiddleware, async (req, res) => {
    try {
      const userId = req.user!.id;
      const watchlist = await storage.getNftWatchlist(userId);
      res.json(watchlist);
    } catch (error) {
      console.error("Error fetching NFT watchlist:", error);
      res.status(500).json({ error: "Failed to fetch watchlist" });
    }
  });

  // Check if NFT is in user's watchlist
  app.get("/api/nft/watchlist/check/:nftId", authMiddleware, async (req, res) => {
    try {
      const userId = req.user!.id;
      const nftId = parseInt(req.params.nftId);

      if (isNaN(nftId)) {
        return res.status(400).json({ message: "Invalid NFT ID" });
      }

      const isWatched = await storage.isNftInWatchlist(userId, nftId);
      res.json({ isWatched });
    } catch (error) {
      console.error("Error checking NFT watchlist status:", error);
      res.status(500).json({ error: "Failed to check watchlist status" });
    }
  });

  // Server-side token package catalog (source of truth)
  const TOKEN_PACKAGES = {
    starter: { id: 'starter', amount: 10, price: 0.50, bonus: 0 },
    popular: { id: 'popular', amount: 25, price: 1.00, bonus: 5 },
    premium: { id: 'premium', amount: 50, price: 2.00, bonus: 10 },
    ultimate: { id: 'ultimate', amount: 100, price: 3.50, bonus: 25 },
  } as const;

  // Create Crossmint order for GF token purchase
  app.post("/api/token/create-order", authMiddleware, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { packageId } = req.body;

      // Validate package ID exists in server catalog
      if (!packageId || typeof packageId !== 'string') {
        return res.status(400).json({ message: "Invalid package ID" });
      }

      const packageData = TOKEN_PACKAGES[packageId as keyof typeof TOKEN_PACKAGES];
      if (!packageData) {
        console.error(`❌ Invalid package ID attempted: ${packageId} by user ${userId}`);
        return res.status(400).json({ message: "Invalid package selected" });
      }

      // Use ONLY server-side values (ignore client-provided amount/price)
      const totalTokens = packageData.amount + packageData.bonus;
      const priceUSD = packageData.price;

      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Require user to have a wallet before purchasing tokens
      if (!user.walletAddress) {
        return res.status(400).json({ 
          message: "Wallet required",
          code: "WALLET_REQUIRED",
          description: "Please create a Crossmint wallet before purchasing GF tokens"
        });
      }

      // Get Crossmint API key
      const apiKey = process.env.CROSSMINT_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Crossmint API key not configured" });
      }

      const userEmail = user.email || `${user.username}@gamefolio.app`;

      // Create Crossmint payment order (fiat-to-crypto gateway)
      // Note: USDC will be delivered to user's wallet, then GF tokens credited to their account
      // Using Base Sepolia testnet for staging (Ethereum L2 compatible)
      const crossmintResponse = await fetch('https://staging.crossmint.com/api/2022-06-09/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          lineItems: [
            {
              tokenLocator: 'base:0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia testnet (staging)
              executionParameters: {
                mode: 'exact-in',
                amount: priceUSD.toFixed(2), // Amount in USD
              },
            },
          ],
          payment: {
            method: 'checkoutcom-flow',
            receiptEmail: userEmail,
          },
          recipient: {
            walletAddress: user.walletAddress, // Required: user's Ethereum-compatible wallet
          },
          metadata: {
            userId: userId.toString(),
            packageId,
            gfTokenAmount: totalTokens.toString(),
            serverValidated: 'true', // Flag to verify order came from our server
          }
        }),
      });

      if (!crossmintResponse.ok) {
        const errorText = await crossmintResponse.text();
        console.error('Crossmint order creation error:', errorText);
        return res.status(500).json({ 
          message: 'Failed to create payment order',
          error: errorText 
        });
      }

      const orderData = await crossmintResponse.json();

      // Store pending order info
      console.log(`📦 Crossmint Order Created: ${orderData.orderId} for user ${userId}`);

      res.json({
        orderId: orderData.orderId,
        clientSecret: orderData.clientSecret,
        packageId,
        amount: totalTokens,
        priceUSD,
      });
    } catch (error) {
      console.error('Error creating Crossmint order:', error);
      res.status(500).json({ error: 'Failed to create order' });
    }
  });

  // Check Crossmint order status and deliver GF tokens
  app.post("/api/token/complete-order", authMiddleware, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({ message: "Order ID required" });
      }

      // Get Crossmint API key
      const apiKey = process.env.CROSSMINT_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Crossmint API key not configured" });
      }

      // Check order status from Crossmint
      const statusResponse = await fetch(
        `https://staging.crossmint.com/api/2022-06-09/orders/${orderId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
        }
      );

      if (!statusResponse.ok) {
        return res.status(500).json({ message: "Failed to check order status" });
      }

      const orderData = await statusResponse.json();
      
      // Check if order is completed
      if (orderData.phase !== 'completed' && orderData.phase !== 'delivery') {
        return res.json({
          status: orderData.phase,
          message: "Order not yet completed"
        });
      }

      // Verify order was created by our server (security check)
      if (orderData.metadata?.serverValidated !== 'true') {
        console.error(`❌ Order ${orderId} failed server validation check`);
        return res.status(400).json({ message: "Invalid order source" });
      }

      // Re-validate package from server catalog (don't trust metadata blindly)
      const packageId = orderData.metadata?.packageId;
      const packageData = TOKEN_PACKAGES[packageId as keyof typeof TOKEN_PACKAGES];
      
      if (!packageData) {
        console.error(`❌ Order ${orderId} has invalid packageId: ${packageId}`);
        return res.status(400).json({ message: "Invalid package in order" });
      }

      // Use server-calculated token amount (defense in depth)
      const gfTokenAmount = packageData.amount + packageData.bonus;
      
      // Double-check metadata matches expected amount
      const metadataAmount = parseInt(orderData.metadata?.gfTokenAmount || '0');
      if (metadataAmount !== gfTokenAmount) {
        console.error(`❌ Order ${orderId} amount mismatch: expected ${gfTokenAmount}, got ${metadataAmount}`);
        return res.status(400).json({ message: "Order amount validation failed" });
      }

      // Get user and update balance
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentBalance = user.gfTokenBalance || 0;
      const newBalance = currentBalance + gfTokenAmount;

      await storage.updateUser(userId, {
        gfTokenBalance: newBalance
      });

      console.log(`✅ GF Tokens Delivered: User ${userId} received ${gfTokenAmount} GF (Order: ${orderId})`);

      res.json({
        success: true,
        amount: gfTokenAmount,
        newBalance,
        orderId
      });
    } catch (error) {
      console.error("Error completing order:", error);
      res.status(500).json({ error: "Failed to complete order" });
    }
  });

  // Test Crossmint API connection
  app.get("/api/token/test-connection", authMiddleware, async (req, res) => {
    try {
      const apiKey = process.env.CROSSMINT_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ 
          success: false, 
          message: "Crossmint API key not configured" 
        });
      }

      // Try to fetch wallets as a simple API test
      const testResponse = await fetch(
        'https://staging.crossmint.com/api/2022-06-09/orders?limit=1',
        {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (testResponse.ok) {
        console.log('✅ Crossmint API connection successful');
        return res.json({
          success: true,
          message: "Crossmint API key is valid and working!",
          environment: "staging",
          statusCode: testResponse.status
        });
      } else {
        const errorText = await testResponse.text();
        console.error('❌ Crossmint API test failed:', errorText);
        return res.status(testResponse.status).json({
          success: false,
          message: "API key invalid or unauthorized",
          error: errorText,
          statusCode: testResponse.status
        });
      }
    } catch (error) {
      console.error('Error testing Crossmint connection:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to test Crossmint connection",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ==================== DAILY LOOTBOX ROUTES ====================

  // Get lootbox status - check if user can open today's lootbox
  app.get("/api/lootbox/status", authMiddleware, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const status = await storage.getDailyLootboxStatus(userId);
      res.json(status);
    } catch (error) {
      console.error("Error getting lootbox status:", error);
      res.status(500).json({ message: "Failed to get lootbox status" });
    }
  });

  // Open daily lootbox
  app.post("/api/lootbox/open", authMiddleware, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      
      // Check if user can open
      const status = await storage.getDailyLootboxStatus(userId);
      if (!status.canOpen) {
        return res.status(400).json({ 
          message: "You've already opened today's lootbox!", 
          nextOpenAt: status.nextOpenAt 
        });
      }

      const result = await storage.openDailyLootbox(userId);
      
      if (!result) {
        return res.status(404).json({ message: "No rewards available in lootbox" });
      }

      // Award the lootbox bonus XP (+100 XP for opening the lootbox)
      await BonusEventsService.awardLootboxBonus(userId);

      // Determine the appropriate message based on reward type
      let message: string;
      if (result.consumed) {
        // Consumable reward (XP, GF tokens) was granted
        const value = result.reward.rewardValue || 0;
        if (result.reward.assetType === 'xp_reward') {
          message = `You earned ${value} XP!`;
        } else {
          message = "Reward claimed!";
        }
      } else if (result.isDuplicate) {
        message = "You already have this reward!";
      } else {
        message = "Congratulations! New reward unlocked!";
      }
      
      res.json({ 
        reward: result.reward,
        isDuplicate: result.isDuplicate,
        consumed: result.consumed,
        message
      });
    } catch (error) {
      console.error("Error opening lootbox:", error);
      res.status(500).json({ message: "Failed to open lootbox" });
    }
  });

  // Get user's claimed rewards
  app.get("/api/lootbox/rewards", authMiddleware, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const rewards = await storage.getUserClaimedRewards(userId);
      res.json(rewards);
    } catch (error) {
      console.error("Error getting user rewards:", error);
      res.status(500).json({ message: "Failed to get rewards" });
    }
  });

  // Get user's complete collection data (for Collection page)
  app.get("/api/lootbox/collection", authMiddleware, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const collectionData = await storage.getUserCollectionData(userId);
      res.json(collectionData);
    } catch (error) {
      console.error("Error getting collection data:", error);
      res.status(500).json({ message: "Failed to get collection data" });
    }
  });

  // Get available rewards for lootbox (public)
  app.get("/api/lootbox/available-rewards", async (req, res) => {
    try {
      const rewards = await storage.getActiveRewardsForLootbox();
      res.json(rewards);
    } catch (error) {
      console.error("Error getting available rewards:", error);
      res.status(500).json({ message: "Failed to get available rewards" });
    }
  });

  // Reset lootbox for testing (development only)
  app.post("/api/lootbox/reset", authMiddleware, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      await storage.resetUserLootbox(userId);
      res.json({ success: true, message: "Lootbox reset successfully" });
    } catch (error) {
      console.error("Error resetting lootbox:", error);
      res.status(500).json({ message: "Failed to reset lootbox" });
    }
  });

  // ==================== WELCOME PACK ROUTES ====================

  // Get welcome pack status
  app.get("/api/welcome-pack/status", authMiddleware, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        claimed: user.welcomePackClaimed || false,
        canClaim: !user.welcomePackClaimed
      });
    } catch (error) {
      console.error("Error getting welcome pack status:", error);
      res.status(500).json({ message: "Failed to get welcome pack status" });
    }
  });

  // Claim welcome pack - grants NFT voucher, random store item, and random animated border
  app.post("/api/welcome-pack/claim", authMiddleware, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (user.welcomePackClaimed) {
        return res.status(400).json({ message: "Welcome pack already claimed" });
      }
      
      const rewards: Array<{
        type: "nft_voucher" | "store_item" | "animated_border";
        reward: any;
        name: string;
        description: string;
        imageUrl?: string;
      }> = [];
      
      // 1. NFT Lootbox Voucher - This is a placeholder/virtual reward
      rewards.push({
        type: "nft_voucher",
        reward: null,
        name: "NFT Lootbox Voucher",
        description: "Redeem this voucher in the store for an exclusive NFT!"
      });
      
      // 2. Random store item (get a random asset reward)
      const allRewards = await storage.getAllAssetRewards();
      const filteredStoreItems = allRewards.filter(r => 
        r.isActive && 
        r.assetType !== "avatar_border" && 
        r.assetType !== "xp_reward" && 
        r.assetType !== "gf_tokens"
      );
      
      if (filteredStoreItems.length > 0) {
        const randomStoreItem = filteredStoreItems[Math.floor(Math.random() * filteredStoreItems.length)];
        // Claim this reward for the user
        await storage.createAssetRewardClaim({
          rewardId: randomStoreItem.id,
          userId: userId
        });
        rewards.push({
          type: "store_item",
          reward: randomStoreItem,
          name: randomStoreItem.name,
          description: `A ${randomStoreItem.rarity} ${randomStoreItem.assetType.replace("_", " ")}`,
          imageUrl: randomStoreItem.imageUrl
        });
      } else {
        // Fallback if no store items available
        rewards.push({
          type: "store_item",
          reward: null,
          name: "Mystery Item",
          description: "Check back later for your mystery item!"
        });
      }
      
      // 3. Random animated avatar border
      const animatedBorders = allRewards.filter(r => 
        r.isActive && 
        r.assetType === "avatar_border" && 
        r.category === "animated"
      );
      
      if (animatedBorders.length > 0) {
        const randomBorder = animatedBorders[Math.floor(Math.random() * animatedBorders.length)];
        // Claim this border for the user
        await storage.createAssetRewardClaim({
          rewardId: randomBorder.id,
          userId: userId
        });
        rewards.push({
          type: "animated_border",
          reward: randomBorder,
          name: randomBorder.name,
          description: "An animated border to make your avatar stand out!",
          imageUrl: randomBorder.imageUrl
        });
      } else {
        // Try to get any border if no animated ones exist
        const anyBorders = allRewards.filter(r => 
          r.isActive && 
          r.assetType === "avatar_border"
        );
        if (anyBorders.length > 0) {
          const randomBorder = anyBorders[Math.floor(Math.random() * anyBorders.length)];
          await storage.createAssetRewardClaim({
            rewardId: randomBorder.id,
            userId: userId
          });
          rewards.push({
            type: "animated_border",
            reward: randomBorder,
            name: randomBorder.name,
            description: "A profile border to make your avatar stand out!",
            imageUrl: randomBorder.imageUrl
          });
        } else {
          rewards.push({
            type: "animated_border",
            reward: null,
            name: "Profile Border",
            description: "Check back later for your profile border!"
          });
        }
      }
      
      // Mark welcome pack as claimed
      await db.update(users).set({ 
        welcomePackClaimed: true,
        updatedAt: new Date()
      }).where(eq(users.id, userId));
      
      res.json({
        rewards,
        success: true,
        message: "Welcome pack claimed successfully!"
      });
    } catch (error) {
      console.error("Error claiming welcome pack:", error);
      res.status(500).json({ message: "Failed to claim welcome pack" });
    }
  });

  // ==================== SUBSCRIPTION ROUTES ====================

  // Sync subscription status from RevenueCat
  app.post("/api/subscription/sync", authMiddleware, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { isPro } = req.body;

      if (typeof isPro !== "boolean") {
        return res.status(400).json({ message: "Invalid isPro value" });
      }

      // Get current user state to check if this is a new Pro subscription
      const currentUser = await storage.getUserById(userId);
      const wasNotPro = !currentUser?.isPro;

      // Update user's Pro status in database
      await db.update(users).set({ 
        isPro,
        updatedAt: new Date()
      }).where(eq(users.id, userId));

      console.log(`✅ Updated Pro status for user ${userId}: ${isPro}`);

      let lootboxReward = null;

      // If user is becoming Pro for the first time, grant initial lootbox
      if (isPro && wasNotPro) {
        console.log(`🎁 User ${userId} just became Pro! Granting initial Pro lootbox...`);
        const initialGrant = await storage.grantProLootbox(userId, 'initial');
        if (initialGrant) {
          lootboxReward = {
            type: 'initial',
            reward: initialGrant.reward,
            isDuplicate: initialGrant.isDuplicate
          };
          console.log(`🎁 Initial Pro lootbox granted: ${initialGrant.reward.name} (${initialGrant.reward.rarity})`);
        }
      }

      // Also check for monthly lootbox grant
      if (isPro) {
        const monthlyGrant = await storage.grantProLootbox(userId, 'monthly');
        if (monthlyGrant && !lootboxReward) {
          lootboxReward = {
            type: 'monthly',
            reward: monthlyGrant.reward,
            isDuplicate: monthlyGrant.isDuplicate
          };
          console.log(`🎁 Monthly Pro lootbox granted: ${monthlyGrant.reward.name} (${monthlyGrant.reward.rarity})`);
        }
      }

      res.json({ success: true, isPro, lootboxReward });
    } catch (error) {
      console.error("Error syncing subscription:", error);
      res.status(500).json({ message: "Failed to sync subscription status" });
    }
  });

  // Check and grant monthly Pro lootbox (can be called on app load for Pro users)
  app.post("/api/subscription/claim-monthly-lootbox", authMiddleware, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUserById(userId);

      if (!user?.isPro) {
        return res.status(403).json({ message: "Pro subscription required" });
      }

      const monthlyGrant = await storage.grantProLootbox(userId, 'monthly');
      
      if (monthlyGrant) {
        console.log(`🎁 Monthly Pro lootbox granted to user ${userId}: ${monthlyGrant.reward.name}`);
        res.json({ 
          success: true, 
          reward: monthlyGrant.reward,
          isDuplicate: monthlyGrant.isDuplicate,
          message: `You received a ${monthlyGrant.reward.rarity} reward: ${monthlyGrant.reward.name}!`
        });
      } else {
        res.json({ 
          success: false, 
          alreadyClaimed: true,
          message: "You've already claimed your monthly Pro lootbox. Check back next month!" 
        });
      }
    } catch (error) {
      console.error("Error claiming monthly lootbox:", error);
      res.status(500).json({ message: "Failed to claim monthly lootbox" });
    }
  });

  // Get current subscription status
  app.get("/api/subscription/status", authMiddleware, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUserById(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let isCancelled = false;
      const hasActiveEndDate = user.proSubscriptionEndDate && new Date(user.proSubscriptionEndDate) > new Date();

      if (!user.isPro && hasActiveEndDate) {
        isCancelled = true;
      } else if (user.isPro && user.proSubscriptionEndDate) {
        try {
          const { getUncachableStripeClient } = await import('./stripeClient');
          const stripe = await getUncachableStripeClient();
          if (user.email) {
            const customers = await stripe.customers.list({ email: user.email, limit: 1 });
            if (customers.data.length > 0) {
              const subs = await stripe.subscriptions.list({
                customer: customers.data[0].id,
                status: 'active',
                limit: 10,
              });
              const matchingSub = subs.data.find((s: any) => 
                s.metadata?.userId === String(user.id) || s.metadata?.plan
              ) || subs.data[0];
              if (matchingSub?.cancel_at_period_end) {
                isCancelled = true;
              }
            }
          }
        } catch (e) {}
      }

      res.json({ 
        isPro: user.isPro || false,
        userId: user.id,
        isCancelled,
        proSubscriptionEndDate: user.proSubscriptionEndDate,
        proSubscriptionType: user.proSubscriptionType,
      });
    } catch (error) {
      console.error("Error getting subscription status:", error);
      res.status(500).json({ message: "Failed to get subscription status" });
    }
  });

  // Cancel subscription via Stripe directly, with RevenueCat fallback
  app.post("/api/subscription/cancel", authMiddleware, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { reason } = req.body || {};
      const user = await storage.getUserById(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.isPro) {
        return res.status(400).json({ message: "No active Pro subscription to cancel" });
      }

      // Try to cancel via Stripe first (subscriptions are created through Stripe)
      try {
        const { getUncachableStripeClient } = await import('./stripeClient');
        const stripe = await getUncachableStripeClient();

        if (user.email) {
          const customers = await stripe.customers.list({ email: user.email, limit: 1 });
          
          if (customers.data.length > 0) {
            const customerId = customers.data[0].id;
            const subscriptions = await stripe.subscriptions.list({
              customer: customerId,
              status: 'active',
              limit: 10,
            });

            const matchingSub = subscriptions.data.find((s: any) =>
              s.metadata?.userId === String(userId) || s.metadata?.plan
            ) || subscriptions.data[0];

            if (matchingSub?.cancel_at_period_end) {
              const periodEnd = new Date(matchingSub.current_period_end * 1000);
              const formattedEnd = periodEnd.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
              return res.status(400).json({
                message: `Your subscription is already cancelled. You have Pro access until ${formattedEnd}.`,
                alreadyCancelled: true,
                endDate: periodEnd.toISOString(),
              });
            }

            let cancelledSub: any = null;
            if (matchingSub) {
              await stripe.subscriptions.update(matchingSub.id, {
                cancel_at_period_end: true,
              });
              console.log(`❌ Pro subscription ${matchingSub.id} set to cancel at period end for user ${userId}`);
              cancelledSub = matchingSub;
            }

            if (cancelledSub) {
              const periodEnd = new Date(cancelledSub.current_period_end * 1000);

              await db.update(users).set({
                isPro: true,
                proSubscriptionEndDate: periodEnd,
                updatedAt: new Date(),
              }).where(eq(users.id, userId));

              const { EmailService } = await import('./email-service');
              if (user.email) {
                EmailService.sendProCancelledEmail(
                  user.email,
                  user.username || user.displayName || 'Gamer',
                  periodEnd
                ).catch(err => console.error('Failed to send Pro cancelled email:', err));
              }

              if (reason) {
                EmailService.sendCancellationReasonToSupport(
                  user.username || user.displayName || 'Unknown',
                  user.email || 'No email',
                  reason,
                  user.proSubscriptionType || 'Unknown'
                ).catch(err => console.error('Failed to send cancellation reason to support:', err));
              }

              const formattedEnd = periodEnd.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
              return res.json({
                success: true,
                message: `Your Pro subscription has been cancelled. You'll retain access until ${formattedEnd}.`,
                endDate: periodEnd.toISOString(),
              });
            }
          }
        }
      } catch (stripeError: any) {
        console.error("Stripe cancellation error:", stripeError.message);
      }

      // Fallback: Try RevenueCat if Stripe didn't work
      const revenueCatSecretKey = process.env.REVENUECAT_SECRET_KEY;
      if (revenueCatSecretKey) {
        try {
          const appUserId = `gamefolio_${userId}`;
          const customerResponse = await fetch(
            `https://api.revenuecat.com/v1/subscribers/${appUserId}`,
            {
              headers: {
                'Authorization': `Bearer ${revenueCatSecretKey}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (customerResponse.ok) {
            const customerData = await customerResponse.json();
            const subscriptions = customerData.subscriber?.subscriptions || {};

            let subscriptionId: string | null = null;
            for (const [productId, subData] of Object.entries(subscriptions)) {
              const sub = subData as any;
              if (sub.unsubscribe_detected_at === null) {
                subscriptionId = sub.store_transaction_id || sub.original_purchase_date;
                break;
              }
            }

            if (subscriptionId) {
              const cancelResponse = await fetch(
                `https://api.revenuecat.com/v2/subscriptions/${subscriptionId}/cancel`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${revenueCatSecretKey}`,
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (cancelResponse.ok) {
                const endDate = user.proSubscriptionEndDate ? new Date(user.proSubscriptionEndDate) : new Date();
                await db.update(users).set({
                  isPro: true,
                  proSubscriptionEndDate: endDate,
                  updatedAt: new Date(),
                }).where(eq(users.id, userId));

                const { EmailService } = await import('./email-service');
                if (user.email) {
                  EmailService.sendProCancelledEmail(
                    user.email,
                    user.username || user.displayName || 'Gamer',
                    endDate
                  ).catch(err => console.error('Failed to send Pro cancelled email:', err));
                }

                console.log(`❌ Pro subscription cancelled via RevenueCat for user ${userId}`);
                return res.json({
                  success: true,
                  message: "Your Pro subscription has been cancelled.",
                  endDate: endDate.toISOString(),
                });
              }
            }
          }
        } catch (revenueCatError) {
          console.error("RevenueCat API error:", revenueCatError);
        }
      }

      // Final fallback: cancel in database directly (keep Pro active until end date)
      const endDate = user.proSubscriptionEndDate ? new Date(user.proSubscriptionEndDate) : new Date();
      await db.update(users).set({
        isPro: true,
        proSubscriptionEndDate: endDate,
        updatedAt: new Date(),
      }).where(eq(users.id, userId));

      const { EmailService } = await import('./email-service');
      if (user.email) {
        EmailService.sendProCancelledEmail(
          user.email,
          user.username || user.displayName || 'Gamer',
          endDate
        ).catch(err => console.error('Failed to send Pro cancelled email:', err));
      }

      console.log(`❌ Pro subscription cancelled (database only) for user ${userId}`);
      return res.json({
        success: true,
        message: "Your Pro subscription has been cancelled.",
        endDate: endDate.toISOString(),
      });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // ==========================================
  // SIGNED URL ENDPOINTS FOR PRIVATE BUCKET
  // ==========================================

  // Generate a signed URL for a single media file
  app.post("/api/media/signed-url", async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "URL is required" });
      }

      // Process all private Supabase bucket URLs
      if (!url.includes('gamefolio-media') && !url.includes('gamefolio-assets') && !url.includes('gamefolio-name-tags') && !url.includes('gamefolio-profile-borders')) {
        return res.json({ signedUrl: url }); // Return original URL for non-Supabase URLs
      }

      const signedUrl = await supabaseStorage.convertToSignedUrl(url, 3600); // 1 hour expiry
      
      if (!signedUrl) {
        return res.status(404).json({ error: "Could not generate signed URL" });
      }

      res.json({ signedUrl });
    } catch (error) {
      console.error("Error generating signed URL:", error);
      res.status(500).json({ error: "Failed to generate signed URL" });
    }
  });

  // Generate signed URLs for multiple media files (batch operation)
  app.post("/api/media/signed-urls", async (req, res) => {
    try {
      const { urls } = req.body;
      
      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: "URLs array is required" });
      }

      // Limit batch size to prevent abuse
      if (urls.length > 50) {
        return res.status(400).json({ error: "Maximum 50 URLs per request" });
      }

      // Separate URLs into Supabase (private) and other (public) URLs
      const supabaseUrls: string[] = [];
      const otherUrls: string[] = [];
      
      for (const url of urls) {
        if (typeof url === 'string') {
          if (url.includes('gamefolio-media') || url.includes('gamefolio-assets') || url.includes('gamefolio-name-tags') || url.includes('gamefolio-profile-borders')) {
            supabaseUrls.push(url);
          } else {
            otherUrls.push(url);
          }
        }
      }

      // Start with non-Supabase URLs (they don't need signing)
      const results: Record<string, string> = {};
      for (const url of otherUrls) {
        results[url] = url; // Return original URL for non-Supabase URLs
      }

      // Generate signed URLs for Supabase bucket content
      for (const url of supabaseUrls) {
        const signedUrl = await supabaseStorage.convertToSignedUrl(url, 3600);
        if (signedUrl) {
          results[url] = signedUrl;
        } else {
          results[url] = url; // Fallback to original if signing fails
        }
      }

      res.json({ signedUrls: results });
    } catch (error) {
      console.error("Error generating signed URLs:", error);
      res.status(500).json({ error: "Failed to generate signed URLs" });
    }
  });

  // Auto-sync verification badges from gamefolio-verification bucket on startup
  (async () => {
    try {
      const files = await supabaseStorage.listBucketFiles('gamefolio-verification', '');
      if (!files || files.length === 0) {
        console.log("No verification badge files found in gamefolio-verification bucket");
        return;
      }

      const existingBadges = await storage.getAllVerificationBadges();
      const existingNames = new Set(existingBadges.map(b => b.name.toLowerCase()));

      let synced = 0;
      const rarities = ['common', 'rare', 'epic', 'legendary'];
      const rarityPrices: Record<string, number> = {
        common: 100,
        rare: 250,
        epic: 500,
        legendary: 1000,
      };

      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!ext || !['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) continue;

        const nameBase = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        const displayName = nameBase.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        const nameKey = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[-_ ]/g, '');

        const isDefaultBadge = nameKey.includes('verified128') || nameKey === 'verified128png';

        if (existingNames.has(displayName.toLowerCase())) {
          const existing = existingBadges.find(b => b.name.toLowerCase() === displayName.toLowerCase());
          if (existing) {
            await storage.updateVerificationBadge(existing.id, {
              imageUrl: file.publicUrl,
              availableInStore: !isDefaultBadge,
              isDefault: isDefaultBadge,
              gfCost: isDefaultBadge ? 0 : (rarityPrices[existing.rarity] || 100),
            });
            synced++;
          }
          continue;
        }

        const rarity = isDefaultBadge ? 'common' : rarities[Math.floor(Math.random() * rarities.length)];

        await storage.createVerificationBadge({
          name: displayName,
          imageUrl: file.publicUrl,
          rarity,
          gfCost: isDefaultBadge ? 0 : rarityPrices[rarity],
          isDefault: isDefaultBadge,
          isActive: true,
          availableInStore: !isDefaultBadge,
        });
        synced++;
      }

      console.log(`Auto-synced ${synced} verification badges from gamefolio-verification bucket`);
    } catch (err) {
      console.error("Error auto-syncing verification badges:", err);
    }
  })();

  return httpServer;
}