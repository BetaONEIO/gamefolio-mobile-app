import { storage } from "./storage";
import { LeaderboardService, POINT_VALUES } from "./leaderboard-service";

const DAILY_LOGIN_XP = POINT_VALUES.daily_login;

// Specific milestone days and their XP bonuses
const STREAK_MILESTONES: { day: number; bonus: number }[] = [
  { day: 2, bonus: 50 },
  { day: 3, bonus: 75 },
  { day: 5, bonus: 150 },
  { day: 7, bonus: 300 },
  { day: 14, bonus: 500 },
  { day: 30, bonus: 1000 },
];

function getMilestoneBonus(streak: number): number {
  if (streak <= 0) return 0;
  // Check explicit milestones first
  const explicit = STREAK_MILESTONES.find(m => m.day === streak);
  if (explicit) return explicit.bonus;
  // Beyond 30: scale by doubling every 30 days
  if (streak > 30 && streak % 30 === 0) {
    const multiplier = Math.floor(streak / 30);
    return 1000 * Math.pow(2, multiplier - 1);
  }
  return 0;
}

export function getNextMilestone(currentStreak: number): { day: number; bonus: number } | null {
  // Check explicit milestones
  const next = STREAK_MILESTONES.find(m => m.day > currentStreak);
  if (next) return next;
  // Beyond 30
  const nextMultiple = Math.ceil((currentStreak + 1) / 30) * 30;
  if (nextMultiple > 30) {
    const multiplier = Math.floor(nextMultiple / 30);
    return { day: nextMultiple, bonus: 1000 * Math.pow(2, multiplier - 1) };
  }
  return null;
}

export { STREAK_MILESTONES };

export class StreakService {
  private static getCalendarDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private static areConsecutiveDays(date1: Date, date2: Date): boolean {
    const cal1 = this.getCalendarDate(date1);
    const cal2 = this.getCalendarDate(date2);
    const oneDay = 24 * 60 * 60 * 1000;
    const diffMs = cal2.getTime() - cal1.getTime();
    const diffDays = Math.round(diffMs / oneDay);
    return diffDays === 1;
  }

  private static isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  static async updateLoginStreak(userId: number): Promise<{
    currentStreak: number;
    bonusAwarded: number;
    dailyXP: number;
    isNewMilestone: boolean;
    message: string;
  }> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const now = new Date();
      const lastStreakUpdate = user.lastStreakUpdate;
      
      let currentStreak = user.currentStreak || 0;
      let longestStreak = user.longestStreak || 0;
      let bonusAwarded = 0;
      let dailyXP = 0;
      let isNewMilestone = false;
      let message = "";

      if (!lastStreakUpdate) {
        currentStreak = 1;
        dailyXP = DAILY_LOGIN_XP;
        message = `Welcome! Your login streak has started! +${DAILY_LOGIN_XP} XP`;
      } else if (this.isSameDay(lastStreakUpdate, now)) {
        return {
          currentStreak,
          bonusAwarded: 0,
          dailyXP: 0,
          isNewMilestone: false,
          message: "Already logged in today"
        };
      } else if (this.areConsecutiveDays(lastStreakUpdate, now)) {
        currentStreak++;
        dailyXP = DAILY_LOGIN_XP;

        const milestoneBonus = getMilestoneBonus(currentStreak);
        if (milestoneBonus > 0) {
          bonusAwarded = milestoneBonus;
          isNewMilestone = true;
          message = `🎉 ${currentStreak} day streak milestone! +${DAILY_LOGIN_XP} daily XP + ${bonusAwarded} bonus XP!`;
        } else {
          message = `${currentStreak} day streak! +${DAILY_LOGIN_XP} XP. Keep going!`;
        }
      } else {
        currentStreak = 1;
        dailyXP = DAILY_LOGIN_XP;
        message = `Streak reset! Starting fresh at day 1. +${DAILY_LOGIN_XP} XP`;
      }

      await LeaderboardService.awardPoints(
        userId,
        'daily_login',
        `Daily login streak (day ${currentStreak})`
      );

      if (bonusAwarded > 0) {
        await LeaderboardService.awardCustomPoints(
          userId,
          'streak_milestone',
          bonusAwarded,
          `Login streak milestone: ${currentStreak} days (${bonusAwarded} bonus XP)`
        );
      }

      try {
        await storage.createNotification({
          userId,
          type: 'streak',
          title: isNewMilestone ? `🔥 ${currentStreak}-Day Streak Milestone!` : `🔥 Day ${currentStreak} Streak!`,
          message: isNewMilestone
            ? `You earned ${DAILY_LOGIN_XP} daily XP + ${bonusAwarded} milestone bonus XP for your ${currentStreak}-day streak!`
            : `You earned ${DAILY_LOGIN_XP} XP for logging in ${currentStreak} day${currentStreak > 1 ? 's' : ''} in a row.`,
          isRead: false,
          fromUserId: null,
          clipId: null,
          screenshotId: null,
          commentId: null,
          metadata: { streakDay: currentStreak, dailyXP, milestoneBonus: bonusAwarded },
          actionUrl: '/level-tracker',
        });
      } catch (notifError) {
        console.error("Error creating streak notification:", notifError);
      }

      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }

      await storage.updateUserStreak?.({
        userId,
        currentStreak,
        longestStreak,
        lastStreakUpdate: now
      });

      return {
        currentStreak,
        bonusAwarded,
        dailyXP,
        isNewMilestone,
        message
      };
    } catch (error) {
      console.error("Error updating login streak:", error);
      return {
        currentStreak: 0,
        bonusAwarded: 0,
        dailyXP: 0,
        isNewMilestone: false,
        message: "Error updating streak"
      };
    }
  }

  static async getUserStreak(userId: number): Promise<{
    currentStreak: number;
    longestStreak: number;
    nextMilestone: number | null;
    nextMilestoneBonus: number | null;
    allMilestones: { day: number; bonus: number }[];
  }> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        return {
          currentStreak: 0,
          longestStreak: 0,
          nextMilestone: null,
          nextMilestoneBonus: null,
          allMilestones: STREAK_MILESTONES
        };
      }

      const currentStreak = user.currentStreak || 0;
      const longestStreak = user.longestStreak || 0;

      const nextMilestoneData = getNextMilestone(currentStreak);
      const nextMilestone = nextMilestoneData?.day ?? null;
      const nextMilestoneBonus = nextMilestoneData?.bonus ?? null;

      return {
        currentStreak,
        longestStreak,
        nextMilestone,
        nextMilestoneBonus: nextMilestoneBonus && nextMilestoneBonus > 0 ? nextMilestoneBonus : null,
        allMilestones: STREAK_MILESTONES
      };
    } catch (error) {
      console.error("Error getting user streak:", error);
      return {
        currentStreak: 0,
        longestStreak: 0,
        nextMilestone: null,
        nextMilestoneBonus: null,
        allMilestones: STREAK_MILESTONES
      };
    }
  }
}
