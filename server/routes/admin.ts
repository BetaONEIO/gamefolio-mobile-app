import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { adminMiddleware } from "../middleware/admin";
import { randomBytes } from "crypto";
import { VideoProcessor } from '../video-processor';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { ContentFilterService } from '../services/content-filter';
import { insertBannerSettingsSchema, insertAssetRewardSchema, insertHeroSlideSchema, heroSlides } from '@shared/schema';
import { POINT_VALUES, XP_SETTINGS_DEFINITION, updatePointValue } from '../leaderboard-service';
import { z } from 'zod';
import { supabaseStorage } from '../supabase-storage';

// Temporary directory for processing
const tempDir = path.join(process.cwd(), "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer for reward image uploads
const rewardImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'reward-' + uniqueId + path.extname(file.originalname));
  }
});

const rewardImageUpload = multer({
  storage: rewardImageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for reward images
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for rewards'));
    }
  }
});

// Create admin router
const adminRouter = Router();

// ENTERPRISE-GRADE BOOTSTRAP ENDPOINT with security controls
adminRouter.post("/initialize", async (req: Request, res: Response) => {
  try {
    // MANDATORY SECURITY: Require bootstrap secret from environment
    const providedSecret = req.headers['x-bootstrap-secret'] || req.body.bootstrapSecret;
    const requiredSecret = process.env.BOOTSTRAP_SECRET;
    
    if (!requiredSecret) {
      console.error('🚨 SECURITY: BOOTSTRAP_SECRET not configured in environment');
      return res.status(500).json({ 
        message: "Bootstrap secret not configured. Contact system administrator." 
      });
    }
    
    if (!providedSecret || providedSecret !== requiredSecret) {
      console.error('🚨 SECURITY: Invalid bootstrap secret attempt');
      return res.status(401).json({ 
        message: "Invalid bootstrap credentials" 
      });
    }
    
    // SECURITY: Only allow initialization if no admin users exist
    const adminCount = await storage.getAdminCount();
    
    if (adminCount > 0) {
      console.log('🔒 SECURITY: Bootstrap blocked - admin users already exist');
      return res.status(400).json({ 
        message: "Admin users already exist. Bootstrap disabled for security." 
      });
    }
    
    // Check if mod_tom already exists
    const superAdmin = await storage.getUserByUsername("mod_tom");
    
    if (superAdmin) {
      // Update existing user to admin role
      await storage.updateUser(superAdmin.id, { role: "admin" });
      
      // Assign moderator badge to admin
      try {
        await storage.createUserBadge({
          userId: superAdmin.id,
          badgeType: "moderator",
          assignedBy: "system"
        });
      } catch (badgeError) {
        console.error("Failed to assign moderator badge during admin initialization:", badgeError);
      }
      
      res.json({ 
        message: "Super admin mod_tom role updated successfully",
        user: { username: superAdmin.username, role: "admin" }
      });
    } else {
      // Create super admin account
      const tempPassword = randomBytes(16).toString('hex');
      const newSuperAdmin = await storage.createUser({
        username: "mod_tom",
        email: "mod_tom@gamefolio.admin",
        displayName: "Administrator",
        role: "admin",
        password: tempPassword, // This should be changed on first login
        bio: "Platform Administrator"
      });
      
      // Assign moderator badge to new admin
      try {
        await storage.createUserBadge({
          userId: newSuperAdmin.id,
          badgeType: "moderator",
          assignedBy: "system"
        });
      } catch (badgeError) {
        console.error("Failed to assign moderator badge to new admin during initialization:", badgeError);
      }
      
      // ENTERPRISE SECURITY: Never return credentials in any environment
      console.log('🔐 AUDIT: Super admin created successfully - credentials secured');
      res.json({ 
        message: "Super admin created successfully. Credentials have been logged securely.",
        user: { username: newSuperAdmin.username, role: "admin" },
        nextSteps: "Check server logs for initial credentials. Change password immediately after first login."
      });
      
      // AUDIT LOG: Securely log the temporary password for admin access
      console.log('🔑 BOOTSTRAP CREDENTIALS (SECURE LOG):');
      console.log(`   Username: ${newSuperAdmin.username}`);
      console.log(`   Temporary Password: ${tempPassword}`);
      console.log('   ⚠️  CHANGE PASSWORD IMMEDIATELY AFTER FIRST LOGIN');
    }
  } catch (err) {
    console.error("Error initializing super admin:", err);
    res.status(500).json({ message: "Error initializing super admin" });
  }
});

// Apply admin middleware to all other routes
adminRouter.use(adminMiddleware);

// GET /api/admin/users - Get all users with pagination
adminRouter.get("/users", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string || "";
    const offset = (page - 1) * limit;

    const users = await storage.getAllUsers(limit, offset, search);
    const total = await storage.getUserCount(search);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Error fetching users" });
  }
});

// GET /api/admin/users/:id - Get user by ID
adminRouter.get("/users/:id", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ message: "Error fetching user" });
  }
});

// PATCH /api/admin/users/:id - Update user
adminRouter.patch("/users/:id", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update user
    const updatedUser = await storage.updateUser(userId, req.body);
    res.json(updatedUser);
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ message: "Error updating user" });
  }
});

// PATCH /api/admin/users/:id/level - Update user level and XP
adminRouter.patch("/users/:id/level", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { level, totalXP } = req.body;

    // Validate inputs
    if (!level || !totalXP) {
      return res.status(400).json({ message: "Level and totalXP are required" });
    }

    if (level < 1 || totalXP < 0) {
      return res.status(400).json({ message: "Level must be at least 1 and totalXP must be at least 0" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update user level and XP
    const updatedUser = await storage.updateUser(userId, {
      level: parseInt(level),
      totalXP: parseInt(totalXP)
    });

    res.json(updatedUser);
  } catch (err) {
    console.error("Error updating user level:", err);
    res.status(500).json({ message: "Error updating user level" });
  }
});

// PATCH /api/admin/users/:id/streak - Update user streak
adminRouter.patch("/users/:id/streak", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { currentStreak, longestStreak } = req.body;

    // Validate inputs
    if (currentStreak === undefined || longestStreak === undefined) {
      return res.status(400).json({ message: "currentStreak and longestStreak are required" });
    }

    if (currentStreak < 0 || longestStreak < 0) {
      return res.status(400).json({ message: "Streaks must be at least 0" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update user streaks while preserving the existing lastStreakUpdate
    // This ensures the user can still earn their daily streak increment
    const existingLastUpdate = user.lastStreakUpdate || new Date();
    
    if (storage.updateUserStreak) {
      await storage.updateUserStreak({
        userId,
        currentStreak: parseInt(currentStreak),
        longestStreak: parseInt(longestStreak),
        lastStreakUpdate: existingLastUpdate
      });
    } else {
      // Fallback if updateUserStreak is not available
      await storage.updateUser(userId, {
        currentStreak: parseInt(currentStreak),
        longestStreak: parseInt(longestStreak),
        lastStreakUpdate: existingLastUpdate
      });
    }

    // Fetch and return updated user
    const updatedUser = await storage.getUser(userId);
    res.json(updatedUser);
  } catch (err) {
    console.error("Error updating user streak:", err);
    res.status(500).json({ message: "Error updating user streak" });
  }
});

// POST /api/admin/users/:id/ban - Ban user
adminRouter.post("/users/:id/ban", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is an admin
    if (user.role === "admin") {
      return res.status(403).json({ message: "Cannot ban an admin user" });
    }

    // Ban user
    const updatedUser = await storage.updateUser(userId, {
      status: "banned",
      bannedReason: req.body.reason || "Violation of community guidelines"
    });

    res.json(updatedUser);
  } catch (err) {
    console.error("Error banning user:", err);
    res.status(500).json({ message: "Error banning user" });
  }
});

