import { db } from '../db';
import { userPointsHistory, weeklyLeaderboard, monthlyLeaderboard } from '@shared/schema';
import { eq, and, gte, lt } from 'drizzle-orm';

/**
 * Fix leaderboard data by rebuilding weekly and monthly leaderboards
 * from the userPointsHistory table which has accurate timestamps
 */
export async function fixLeaderboardData() {
  console.log('🔧 Starting leaderboard data fix...');
  
  try {
    // Step 1: Clear current weekly and monthly leaderboard data
    console.log('📊 Clearing current leaderboard data...');
    await db.delete(weeklyLeaderboard);
    await db.delete(monthlyLeaderboard);
    console.log('✅ Cleared leaderboard tables');

    // Step 2: Rebuild from points history
    console.log('📊 Rebuilding leaderboards from points history...');
    
    // Get all unique users from points history
    const usersWithActivity = await db
      .selectDistinct({ userId: userPointsHistory.userId })
      .from(userPointsHistory);
    
    console.log(`📊 Found ${usersWithActivity.length} users with activity`);

    // Get current date info
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const currentMonthKey = `${currentYear}-${currentMonth}`;
    
    // Calculate current week
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    const currentWeek = `${currentYear}-W${String(weekNumber).padStart(2, '0')}`;

    // Calculate start of current month
    const startOfMonth = new Date(currentYear, now.getMonth(), 1);
    
    // Calculate start of current week (week starts on Monday)
    const startOfWeek = new Date(now);
    const dayOfWeek = startOfWeek.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days
    startOfWeek.setDate(startOfWeek.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    // Process each user
    for (const { userId } of usersWithActivity) {
      // Get ALL activity for this user
      const allActivity = await db
        .select()
        .from(userPointsHistory)
        .where(eq(userPointsHistory.userId, userId));

      // Group by month
      const activityByMonth = new Map<string, any[]>();
      for (const activity of allActivity) {
        const date = new Date(activity.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!activityByMonth.has(monthKey)) {
          activityByMonth.set(monthKey, []);
        }
        activityByMonth.get(monthKey)!.push(activity);
      }

      // Create monthly entries for each month
      for (const [monthKey, monthActivity] of activityByMonth) {
        const [year, month] = monthKey.split('-');
        const monthStats = {
          uploadsCount: monthActivity.filter(a => a.action === 'upload').length,
          likesGivenCount: monthActivity.filter(a => a.action === 'like').length,
          commentsCount: monthActivity.filter(a => a.action === 'comment').length,
          firesGivenCount: monthActivity.filter(a => a.action === 'fire').length,
          viewsCount: monthActivity.filter(a => a.action === 'view').length,
          totalPoints: monthActivity.reduce((sum, a) => sum + a.points, 0),
        };

        await db.insert(monthlyLeaderboard).values({
          userId,
          month: monthKey,
          year: parseInt(year),
          ...monthStats,
          rank: 0, // Will be recalculated
        });
      }

      // Get this week's activity
      const weekActivity = await db
        .select()
        .from(userPointsHistory)
        .where(
          and(
            eq(userPointsHistory.userId, userId),
            gte(userPointsHistory.createdAt, startOfWeek)
          )
        );

      if (weekActivity.length > 0) {
        const weekStats = {
          uploadsCount: weekActivity.filter(a => a.action === 'upload').length,
          likesGivenCount: weekActivity.filter(a => a.action === 'like').length,
          commentsCount: weekActivity.filter(a => a.action === 'comment').length,
          firesGivenCount: weekActivity.filter(a => a.action === 'fire').length,
          viewsCount: weekActivity.filter(a => a.action === 'view').length,
          totalPoints: weekActivity.reduce((sum, a) => sum + a.points, 0),
        };

        await db.insert(weeklyLeaderboard).values({
          userId,
          week: currentWeek,
          year: currentYear,
          ...weekStats,
          rank: 0, // Will be recalculated
        });
      }
    }

    // Step 3: Recalculate rankings
    console.log('📊 Recalculating rankings...');
    
    // Recalculate monthly rankings
    const monthlyEntries = await db
      .select()
      .from(monthlyLeaderboard)
      .where(and(
        eq(monthlyLeaderboard.month, currentMonthKey),
        eq(monthlyLeaderboard.year, currentYear)
      ))
      .orderBy(monthlyLeaderboard.totalPoints);
    
    for (let i = 0; i < monthlyEntries.length; i++) {
      await db
        .update(monthlyLeaderboard)
        .set({ rank: monthlyEntries.length - i })
        .where(eq(monthlyLeaderboard.id, monthlyEntries[i].id));
    }

    // Recalculate weekly rankings
    const weeklyEntries = await db
      .select()
      .from(weeklyLeaderboard)
      .where(and(
        eq(weeklyLeaderboard.week, currentWeek),
        eq(weeklyLeaderboard.year, currentYear)
      ))
      .orderBy(weeklyLeaderboard.totalPoints);
    
    for (let i = 0; i < weeklyEntries.length; i++) {
      await db
        .update(weeklyLeaderboard)
        .set({ rank: weeklyEntries.length - i })
        .where(eq(weeklyLeaderboard.id, weeklyEntries[i].id));
    }

    console.log('✅ Leaderboard data fix completed successfully!');
    console.log(`📊 Rebuilt ${monthlyEntries.length} monthly entries and ${weeklyEntries.length} weekly entries`);
  } catch (error) {
    console.error('❌ Error fixing leaderboard data:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixLeaderboardData()
    .then(() => {
      console.log('✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}
