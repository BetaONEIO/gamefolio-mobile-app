import { storage } from "./storage";
import { LeaderboardService } from "./leaderboard-service";
import { InsertUserXPHistory } from "@shared/schema";

export class BonusEventsService {
  static isWeekend(): boolean {
    const day = new Date().getDay();
    return day === 0 || day === 6;
  }

  static getWeekendUploadBonus(baseXP: number): number {
    return Math.round(baseXP * 0.5);
  }

  static async checkConsecutiveUploadBonus(userId: number): Promise<void> {
    try {
      const history = await storage.getUserPointsHistory(userId, 50);
      const uploads = history.filter(
        (h) => h.action === "upload" || h.action === "screenshot_upload"
      );

      if (uploads.length < 2) return;

      const lastUpload = uploads[0];
      const secondToLast = uploads[1];

      const lastDate = new Date(lastUpload.createdAt);
      const prevDate = new Date(secondToLast.createdAt);
      const diffMs = lastDate.getTime() - prevDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours > 0 && diffHours <= 24) {
        await LeaderboardService.awardCustomPoints(
          userId,
          "consecutive_upload_bonus",
          75,
          "Uploaded within 24h of last upload!"
        );
      }
    } catch (error) {
      console.error("Error checking consecutive upload bonus:", error);
    }
  }

  static async awardLootboxBonus(userId: number): Promise<void> {
    try {
      await LeaderboardService.awardCustomPoints(
        userId,
        "lootbox_bonus",
        100,
        "Daily lootbox opened!"
      );
    } catch (error) {
      console.error("Error awarding lootbox bonus:", error);
    }
  }

  static async awardFeaturedClipBonus(userId: number, clipId: number): Promise<void> {
    try {
      await LeaderboardService.awardCustomPoints(
        userId,
        "featured_clip_of_day",
        500,
        `Clip #${clipId} was featured as Clip of the Day!`
      );
    } catch (error) {
      console.error("Error awarding featured clip bonus:", error);
    }
  }

  static async awardWeekendUploadBonus(userId: number, baseXP: number): Promise<void> {
    try {
      if (!this.isWeekend()) return;
      const bonus = this.getWeekendUploadBonus(baseXP);
      if (bonus > 0) {
        await LeaderboardService.awardCustomPoints(
          userId,
          "weekend_upload_bonus",
          bonus,
          `Weekend upload bonus (+50% XP)!`
        );
      }
    } catch (error) {
      console.error("Error awarding weekend upload bonus:", error);
    }
  }

  static isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  static async awardWatchClipXP(userId: number): Promise<{
    awarded5: boolean;
    awarded20: boolean;
    clipsWatchedToday: number;
  }> {
    try {
      const history = await storage.getUserXPHistory(userId, 300);
      const today = new Date();

      const todayWatches = history.filter(
        (h) => h.source === "watch_clip_counted" && this.isSameDay(new Date(h.createdAt), today)
      ).length;

      const newCount = todayWatches + 1;

      const watchEntry: InsertUserXPHistory = {
        userId,
        xpAmount: 0,
        source: "watch_clip_counted",
        description: `Watched clip (${newCount} today)`,
      };
      await storage.addUserXPHistory(watchEntry);

      let awarded5 = false;
      let awarded20 = false;

      const has5 = history.some(
        (h) => h.source === "watch_5_clips" && this.isSameDay(new Date(h.createdAt), today)
      );
      const has20 = history.some(
        (h) => h.source === "watch_20_clips" && this.isSameDay(new Date(h.createdAt), today)
      );

      if (newCount >= 5 && !has5) {
        await LeaderboardService.awardCustomPoints(userId, "watch_5_clips", 10, "Watched 5 clips today!");
        awarded5 = true;
      }

      if (newCount >= 20 && !has20) {
        await LeaderboardService.awardCustomPoints(userId, "watch_20_clips", 30, "Watched 20 clips today!");
        awarded20 = true;
      }

      return { awarded5, awarded20, clipsWatchedToday: newCount };
    } catch (error) {
      console.error("Error awarding watch clip XP:", error);
      return { awarded5: false, awarded20: false, clipsWatchedToday: 0 };
    }
  }
}