// POST /api/admin/users/:id/unban - Unban user
adminRouter.post("/users/:id/unban", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Unban user
    const updatedUser = await storage.updateUser(userId, {
      status: "active",
      bannedReason: null
    });

    res.json(updatedUser);
  } catch (err) {
    console.error("Error unbanning user:", err);
    res.status(500).json({ message: "Error unbanning user" });
  }
});

// POST /api/admin/users/:id/make-admin - Make user an admin
adminRouter.post("/users/:id/make-admin", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the requesting admin is trying to modify their own role
    const adminUser = req.user;
    if (adminUser.id === userId) {
      return res.status(403).json({ message: "Cannot modify your own admin role" });
    }

    // Make user an admin
    const updatedUser = await storage.updateUser(userId, {
      role: "admin"
    });

    // Automatically assign moderator badge to new admin
    try {
      await storage.createUserBadge({
        userId: userId,
        badgeType: "moderator",
        assignedBy: "system",
        assignedById: adminUser.id
      });
    } catch (badgeError) {
      // Log error but don't fail the admin promotion if badge assignment fails
      console.error("Failed to assign moderator badge to new admin:", badgeError);
    }

    res.json(updatedUser);
  } catch (err) {
    console.error("Error making user admin:", err);
    res.status(500).json({ message: "Error making user admin" });
  }
});


// POST /api/admin/users/by-username/:username/make-admin - Give admin role to user by username
adminRouter.post("/users/by-username/:username/make-admin", async (req: Request, res: Response) => {
  try {
    const username = req.params.username;
    const user = await storage.getUserByUsername(username);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Make user admin
    const updatedUser = await storage.updateUser(user.id, {
      role: "admin"
    });

    // Automatically assign moderator badge to new admin
    try {
      await storage.createUserBadge({
        userId: user.id,
        badgeType: "moderator",
        assignedBy: "system"
      });
    } catch (badgeError) {
      // Log error but don't fail the admin promotion if badge assignment fails
      console.error("Failed to assign moderator badge to new admin:", badgeError);
    }

    res.json(updatedUser);
  } catch (err) {
    console.error("Error making user admin:", err);
    res.status(500).json({ message: "Error making user admin" });
  }
});

// POST /api/admin/users/:id/remove-admin - Remove admin role from user
adminRouter.post("/users/:id/remove-admin", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the requesting admin is trying to modify their own role
    const adminUser = req.user;
    if (adminUser?.id === userId) {
      return res.status(403).json({ message: "Cannot remove your own admin role" });
    }

    // Remove admin role
    const updatedUser = await storage.updateUser(userId, {
      role: "user"
    });

    // Automatically remove moderator badge when removing admin role
    try {
      await storage.deleteBadgesByType(userId, "moderator");
    } catch (badgeError) {
      // Log error but don't fail the admin demotion if badge removal fails
      console.error("Failed to remove moderator badge from former admin:", badgeError);
    }

    res.json(updatedUser);
  } catch (err) {
    console.error("Error removing admin role:", err);
    res.status(500).json({ message: "Error removing admin role" });
  }
});

// POST /api/admin/users/:id/reset-password - Reset user password
adminRouter.post("/users/:id/reset-password", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate a temporary password
    const tempPassword = randomBytes(8).toString("hex");

    // Hash the temporary password (this would be done in storage method)
    // and update the user's password
    const updatedUser = await storage.updateUser(userId, {
      password: tempPassword // The storage method should hash this
    });

    // In a production environment, send an email with the temporary password
    // For development, return the temporary password
    const isDev = process.env.NODE_ENV === "development";
    
    res.json({
      message: "Password reset successfully",
      // Only include the temporary password in development mode
      ...(isDev && { tempPassword })
    });
  } catch (err) {
    console.error("Error resetting password:", err);
    res.status(500).json({ message: "Error resetting password" });
  }
});

// DELETE /api/admin/users/:id - Delete user with all related data
adminRouter.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is an admin
    if (user.role === "admin") {
      return res.status(403).json({ message: "Cannot delete an admin user" });
    }

    // Delete user and all related data using storage method
    const result = await storage.deleteUser(userId);
    
    if (result) {
      res.json({ 
        message: "User and all related data deleted successfully",
        deletedUserId: userId,
        deletedUsername: user.username
      });
    } else {
      res.status(500).json({ message: "Failed to delete user" });
    }
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ message: "Error deleting user" });
  }
});

// GET /api/admin/stats - Get admin dashboard stats
adminRouter.get("/stats", async (req: Request, res: Response) => {
  try {
    // Fetch all required stats
    const totalUsers = await storage.getUserCount();
    const totalClips = await storage.getClipCount();
    const totalGames = await storage.getGameCount();

    // Fetch analytics data
    const userTypeDistribution = await storage.getUserTypeDistribution();
    
    const ageRangeDistribution = await storage.getAgeRangeDistribution();
    
    const topGames = await storage.getTopGames(5);
    
    const recentClips = await storage.getRecentClips(5);

    res.json({
      overview: {
        totalUsers,
        totalClips,
        totalGames
      },
      analytics: {
        userTypeDistribution,
        ageRangeDistribution,
        topGames,
        recentClips
      }
    });
  } catch (err) {
    console.error("Error fetching admin stats:", err);
    res.status(500).json({ message: "Error fetching admin stats" });
  }
});

// GET /api/admin/clips - Get all clips with pagination
adminRouter.get("/clips", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const clips = await storage.getAllClips(limit, offset);
    const total = await storage.getClipCount();

    res.json({
      clips,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("Error fetching clips:", err);
    res.status(500).json({ message: "Error fetching clips" });
  }
});

// DELETE /api/admin/clips/:id - Delete clip
adminRouter.delete("/clips/:id", async (req: Request, res: Response) => {
  try {
    const clipId = parseInt(req.params.id);
    const success = await storage.deleteClip(clipId);

    if (!success) {
      return res.status(404).json({ message: "Clip not found" });
    }

    res.json({ message: "Clip deleted successfully" });
  } catch (err) {
    console.error("Error deleting clip:", err);
    res.status(500).json({ message: "Error deleting clip" });
  }
});

// GET /api/admin/screenshots - Get all screenshots with pagination  
adminRouter.get("/screenshots", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const screenshots = await storage.getAllScreenshots(limit, offset);
    const total = await storage.getScreenshotCount();

    res.json({
      screenshots,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("Error fetching screenshots:", err);
    res.status(500).json({ message: "Error fetching screenshots" });
  }
});

// DELETE /api/admin/screenshots/:id - Delete screenshot
adminRouter.delete("/screenshots/:id", async (req: Request, res: Response) => {
  try {
    const screenshotId = parseInt(req.params.id);
    const success = await storage.deleteScreenshot(screenshotId);

    if (!success) {
      return res.status(404).json({ message: "Screenshot not found" });
    }

    res.json({ message: "Screenshot deleted successfully" });
  } catch (err) {
    console.error("Error deleting screenshot:", err);
    res.status(500).json({ message: "Error deleting screenshot" });
  }
});

// GET /api/admin/recent-content - Get recent content (clips, reels, screenshots) in chronological order
adminRouter.get("/recent-content", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const contentType = req.query.contentType as string;
    
    const recentContent = await storage.getRecentContent(limit, (page - 1) * limit, contentType);
    const total = await storage.getRecentContentCount(contentType);

    res.json({
      content: recentContent,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("Error fetching recent content:", err);
    res.status(500).json({ message: "Error fetching recent content" });
  }
});

