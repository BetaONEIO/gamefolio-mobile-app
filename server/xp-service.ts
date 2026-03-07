import { storage } from "./storage";
import { InsertUserXPHistory } from "@shared/schema";
import { calculateLevel } from "./level-system";

export type XPSource = "view" | "lootbox" | "like_received" | "fire_received" | "upload" | "daily_login" | "welcome_bonus" | "other";

export class XPService {
  // Award XP to clip owner based on views (1 XP per view)
  static async awardXPForViews(
    clipId: number,
    userId: number,
    currentViews: number
  ): Promise<void> {
    try {
      // Award 1 XP for this view
      const xpAmount = 1;
      
      // Record the XP in history
      const xpHistory: InsertUserXPHistory = {
        userId,
        clipId,
        xpAmount,
        viewCount: currentViews,
        source: "view",
        description: `Earned ${xpAmount} XP from clip reaching ${currentViews} views`,
      };
      
      await storage.addUserXPHistory(xpHistory);
      
      // Update user's total XP
      await storage.incrementUserXP(userId, xpAmount);
      
      // Update user's level based on new XP total
      await this.updateUserLevel(userId);
      
    } catch (error) {
      console.error("Error awarding XP for views:", error);
    }
  }

  // Award XP from any source
  static async awardXP(
    userId: number,
    xpAmount: number,
    source: XPSource,
    description: string,
    clipId?: number
  ): Promise<void> {
    try {
      // Record the XP in history
      const xpHistory: InsertUserXPHistory = {
        userId,
        xpAmount,
        source,
        description,
        ...(clipId && { clipId }),
      };
      
      await storage.addUserXPHistory(xpHistory);
      
      // Update user's total XP
      await storage.incrementUserXP(userId, xpAmount);
      
      // Update user's level based on new XP total
      await this.updateUserLevel(userId);
      
    } catch (error) {
      console.error(`Error awarding XP from ${source}:`, error);
    }
  }

  // Update user's level based on their total XP
  static async updateUserLevel(userId: number): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      if (!user) return;
      
      const newLevel = calculateLevel(user.totalXP);
      
      // Only update if level has changed
      if (newLevel !== user.level) {
        await storage.updateUser(userId, { level: newLevel });
        console.log(`User ${userId} leveled up to level ${newLevel}!`);
      }
    } catch (error) {
      console.error("Error updating user level:", error);
    }
  }

  // Get user's total XP
  static async getUserTotalXP(userId: number): Promise<number> {
    const user = await storage.getUser(userId);
    return user?.totalXP || 0;
  }

  // Get user's XP history
  static async getUserXPHistory(userId: number, limit: number = 50) {
    return await storage.getUserXPHistory(userId, limit);
  }

  // Get XP leaderboard (top users by XP)
  static async getXPLeaderboard(limit: number = 10) {
    return await storage.getXPLeaderboard(limit);
  }
}
