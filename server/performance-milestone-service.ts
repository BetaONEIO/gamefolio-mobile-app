import { storage } from "./storage";
import { LeaderboardService } from "./leaderboard-service";

// Per-clip view milestone thresholds and their XP rewards
const VIEW_MILESTONES: { views: number; xp: number }[] = [
  { views: 50, xp: 50 },
  { views: 100, xp: 100 },
  { views: 250, xp: 200 },
  { views: 500, xp: 400 },
  { views: 1000, xp: 800 },
  { views: 5000, xp: 1500 },
  { views: 10000, xp: 3000 },
  { views: 25000, xp: 6000 },
  { views: 50000, xp: 12000 },
  { views: 100000, xp: 24000 },
];

export function getViewMilestoneSource(views: number): string {
  return `view_milestone_${views}`;
}

export class PerformanceMilestoneService {
  static getViewMilestones(): { views: number; xp: number }[] {
    return VIEW_MILESTONES;
  }

  static async checkAndAwardViewMilestones(
    clipId: number,
    ownerId: number,
    newViewCount: number
  ): Promise<void> {
    try {
      for (const milestone of VIEW_MILESTONES) {
        if (newViewCount >= milestone.views) {
          const source = getViewMilestoneSource(milestone.views);
          const alreadyAwarded = await this.hasMilestoneBeenAwarded(ownerId, clipId, source);
          if (!alreadyAwarded) {
            await LeaderboardService.awardCustomPoints(
              ownerId,
              source,
              milestone.xp,
              `Clip #${clipId} reached ${milestone.views.toLocaleString()} views`,
            );
          }
        }
      }
    } catch (error) {
      console.error("Error checking view milestones:", error);
    }
  }

  private static async hasMilestoneBeenAwarded(
    userId: number,
    clipId: number,
    source: string
  ): Promise<boolean> {
    try {
      const history = await storage.getUserXPHistory(userId, 500);
      return history.some(
        (h) => h.source === source && h.clipId === clipId
      );
    } catch {
      return false;
    }
  }
}