// Badge management routes

// GET /api/admin/users/:id/badges - Get user badges
adminRouter.get("/users/:id/badges", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const badges = await storage.getUserBadges(userId);
    res.json(badges);
  } catch (err) {
    console.error("Error fetching user badges:", err);
    res.status(500).json({ message: "Error fetching user badges" });
  }
});

// POST /api/admin/users/:id/badges - Assign badge to user
adminRouter.post("/users/:id/badges", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { badgeType } = req.body;
    const adminUser = req.user;

    if (!userId || !badgeType) {
      return res.status(400).json({ message: "User ID and badge type are required" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate badge type
    const validBadgeTypes = ['newcomer', 'founder', 'admin'];
    if (!validBadgeTypes.includes(badgeType)) {
      return res.status(400).json({ message: "Invalid badge type" });
    }

    // Check if badge already exists for this user
    const existingBadges = await storage.getUserBadges(userId);
    const hasBadge = existingBadges.some(badge => badge.badgeType === badgeType);
    
    if (hasBadge) {
      return res.status(400).json({ message: "User already has this badge" });
    }

    // Create the badge
    const badge = await storage.createUserBadge({
      userId,
      badgeType,
      assignedBy: 'admin',
      assignedById: adminUser?.id
    });

    // If assigning admin badge, also update user role
    if (badgeType === 'admin') {
      await storage.updateUser(userId, { role: 'admin' });
    }

    res.json(badge);
  } catch (err) {
    console.error("Error assigning badge:", err);
    res.status(500).json({ message: "Error assigning badge" });
  }
});

// DELETE /api/admin/users/:id/badges/:badgeType - Remove badge from user
adminRouter.delete("/users/:id/badges/:badgeType", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const badgeType = req.params.badgeType;

    if (!userId || !badgeType) {
      return res.status(400).json({ message: "User ID and badge type are required" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const success = await storage.deleteBadgesByType(userId, badgeType);
    
    if (!success) {
      return res.status(404).json({ message: "Badge not found" });
    }

    // If removing admin badge, also update user role
    if (badgeType === 'admin') {
      await storage.updateUser(userId, { role: 'user' });
    }

    res.json({ message: "Badge removed successfully" });
  } catch (err) {
    console.error("Error removing badge:", err);
    res.status(500).json({ message: "Error removing badge" });
  }
});

// POST /api/admin/badges/cleanup - Clean up expired badges
adminRouter.post("/badges/cleanup", async (req: Request, res: Response) => {
  try {
    await storage.cleanupExpiredBadges();
    res.json({ message: "Expired badges cleaned up successfully" });
  } catch (err) {
    console.error("Error cleaning up badges:", err);
    res.status(500).json({ message: "Error cleaning up badges" });
  }
});

// ==========================================
// Badge Definition Management Routes
// ==========================================

// GET /api/admin/badges - Get all badge definitions
adminRouter.get("/badges", async (req: Request, res: Response) => {
  try {
    const badges = await storage.getAllBadges();
    res.json(badges);
  } catch (err) {
    console.error("Error fetching badges:", err);
    res.status(500).json({ message: "Error fetching badges" });
  }
});

// GET /api/admin/badges/active - Get active badge definitions
adminRouter.get("/badges/active", async (req: Request, res: Response) => {
  try {
    const badges = await storage.getActiveBadges();
    res.json(badges);
  } catch (err) {
    console.error("Error fetching active badges:", err);
    res.status(500).json({ message: "Error fetching active badges" });
  }
});

// GET /api/admin/badges/stats - Get badges with usage statistics
adminRouter.get("/badges/stats", async (req: Request, res: Response) => {
  try {
    const badgesWithStats = await storage.getBadgesWithStats();
    res.json(badgesWithStats);
  } catch (err) {
    console.error("Error fetching badge stats:", err);
    res.status(500).json({ message: "Error fetching badge stats" });
  }
});

// GET /api/admin/badges/:id - Get badge by ID
adminRouter.get("/badges/:id", async (req: Request, res: Response) => {
  try {
    const badgeId = parseInt(req.params.id);
    const badge = await storage.getBadge(badgeId);
    
    if (!badge) {
      return res.status(404).json({ message: "Badge not found" });
    }
    
    res.json(badge);
  } catch (err) {
    console.error("Error fetching badge:", err);
    res.status(500).json({ message: "Error fetching badge" });
  }
});

// POST /api/admin/badges - Create new badge definition
adminRouter.post("/badges", async (req: Request, res: Response) => {
  try {
    const { name, description, imageUrl, textColor, backgroundColor, isActive } = req.body;
    const adminUser = req.user;
    
    if (!name) {
      return res.status(400).json({ message: "Badge name is required" });
    }
    
    // Check if badge name already exists
    const existingBadge = await storage.getBadgeByName(name);
    if (existingBadge) {
      return res.status(400).json({ message: "Badge with this name already exists" });
    }
    
    const badgeData = {
      name,
      description: description || null,
      imageUrl: imageUrl || null,
      textColor: textColor || '#FFFFFF',
      backgroundColor: backgroundColor || '#6B7280',
      isActive: isActive !== undefined ? isActive : true,
      isSystemBadge: false,
      createdBy: adminUser?.id || null
    };
    
    const badge = await storage.createBadge(badgeData);
    res.status(201).json(badge);
  } catch (err) {
    console.error("Error creating badge:", err);
    res.status(500).json({ message: "Error creating badge" });
  }
});

// PATCH /api/admin/badges/:id - Update badge definition
adminRouter.patch("/badges/:id", async (req: Request, res: Response) => {
  try {
    const badgeId = parseInt(req.params.id);
    const updateData = req.body;
    
    // Check if badge exists
    const existingBadge = await storage.getBadge(badgeId);
    if (!existingBadge) {
      return res.status(404).json({ message: "Badge not found" });
    }
    
    // If updating name, check for duplicates
    if (updateData.name && updateData.name !== existingBadge.name) {
      const nameExists = await storage.getBadgeByName(updateData.name);
      if (nameExists) {
        return res.status(400).json({ message: "Badge with this name already exists" });
      }
    }
    
    const updatedBadge = await storage.updateBadge(badgeId, updateData);
    
    if (!updatedBadge) {
      return res.status(500).json({ message: "Failed to update badge" });
    }
    
    res.json(updatedBadge);
  } catch (err) {
    console.error("Error updating badge:", err);
    res.status(500).json({ message: "Error updating badge" });
  }
});

// DELETE /api/admin/badges/:id - Delete badge definition
adminRouter.delete("/badges/:id", async (req: Request, res: Response) => {
  try {
    const badgeId = parseInt(req.params.id);
    
    // Check if badge exists
    const badge = await storage.getBadge(badgeId);
    if (!badge) {
      return res.status(404).json({ message: "Badge not found" });
    }
    
    // Prevent deletion of system badges
    if (badge.isSystemBadge) {
      return res.status(403).json({ message: "Cannot delete system badges" });
    }
    
    const success = await storage.deleteBadge(badgeId);
    
    if (!success) {
      return res.status(400).json({ message: "Cannot delete badge - it may be assigned to users" });
    }
    
    res.json({ message: "Badge deleted successfully" });
  } catch (err) {
    console.error("Error deleting badge:", err);
    res.status(500).json({ message: "Error deleting badge" });
  }
});

// Regenerate thumbnail for a clip or reel
adminRouter.post("/regenerate-thumbnail/:clipId", async (req: Request, res: Response) => {
  try {
    const clipId = parseInt(req.params.clipId);
    
    if (isNaN(clipId)) {
      return res.status(400).json({ message: "Invalid clip ID" });
    }

    // Get clip details
    const clip = await storage.getClip(clipId);
    if (!clip) {
      return res.status(404).json({ message: "Clip not found" });
    }

    // Download video temporarily for processing
    const tempDir = path.join(process.cwd(), "temp");
    const tempVideoPath = path.join(tempDir, `admin_video_${clipId}_${Date.now()}.mp4`);
    
    try {
      // Download video from Supabase
      const videoResponse = await fetch(clip.videoUrl);
      if (!videoResponse.ok) {
        throw new Error('Failed to download video');
      }
      
      const videoBuffer = await videoResponse.arrayBuffer();
      await fs.promises.writeFile(tempVideoPath, Buffer.from(videoBuffer));
      
      // Generate new thumbnail
      const newThumbnailUrl = await VideoProcessor.generateAutoThumbnail(
        tempVideoPath, 
        clip.userId, 
        `admin_regen_thumb_${clipId}`
      );
      
      // Update clip with new thumbnail URL
      await storage.updateClip(clipId, { thumbnailUrl: newThumbnailUrl });
      
      // Clean up temp video file
      fs.unlink(tempVideoPath, (err) => {
        if (err) console.warn('Could not delete temp video file:', err);
      });
      
      res.json({
        success: true,
        message: 'Thumbnail regenerated successfully',
        thumbnailUrl: newThumbnailUrl
      });
      
    } catch (error) {
      // Clean up temp file on error
      if (fs.existsSync(tempVideoPath)) {
        fs.unlink(tempVideoPath, (err) => {
          if (err) console.warn('Could not delete temp video file:', err);
        });
      }
      throw error;
    }
    
  } catch (error) {
    console.error('Error regenerating thumbnail:', error);
    res.status(500).json({ 
      message: error instanceof Error ? error.message : 'Thumbnail regeneration failed' 
    });
  }
});

// ==========================================
// Content Filtering Management Routes
// ==========================================

// POST /api/admin/content-filter/check - Check if content contains profanity
adminRouter.post("/content-filter/check", async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: "Content is required" });
    }
    
    const containsProfanity = ContentFilterService.containsProfanity(content);
    const profaneWords = ContentFilterService.getProfaneWords(content);
    const cleanedContent = ContentFilterService.cleanContent(content);
    
    res.json({
      originalContent: content,
      containsProfanity,
      profaneWords,
      cleanedContent
    });
  } catch (err) {
    console.error("Error checking content:", err);
    res.status(500).json({ message: "Error checking content" });
  }
});

