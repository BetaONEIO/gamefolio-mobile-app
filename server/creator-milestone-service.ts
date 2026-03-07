import { storage } from "./storage";
import { LeaderboardService } from "./leaderboard-service";

export class CreatorMilestoneService {
  private static isSameCalendarDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  private static getCurrentISOWeek(): string {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor(
      (startOfWeek.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
    );
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
  }

  private static async hasSourceToday(userId: number, source: string): Promise<boolean> {
    const history = await storage.getUserXPHistory(userId, 200);
    const today = new Date();
    return history.some(
      (h) => h.source === source && this.isSameCalendarDay(new Date(h.createdAt), today)
    );
  }

  private static async hasSourceThisWeek(userId: number, source: string): Promise<boolean> {
    const history = await storage.getUserXPHistory(userId, 500);
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    return history.some(
      (h) => h.source === source && new Date(h.createdAt) >= startOfWeek
    );
  }

  private static async hasSourceEver(userId: number, source: string): Promise<boolean> {
    const history = await storage.getUserXPHistory(userId, 1000);
    return history.some((h) => h.source === source);
  }

  static async checkFirstUploadOfDay(userId: number): Promise<void> {
    try {
      const alreadyClaimed = await this.hasSourceToday(userId, "first_upload_of_day");
      if (!alreadyClaimed) {
        await LeaderboardService.awardCustomPoints(
          userId,
          "first_upload_of_day",
          100,
          "First upload of the day!"
        );
      }
    } catch (error) {
      console.error("Error checking first upload of day:", error);
    }
  }

  static async checkWeeklyUploadMilestones(userId: number): Promise<void> {
    try {
      const weeklyUploads = await this.countUploadsThisWeek(userId);

      if (weeklyUploads >= 5) {
        const already5 = await this.hasSourceThisWeek(userId, "weekly_uploads_5");
        if (!already5) {
          await LeaderboardService.awardCustomPoints(
            userId,
            "weekly_uploads_5",
            300,
            "5 uploads in a week!"
          );
        }
      }

      if (weeklyUploads >= 10) {
        const already10 = await this.hasSourceThisWeek(userId, "weekly_uploads_10");
        if (!already10) {
          await LeaderboardService.awardCustomPoints(
            userId,
            "weekly_uploads_10",
            750,
            "10 uploads in a week!"
          );
        }
      }
    } catch (error) {
      console.error("Error checking weekly upload milestones:", error);
    }
  }

  static async checkFirst100Views(userId: number, clipId: number): Promise<void> {
    try {
      const alreadyClaimed = await this.hasSourceEver(userId, "first_100_views");
      if (!alreadyClaimed) {
        await LeaderboardService.awardCustomPoints(
          userId,
          "first_100_views",
          250,
          `First clip to reach 100 views (clip #${clipId})!`
        );
      }
    } catch (error) {
      console.error("Error checking first 100 views:", error);
    }
  }

  static async checkFirst1000Views(userId: number, clipId: number): Promise<void> {
    try {
      const alreadyClaimed = await this.hasSourceEver(userId, "first_1000_views");
      if (!alreadyClaimed) {
        await LeaderboardService.awardCustomPoints(
          userId,
          "first_1000_views",
          1000,
          `First clip to reach 1,000 views (clip #${clipId})!`
        );
      }
    } catch (error) {
      console.error("Error checking first 1,000 views:", error);
    }
  }

  private static async countUploadsThisWeek(userId: number): Promise<number> {
    const history = await storage.getUserPointsHistory(userId, 200);
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    return history.filter(
      (h) =>
        (h.action === "upload" || h.action === "screenshot_upload") &&
        new Date(h.createdAt) >= startOfWeek
    ).length;
  }

  static async getWeeklyUploadCount(userId: number): Promise<number> {
    return this.countUploadsThisWeek(userId);
  }

  static async getCreatorMilestoneStatus(userId: number): Promise<{
    firstUploadOfDayDone: boolean;
    weeklyUploadsCount: number;
    weekly5Done: boolean;
    weekly10Done: boolean;
    first100ViewsDone: boolean;
    first1000ViewsDone: boolean;
  }> {
    const [
      firstUploadOfDayDone,
      weeklyUploadsCount,
      xpHas100Views,
      xpHas1000Views,
    ] = await Promise.all([
      this.hasSourceToday(userId, "first_upload_of_day"),
      this.countUploadsThisWeek(userId),
      this.hasSourceEver(userId, "first_100_views"),
      this.hasSourceEver(userId, "first_1000_views"),
    ]);

    // Weekly upload milestones: award retroactively if count met but XP not recorded yet
    let weekly5Done = false;
    let weekly10Done = false;

    if (weeklyUploadsCount >= 5) {
      const xpAwarded5 = await this.hasSourceThisWeek(userId, "weekly_uploads_5");
      if (!xpAwarded5) {
        // Retroactively award — fire and forget so status page doesn't block
        LeaderboardService.awardCustomPoints(userId, "weekly_uploads_5", 300, "5 uploads in a week!").catch(() => {});
      }
      weekly5Done = true;
    }

    if (weeklyUploadsCount >= 10) {
      const xpAwarded10 = await this.hasSourceThisWeek(userId, "weekly_uploads_10");
      if (!xpAwarded10) {
        LeaderboardService.awardCustomPoints(userId, "weekly_uploads_10", 750, "10 uploads in a week!").catch(() => {});
      }
      weekly10Done = true;
    }

    // View milestones: check actual clip data if XP history entry is missing
    let first100ViewsDone = xpHas100Views;
    let first1000ViewsDone = xpHas1000Views;

    if (!xpHas100Views || !xpHas1000Views) {
      try {
        const clips = await storage.getClipsByUserId(userId);
        for (const clip of clips) {
          const views = (clip as any).viewCount ?? 0;

          if (!first100ViewsDone && views >= 100) {
            first100ViewsDone = true;
            LeaderboardService.awardCustomPoints(
              userId,
              "first_100_views",
              250,
              `First clip to reach 100 views (clip #${clip.id})!`
            ).catch(() => {});
          }

          if (!first1000ViewsDone && views >= 1000) {
            first1000ViewsDone = true;
            LeaderboardService.awardCustomPoints(
              userId,
              "first_1000_views",
              1000,
              `First clip to reach 1,000 views (clip #${clip.id})!`
            ).catch(() => {});
          }

          if (first100ViewsDone && first1000ViewsDone) break;
        }
      } catch (error) {
        console.error("Error checking clips for view milestones:", error);
      }
    }

    return {
      firstUploadOfDayDone,
      weeklyUploadsCount,
      weekly5Done,
      weekly10Done,
      first100ViewsDone,
      first1000ViewsDone,
    };
  }
}