// POST /api/admin/content-filter/add-words - Add custom words to filter
adminRouter.post("/content-filter/add-words", async (req: Request, res: Response) => {
  try {
    const { words } = req.body;
    
    if (!words || !Array.isArray(words)) {
      return res.status(400).json({ message: "Words array is required" });
    }
    
    // Validate that all words are strings
    const invalidWords = words.filter(word => typeof word !== 'string');
    if (invalidWords.length > 0) {
      return res.status(400).json({ message: "All words must be strings" });
    }
    
    ContentFilterService.addCustomWords(words);
    
    res.json({ 
      message: `Successfully added ${words.length} words to content filter`,
      addedWords: words 
    });
  } catch (err) {
    console.error("Error adding words to filter:", err);
    res.status(500).json({ message: "Error adding words to filter" });
  }
});

// POST /api/admin/content-filter/remove-words - Remove words from filter
adminRouter.post("/content-filter/remove-words", async (req: Request, res: Response) => {
  try {
    const { words } = req.body;
    
    if (!words || !Array.isArray(words)) {
      return res.status(400).json({ message: "Words array is required" });
    }
    
    // Validate that all words are strings
    const invalidWords = words.filter(word => typeof word !== 'string');
    if (invalidWords.length > 0) {
      return res.status(400).json({ message: "All words must be strings" });
    }
    
    ContentFilterService.removeWords(words);
    
    res.json({ 
      message: `Successfully removed ${words.length} words from content filter`,
      removedWords: words 
    });
  } catch (err) {
    console.error("Error removing words from filter:", err);
    res.status(500).json({ message: "Error removing words from filter" });
  }
});

// POST /api/admin/content-filter/validate - Validate content with detailed response
adminRouter.post("/content-filter/validate", async (req: Request, res: Response) => {
  try {
    const { content, options } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: "Content is required" });
    }
    
    const validationOptions = {
      allowProfanity: options?.allowProfanity || false,
      cleanAutomatically: options?.cleanAutomatically || false,
      maxLength: options?.maxLength || 1000
    };
    
    const validation = ContentFilterService.validateContent(content, validationOptions);
    
    res.json({
      originalContent: content,
      ...validation
    });
  } catch (err) {
    console.error("Error validating content:", err);
    res.status(500).json({ message: "Error validating content" });
  }
});

// GET /api/admin/banner-settings - Get current banner settings
adminRouter.get("/banner-settings", async (req: Request, res: Response) => {
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

// PUT /api/admin/banner-settings - Update banner settings
adminRouter.put("/banner-settings", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const updateSchema = z.object({
      isEnabled: z.boolean().optional(),
      title: z.string().min(1).max(100).optional(),
      message: z.string().min(1).max(500).optional(),
      linkText: z.string().max(50).optional(),
      linkUrl: z.string().max(200).optional(),
      variant: z.enum(["primary", "warning", "info", "danger"]).optional(),
      showIcon: z.boolean().optional(),
      isDismissible: z.boolean().optional(),
    });
    
    const validatedData = updateSchema.parse(req.body);
    
    // Add updatedBy from authenticated user
    const updateData = {
      ...validatedData,
      updatedBy: req.user!.id,
    };
    
    // Check if settings exist
    const existingSettings = await storage.getBannerSettings();
    
    let bannerSettings;
    if (existingSettings) {
      // Update existing settings
      bannerSettings = await storage.updateBannerSettings(updateData);
    } else {
      // Create new settings
      const createData = {
        isEnabled: true,
        title: "Alpha Stage",
        message: "This app is currently in Alpha. You may encounter issues while using it.",
        linkText: "report a bug",
        linkUrl: "/contact",
        variant: "primary" as const,
        showIcon: true,
        isDismissible: true,
        updatedBy: req.user!.id,
        ...validatedData,
      };
      bannerSettings = await storage.createBannerSettings(createData);
    }
    
    res.json(bannerSettings);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Invalid input", 
        errors: err.errors 
      });
    }
    console.error("Error updating banner settings:", err);
    res.status(500).json({ message: "Error updating banner settings" });
  }
});

// POST /api/admin/banner-settings/reset - Reset banner settings to defaults
adminRouter.post("/banner-settings/reset", async (req: Request, res: Response) => {
  try {
    const defaultSettings = {
      isEnabled: true,
      title: "Alpha Stage",
      message: "This app is currently in Alpha. You may encounter issues while using it.",
      linkText: "report a bug",
      linkUrl: "/contact",
      variant: "primary" as const,
      showIcon: true,
      isDismissible: true,
      updatedBy: req.user!.id,
    };
    
    // Check if settings exist
    const existingSettings = await storage.getBannerSettings();
    
    let bannerSettings;
    if (existingSettings) {
      bannerSettings = await storage.updateBannerSettings(defaultSettings);
    } else {
      bannerSettings = await storage.createBannerSettings(defaultSettings);
    }
    
    res.json(bannerSettings);
  } catch (err) {
    console.error("Error resetting banner settings:", err);
    res.status(500).json({ message: "Error resetting banner settings" });
  }
});

// POST /api/admin/fix-leaderboard - Fix leaderboard data by rebuilding from points history
adminRouter.post("/fix-leaderboard", async (req: Request, res: Response) => {
  try {
    const { fixLeaderboardData } = await import('../scripts/fix-leaderboard-data.js');
    await fixLeaderboardData();
    res.json({ 
      success: true, 
      message: "Leaderboard data has been successfully rebuilt from points history" 
    });
  } catch (err) {
    console.error("Error fixing leaderboard data:", err);
    res.status(500).json({ 
      success: false,
      message: "Error fixing leaderboard data",
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

// POST /api/admin/regenerate-reel-thumbnails - Regenerate all reel thumbnails with correct 9:16 aspect ratio
adminRouter.post("/regenerate-reel-thumbnails", async (req: Request, res: Response) => {
  try {
    const { regenerateReelThumbnails } = await import('../scripts/regenerate-reel-thumbnails');
    await regenerateReelThumbnails();
    res.json({ 
      success: true, 
      message: "Reel thumbnails have been successfully regenerated with correct 9:16 aspect ratio" 
    });
  } catch (err) {
    console.error("Error regenerating reel thumbnails:", err);
    res.status(500).json({ 
      success: false,
      message: "Error regenerating reel thumbnails",
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

// ============ Asset Rewards Routes ============

// POST /api/admin/asset-rewards/upload-image - Upload reward image
adminRouter.post("/asset-rewards/upload-image", rewardImageUpload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const userId = req.user!.id;
    
    // Upload to Supabase storage
    const result = await supabaseStorage.uploadFile(req.file, 'image', userId);
    
    // Clean up temp file
    const fs = await import('fs');
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({ 
      imageUrl: result.url,
      path: result.path 
    });
  } catch (err) {
    console.error("Error uploading reward image:", err);
    res.status(500).json({ message: "Error uploading image" });
  }
});

// GET /api/admin/asset-rewards - Get all asset rewards
adminRouter.get("/asset-rewards", async (req: Request, res: Response) => {
  try {
    const rewards = await storage.getAllAssetRewards();
    res.json(rewards);
  } catch (err) {
    console.error("Error fetching asset rewards:", err);
    res.status(500).json({ message: "Error fetching asset rewards" });
  }
});

// GET /api/admin/asset-rewards/:id - Get single asset reward with claims
adminRouter.get("/asset-rewards/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid reward ID" });
    }

    const reward = await storage.getAssetRewardWithClaims(id);
    if (!reward) {
      return res.status(404).json({ message: "Asset reward not found" });
    }

    res.json(reward);
  } catch (err) {
    console.error("Error fetching asset reward:", err);
    res.status(500).json({ message: "Error fetching asset reward" });
  }
});

// POST /api/admin/asset-rewards - Create new asset reward
adminRouter.post("/asset-rewards", async (req: Request, res: Response) => {
  try {
    const validatedData = insertAssetRewardSchema.parse({
      ...req.body,
      createdBy: req.user!.id,
    });

    const reward = await storage.createAssetReward(validatedData);
    res.status(201).json(reward);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Invalid input", 
        errors: err.errors 
      });
    }
    console.error("Error creating asset reward:", err);
    res.status(500).json({ message: "Error creating asset reward" });
  }
});

// Update schema for asset rewards (partial validation)
const updateAssetRewardSchema = z.object({
  name: z.string().min(1).optional(),
  imageUrl: z.string().url().optional(),
  assetType: z.string().optional(),
  rarity: z.enum(["common", "rare", "epic", "legendary"]).optional(),
  unlockChance: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  availableInLootbox: z.boolean().optional(),
  availableInStore: z.boolean().optional(),
  proOnly: z.boolean().optional(),
  freeItem: z.boolean().optional(),
  redeemable: z.boolean().optional(),
  rewardCategory: z.enum(["pro_user", "lootbox", "free_item", "store_item", "redeemable", "other"]).optional(),
  storePrice: z.number().int().min(1).nullable().optional(),
  sourceBucket: z.string().nullable().optional(),
  sourcePath: z.string().nullable().optional(),
});

// PATCH /api/admin/asset-rewards/:id - Update asset reward
adminRouter.patch("/asset-rewards/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid reward ID" });
    }

    const existing = await storage.getAssetReward(id);
    if (!existing) {
      return res.status(404).json({ message: "Asset reward not found" });
    }

    const validatedData = updateAssetRewardSchema.parse(req.body);
    
    if (validatedData.availableInStore && !validatedData.storePrice && !existing.storePrice) {
      return res.status(400).json({ message: "Store price is required when available in store" });
    }

    const updated = await storage.updateAssetReward(id, validatedData);
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Invalid input", 
        errors: err.errors 
      });
    }
    console.error("Error updating asset reward:", err);
    res.status(500).json({ message: "Error updating asset reward" });
  }
});

// DELETE /api/admin/asset-rewards/:id - Delete asset reward
adminRouter.delete("/asset-rewards/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid reward ID" });
    }

    const existing = await storage.getAssetReward(id);
    if (!existing) {
      return res.status(404).json({ message: "Asset reward not found" });
    }

    await storage.deleteAssetReward(id);
    res.json({ success: true, message: "Asset reward deleted" });
  } catch (err) {
    console.error("Error deleting asset reward:", err);
    res.status(500).json({ message: "Error deleting asset reward" });
  }
});

// GET /api/admin/asset-rewards/:id/claims - Get claims for a specific reward
adminRouter.get("/asset-rewards/:id/claims", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid reward ID" });
    }

    const claims = await storage.getAssetRewardClaims(id);
    res.json(claims);
  } catch (err) {
    console.error("Error fetching asset reward claims:", err);
    res.status(500).json({ message: "Error fetching asset reward claims" });
  }
});

// GET /api/admin/pro-subscribers - Get all Pro subscribers with subscription details
adminRouter.get("/pro-subscribers", async (req: Request, res: Response) => {
  try {
    const proSubscribers = await storage.getProSubscribers();
    res.json({
      subscribers: proSubscribers,
      total: proSubscribers.length
    });
  } catch (err) {
    console.error("Error fetching Pro subscribers:", err);
    res.status(500).json({ message: "Error fetching Pro subscribers" });
  }
});

// GET /api/admin/storage/buckets - List all Supabase buckets dynamically
adminRouter.get("/storage/buckets", async (req: Request, res: Response) => {
  try {
    const { supabaseStorage } = await import('../supabase-storage');
    const buckets = await supabaseStorage.listAllBuckets();
    res.json(buckets);
  } catch (err) {
    console.error("Error fetching buckets:", err);
    res.status(500).json({ message: "Error fetching buckets" });
  }
});

// GET /api/admin/storage/buckets/:bucketName/files - List files in a bucket
adminRouter.get("/storage/buckets/:bucketName/files", async (req: Request, res: Response) => {
  try {
    const { bucketName } = req.params;
    const { folder } = req.query;
    
    const { supabaseStorage } = await import('../supabase-storage');
    console.log(`[Admin Assets] Fetching files from bucket: ${bucketName}, folder: ${folder || '(root)'}`);
    const files = await supabaseStorage.listBucketFiles(bucketName, folder as string || '');
    const folders = await supabaseStorage.listBucketFolders(bucketName, folder as string || '');
    console.log(`[Admin Assets] Found ${files.length} files and ${folders.length} folders in ${bucketName}`);
    if (files.length > 0) {
      console.log(`[Admin Assets] Sample file URL: ${files[0].publicUrl?.substring(0, 100)}...`);
    }
    
    res.json({ files, folders, bucket: bucketName, currentFolder: folder || '' });
  } catch (err) {
    console.error("Error listing bucket files:", err);
    res.status(500).json({ message: "Error listing bucket files" });
  }
});

adminRouter.get("/assets/assignments", async (req: Request, res: Response) => {
  try {
    const { db } = await import('../db');
    
    const assignments: Record<string, any> = {};
    
    const { assetRewards, nameTags, profileBorders } = await import('../../shared/schema');
    
    const extractFilePath = (url: string): string => {
      try {
        const patterns = [
          /\/storage\/v1\/object\/(?:public|sign)\/(.+?)(?:\?.*)?$/,
          /\/storage\/v1\/object\/(.+?)(?:\?.*)?$/,
        ];
        for (const pattern of patterns) {
          const match = url.match(pattern);
          if (match) return match[1];
        }
        return url;
      } catch {
        return url;
      }
    };

    const rewards = await db.select().from(assetRewards);
    for (const reward of rewards) {
      if (reward.imageUrl) {
        const key = extractFilePath(reward.imageUrl);
        assignments[key] = {
          type: 'asset_reward',
          table: 'asset_rewards',
          id: reward.id,
          name: reward.name,
          imageUrl: reward.imageUrl,
          availableInLootbox: reward.availableInLootbox,
          unlockChance: reward.unlockChance,
          availableInStore: reward.availableInStore,
          storePrice: reward.storePrice,
          rarity: reward.rarity,
          assetType: reward.assetType,
          isActive: reward.isActive,
          proOnly: reward.proOnly,
        };
      }
    }
    
    const tags = await db.select().from(nameTags);
    for (const tag of tags) {
      if (tag.imageUrl) {
        const key = extractFilePath(tag.imageUrl);
        assignments[key] = {
          type: 'name_tag',
          table: 'name_tags',
          id: tag.id,
          name: tag.name,
          imageUrl: tag.imageUrl,
          availableInLootbox: tag.availableInLootbox,
          unlockChance: null,
          availableInStore: tag.availableInStore,
          storePrice: tag.gfCost,
          rarity: tag.rarity,
          assetType: 'name_tag',
          isActive: tag.isActive,
          proOnly: false,
        };
      }
    }
    
    const borders = await db.select().from(profileBorders);
    for (const border of borders) {
      if (border.imageUrl) {
        const key = extractFilePath(border.imageUrl);
        assignments[key] = {
          type: 'profile_border',
          table: 'profile_borders',
          id: border.id,
          name: border.name,
          imageUrl: border.imageUrl,
          availableInLootbox: border.availableInLootbox,
          unlockChance: null,
          availableInStore: border.availableInStore,
          storePrice: border.gfCost,
          rarity: border.rarity,
          assetType: 'profile_border',
          isActive: border.isActive,
          proOnly: border.proOnly,
        };
      }
    }
    
    res.json(assignments);
  } catch (err) {
    console.error("Error fetching asset assignments:", err);
    res.status(500).json({ message: "Error fetching asset assignments" });
  }
});

adminRouter.post("/assets/assign", async (req: Request, res: Response) => {
  try {
    const { db } = await import('../db');
    
    const { imageUrl, name, bucket, path, availableInLootbox, availableInStore, proOnly, rarity, unlockChance, storePrice, assetType } = req.body;
    
    if (!imageUrl || !name) {
      return res.status(400).json({ message: "imageUrl and name are required" });
    }
    
    const { assetRewards } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const existing = await db.select().from(assetRewards).where(eq(assetRewards.imageUrl, imageUrl));
    
    if (existing.length > 0) {
      const updated = await db.update(assetRewards)
        .set({
          name,
          rarity: rarity || 'common',
          unlockChance: unlockChance ?? 10,
          availableInLootbox: availableInLootbox ?? false,
          availableInStore: availableInStore ?? false,
          proOnly: proOnly ?? false,
          storePrice: storePrice || null,
          assetType: assetType || 'other',
          isActive: true,
          sourceBucket: bucket || null,
          sourcePath: path || null,
          updatedAt: new Date(),
        })
        .where(eq(assetRewards.id, existing[0].id))
        .returning();
      
      res.json({ message: "Asset assignment updated", reward: updated[0] });
    } else {
      const created = await db.insert(assetRewards)
        .values({
          name,
          imageUrl,
          rarity: rarity || 'common',
          unlockChance: unlockChance ?? 10,
          availableInLootbox: availableInLootbox ?? false,
          availableInStore: availableInStore ?? false,
          proOnly: proOnly ?? false,
          storePrice: storePrice || null,
          assetType: assetType || 'other',
          isActive: true,
          sourceBucket: bucket || null,
          sourcePath: path || null,
        })
        .returning();
      
      res.json({ message: "Asset assigned successfully", reward: created[0] });
    }
  } catch (err) {
    console.error("Error assigning asset:", err);
    res.status(500).json({ message: "Error assigning asset" });
  }
});

adminRouter.post("/assets/unassign", async (req: Request, res: Response) => {
  try {
    const { db } = await import('../db');
    
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ message: "imageUrl is required" });
    }
    
    const { assetRewards } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const existing = await db.select().from(assetRewards).where(eq(assetRewards.imageUrl, imageUrl));
    
    if (existing.length > 0) {
      await db.update(assetRewards)
        .set({
          availableInLootbox: false,
          availableInStore: false,
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(assetRewards.id, existing[0].id));
      
      res.json({ message: "Asset unassigned successfully" });
    } else {
      res.status(404).json({ message: "Asset not found in rewards" });
    }
  } catch (err) {
    console.error("Error unassigning asset:", err);
    res.status(500).json({ message: "Error unassigning asset" });
  }
});

// ===== Hero Slides Management =====

// POST /api/admin/hero-slides/upload-image - Upload hero slide image
adminRouter.post("/hero-slides/upload-image", rewardImageUpload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const userId = req.user!.id;
    const sharp = (await import('sharp')).default;
    
    const metadata = await sharp(req.file.path).metadata();
    const origWidth = metadata.width || 0;
    const origHeight = metadata.height || 0;
    
    if (origHeight > origWidth) {
      const fs = await import('fs');
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Hero banner images must be landscape orientation (wider than tall)." });
    }
    
    let processedBuffer: Buffer;
    const maxWidth = 1920;
    const maxHeight = 820;
    
    if (origWidth > maxWidth || origHeight > maxHeight) {
      processedBuffer = await sharp(req.file.path)
        .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
    } else {
      processedBuffer = await sharp(req.file.path)
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
    }
    
    const processedMeta = await sharp(processedBuffer).metadata();
    const fileName = `hero-slide-${Date.now()}-${Math.random().toString(36).substr(2, 8)}.jpg`;
    
    const result = await supabaseStorage.uploadBuffer(
      processedBuffer,
      fileName,
      'image/jpeg',
      'image',
      userId
    );

    const fs = await import('fs');
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const signedUrl = await supabaseStorage.convertToSignedUrl(result.url);

    res.json({ 
      imageUrl: result.url,
      signedImageUrl: signedUrl || result.url,
      dimensions: { width: processedMeta.width, height: processedMeta.height }
    });
  } catch (err) {
    console.error("Error uploading hero slide image:", err);
    res.status(500).json({ message: "Error uploading image" });
  }
});

// GET /api/admin/hero-slides - Get all hero slides
adminRouter.get("/hero-slides", async (req: Request, res: Response) => {
  try {
    const { db } = await import('../db');
    const { asc } = await import('drizzle-orm');
    const slides = await db.select().from(heroSlides).orderBy(asc(heroSlides.displayOrder));
    const slidesWithSignedUrls = await Promise.all(
      slides.map(async (slide) => {
        if (slide.imageUrl && slide.imageUrl.includes('supabase.co') && slide.imageUrl.includes('gamefolio-media')) {
          const signedUrl = await supabaseStorage.convertToSignedUrl(slide.imageUrl);
          return { ...slide, signedImageUrl: signedUrl || slide.imageUrl };
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

// GET /api/admin/hero-slides/settings - Get hero slide settings (interval etc.)
adminRouter.get("/hero-slides/settings", async (req: Request, res: Response) => {
  try {
    const { db } = await import('../db');
    const { eq } = await import('drizzle-orm');
    const { heroTextSettings } = await import('@shared/schema');
    const [config] = await db.select().from(heroTextSettings).where(eq(heroTextSettings.textType, "slide_config"));
    res.json({
      intervalSeconds: config ? parseInt(config.title) || 6 : 6,
    });
  } catch (err) {
    console.error("Error fetching hero slide settings:", err);
    res.status(500).json({ message: "Error fetching hero slide settings" });
  }
});

// PATCH /api/admin/hero-slides/settings - Update hero slide settings (interval etc.)
adminRouter.patch("/hero-slides/settings", async (req: Request, res: Response) => {
  try {
    const { intervalSeconds } = req.body;
    if (typeof intervalSeconds !== 'number' || intervalSeconds < 2 || intervalSeconds > 30) {
      return res.status(400).json({ message: "Interval must be between 2 and 30 seconds" });
    }

    const { db } = await import('../db');
    const { eq } = await import('drizzle-orm');
    const { heroTextSettings } = await import('@shared/schema');
    const [existing] = await db.select().from(heroTextSettings).where(eq(heroTextSettings.textType, "slide_config"));

    if (existing) {
      await db.update(heroTextSettings)
        .set({ title: String(intervalSeconds), updatedAt: new Date() })
        .where(eq(heroTextSettings.textType, "slide_config"));
    } else {
      await db.insert(heroTextSettings).values({
        textType: "slide_config",
        title: String(intervalSeconds),
        subtitle: "",
        targetAudience: "all_users",
        isActive: true,
      });
    }

    res.json({ intervalSeconds });
  } catch (err) {
    console.error("Error updating hero slide settings:", err);
    res.status(500).json({ message: "Error updating hero slide settings" });
  }
});

const convertToPublicUrl = (url: string): string => {
  if (!url) return url;
  const signedMatch = url.match(/(.+\/storage\/v1\/object\/)sign\/(.+?)(\?.*)?$/);
  if (signedMatch) {
    return `${signedMatch[1]}public/${signedMatch[2]}`;
  }
  return url;
};

// POST /api/admin/hero-slides - Create a new hero slide
adminRouter.post("/hero-slides", async (req: Request, res: Response) => {
  try {
    if (req.body.imageUrl) {
      req.body.imageUrl = convertToPublicUrl(req.body.imageUrl);
    }
    const parsed = insertHeroSlideSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid hero slide data", errors: parsed.error.errors });
    }

    const { db } = await import('../db');
    const [slide] = await db.insert(heroSlides).values(parsed.data).returning();
    res.json(slide);
  } catch (err) {
    console.error("Error creating hero slide:", err);
    res.status(500).json({ message: "Error creating hero slide" });
  }
});

// PATCH /api/admin/hero-slides/:id - Update a hero slide
adminRouter.patch("/hero-slides/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid slide ID" });
    }

    if (req.body.imageUrl) {
      req.body.imageUrl = convertToPublicUrl(req.body.imageUrl);
    }

    const { db } = await import('../db');
    const { eq } = await import('drizzle-orm');
    const [updated] = await db.update(heroSlides).set(req.body).where(eq(heroSlides.id, id)).returning();

    if (!updated) {
      return res.status(404).json({ message: "Hero slide not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error("Error updating hero slide:", err);
    res.status(500).json({ message: "Error updating hero slide" });
  }
});

// DELETE /api/admin/hero-slides/:id - Delete a hero slide
adminRouter.delete("/hero-slides/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid slide ID" });
    }

    const { db } = await import('../db');
    const { eq } = await import('drizzle-orm');
    const [deleted] = await db.delete(heroSlides).where(eq(heroSlides.id, id)).returning();

    if (!deleted) {
      return res.status(404).json({ message: "Hero slide not found" });
    }

    res.json({ message: "Hero slide deleted successfully" });
  } catch (err) {
    console.error("Error deleting hero slide:", err);
    res.status(500).json({ message: "Error deleting hero slide" });
  }
});

// POST /api/admin/hero-slides/reorder - Reorder hero slides
adminRouter.post("/hero-slides/reorder", async (req: Request, res: Response) => {
  try {
    const { slides } = req.body;
    if (!Array.isArray(slides)) {
      return res.status(400).json({ message: "Invalid reorder data - slides array required" });
    }

    const { db } = await import('../db');
    const { eq } = await import('drizzle-orm');

    for (const slide of slides) {
      if (slide.id && typeof slide.displayOrder === 'number') {
        await db.update(heroSlides).set({ displayOrder: slide.displayOrder }).where(eq(heroSlides.id, slide.id));
      }
    }

    res.json({ message: "Hero slides reordered successfully" });
  } catch (err) {
    console.error("Error reordering hero slides:", err);
    res.status(500).json({ message: "Error reordering hero slides" });
  }
});

// ==========================================
// XP Settings Routes
// ==========================================

// GET /api/admin/xp-config - Return all XP settings (with current in-memory values)
adminRouter.get("/xp-config", async (req: Request, res: Response) => {
  try {
    const dbSettings = await storage.getXpSettings();
    const dbMap = new Map(dbSettings.map(s => [s.key, s]));

    // Merge DB records with the canonical definition (so we always show all settings)
    const result = XP_SETTINGS_DEFINITION.map(def => {
      const dbRow = dbMap.get(def.key);
      return {
        key: def.key,
        label: def.label,
        description: def.description,
        category: def.category,
        value: dbRow ? dbRow.value : POINT_VALUES[def.key] ?? 0,
        updatedAt: dbRow?.updatedAt ?? null,
        updatedBy: dbRow?.updatedBy ?? null,
        id: dbRow?.id ?? null,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Error fetching XP config:", err);
    res.status(500).json({ message: "Error fetching XP config" });
  }
});

// PUT /api/admin/xp-config - Update one or more XP settings
adminRouter.put("/xp-config", async (req: Request, res: Response) => {
  try {
    const { updates } = req.body as { updates: Array<{ key: string; value: number }> };
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: "updates array is required" });
    }

    const adminUser = req.user as any;
    const updatedBy = adminUser?.id ?? null;

    for (const { key, value } of updates) {
      if (typeof key !== "string" || typeof value !== "number" || isNaN(value)) {
        return res.status(400).json({ message: `Invalid update: key=${key} value=${value}` });
      }
      const def = XP_SETTINGS_DEFINITION.find(d => d.key === key);
      if (!def) {
        return res.status(400).json({ message: `Unknown XP setting key: ${key}` });
      }
      // Upsert into DB
      await storage.upsertXpSetting({
        key,
        value,
        label: def.label,
        description: def.description,
        category: def.category,
        updatedBy,
      });
      // Update in-memory POINT_VALUES immediately
      updatePointValue(key, value);
    }

    res.json({ message: `Updated ${updates.length} XP setting(s) successfully` });
  } catch (err) {
    console.error("Error updating XP config:", err);
    res.status(500).json({ message: "Error updating XP config" });
  }
});

// POST /api/admin/retroactive-points-migration - Retroactively fix historical upload point records
adminRouter.post("/retroactive-points-migration", async (req: Request, res: Response) => {
  try {
    const { db } = await import('../db');
    const { sql } = await import('drizzle-orm');

    // Current (new) point values
    const NEW_CLIP_REEL_XP = 200;
    const NEW_SCREENSHOT_XP = 100;

    // Old point values that need to be updated
    const OLD_CLIP_REEL_VALUES = [5, 10, 20];
    const OLD_SCREENSHOT_VALUES = [2];

    // Step 1: Get all affected records from user_points_history (uploads & their deletions)
    const affectedRecords = await db.execute(sql`
      SELECT id, user_id, action, points, created_at
      FROM user_points_history
      WHERE 
        (action = 'upload' AND points IN (5, 10, 20, -5, -10, -20))
        OR (action = 'screenshot_upload' AND points IN (2, -2))
      ORDER BY user_id, created_at
    `);

    if (affectedRecords.rows.length === 0) {
      return res.json({ message: "No records to migrate", recordsUpdated: 0, usersAffected: 0, totalXPAdded: 0 });
    }

    // Step 2: Calculate per-user XP adjustment and per-week/month leaderboard adjustments
    const userAdjustments: Record<number, number> = {};
    const weeklyAdjustments: Record<string, number> = {}; // "userId:week:year" -> delta
    const monthlyAdjustments: Record<string, number> = {}; // "userId:month:year" -> delta

    for (const row of affectedRecords.rows as any[]) {
      const userId = Number(row.user_id);
      const oldPoints = Number(row.points);
      const action = row.action as string;
      const createdAt = new Date(row.created_at);

      // Determine new points value
      let newPoints: number;
      if (action === 'upload') {
        newPoints = oldPoints > 0 ? NEW_CLIP_REEL_XP : -NEW_CLIP_REEL_XP;
      } else {
        newPoints = oldPoints > 0 ? NEW_SCREENSHOT_XP : -NEW_SCREENSHOT_XP;
      }

      const delta = newPoints - oldPoints;

      // Accumulate per-user adjustment
      userAdjustments[userId] = (userAdjustments[userId] || 0) + delta;

      // Only count positive uploads (not deletions) toward leaderboard adjustments,
      // since leaderboard total_points tracks cumulative earned points
      if (oldPoints > 0) {
        // Calculate ISO week
        const dayOfWeek = createdAt.getDay();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const startOfWeek = new Date(createdAt);
        startOfWeek.setDate(createdAt.getDate() - daysFromMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfYear = new Date(createdAt.getFullYear(), 0, 1);
        const days = Math.floor((startOfWeek.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        const week = `${createdAt.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
        const year = createdAt.getFullYear();
        const month = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;

        const weekKey = `${userId}:${week}:${year}`;
        weeklyAdjustments[weekKey] = (weeklyAdjustments[weekKey] || 0) + delta;

        const monthKey = `${userId}:${month}:${year}`;
        monthlyAdjustments[monthKey] = (monthlyAdjustments[monthKey] || 0) + delta;
      }
    }

    // Step 3: Apply all updates in sequence
    let recordsUpdated = 0;

    // Update clip/reel upload records (positive)
    const clipReelPositiveResult = await db.execute(sql`
      UPDATE user_points_history
      SET points = ${NEW_CLIP_REEL_XP}
      WHERE action = 'upload' AND points IN (5, 10, 20)
    `);
    recordsUpdated += Number(clipReelPositiveResult.rowCount ?? 0);

    // Update clip/reel deletion records (negative)
    await db.execute(sql`
      UPDATE user_points_history
      SET points = ${-NEW_CLIP_REEL_XP}
      WHERE action = 'upload' AND points IN (-5, -10, -20)
    `);

    // Update screenshot upload records (positive)
    const screenshotPositiveResult = await db.execute(sql`
      UPDATE user_points_history
      SET points = ${NEW_SCREENSHOT_XP}
      WHERE action = 'screenshot_upload' AND points = 2
    `);
    recordsUpdated += Number(screenshotPositiveResult.rowCount ?? 0);

    // Update screenshot deletion records (negative)
    await db.execute(sql`
      UPDATE user_points_history
      SET points = ${-NEW_SCREENSHOT_XP}
      WHERE action = 'screenshot_upload' AND points = -2
    `);

    // Step 4: Update user totalXP
    const usersAffected = Object.keys(userAdjustments).length;
    for (const [userIdStr, delta] of Object.entries(userAdjustments)) {
      const userId = Number(userIdStr);
      await db.execute(sql`
        UPDATE users
        SET total_xp = GREATEST(0, total_xp + ${delta})
        WHERE id = ${userId}
      `);
    }

    // Step 5: Update weekly leaderboard total_points
    for (const [key, delta] of Object.entries(weeklyAdjustments)) {
      const [userIdStr, week, yearStr] = key.split(':');
      const userId = Number(userIdStr);
      const year = Number(yearStr);
      await db.execute(sql`
        UPDATE weekly_leaderboard
        SET total_points = GREATEST(0, total_points + ${delta})
        WHERE user_id = ${userId} AND week = ${week} AND year = ${year}
      `);
    }

    // Step 6: Update monthly leaderboard total_points
    for (const [key, delta] of Object.entries(monthlyAdjustments)) {
      const [userIdStr, month, yearStr] = key.split(':');
      const userId = Number(userIdStr);
      const year = Number(yearStr);
      await db.execute(sql`
        UPDATE monthly_leaderboard
        SET total_points = GREATEST(0, total_points + ${delta})
        WHERE user_id = ${userId} AND month = ${month} AND year = ${year}
      `);
    }

    // Step 7: Seed xp_settings if empty
    const existing = await db.execute(sql`SELECT COUNT(*) as count FROM xp_settings`);
    const count = Number((existing.rows[0] as any)?.count ?? 0);
    if (count === 0) {
      const adminUser = req.user as any;
      for (const def of XP_SETTINGS_DEFINITION) {
        await storage.upsertXpSetting({
          key: def.key,
          value: POINT_VALUES[def.key] ?? 0,
          label: def.label,
          description: def.description,
          category: def.category,
          updatedBy: adminUser?.id ?? null,
        });
      }
    }

    const totalXPAdded = Object.values(userAdjustments).reduce((sum, v) => sum + v, 0);

    res.json({
      message: "Retroactive points migration completed successfully",
      recordsUpdated,
      usersAffected,
      totalXPAdded,
      weeklyPeriodsUpdated: Object.keys(weeklyAdjustments).length,
      monthlyPeriodsUpdated: Object.keys(monthlyAdjustments).length,
      xpSettingsSeeded: count === 0,
    });
  } catch (err) {
    console.error("Error running retroactive points migration:", err);
    res.status(500).json({ message: "Error running retroactive points migration", error: String(err) });
  }
});

// POST /api/admin/xp-config/seed - Seed DB with current defaults (idempotent)
adminRouter.post("/xp-config/seed", async (req: Request, res: Response) => {
  try {
    const adminUser = req.user as any;
    for (const def of XP_SETTINGS_DEFINITION) {
      await storage.upsertXpSetting({
        key: def.key,
        value: POINT_VALUES[def.key] ?? 0,
        label: def.label,
        description: def.description,
        category: def.category,
        updatedBy: adminUser?.id ?? null,
      });
    }
    res.json({ message: `Seeded ${XP_SETTINGS_DEFINITION.length} XP settings successfully` });
  } catch (err) {
    console.error("Error seeding XP config:", err);
    res.status(500).json({ message: "Error seeding XP config" });
  }
});

export default adminRouter;