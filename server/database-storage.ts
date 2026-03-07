import {
  User, InsertUser,
  Game, InsertGame,
  Clip, InsertClip,
  Like, InsertLike,
  Comment, InsertComment,
  UserGameFavorite, InsertUserGameFavorite,
  Follow, InsertFollow,
  FollowRequest, InsertFollowRequest,
  ProfileBanner,
  Screenshot, InsertScreenshot, ScreenshotLike,
  ClipReaction, InsertClipReaction,
  ScreenshotComment, InsertScreenshotComment,
  ScreenshotReaction, InsertScreenshotReaction,
  CommentReport, InsertCommentReport,
  ClipReport, InsertClipReport,
  ScreenshotReport, InsertScreenshotReport,
  Notification, InsertNotification,
  Message, InsertMessage,
  UserBlock, InsertUserBlock,
  UserBadge, InsertUserBadge,
  MonthlyLeaderboard, InsertMonthlyLeaderboard,
  WeeklyLeaderboard, InsertWeeklyLeaderboard,
  TopContributor, InsertTopContributor,
  UserPointsHistory, InsertUserPointsHistory,
  UserXPHistory, InsertUserXPHistory,
  ContentFilterSettings, InsertContentFilterSettings,
  BannedWord, InsertBannedWord,
  BannerSettings, InsertBannerSettings,
  UploadedBanner, InsertUploadedBanner,
  HeroTextSettings, InsertHeroTextSettings,
  ClipMention, InsertClipMention,
  CommentMention, InsertCommentMention,
  ScreenshotCommentMention, InsertScreenshotCommentMention,
  NftWatchlist, InsertNftWatchlist,
  AssetReward, InsertAssetReward,
  AssetRewardClaim, InsertAssetRewardClaim,
  AssetRewardWithClaims,
  UserDailyLootbox, InsertUserDailyLootbox,
  UserDailyUploads, InsertUserDailyUploads,
  ProLootboxGrant, InsertProLootboxGrant,
  UploadLimits,
  NameTag, InsertNameTag,
  UserUnlockedNameTag, InsertUserUnlockedNameTag,
  ProfileBorder, InsertProfileBorder,
  UserUnlockedBorder, InsertUserUnlockedBorder,
  VerificationBadge, InsertVerificationBadge,
  UserUnlockedVerificationBadge, InsertUserUnlockedVerificationBadge,
  ClipWithUser,
  CommentWithUser,
  ScreenshotCommentWithUser,
  UserWithStats,
  UserWithBadges,
  Badge, InsertBadge,
  BadgeWithStats,
  users,
  games,
  clips,
  likes,
  comments,
  userGameFavorites,
  follows,
  followRequests,
  profileBanners,
  screenshots,
  screenshotLikes,
  screenshotComments,
  screenshotReactions,
  clipReactions,
  commentReports,
  clipReports,
  screenshotReports,
  notifications,
  messages,
  userBlocks,
  userBadges,
  badges,
  monthlyLeaderboard,
  weeklyLeaderboard,
  topContributors,
  userPointsHistory,
  userXPHistory,
  emailVerificationTokens,
  contentFilterSettings,
  bannedWords,
  heroTextSettings,
  bannerSettings,
  uploadedBanners,
  clipMentions,
  nftWatchlist,
  commentMentions,
  nameTags,
  userUnlockedNameTags,
  profileBorders,
  userUnlockedBorders,
  verificationBadges,
  userUnlockedVerificationBadges,
  screenshotCommentMentions,
  assetRewards,
  assetRewardClaims,
  userDailyLootbox,
  userDailyUploads,
  userDailyFires,
  proLootboxGrants,
  userUnlockedBanners,
  commentLikes,
  screenshotCommentLikes,
  UserDailyFires, InsertUserDailyFires,
  FireLimits,
  xpSettings,
  XpSetting, InsertXpSetting
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, like, ilike, asc, or, lt, gt, sql, arrayContains, ne, inArray, isNotNull, getTableColumns } from "drizzle-orm";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { IStorage } from "./storage";
import { calculateLevel } from "./level-system";
import { promisify } from "util";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";

const PgSession = connectPgSimple(session);

// Password hashing utilities - CRITICAL SECURITY
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

async function comparePasswords(password: string, hashedPassword: string | null | undefined): Promise<boolean> {
  if (!hashedPassword) {
    return false;
  }
  
  const [hash, salt] = hashedPassword.split('.');
  if (!hash || !salt) {
    return false;
  }
  
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(Buffer.from(hash, 'hex'), buf);
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // PRODUCTION-GRADE SESSION STORE using PostgreSQL connection string
    // This ensures session persistence across server restarts and supports clustering
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('🚨 CRITICAL: DATABASE_URL not configured for session store');
    }
    
    this.sessionStore = new PgSession({
      conString: connectionString, // Use DATABASE_URL connection string
      tableName: 'session', // Session table name
      createTableIfMissing: true, // Auto-create session table
      pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
      errorLog: (error: Error) => {
        console.error('🚨 SESSION STORE ERROR:', error);
      }
    });
    console.log('✅ PRODUCTION SESSION STORE: PostgreSQL connect-pg-simple initialized with DATABASE_URL');
  }

  // User operations
  async getUser(id: number): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(ilike(users.username, username));
    return user || null;
  }

  async getUserById(id: number): Promise<User | null> {
    // Alias for getUser method for mention service compatibility
    return this.getUser(id);
  }

  async getUsersByUsernames(usernames: string[]): Promise<User[]> {
    if (usernames.length === 0) return [];
    
    // Use case-insensitive matching for usernames
    const lowerUsernames = usernames.map(u => u.toLowerCase());
    const matchingUsers = await db.select().from(users).where(
      inArray(sql`LOWER(${users.username})`, lowerUsernames)
    );
    return matchingUsers;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user || null;
  }

  async createUser(userData: InsertUser): Promise<User> {
    try {
      // CRITICAL SECURITY: Hash password before storing
      const safeUserData = { ...userData };
      if (safeUserData.password) {
        console.log(`🔐 SECURITY: Hashing password for new user`);
        safeUserData.password = await hashPassword(safeUserData.password);
      }
      
      const userWithDefaults = {
        ...safeUserData,
        avatarUrl: safeUserData.avatarUrl || "/attached_assets/gamefolio social logo 3d circle web.png",
        bannerUrl: safeUserData.bannerUrl || "/api/static/telegram-cloud-photo-size-4-5929334272504744521-y_1749637964973.jpg",
        selectedAvatarBorderId: safeUserData.selectedAvatarBorderId ?? (await db.select({ id: assetRewards.id }).from(assetRewards).where(eq(assetRewards.category, "avatar_border")).limit(1))[0]?.id,
      };
      const [user] = await db.insert(users).values(userWithDefaults).returning();
      return user;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | null> {
    try {
      // CRITICAL SECURITY: Hash password if it's being updated
      const safeUserData = { ...userData };
      if (safeUserData.password) {
        console.log(`🔐 SECURITY: Hashing password for user ${id}`);
        safeUserData.password = await hashPassword(safeUserData.password);
      }
      
      const [updatedUser] = await db
        .update(users)
        .set({ ...safeUserData, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return updatedUser;
    } catch (error) {
      console.error("Error updating user:", error);
      return null;
    }
  }

  async updateUserType(id: number, userType: string): Promise<User | null> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({ userType, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return updatedUser;
    } catch (error) {
      console.error("Error updating user type:", error);
      return null;
    }
  }

  async updateUserStreak(data: {
    userId: number;
    currentStreak: number;
    longestStreak: number;
    lastStreakUpdate: Date;
  }): Promise<void> {
    try {
      await db
        .update(users)
        .set({
          currentStreak: data.currentStreak,
          longestStreak: data.longestStreak,
          lastStreakUpdate: data.lastStreakUpdate,
          updatedAt: new Date()
        })
        .where(eq(users.id, data.userId));
      console.log(`✅ Updated streak for user ${data.userId}: ${data.currentStreak} days`);
    } catch (error) {
      console.error("Error updating user streak:", error);
      throw error;
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      // Delete all related data first to maintain referential integrity
      console.log(`Starting user deletion process for user ID: ${id}`);

      // Delete email verification tokens
      await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, id));
      console.log(`✅ Deleted email verification tokens for user ${id}`);

      // Delete user points history
      await db.delete(userPointsHistory).where(eq(userPointsHistory.userId, id));
      console.log(`✅ Deleted points history for user ${id}`);

      // Delete user badges
      await db.delete(userBadges).where(eq(userBadges.userId, id));
      console.log(`✅ Deleted badges for user ${id}`);

      // Delete user blocks (both as blocker and blocked)
      await db.delete(userBlocks).where(or(
        eq(userBlocks.blockerId, id),
        eq(userBlocks.blockedId, id)
      ));
      console.log(`✅ Deleted user blocks for user ${id}`);

      // Delete messages (both sent and received)
      await db.delete(messages).where(or(
        eq(messages.senderId, id),
        eq(messages.receiverId, id)
      ));
      console.log(`✅ Deleted messages for user ${id}`);

      // Delete notifications
      await db.delete(notifications).where(eq(notifications.userId, id));
      console.log(`✅ Deleted notifications for user ${id}`);

      // Delete follows (both as follower and following)
      await db.delete(follows).where(or(
        eq(follows.followerId, id),
        eq(follows.followingId, id)
      ));
      console.log(`✅ Deleted follows for user ${id}`);

      // Delete user game favorites
      await db.delete(userGameFavorites).where(eq(userGameFavorites.userId, id));
      console.log(`✅ Deleted game favorites for user ${id}`);

      // Delete likes made by the user
      await db.delete(likes).where(eq(likes.userId, id));
      console.log(`✅ Deleted likes for user ${id}`);

      // Delete comments made by the user
      await db.delete(comments).where(eq(comments.userId, id));
      console.log(`✅ Deleted comments for user ${id}`);

      // Delete clip reactions made by the user
      await db.delete(clipReactions).where(eq(clipReactions.userId, id));
      console.log(`✅ Deleted clip reactions for user ${id}`);

      // Delete screenshots uploaded by the user
      await db.delete(screenshots).where(eq(screenshots.userId, id));
      console.log(`✅ Deleted screenshots for user ${id}`);

      // Delete clips uploaded by the user (this will cascade delete related likes, comments, etc.)
      await db.delete(clips).where(eq(clips.userId, id));
      console.log(`✅ Deleted clips for user ${id}`);

      // Finally, delete the user
      const result = await db.delete(users).where(eq(users.id, id)).returning();

      if (result.length > 0) {
        console.log(`✅ Successfully deleted user ${id} and all related data`);
        return true;
      } else {
        console.log(`❌ User ${id} not found for deletion`);
        return false;
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }

  async getUserWithStats(id: number): Promise<UserWithStats | null> {
    const user = await this.getUser(id);
    if (!user) return null;

    // Get followers count
    const followersCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followingId, id));

    // Get following count
    const followingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followerId, id));

    // Get clips count
    const clipsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(clips)
      .where(eq(clips.userId, id));

    // Get screenshots count
    const screenshotsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(screenshots)
      .where(eq(screenshots.userId, id));

    // Get total views count
    const viewsResult = await db
      .select({ total: sql<number>`sum(${clips.views})` })
      .from(clips)
      .where(eq(clips.userId, id));

    // Get total likes received on user's clips
    const likesReceivedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(likes)
      .leftJoin(clips, eq(likes.clipId, clips.id))
      .where(eq(clips.userId, id));

    // Get total fires received on user's clips (clip reactions with fire emoji)
    const firesReceivedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(clipReactions)
      .leftJoin(clips, eq(clipReactions.clipId, clips.id))
      .where(and(
        eq(clips.userId, id),
        eq(clipReactions.emoji, '🔥')
      ));

    // Get favorite games
    const favoriteGames = await this.getUserGameFavorites(id);

    const userWithStats: UserWithStats = {
      ...user,
      _count: {
        followers: followersCount[0].count || 0,
        following: followingCount[0].count || 0,
        clips: clipsCount[0].count || 0,
        screenshots: screenshotsCount[0].count || 0,
        clipViews: viewsResult[0].total || 0,
        likesReceived: likesReceivedResult[0].count || 0,
        firesReceived: firesReceivedResult[0].count || 0
      },
      favoriteGames
    };

    return userWithStats;
  }

  async getFeaturedUsers(limit: number = 6): Promise<User[]> {
    try {
      // Get the first few users to showcase the feature
      const featuredUsers = await db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt), desc(users.id))
        .limit(limit);

      return featuredUsers;
    } catch (error) {
      console.error("Error getting featured users:", error);
      return [];
    }
  }

  // Game operations
  async getGame(id: number): Promise<Game | null> {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    return game || null;
  }

  async getGameByName(name: string): Promise<Game | null> {
    const [game] = await db.select().from(games).where(eq(games.name, name));
    return game || null;
  }

  async getGameByTwitchId(twitchId: string): Promise<Game | null> {
    const [game] = await db.select().from(games).where(eq(games.twitchId, twitchId));
    return game || null;
  }

  async createGame(gameData: InsertGame): Promise<Game> {
    const [game] = await db.insert(games).values(gameData).returning();
    return game;
  }

  async updateGame(id: number, data: Partial<InsertGame>): Promise<Game | null> {
    const [game] = await db.update(games).set(data).where(eq(games.id, id)).returning();
    return game || null;
  }

  async deleteGame(id: number): Promise<boolean> {
    await db.update(clips).set({ gameId: null }).where(eq(clips.gameId, id));
    await db.update(screenshots).set({ gameId: null }).where(eq(screenshots.gameId, id));
    const result = await db.delete(games).where(eq(games.id, id)).returning();
    return result.length > 0;
  }

  async getAllGames(): Promise<Game[]> {
    return db.select().from(games).orderBy(asc(games.name));
  }

  async getTrendingGames(limit: number = 10): Promise<Game[]> {
    try {
      // Just get all games and then sort them by highest ID (newest)
      const allGames = await db.select().from(games).orderBy(desc(games.id)).limit(limit);
      return allGames;
    } catch (error) {
      console.error("Error in getTrendingGames:", error);
      return [];
    }
  }

  // Clip operations
  async getClip(id: number): Promise<Clip | null> {
    const [clip] = await db.select().from(clips).where(eq(clips.id, id));
    return clip || null;
  }

  async getClipWithUser(id: number): Promise<ClipWithUser | null> {
    try {
      const result = await db
        .select({
          ...getTableColumns(clips),
          user: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
            emailVerified: users.emailVerified,
            nftProfileTokenId: users.nftProfileTokenId,
            nftProfileImageUrl: users.nftProfileImageUrl,
          },
          game: {
            id: games.id,
            name: games.name,
            imageUrl: games.imageUrl,
            twitchId: games.twitchId,
            createdAt: games.createdAt,
          }
        })
        .from(clips)
        .leftJoin(users, eq(clips.userId, users.id))
        .leftJoin(games, eq(clips.gameId, games.id))
        .where(eq(clips.id, id))
        .limit(1);

      if (result.length === 0) return null;

      const row = result[0];
      const { user, game, ...clipData } = row;

      // Get engagement counts
      const [likesResult, commentsResult, reactionsResult] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(likes).where(eq(likes.clipId, id)),
        db.select({ count: sql<number>`count(*)` }).from(comments).where(eq(comments.clipId, id)),
        db.select({ count: sql<number>`count(*)` }).from(clipReactions).where(eq(clipReactions.clipId, id))
      ]);

      return {
        ...clipData,
        user: user?.id ? { ...user } : null,
        game: game?.id ? { ...game } : null,
        _count: {
          likes: parseInt(likesResult[0]?.count.toString() || '0'),
          comments: parseInt(commentsResult[0]?.count.toString() || '0'),
          reactions: parseInt(reactionsResult[0]?.count.toString() || '0')
        }
      };
    } catch (error) {
      console.error('Error getting clip with user:', error);
      return null;
    }
  }

  async getClipById(id: number): Promise<ClipWithUser | null> {
    const result = await this.getClipWithUser(id);
    return result || null;
  }

  async createClip(clipData: InsertClip): Promise<Clip> {
    const [clip] = await db.insert(clips).values(clipData).returning();
    return clip;
  }

  async updateClip(id: number, clipData: Partial<Clip>): Promise<Clip | null> {
    const [updatedClip] = await db
      .update(clips)
      .set(clipData)
      .where(eq(clips.id, id))
      .returning();
    return updatedClip || null;
  }

  async updateClipDuration(id: number, duration: number): Promise<boolean> {
    try {
      await db
        .update(clips)
        .set({ duration })
        .where(eq(clips.id, id));
      return true;
    } catch (error) {
      console.error('Error updating clip duration:', error);
      return false;
    }
  }

  async getClipsWithDuration(duration: number): Promise<Clip[]> {
    return await db.select().from(clips).where(eq(clips.duration, duration));
  }

  async deleteClip(id: number): Promise<boolean> {
    try {
      // First delete associated XP history records
      await db.delete(userXPHistory).where(eq(userXPHistory.clipId, id));
      
      // Then delete associated likes and comments
      await db.delete(likes).where(eq(likes.clipId, id));
      await db.delete(comments).where(eq(comments.clipId, id));

      // Then delete the clip
      const result = await db.delete(clips).where(eq(clips.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting clip:", error);
      return false;
    }
  }

  async incrementClipViews(id: number): Promise<void> {
    // Get the clip first to get userId and current views
    const [clip] = await db.select().from(clips).where(eq(clips.id, id));
    if (!clip) return;

    // Increment views
    await db
      .update(clips)
      .set({ views: sql`${clips.views} + 1` })
      .where(eq(clips.id, id));

    // Award XP to the clip owner (1 XP per view) and Points for leaderboard
    const newViewCount = (clip.views || 0) + 1;
    const { XPService } = await import("./xp-service");
    const { LeaderboardService } = await import("./leaderboard-service");
    
    await Promise.all([
      XPService.awardXPForViews(id, clip.userId, newViewCount),
      LeaderboardService.awardPoints(clip.userId, 'view', `View on clip: ${clip.title}`)
    ]);
  }

  async incrementScreenshotViews(id: number): Promise<void> {
    // Get the screenshot first to get userId
    const [screenshot] = await db.select().from(screenshots).where(eq(screenshots.id, id));
    if (!screenshot) return;

    // Increment views
    await db
      .update(screenshots)
      .set({ views: sql`${screenshots.views} + 1` })
      .where(eq(screenshots.id, id));

    // Award Points for leaderboard (screenshots don't have XP tracking yet)
    const { LeaderboardService } = await import("./leaderboard-service");
    await LeaderboardService.awardPoints(screenshot.userId, 'view', `View on screenshot: ${screenshot.title}`);
  }

  async getClipsByUserId(userId: number): Promise<ClipWithUser[]> {
    const userClips = await db
      .select()
      .from(clips)
      .where(eq(clips.userId, userId))
      .orderBy(desc(clips.createdAt), desc(clips.id));

    const clipsWithDetails: ClipWithUser[] = [];
    for (const clip of userClips) {
      const clipWithUser = await this.getClipWithUser(clip.id);
      if (clipWithUser) {
        clipsWithDetails.push(clipWithUser);
      }
    }

    return clipsWithDetails;
  }

  async getClipByShareCode(shareCode: string): Promise<Clip | null> {
    const [clip] = await db.select().from(clips).where(eq(clips.shareCode, shareCode));
    return clip || null;
  }

  async getScreenshotByShareCode(shareCode: string): Promise<Screenshot | null> {
    const [screenshot] = await db.select().from(screenshots).where(eq(screenshots.shareCode, shareCode));
    return screenshot || null;
  }

  async getClipsByGameId(gameId: number, limit: number = 4): Promise<ClipWithUser[]> {
    // Get clips for a specific game
    const gameClips = await db
      .select()
      .from(clips)
      .where(eq(clips.gameId, gameId))
      .orderBy(desc(clips.views), desc(clips.createdAt), desc(clips.id))
      .limit(limit);

    // Get full clip details with user info
    const clipsWithDetails: ClipWithUser[] = [];
    for (const clip of gameClips) {
      const clipWithUser = await this.getClipWithUser(clip.id);
      if (clipWithUser) {
        clipsWithDetails.push(clipWithUser);
      }
    }

    return clipsWithDetails;
  }

  async getClipsByHashtag(hashtag: string): Promise<ClipWithUser[]> {
    // Search for clips that have the hashtag in their tags array using ANY operator
    const hashtagClips = await db
      .select()
      .from(clips)
      .where(sql`${hashtag} = ANY(${clips.tags})`)
      .orderBy(desc(clips.createdAt), desc(clips.id));

    // Get full clip details with user info
    const clipsWithDetails: ClipWithUser[] = [];
    for (const clip of hashtagClips) {
      const clipWithUser = await this.getClipWithUser(clip.id);
      if (clipWithUser) {
        clipsWithDetails.push(clipWithUser);
      }
    }

    return clipsWithDetails;
  }

  async getFeedClips(period: string = 'recent', limit: number = 10): Promise<ClipWithUser[]> {
    let dateFilter;
    const now = new Date();

    switch (period) {
      case '1d':
      case 'day':
      case 'today':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
        break;
      case 'week':
      case '1w':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        break;
      case 'month':
      case '1m':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        break;
      case 'ever':
      case 'all':
        dateFilter = new Date(0); // Beginning of time
        break;
      case 'recent':
      default:
        dateFilter = null; // No date filter, just order by recency
    }

    const clipIds = dateFilter 
      ? await db
          .select()
          .from(clips)
          .where(gt(clips.createdAt, dateFilter))
          .orderBy(desc(clips.createdAt), desc(clips.id))
          .limit(limit)
      : await db
          .select()
          .from(clips)
          .orderBy(desc(clips.createdAt), desc(clips.id))
          .limit(limit);

    const clipsWithDetails: ClipWithUser[] = [];
    for (const clip of clipIds) {
      const clipWithUser = await this.getClipWithUser(clip.id);
      if (clipWithUser) {
        clipsWithDetails.push(clipWithUser);
      }
    }

    return clipsWithDetails;
  }

  async getTrendingClips(period: string = 'recent', limit: number = 10, gameId?: number, currentUserId?: number): Promise<ClipWithUser[]> {
    let dateFilter: Date | null;
    const now = new Date();

    switch (period) {
      case '1d':
      case 'day':
      case 'today':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
      case '1w':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      case '1m':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'ever':
      case 'all':
        dateFilter = new Date(0);
        break;
      case 'recent':
      default:
        dateFilter = null; // No date filter for most recent
    }

    // Get clips based on engagement (likes + comments) with privacy filtering
    console.log('getTrendingClips: currentUserId =', currentUserId);
    
    const clipEngagementQuery = db
      .select({
        clipId: clips.id,
        engagement: sql<number>`cast(count(distinct ${likes.id}) + count(distinct ${comments.id}) as integer)`.as('engagement')
      })
      .from(clips)
      .leftJoin(users, eq(clips.userId, users.id))
      .leftJoin(likes, eq(clips.id, likes.clipId))
      .leftJoin(comments, eq(clips.id, comments.clipId))
      .where(
        and(
          dateFilter ? gt(clips.createdAt, dateFilter) : undefined,
          eq(clips.videoType, 'clip'),
          gameId ? eq(clips.gameId, gameId) : undefined,
          // Only show clips from public accounts OR private accounts that current user follows OR user's own content
          or(
            eq(users.isPrivate, false), // Public accounts
            currentUserId ? eq(users.id, currentUserId) : sql`false`, // User's own content
            currentUserId ? sql`exists (select 1 from follows f where f.following_id = ${users.id} and f.follower_id = ${currentUserId})` : sql`false` // Current user follows this private account
          )
        )
      )
      .groupBy(clips.id)
      .orderBy(sql`engagement desc`, desc(clips.createdAt), desc(clips.id))
      .limit(limit);

    const engagementResults = await clipEngagementQuery;

    const clipsWithDetails: ClipWithUser[] = [];
    for (const result of engagementResults) {
      const clipWithUser = await this.getClipWithUser(result.clipId);
      if (clipWithUser) {
        clipsWithDetails.push(clipWithUser);
      }
    }

    return clipsWithDetails;
  }

  async getTrendingReels(period: string = 'recent', limit: number = 10, gameId?: number, currentUserId?: number): Promise<ClipWithUser[]> {
    let dateFilter: Date | null;
    const now = new Date();

    switch (period) {
      case '1d':
      case 'day':
      case 'today':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
      case '1w':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      case '1m':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'ever':
      case 'all':
        dateFilter = new Date(0);
        break;
      case 'recent':
      default:
        dateFilter = null;
    }

    // Get reels based on engagement (likes + comments) with proper joins
    const reelEngagementQuery = db
      .select({
        clip: clips,
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          emailVerified: users.emailVerified,
        },
        game: {
          id: games.id,
          name: games.name,
          imageUrl: games.imageUrl,
          twitchId: games.twitchId,
          createdAt: games.createdAt,
        },
        engagement: sql<number>`cast(count(distinct ${likes.id}) + count(distinct ${comments.id}) as integer)`.as('engagement'),
        likesCount: sql<number>`count(distinct ${likes.id})`.as('likesCount'),
        commentsCount: sql<number>`count(distinct ${comments.id})`.as('commentsCount'),
        reactionsCount: sql<number>`count(distinct ${clipReactions.id})`.as('reactionsCount')
      })
      .from(clips)
      .leftJoin(users, eq(clips.userId, users.id))
      .leftJoin(games, eq(clips.gameId, games.id))
      .leftJoin(likes, eq(clips.id, likes.clipId))
      .leftJoin(comments, eq(clips.id, comments.clipId))
      .leftJoin(clipReactions, eq(clips.id, clipReactions.clipId))
      .leftJoin(follows, and(
        eq(follows.followingId, users.id),
        currentUserId ? eq(follows.followerId, currentUserId) : sql`false`
      ))
      .where(
        and(
          dateFilter ? gt(clips.createdAt, dateFilter) : undefined,
          eq(clips.videoType, 'reel'),
          gameId ? eq(clips.gameId, gameId) : undefined,
          // Only show reels from public accounts OR private accounts that current user follows OR user's own content
          or(
            eq(users.isPrivate, false), // Public accounts
            currentUserId ? eq(users.id, currentUserId) : sql`false`, // User's own content
            currentUserId ? and(
              eq(users.isPrivate, true),
              eq(follows.followerId, currentUserId) // Current user follows this private account
            ) : sql`false` // If no current user, don't show any private content
          )
        )
      )
      .groupBy(clips.id, users.id, games.id)
      .orderBy(sql`engagement desc`, desc(clips.createdAt), desc(clips.id))
      .limit(limit);

    const results = await reelEngagementQuery;

    return results.map(row => ({
      ...row.clip,
      user: row.user?.id ? { ...row.user } : null,
      game: row.game?.id ? { ...row.game } : null,
      _count: {
        likes: parseInt(row.likesCount?.toString() || '0'),
        comments: parseInt(row.commentsCount?.toString() || '0'),
        reactions: parseInt(row.reactionsCount?.toString() || '0')
      }
    }));
  }

  async getLatestReels(limit: number, currentUserId?: number): Promise<ClipWithUser[]> {
    // Get latest reels by creation date (newest first) with engagement counts
    const latestReelsQuery = db
      .select({
        clip: clips,
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          emailVerified: users.emailVerified,
        },
        game: {
          id: games.id,
          name: games.name,
          imageUrl: games.imageUrl,
          twitchId: games.twitchId,
          createdAt: games.createdAt,
        },
        likesCount: sql<number>`count(distinct ${likes.id})`.as('likesCount'),
        commentsCount: sql<number>`count(distinct ${comments.id})`.as('commentsCount'),
        reactionsCount: sql<number>`count(distinct ${clipReactions.id})`.as('reactionsCount')
      })
      .from(clips)
      .leftJoin(users, eq(clips.userId, users.id))
      .leftJoin(games, eq(clips.gameId, games.id))
      .leftJoin(likes, eq(clips.id, likes.clipId))
      .leftJoin(comments, eq(clips.id, comments.clipId))
      .leftJoin(clipReactions, eq(clips.id, clipReactions.clipId))
      .leftJoin(follows, and(
        eq(follows.followingId, users.id),
        currentUserId ? eq(follows.followerId, currentUserId) : sql`false`
      ))
      .where(
        and(
          eq(clips.videoType, 'reel'),
          // Only show reels from public accounts OR private accounts that current user follows OR user's own content
          or(
            eq(users.isPrivate, false), // Public accounts
            currentUserId ? eq(users.id, currentUserId) : sql`false`, // User's own content
            currentUserId ? and(
              eq(users.isPrivate, true),
              eq(follows.followerId, currentUserId) // Current user follows this private account
            ) : sql`false` // If no current user, don't show any private content
          )
        )
      )
      .groupBy(clips.id, users.id, games.id)
      .orderBy(desc(clips.createdAt), desc(clips.id))
      .limit(limit);

    const results = await latestReelsQuery;

    return results.map(row => ({
      ...row.clip,
      user: row.user?.id ? { ...row.user } : null,
      game: row.game?.id ? { ...row.game } : null,
      _count: {
        likes: parseInt(row.likesCount?.toString() || '0'),
        comments: parseInt(row.commentsCount?.toString() || '0'),
        reactions: parseInt(row.reactionsCount?.toString() || '0')
      }
    }));
  }

  async getGameCategories(): Promise<{ category: string; count: number }[]> {
    const result = await db
      .select({
        category: games.name,
        count: sql<number>`count(distinct ${clips.id})`.as('count')
      })
      .from(games)
      .leftJoin(clips, eq(games.id, clips.gameId))
      .groupBy(games.name)
      .having(sql`count(distinct ${clips.id}) > 0`)
      .orderBy(sql`count(distinct ${clips.id}) desc`)
      .limit(20);

    return result.map(row => ({
      category: row.category,
      count: Number(row.count) || 0,
    }));
  }

  // Like operations
  async createLike(likeData: InsertLike): Promise<Like> {
    const [like] = await db.insert(likes).values(likeData).returning();
    return like;
  }

  async deleteLike(userId: number, clipId: number): Promise<boolean> {
    const result = await db
      .delete(likes)
      .where(
        and(
          eq(likes.userId, userId),
          eq(likes.clipId, clipId)
        )
      )
      .returning();
    return result.length > 0;
  }

  async getLikesByClipId(clipId: number): Promise<Like[]> {
    return db.select().from(likes).where(eq(likes.clipId, clipId));
  }

  async getLikesByUserId(userId: number): Promise<Like[]> {
    return db.select().from(likes).where(eq(likes.userId, userId));
  }

  // Comment operations
  async getComment(id: number): Promise<Comment | null> {
    const [comment] = await db.select().from(comments).where(eq(comments.id, id));
    return comment || null;
  }

  async createComment(commentData: InsertComment): Promise<Comment> {
    const [comment] = await db.insert(comments).values(commentData).returning();
    return comment;
  }

  // Mention operations
  async createClipMention(mentionData: InsertClipMention): Promise<ClipMention> {
    const [mention] = await db.insert(clipMentions).values(mentionData).returning();
    return mention;
  }

  async createCommentMention(mentionData: InsertCommentMention): Promise<CommentMention> {
    const [mention] = await db.insert(commentMentions).values(mentionData).returning();
    return mention;
  }

  async createScreenshotCommentMention(mentionData: InsertScreenshotCommentMention): Promise<ScreenshotCommentMention> {
    const [mention] = await db.insert(screenshotCommentMentions).values(mentionData).returning();
    return mention;
  }

  async getCommentsByClipId(clipId: number): Promise<CommentWithUser[]> {
    const commentsWithUsers = await db
      .select({
        comment: comments,
        user: users
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.clipId, clipId))
      .orderBy(desc(comments.createdAt), desc(comments.id));

    return commentsWithUsers.map(row => ({
      ...row.comment,
      user: row.user?.id ? row.user : null  // null for orphaned comments
    }));
  }

  async deleteComment(id: number): Promise<boolean> {
    const result = await db.delete(comments).where(eq(comments.id, id)).returning();
    return result.length > 0;
  }

  // User game favorites operations
  async addUserGameFavorite(favoriteData: InsertUserGameFavorite): Promise<UserGameFavorite> {
    const [favorite] = await db.insert(userGameFavorites).values(favoriteData).returning();
    return favorite;
  }

  async removeUserGameFavorite(userId: number, gameId: number): Promise<boolean> {
    const result = await db
      .delete(userGameFavorites)
      .where(
        and(
          eq(userGameFavorites.userId, userId),
          eq(userGameFavorites.gameId, gameId)
        )
      )
      .returning();
    return result.length > 0;
  }

  async getUserGameFavorites(userId: number): Promise<Game[]> {
    const results = await db
      .select({
        game: games
      })
      .from(userGameFavorites)
      .innerJoin(games, eq(userGameFavorites.gameId, games.id))
      .where(eq(userGameFavorites.userId, userId));

    return results.map(r => r.game);
  }

  // Follow operations
  async createFollow(followData: InsertFollow): Promise<Follow> {
    try {
      const [follow] = await db.insert(follows).values(followData).returning();
      return follow;
    } catch (error) {
      // Log the error for debugging
      console.error("Database error in createFollow:", error);
      
      // Re-throw the error with more context if needed
      if (error instanceof Error) {
        if (error.message.includes('duplicate key value') || error.message.includes('unique constraint')) {
          throw new Error("Follow relationship already exists");
        }
        if (error.message.includes('foreign key constraint')) {
          throw new Error("Invalid user ID for follow relationship");
        }
      }
      
      // Re-throw the original error for other cases
      throw error;
    }
  }

  async deleteFollow(followerId: number, followingId: number): Promise<boolean> {
    const result = await db
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.followingId, followingId)
        )
      )
      .returning();
    return result.length > 0;
  }

  async getFollowersByUserId(userId: number): Promise<User[]> {
    const results = await db
      .select({
        user: users
      })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, userId));

    return results.map(r => r.user);
  }

  async getFollowingByUserId(userId: number): Promise<User[]> {
    const results = await db
      .select({
        user: users
      })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(eq(follows.followerId, userId));

    return results.map(r => r.user);
  }

  async isFollowing(followerId: number, followingId: number): Promise<boolean> {
    const [follow] = await db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.followingId, followingId)
        )
      );
    return !!follow;
  }

  async getFollowerCount(userId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followingId, userId));
    return result[0].count || 0;
  }

  async getFollowingCount(userId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followerId, userId));
    return result[0].count || 0;
  }

  // Follow request operations
  async createFollowRequest(requesterId: number, requestedId: number): Promise<void> {
    await db.insert(followRequests).values({
      requesterId,
      addresseeId: requestedId,
      status: 'pending'
    });
  }

  async getPendingFollowRequests(userId: number) {
    const requests = await db
      .select()
      .from(followRequests)
      .where(
        and(
          eq(followRequests.addresseeId, userId),
          eq(followRequests.status, 'pending')
        )
      );
    return requests;
  }

  async getFollowRequest(requestId: number): Promise<any> {
    const [request] = await db
      .select()
      .from(followRequests)
      .where(eq(followRequests.id, requestId));
    return request;
  }

  async hasFollowRequest(requesterId: number, requestedId: number): Promise<string | null> {
    const [request] = await db
      .select()
      .from(followRequests)
      .where(
        and(
          eq(followRequests.requesterId, requesterId),
          eq(followRequests.addresseeId, requestedId)
        )
      );
    return request ? request.status : null;
  }

  async acceptFollowRequest(requestId: number): Promise<boolean> {
    // Get the follow request details first
    const [request] = await db
      .select()
      .from(followRequests)
      .where(eq(followRequests.id, requestId));
    
    if (!request) {
      return false;
    }

    // Create the follow relationship
    await db.insert(follows).values({
      followerId: request.requesterId,
      followingId: request.addresseeId
    });

    // Update the request status to approved
    const result = await db
      .update(followRequests)
      .set({ status: 'approved' })
      .where(eq(followRequests.id, requestId))
      .returning();
      
    return result.length > 0;
  }

  async declineFollowRequest(requestId: number): Promise<boolean> {
    const result = await db
      .update(followRequests)
      .set({ status: 'rejected' })
      .where(eq(followRequests.id, requestId))
      .returning();
    return result.length > 0;
  }

  async removeFollowRequest(requesterId: number, requestedId: number): Promise<void> {
    await db
      .delete(followRequests)
      .where(
        and(
          eq(followRequests.requesterId, requesterId),
          eq(followRequests.addresseeId, requestedId)
        )
      );
  }

  // Search operations
  async searchUsers(query: string): Promise<User[]> {
    const searchResults = await db
      .select()
      .from(users)
      .where(
        or(
          ilike(users.username, `%${query}%`),
          ilike(users.displayName, `%${query}%`)
        )
      )
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(10);

    return searchResults;
  }

  async searchGames(query: string): Promise<Game[]> {
    return db
      .select()
      .from(games)
      .where(ilike(games.name, `%${query}%`))
      .orderBy(desc(games.createdAt), desc(games.id))
      .limit(10);
  }

  async searchClips(query: string): Promise<ClipWithUser[]> {
    // Check if query is a hashtag
    const isHashtag = query.startsWith('#');
    const searchTerm = isHashtag ? query.slice(1).toLowerCase() : query.toLowerCase();

    let matchingClips;

    if (isHashtag) {
      // Search by hashtags in tags array for clips only
      matchingClips = await db
        .select()
        .from(clips)
        .where(
          and(
            eq(clips.videoType, 'clip'),
            sql`EXISTS (SELECT 1 FROM unnest(${clips.tags}) AS tag WHERE LOWER(tag) = ${searchTerm})`
          )
        );
    } else {
      // Search by title and description for clips only
      matchingClips = await db
        .select()
        .from(clips)
        .where(
          and(
            eq(clips.videoType, 'clip'),
            or(
              ilike(clips.title, `%${query}%`),
              ilike(clips.description, `%${query}%`)
            )
          )
        );
    }

    const clipsWithDetails: ClipWithUser[] = [];
    for (const clip of matchingClips) {
      const clipWithUser = await this.getClipWithUser(clip.id);
      if (clipWithUser) {
        clipsWithDetails.push(clipWithUser);
      }
    }

    return clipsWithDetails;
  }

  async searchReels(query: string): Promise<ClipWithUser[]> {
    // Check if query is a hashtag
    const isHashtag = query.startsWith('#');
    const searchTerm = isHashtag ? query.slice(1).toLowerCase() : query.toLowerCase();

    let matchingReels;

    if (isHashtag) {
      // Search by hashtags in tags array for reels only
      matchingReels = await db
        .select()
        .from(clips)
        .where(
          and(
            eq(clips.videoType, 'reel'),
            sql`EXISTS (SELECT 1 FROM unnest(${clips.tags}) AS tag WHERE LOWER(tag) = ${searchTerm})`
          )
        );
    } else {
      // Search by title and description for reels only
      matchingReels = await db
        .select()
        .from(clips)
        .where(
          and(
            eq(clips.videoType, 'reel'),
            or(
              ilike(clips.title, `%${query}%`),
              ilike(clips.description, `%${query}%`)
            )
          )
        );
    }

    const reelsWithDetails: ClipWithUser[] = [];
    for (const reel of matchingReels) {
      const reelWithUser = await this.getClipWithUser(reel.id);
      if (reelWithUser) {
        reelsWithDetails.push(reelWithUser);
      }
    }

    return reelsWithDetails;
  }

  async searchScreenshots(query: string): Promise<(Screenshot & { user: User; game?: Game; _count?: { likes: number; reactions: number; comments: number } })[]> {
    // Check if query is a hashtag
    const isHashtag = query.startsWith('#');
    const searchTerm = isHashtag ? query.slice(1).toLowerCase() : query.toLowerCase();

    let whereClause;
    if (isHashtag) {
      // Search by hashtags in tags array for screenshots
      whereClause = sql`EXISTS (SELECT 1 FROM unnest(${screenshots.tags}) AS tag WHERE LOWER(tag) = ${searchTerm})`;
    } else {
      // Search by title and description for screenshots
      whereClause = or(
        ilike(screenshots.title, `%${query}%`),
        ilike(screenshots.description, `%${query}%`)
      );
    }

    const results = await db
      .select({
        screenshot: screenshots,
        user: users,
        game: games,
        likesCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${screenshotLikes} WHERE ${screenshotLikes.screenshotId} = ${screenshots.id}), 0)`,
        reactionsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${screenshotReactions} WHERE ${screenshotReactions.screenshotId} = ${screenshots.id}), 0)`,
        commentsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${screenshotComments} WHERE ${screenshotComments.screenshotId} = ${screenshots.id}), 0)`
      })
      .from(screenshots)
      .leftJoin(users, eq(screenshots.userId, users.id))
      .leftJoin(games, eq(screenshots.gameId, games.id))
      .where(whereClause)
      .orderBy(desc(screenshots.createdAt), desc(screenshots.id))
      .limit(20);

    return results.map(row => ({
      ...row.screenshot,
      user: row.user,
      game: row.game || undefined,
      _count: {
        likes: Number(row.likesCount) || 0,
        reactions: Number(row.reactionsCount) || 0,
        comments: Number(row.commentsCount) || 0
      }
    }));
  }

  // Profile customization operations
  async getAllProfileBanners(): Promise<ProfileBanner[]> {
    const banners = await db.select().from(profileBanners).orderBy(profileBanners.id);
    return banners;
  }

  async getProfileBannersByCategory(category: string): Promise<ProfileBanner[]> {
    const banners = await db
      .select()
      .from(profileBanners)
      .where(eq(profileBanners.category, category))
      .orderBy(profileBanners.id);
    return banners;
  }

  async getUserUnlockedBanners(userId: number): Promise<ProfileBanner[]> {
    const results = await db
      .select({
        id: profileBanners.id,
        name: profileBanners.name,
        imageUrl: profileBanners.imageUrl,
        category: profileBanners.category,
        createdAt: profileBanners.createdAt,
      })
      .from(userUnlockedBanners)
      .innerJoin(profileBanners, eq(userUnlockedBanners.bannerId, profileBanners.id))
      .where(eq(userUnlockedBanners.userId, userId))
      .orderBy(profileBanners.category, profileBanners.id);
    return results;
  }

  async unlockBannerForUser(userId: number, bannerId: number): Promise<void> {
    const existing = await db
      .select()
      .from(userUnlockedBanners)
      .where(and(
        eq(userUnlockedBanners.userId, userId),
        eq(userUnlockedBanners.bannerId, bannerId)
      ))
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(userUnlockedBanners).values({ userId, bannerId });
    }
  }

  async hasUserUnlockedBanner(userId: number, bannerId: number): Promise<boolean> {
    const result = await db
      .select()
      .from(userUnlockedBanners)
      .where(and(
        eq(userUnlockedBanners.userId, userId),
        eq(userUnlockedBanners.bannerId, bannerId)
      ))
      .limit(1);
    return result.length > 0;
  }

  // Uploaded banner operations
  async createUploadedBanner(userId: number, bannerUrl: string): Promise<UploadedBanner> {
    // Deactivate all previous banners for this user
    await db
      .update(uploadedBanners)
      .set({ isActive: false })
      .where(eq(uploadedBanners.userId, userId));

    // Insert new banner as active
    const [banner] = await db
      .insert(uploadedBanners)
      .values({ userId, bannerUrl, isActive: true })
      .returning();

    // Update user's bannerUrl
    await db
      .update(users)
      .set({ bannerUrl })
      .where(eq(users.id, userId));

    return banner;
  }

  async getUserUploadedBanners(userId: number): Promise<UploadedBanner[]> {
    const banners = await db
      .select()
      .from(uploadedBanners)
      .where(eq(uploadedBanners.userId, userId))
      .orderBy(desc(uploadedBanners.createdAt));
    return banners;
  }

  async setActiveBanner(userId: number, bannerId: number): Promise<boolean> {
    // Get the banner to activate
    const [banner] = await db
      .select()
      .from(uploadedBanners)
      .where(and(
        eq(uploadedBanners.id, bannerId),
        eq(uploadedBanners.userId, userId)
      ));

    if (!banner) {
      return false;
    }

    // Deactivate all banners for this user
    await db
      .update(uploadedBanners)
      .set({ isActive: false })
      .where(eq(uploadedBanners.userId, userId));

    // Activate the selected banner
    await db
      .update(uploadedBanners)
      .set({ isActive: true })
      .where(eq(uploadedBanners.id, bannerId));

    // Update user's bannerUrl
    await db
      .update(users)
      .set({ bannerUrl: banner.bannerUrl })
      .where(eq(users.id, userId));

    return true;
  }

  async deleteUploadedBanner(userId: number, bannerId: number): Promise<boolean> {
    const result = await db
      .delete(uploadedBanners)
      .where(and(
        eq(uploadedBanners.id, bannerId),
        eq(uploadedBanners.userId, userId)
      ))
      .returning();

    return result.length > 0;
  }

  // Admin operations
  async getAllUsers(limit: number = 10, offset: number = 0, search?: string): Promise<UserWithBadges[]> {
    let userQuery = db.select().from(users);

    if (search) {
      userQuery = userQuery.where(
        or(
          ilike(users.username, `%${search}%`),
          ilike(users.displayName, `%${search}%`),
          and(
            isNotNull(users.email),
            ilike(users.email, `%${search}%`)
          )
        )
      ) as any;
    }

    const usersResults = await userQuery
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(limit)
      .offset(offset);

    // Bulk fetch badges for all users to avoid N+1 queries
    const userIds = usersResults.map(user => user.id);
    const allBadges = userIds.length > 0 
      ? await db.select().from(userBadges).where(inArray(userBadges.userId, userIds))
      : [];

    // Group badges by user ID
    const badgesByUserId = allBadges.reduce((acc, badge) => {
      if (!acc[badge.userId]) {
        acc[badge.userId] = [];
      }
      acc[badge.userId].push(badge);
      return acc;
    }, {} as Record<number, UserBadge[]>);

    // Combine users with their badges
    const usersWithBadges: UserWithBadges[] = usersResults.map(user => ({
      ...user,
      badges: badgesByUserId[user.id] || []
    }));

    return usersWithBadges;
  }

  async getUserCount(search?: string): Promise<number> {
    let query = db.select({ count: sql`count(*)` }).from(users);

    if (search) {
      query = query.where(
        or(
          ilike(users.username, `%${search}%`),
          ilike(users.displayName, `%${search}%`),
          and(
            isNotNull(users.email),
            ilike(users.email, `%${search}%`)
          )
        )
      ) as any;
    }

    const [result] = await query;
    return Number(result.count || 0);
  }

  async getAdminCount(): Promise<number> {
    const [result] = await db
      .select({ count: sql`count(*)` })
      .from(users)
      .where(eq(users.role, 'admin'));
    return Number(result.count);
  }

  async getProSubscribers(): Promise<Array<{
    id: number;
    username: string;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    isPro: boolean;
    proSubscriptionType: string | null;
    proSubscriptionStartDate: Date | null;
    proSubscriptionEndDate: Date | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    createdAt: Date;
  }>> {
    const proUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        isPro: users.isPro,
        proSubscriptionType: users.proSubscriptionType,
        proSubscriptionStartDate: users.proSubscriptionStartDate,
        proSubscriptionEndDate: users.proSubscriptionEndDate,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        or(
          eq(users.isPro, true),
          isNotNull(users.proSubscriptionStartDate)
        )
      )
      .orderBy(desc(users.proSubscriptionStartDate));
    
    return proUsers;
  }

  async getClipCount(): Promise<number> {
    const [result] = await db.select({ count: sql`count(*)` }).from(clips);
    return Number(result.count);
  }

  async getGameCount(): Promise<number> {
    const [result] = await db.select({ count: sql`count(*)` }).from(games);
    return Number(result.count);
  }

  async getAllClips(limit: number = 10, offset: number = 0, currentUserId?: number): Promise<ClipWithUser[]> {
    console.log('getAllClips: currentUserId =', currentUserId);
    
    // CRITICAL FIX: Show ALL clips including orphaned ones for admin moderation
    const allClipsData = await db
      .select({
        clip: clips,
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          emailVerified: users.emailVerified,
        },
        game: {
          id: games.id,
          name: games.name,
          imageUrl: games.imageUrl,
          twitchId: games.twitchId,
          createdAt: games.createdAt,
        }
      })
      .from(clips)
      .leftJoin(users, eq(clips.userId, users.id))
      .leftJoin(games, eq(clips.gameId, games.id))
      .where(eq(clips.videoType, 'clip'))
      .orderBy(desc(clips.createdAt), desc(clips.id))
      .limit(limit)
      .offset(offset);

    // Map to ClipWithUser format, preserving ALL records including orphaned ones
    return allClipsData.map(row => ({
      ...row.clip,
      user: row.user?.id ? { ...row.user } : null,  // null for orphaned clips
      game: row.game?.id ? { ...row.game } : null,  // null for missing games
      _count: {
        likes: 0,  // Will be calculated separately if needed
        comments: 0
      }
    }));
  }

  async getUserTypeDistribution(): Promise<{type: string, count: number}[]> {
    const results = await db
      .select({
        type: users.role,
        count: sql`count(*)`
      })
      .from(users)
      .groupBy(users.role);

    return results.map(r => ({
      type: r.type || 'user',
      count: Number(r.count)
    }));
  }

  async getAgeRangeDistribution(): Promise<{range: string, count: number}[]> {
    // Since we don't have age field, return empty for now
    return [];
  }

  async getTopGames(limit: number = 5): Promise<Game[]> {
    const gameClipCounts = await db
      .select({
        gameId: clips.gameId,
        count: sql`count(*)`
      })
      .from(clips)
      .groupBy(clips.gameId)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    const topGames: Game[] = [];
    for (const gameCount of gameClipCounts) {
      if (gameCount.gameId) {
        const game = await this.getGame(gameCount.gameId);
        if (game) {
          topGames.push(game);
        }
      }
    }

    return topGames;
  }

  async getRecentClips(limit: number = 5): Promise<ClipWithUser[]> {
    return this.getAllClips(limit, 0);
  }

  // Screenshot operations
  async getScreenshot(id: number): Promise<Screenshot | null> {
    const [screenshot] = await db.select().from(screenshots).where(eq(screenshots.id, id));
    return screenshot || null;
  }

  async createScreenshot(screenshotData: InsertScreenshot): Promise<Screenshot> {
    const [screenshot] = await db
      .insert(screenshots)
      .values(screenshotData)
      .returning();
    return screenshot;
  }

  async updateScreenshot(id: number, screenshotData: Partial<Screenshot>): Promise<Screenshot | null> {
    const [updatedScreenshot] = await db
      .update(screenshots)
      .set(screenshotData)
      .where(eq(screenshots.id, id))
      .returning();
    return updatedScreenshot || null;
  }

  async getScreenshotsByUserId(userId: number): Promise<Screenshot[]> {
    const results = await db
      .select({
        screenshot: screenshots,
        game: games,
        likesCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM screenshot_likes WHERE screenshot_likes.screenshot_id = screenshots.id), 0)`,
        reactionsCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM screenshot_reactions WHERE screenshot_reactions.screenshot_id = screenshots.id), 0)`,
        commentsCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM screenshot_comments WHERE screenshot_comments.screenshot_id = screenshots.id), 0)`
      })
      .from(screenshots)
      .leftJoin(games, eq(screenshots.gameId, games.id))
      .where(eq(screenshots.userId, userId))
      .orderBy(desc(screenshots.createdAt), desc(screenshots.id));
    
    return results.map(row => ({
      ...row.screenshot,
      game: row.game?.id ? row.game : null,
      _count: {
        likes: Number(row.likesCount),
        reactions: Number(row.reactionsCount),
        comments: Number(row.commentsCount)
      }
    })) as any;
  }

  async getScreenshotsByGameId(gameId: number, limit: number = 20): Promise<Screenshot[]> {
    return await db
      .select()
      .from(screenshots)
      .where(eq(screenshots.gameId, gameId))
      .orderBy(desc(screenshots.createdAt), desc(screenshots.id))
      .limit(limit);
  }

  async deleteScreenshot(id: number): Promise<boolean> {
    try {
      const result = await db.delete(screenshots).where(eq(screenshots.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error(`❌ Error in deleteScreenshot for ID ${id}:`, error);
      console.error("Error details:", error instanceof Error ? error.stack : error);
      throw error;
    }
  }

  // Clip reactions operations
  async createClipReaction(reactionData: InsertClipReaction): Promise<ClipReaction> {
    const [reaction] = await db
      .insert(clipReactions)
      .values(reactionData)
      .returning();
    return reaction;
  }

  async getClipReactions(clipId: number): Promise<any[]> {
    try {
      const result = await db
        .select()
        .from(clipReactions)
        .where(eq(clipReactions.clipId, clipId));
      return result;
    } catch (error) {
      console.error('Error getting clip reactions:', error);
      return [];
    }
  }

  async getClipReactionById(reactionId: number): Promise<any | null> {
    try {
      const result = await db
        .select()
        .from(clipReactions)
        .where(eq(clipReactions.id, reactionId));
      return result[0] || null;
    } catch (error) {
      console.error('Error getting clip reaction by id:', error);
      return null;
    }
  }

  async getUserClipReaction(userId: number, clipId: number, emoji: string): Promise<any> {
    try {
      const result = await db
        .select()
        .from(clipReactions)
        .where(and(
          eq(clipReactions.userId, userId),
          eq(clipReactions.clipId, clipId),
          eq(clipReactions.emoji, emoji)
        ))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error getting user clip reaction:', error);
      return null;
    }
  }

  async deleteClipReaction(id: number): Promise<boolean> {
    try {
      await db.delete(clipReactions).where(eq(clipReactions.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting clip reaction:", error);
      return false;
    }
  }

  // Screenshot Comments operations
  async createScreenshotComment(commentData: InsertScreenshotComment): Promise<ScreenshotComment> {
    const [comment] = await db.insert(screenshotComments).values(commentData).returning();
    return comment;
  }

  async getScreenshotComments(screenshotId: number): Promise<ScreenshotCommentWithUser[]> {
    const results = await db
      .select({
        id: screenshotComments.id,
        userId: screenshotComments.userId,
        screenshotId: screenshotComments.screenshotId,
        content: screenshotComments.content,
        createdAt: screenshotComments.createdAt,
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          emailVerified: users.emailVerified,
          role: users.role,
          nftProfileTokenId: users.nftProfileTokenId,
          nftProfileImageUrl: users.nftProfileImageUrl,
          selectedVerificationBadgeId: users.selectedVerificationBadgeId
        }
      })
      .from(screenshotComments)
      .leftJoin(users, eq(screenshotComments.userId, users.id))
      .where(eq(screenshotComments.screenshotId, screenshotId))
      .orderBy(desc(screenshotComments.createdAt), desc(screenshotComments.id));

    return results as any;
  }

  async deleteScreenshotComment(id: number): Promise<boolean> {
    try {
      await db.delete(screenshotComments).where(eq(screenshotComments.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting screenshot comment:", error);
      return false;
    }
  }

  // Comment like operations (for clip comments)
  async likeComment(commentId: number, userId: number): Promise<boolean> {
    try {
      await db.insert(commentLikes).values({ commentId, userId });
      return true;
    } catch (error) {
      console.error("Error liking comment:", error);
      return false;
    }
  }

  async unlikeComment(commentId: number, userId: number): Promise<boolean> {
    try {
      await db.delete(commentLikes).where(
        and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId))
      );
      return true;
    } catch (error) {
      console.error("Error unliking comment:", error);
      return false;
    }
  }

  async hasUserLikedComment(commentId: number, userId: number): Promise<boolean> {
    try {
      const result = await db.select()
        .from(commentLikes)
        .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)))
        .limit(1);
      return result.length > 0;
    } catch (error) {
      console.error("Error checking comment like:", error);
      return false;
    }
  }

  async getCommentLikeCount(commentId: number): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(commentLikes)
        .where(eq(commentLikes.commentId, commentId));
      return Number(result[0]?.count || 0);
    } catch (error) {
      console.error("Error getting comment like count:", error);
      return 0;
    }
  }

  // Screenshot comment like operations
  async likeScreenshotComment(screenshotCommentId: number, userId: number): Promise<boolean> {
    try {
      await db.insert(screenshotCommentLikes).values({ screenshotCommentId, userId });
      return true;
    } catch (error) {
      console.error("Error liking screenshot comment:", error);
      return false;
    }
  }

  async unlikeScreenshotComment(screenshotCommentId: number, userId: number): Promise<boolean> {
    try {
      await db.delete(screenshotCommentLikes).where(
        and(eq(screenshotCommentLikes.screenshotCommentId, screenshotCommentId), eq(screenshotCommentLikes.userId, userId))
      );
      return true;
    } catch (error) {
      console.error("Error unliking screenshot comment:", error);
      return false;
    }
  }

  async hasUserLikedScreenshotComment(screenshotCommentId: number, userId: number): Promise<boolean> {
    try {
      const result = await db.select()
        .from(screenshotCommentLikes)
        .where(and(eq(screenshotCommentLikes.screenshotCommentId, screenshotCommentId), eq(screenshotCommentLikes.userId, userId)))
        .limit(1);
      return result.length > 0;
    } catch (error) {
      console.error("Error checking screenshot comment like:", error);
      return false;
    }
  }

  async getScreenshotCommentLikeCount(screenshotCommentId: number): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(screenshotCommentLikes)
        .where(eq(screenshotCommentLikes.screenshotCommentId, screenshotCommentId));
      return Number(result[0]?.count || 0);
    } catch (error) {
      console.error("Error getting screenshot comment like count:", error);
      return 0;
    }
  }

  // Screenshot Reactions operations
  async createScreenshotReaction(reactionData: any): Promise<any> {
    try {
      const result = await db
        .insert(screenshotReactions)
        .values(reactionData)
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating screenshot reaction:', error);
      throw error;
    }
  }

  async getScreenshotReactions(screenshotId: number): Promise<any[]> {
    try {
      const result = await db
        .select()
        .from(screenshotReactions)
        .where(eq(screenshotReactions.screenshotId, screenshotId));
      return result;
    } catch (error) {
      console.error('Error getting screenshot reactions:', error);
      return [];
    }
  }

  async getUserScreenshotReaction(userId: number, screenshotId: number, emoji: string): Promise<any> {
    try {
      const result = await db
        .select()
        .from(screenshotReactions)
        .where(and(
          eq(screenshotReactions.userId, userId),
          eq(screenshotReactions.screenshotId, screenshotId),
          eq(screenshotReactions.emoji, emoji)
        ))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error getting user screenshot reaction:', error);
      return null;
    }
  }

  async deleteScreenshotReaction(reactionId: number): Promise<boolean> {
    try {
      await db
        .delete(screenshotReactions)
        .where(eq(screenshotReactions.id, reactionId));
      return true;
    } catch (error) {
      console.error('Error deleting screenshot reaction:', error);
      return false;
    }
  }

  // Screenshot Likes operations
  async getScreenshotLikes(screenshotId: number): Promise<any[]> {
    try {
      const result = await db
        .select()
        .from(screenshotLikes)
        .where(eq(screenshotLikes.screenshotId, screenshotId));
      return result;
    } catch (error) {
      console.error('Error getting screenshot likes:', error);
      return [];
    }
  }

  async hasUserLikedScreenshot(userId: number, screenshotId: number): Promise<boolean> {
    try {
      const result = await db
        .select()
        .from(screenshotLikes)
        .where(and(
          eq(screenshotLikes.userId, userId),
          eq(screenshotLikes.screenshotId, screenshotId)
        ))
        .limit(1);
      return result.length > 0;
    } catch (error) {
      console.error('Error checking screenshot like status:', error);
      return false;
    }
  }

  async createScreenshotLike(userId: number, screenshotId: number): Promise<any> {
    try {
      const result = await db
        .insert(screenshotLikes)
        .values({ userId, screenshotId })
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating screenshot like:', error);
      throw error;
    }
  }

  async deleteScreenshotLike(userId: number, screenshotId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(screenshotLikes)
        .where(and(
          eq(screenshotLikes.userId, userId),
          eq(screenshotLikes.screenshotId, screenshotId)
        ));
      return true;
    } catch (error) {
      console.error('Error deleting screenshot like:', error);
      return false;
    }
  }

  // Comment Reports operations
  async createCommentReport(reportData: InsertCommentReport): Promise<CommentReport> {
    const [report] = await db.insert(commentReports).values(reportData).returning();
    return report;
  }

  async getCommentReports(status?: string): Promise<CommentReport[]> {
    let query = db.select().from(commentReports);

    if (status) {
      query = query.where(eq(commentReports.status, status)) as any;
    }

    return await query.orderBy(desc(commentReports.createdAt));
  }


  // Check if user has already liked a clip
  async hasUserLikedClip(userId: number, clipId: number): Promise<boolean> {
    const [like] = await db
      .select()
      .from(likes)
      .where(and(
        eq(likes.userId, userId),
        eq(likes.clipId, clipId)
      ));
    return !!like;
  }

  // Notification operations
  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values(notificationData)
      .returning();
    return notification;
  }

  async getNotificationsByUserId(userId: number): Promise<any[]> {
    const results = await db
      .select({
        id: notifications.id,
        userId: notifications.userId,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        isRead: notifications.isRead,
        fromUserId: notifications.fromUserId,
        clipId: notifications.clipId,
        commentId: notifications.commentId,
        actionUrl: notifications.actionUrl,
        createdAt: notifications.createdAt,
        fromUser: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          nftProfileTokenId: users.nftProfileTokenId,
          nftProfileImageUrl: users.nftProfileImageUrl,
          activeProfilePicType: users.activeProfilePicType,
          accentColor: users.accentColor,
          selectedBorderId: users.selectedBorderId,
          isPro: users.isPro,
        }
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.fromUserId, users.id))
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(50);

    return results.map(result => ({
      ...result,
      fromUser: result.fromUser?.id ? result.fromUser : null
    }));
  }

  async getUnreadNotificationsCount(userId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    return result.count;
  }

  async markNotificationAsRead(id: number): Promise<boolean> {
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, id));
      return true;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return false;
    }
  }

  async markAllNotificationsAsRead(userId: number): Promise<boolean> {
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        ));
      return true;
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      return false;
    }
  }

  async deleteNotification(id: number): Promise<boolean> {
    try {
      await db.delete(notifications).where(eq(notifications.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting notification:", error);
      return false;
    }
  }

  async deleteAllNotifications(userId: number): Promise<boolean> {
    try {
      await db.delete(notifications).where(eq(notifications.userId, userId));
      return true;
    } catch (error) {
      console.error("Error deleting all notifications:", error);
      return false;
    }
  }

  async getNotification(id: number): Promise<any> {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id));
    return notification;
  }

  async getFollowRequestByUsers(requesterId: number, addresseeId: number): Promise<any> {
    const [request] = await db
      .select()
      .from(followRequests)
      .where(
        and(
          eq(followRequests.requesterId, requesterId),
          eq(followRequests.addresseeId, addresseeId),
          eq(followRequests.status, 'pending')
        )
      );
    return request;
  }

  // Message operations
  async createMessage(messageData: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(messageData).returning();
    return message;
  }

  async deleteMessage(messageId: number, senderId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(messages)
        .where(and(
          eq(messages.id, messageId),
          eq(messages.senderId, senderId)
        ))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error("Error deleting message:", error);
      return false;
    }
  }

  async deleteConversationHistory(userId1: number, userId2: number): Promise<boolean> {
    try {
      const result = await db
        .delete(messages)
        .where(
          or(
            and(eq(messages.senderId, userId1), eq(messages.receiverId, userId2)),
            and(eq(messages.senderId, userId2), eq(messages.receiverId, userId1))
          )
        )
        .returning();

      return true; // Returns true even if no messages were deleted (empty conversation)
    } catch (error) {
      console.error("Error deleting conversation history:", error);
      return false;
    }
  }

  async getMessagesBetweenUsers(userId1: number, userId2: number): Promise<Message[]> {
    try {
      const messageList = await db
        .select()
        .from(messages)
        .where(
          or(
            and(eq(messages.senderId, userId1), eq(messages.receiverId, userId2)),
            and(eq(messages.senderId, userId2), eq(messages.receiverId, userId1))
          )
        )
        .orderBy(asc(messages.createdAt), asc(messages.id));

      return messageList;
    } catch (error) {
      console.error("Error fetching messages:", error);
      return [];
    }
  }

  async getConversations(userId: number): Promise<any[]> {
    try {
      // Get all unique conversation partners and their latest message time using a subquery approach
      const conversationPartners = await db
        .selectDistinct({
          otherUserId: sql<number>`CASE 
            WHEN ${messages.senderId} = ${userId} THEN ${messages.receiverId}
            ELSE ${messages.senderId}
          END`.as('other_user_id')
        })
        .from(messages)
        .where(
          or(
            eq(messages.senderId, userId),
            eq(messages.receiverId, userId)
          )
        );

      const conversations = [];

      for (const partner of conversationPartners) {
        // Get the latest message for this conversation
        const [lastMessage] = await db
          .select()
          .from(messages)
          .where(
            or(
              and(eq(messages.senderId, userId), eq(messages.receiverId, partner.otherUserId)),
              and(eq(messages.senderId, partner.otherUserId), eq(messages.receiverId, userId))
            )
          )
          .orderBy(desc(messages.createdAt), desc(messages.id))
          .limit(1);

        // Get the other user's details
        const [otherUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, partner.otherUserId));

        // Count unread messages from this user
        const [unreadCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(
            and(
              eq(messages.senderId, partner.otherUserId),
              eq(messages.receiverId, userId),
              eq(messages.isRead, false)
            )
          );

        if (otherUser && lastMessage) {
          conversations.push({
            userId: partner.otherUserId,
            user: {
              id: otherUser.id,
              username: otherUser.username,
              displayName: otherUser.displayName,
              avatarUrl: otherUser.avatarUrl,
              nftProfileTokenId: otherUser.nftProfileTokenId,
              nftProfileImageUrl: otherUser.nftProfileImageUrl,
              activeProfilePicType: otherUser.activeProfilePicType
            },
            lastMessage: {
              id: lastMessage.id,
              content: lastMessage.content,
              createdAt: lastMessage.createdAt,
              senderId: lastMessage.senderId,
              receiverId: lastMessage.receiverId,
              isRead: lastMessage.isRead
            },
            unreadCount: unreadCount.count || 0
          });
        }
      }

      // Sort by latest message time (most recent first)
      conversations.sort((a, b) => 
        new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
      );

      return conversations;
    } catch (error) {
      console.error("Error fetching conversations:", error);
      return [];
    }
  }

  async markMessagesAsRead(currentUserId: number, otherUserId: number): Promise<void> {
    try {
      await db
        .update(messages)
        .set({ isRead: true })
        .where(
          and(
            eq(messages.receiverId, currentUserId),
            eq(messages.senderId, otherUserId),
            eq(messages.isRead, false)
          )
        );
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  }

  // User blocking operations
  async blockUser(userId: number, blockedUserId: number): Promise<UserBlock> {
    try {
      const [block] = await db
        .insert(userBlocks)
        .values({ blockerId: userId, blockedId: blockedUserId, createdAt: new Date() })
        .returning();
      return block;
    } catch (error) {
      console.error("Error blocking user:", error);
      throw error;
    }
  }

  async unblockUser(userId: number, blockedUserId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(userBlocks)
        .where(
          and(
            eq(userBlocks.blockerId, userId),
            eq(userBlocks.blockedId, blockedUserId)
          )
        )
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error("Error unblocking user:", error);
      return false;
    }
  }

  async getBlockedUsers(userId: number): Promise<User[]> {
    try {
      console.log(`Fetching blocked users for user ID: ${userId}`);

      const blockedUsersData = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          email: users.email,
          password: users.password,
          emailVerified: users.emailVerified,
          bannerUrl: users.bannerUrl,
          bio: users.bio,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt
        })
        .from(userBlocks)
        .innerJoin(users, eq(userBlocks.blockedId, users.id))
        .where(eq(userBlocks.blockerId, userId));

      console.log(`Found ${blockedUsersData.length} blocked users for user ${userId}:`, blockedUsersData);
      return blockedUsersData as any;
    } catch (error) {
      console.error('Error fetching blocked users:', error);
      return [];
    }
  }

  async isUserBlocked(userId1: number, userId2: number): Promise<boolean> {
    try {
      const block = await db
        .select()
        .from(userBlocks)
        .where(
          or(
            and(eq(userBlocks.blockerId, userId1), eq(userBlocks.blockedId, userId2)),
            and(eq(userBlocks.blockerId, userId2), eq(userBlocks.blockedId, userId1))
          )
        )
        .limit(1);

      return block.length > 0;
    } catch (error) {
      console.error("Error checking if user is blocked:", error);
      return false;
    }
  }

  // Extended trending methods for comprehensive trending page
  async getTrendingClipsByLikes(period: string = 'recent', limit: number = 10, gameId?: number): Promise<ClipWithUser[]> {
    let dateFilter: Date | null;
    const now = new Date();

    switch (period) {
      case '1d':
      case 'day':
      case 'today':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
      case '1w':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      case '1m':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'ever':
      case 'all':
        dateFilter = new Date(0);
        break;
      case 'recent':
      default:
        dateFilter = null;
    }

    // Get clips ordered by likes count
    const clipLikesQuery = db
      .select({
        clipId: clips.id,
        likesCount: sql<number>`cast(count(distinct ${likes.id}) as integer)`.as('likesCount')
      })
      .from(clips)
      .leftJoin(likes, eq(clips.id, likes.clipId))
      .where(
        and(
          dateFilter ? gt(clips.createdAt, dateFilter) : undefined,
          eq(clips.videoType, 'clip'),
          gameId ? eq(clips.gameId, gameId) : undefined
        )
      )
      .groupBy(clips.id)
      .orderBy(sql`likesCount desc`, desc(clips.createdAt), desc(clips.id))
      .limit(limit);

    const likesResults = await clipLikesQuery;

    const clipsWithDetails: ClipWithUser[] = [];
    for (const result of likesResults) {
      const clipWithUser = await this.getClipWithUser(result.clipId);
      if (clipWithUser) {
        clipsWithDetails.push(clipWithUser);
      }
    }

    return clipsWithDetails;
  }

  async getTrendingClipsByComments(period: string = 'recent', limit: number = 10, gameId?: number): Promise<ClipWithUser[]> {
    let dateFilter: Date | null;
    const now = new Date();

    switch (period) {
      case '1d':
      case 'day':
      case 'today':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
      case '1w':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      case '1m':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'ever':
      case 'all':
        dateFilter = new Date(0);
        break;
      case 'recent':
      default:
        dateFilter = null;
    }

    // Get clips ordered by comments count
    const clipCommentsQuery = db
      .select({
        clipId: clips.id,
        commentsCount: sql<number>`cast(count(distinct ${comments.id}) as integer)`.as('commentsCount')
      })
      .from(clips)
      .leftJoin(comments, eq(clips.id, comments.clipId))
      .where(
        and(
          dateFilter ? gt(clips.createdAt, dateFilter) : undefined,
          eq(clips.videoType, 'clip'),
          gameId ? eq(clips.gameId, gameId) : undefined
        )
      )
      .groupBy(clips.id)
      .orderBy(sql`commentsCount desc`, desc(clips.createdAt), desc(clips.id))
      .limit(limit);

    const commentsResults = await clipCommentsQuery;

    const clipsWithDetails: ClipWithUser[] = [];
    for (const result of commentsResults) {
      const clipWithUser = await this.getClipWithUser(result.clipId);
      if (clipWithUser) {
        clipsWithDetails.push(clipWithUser);
      }
    }

    return clipsWithDetails;
  }

  async getTrendingReelsByLikes(period: string = 'recent', limit: number = 10, gameId?: number): Promise<ClipWithUser[]> {
    let dateFilter: Date | null;
    const now = new Date();

    switch (period) {
      case '1d':
      case 'day':
      case 'today':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
      case '1w':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      case '1m':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'ever':
      case 'all':
        dateFilter = new Date(0);
        break;
      case 'recent':
      default:
        dateFilter = null;
    }

    // Get reels ordered by likes count
    const reelLikesQuery = db
      .select({
        clipId: clips.id,
        likesCount: sql<number>`cast(count(distinct ${likes.id}) as integer)`.as('likesCount')
      })
      .from(clips)
      .leftJoin(likes, eq(clips.id, likes.clipId))
      .where(
        and(
          dateFilter ? gt(clips.createdAt, dateFilter) : undefined,
          eq(clips.videoType, 'reel'),
          gameId ? eq(clips.gameId, gameId) : undefined
        )
      )
      .groupBy(clips.id)
      .orderBy(sql`likesCount desc`, desc(clips.createdAt), desc(clips.id))
      .limit(limit);

    const likesResults = await reelLikesQuery;

    const clipsWithDetails: ClipWithUser[] = [];
    for (const result of likesResults) {
      const clipWithUser = await this.getClipWithUser(result.clipId);
      if (clipWithUser) {
        clipsWithDetails.push(clipWithUser);
      }
    }

    return clipsWithDetails;
  }

  async getTrendingReelsByComments(period: string = 'recent', limit: number = 10, gameId?: number): Promise<ClipWithUser[]> {
    let dateFilter: Date | null;
    const now = new Date();

    switch (period) {
      case '1d':
      case 'day':
      case 'today':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
      case '1w':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      case '1m':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'ever':
      case 'all':
        dateFilter = new Date(0);
        break;
      case 'recent':
      default:
        dateFilter = null;
    }

    // Get reels ordered by comments count
    const reelCommentsQuery = db
      .select({
        clipId: clips.id,
        commentsCount: sql<number>`cast(count(distinct ${comments.id}) as integer)`.as('commentsCount')
      })
      .from(clips)
      .leftJoin(comments, eq(clips.id, comments.clipId))
      .where(
        and(
          dateFilter ? gt(clips.createdAt, dateFilter) : undefined,
          eq(clips.videoType, 'reel'),
          gameId ? eq(clips.gameId, gameId) : undefined
        )
      )
      .groupBy(clips.id)
      .orderBy(sql`commentsCount desc`, desc(clips.createdAt), desc(clips.id))
      .limit(limit);

    const commentsResults = await reelCommentsQuery;

    const clipsWithDetails: ClipWithUser[] = [];
    for (const result of commentsResults) {
      const clipWithUser = await this.getClipWithUser(result.clipId);
      if (clipWithUser) {
        clipsWithDetails.push(clipWithUser);
      }
    }

    return clipsWithDetails;
  }

  // Extended screenshot type with user and game information
  async getScreenshotWithUser(screenshotId: number): Promise<(Screenshot & { user: User; game?: Game }) | undefined> {
    const result = await db
      .select()
      .from(screenshots)
      .leftJoin(users, eq(screenshots.userId, users.id))
      .leftJoin(games, eq(screenshots.gameId, games.id))
      .where(eq(screenshots.id, screenshotId))
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0];
    return {
      ...row.screenshots,
      user: row.users?.id ? { ...row.users } : null,
      game: row.games?.id ? { ...row.games } : null
    };
  }

  async getTrendingScreenshots(period: string = 'recent', limit: number = 10, gameId?: number): Promise<(Screenshot & { user: User; game?: Game })[]> {
    let dateFilter: Date | null;
    const now = new Date();

    switch (period) {
      case '1d':
      case 'day':
      case 'today':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
      case '1w':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      case '1m':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'ever':
      case 'all':
        dateFilter = new Date(0);
        break;
      case 'recent':
      default:
        dateFilter = null;
    }

    const screenshotsQuery = db
      .select({
        screenshot: screenshots,
        user: users,
        game: games,
        likesCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${screenshotLikes} WHERE ${screenshotLikes.screenshotId} = ${screenshots.id}), 0)`,
        reactionsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${screenshotReactions} WHERE ${screenshotReactions.screenshotId} = ${screenshots.id}), 0)`,
        commentsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${screenshotComments} WHERE ${screenshotComments.screenshotId} = ${screenshots.id}), 0)`
      })
      .from(screenshots)
      .leftJoin(users, eq(screenshots.userId, users.id))
      .leftJoin(games, eq(screenshots.gameId, games.id))
      .where(
        and(
          dateFilter ? gt(screenshots.createdAt, dateFilter) : undefined,
          gameId ? eq(screenshots.gameId, gameId) : undefined
        )
      )
      .orderBy(desc(screenshots.views), desc(screenshots.createdAt), desc(screenshots.id))
      .limit(limit);

    const results = await screenshotsQuery;

    return results.map(row => ({
      ...row.screenshot,
      user: row.user?.id ? { ...row.user } : null,
      game: row.game?.id ? { ...row.game } : null,
      _count: {
        likes: Number(row.likesCount) || 0,
        reactions: Number(row.reactionsCount) || 0,
        comments: Number(row.commentsCount) || 0
      }
    })) as any;
  }

  // Badge definition operations
  async createBadge(badgeData: InsertBadge): Promise<Badge> {
    const [badge] = await db.insert(badges).values(badgeData).returning();
    return badge;
  }

  async getAllBadges(): Promise<Badge[]> {
    return db.select().from(badges).orderBy(desc(badges.createdAt));
  }

  async getActiveBadges(): Promise<Badge[]> {
    return db.select().from(badges)
      .where(eq(badges.isActive, true))
      .orderBy(asc(badges.name));
  }

  async getBadge(id: number): Promise<Badge | null> {
    const [badge] = await db.select().from(badges).where(eq(badges.id, id));
    return badge || null;
  }

  async getBadgeByName(name: string): Promise<Badge | null> {
    const [badge] = await db.select().from(badges).where(eq(badges.name, name));
    return badge || null;
  }

  async updateBadge(id: number, badgeData: Partial<Badge>): Promise<Badge | null> {
    try {
      const [updatedBadge] = await db
        .update(badges)
        .set({ ...badgeData, updatedAt: new Date() })
        .where(eq(badges.id, id))
        .returning();
      return updatedBadge;
    } catch (error) {
      console.error("Error updating badge:", error);
      return null;
    }
  }

  async deleteBadge(id: number): Promise<boolean> {
    try {
      // Check if badge is in use
      const badgeInUse = await db.select().from(userBadges).where(eq(userBadges.badgeId, id)).limit(1);
      if (badgeInUse.length > 0) {
        console.log(`Cannot delete badge ${id}: still in use by users`);
        return false;
      }

      const result = await db.delete(badges).where(eq(badges.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting badge:", error);
      return false;
    }
  }

  async getBadgesWithStats(): Promise<BadgeWithStats[]> {
    try {
      const allBadges = await this.getAllBadges();
      const badgesWithStats: BadgeWithStats[] = [];

      for (const badge of allBadges) {
        const userCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(userBadges)
          .where(eq(userBadges.badgeId, badge.id));

        badgesWithStats.push({
          ...badge,
          _count: {
            users: Number(userCount[0]?.count || 0)
          }
        });
      }

      return badgesWithStats;
    } catch (error) {
      console.error("Error getting badges with stats:", error);
      return [];
    }
  }

  // User badge operations
  async createUserBadge(badge: InsertUserBadge): Promise<UserBadge> {
    const [userBadge] = await db.insert(userBadges).values(badge).returning();
    return userBadge;
  }

  async getUserBadges(userId: number): Promise<UserBadge[]> {
    return await db
      .select()
      .from(userBadges)
      .where(eq(userBadges.userId, userId))
      .orderBy(desc(userBadges.createdAt));
  }

  async deleteBadgesByType(userId: number, badgeType: string): Promise<boolean> {
    const result = await db
      .delete(userBadges)
      .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeType, badgeType)));
    return Array.isArray(result) ? result.length > 0 : (result as any).count > 0;
  }

  async deleteUserBadge(badgeId: number): Promise<boolean> {
    const result = await db.delete(userBadges).where(eq(userBadges.id, badgeId));
    return Array.isArray(result) ? result.length > 0 : (result as any).count > 0;
  }

  async cleanupExpiredBadges(): Promise<void> {
    await db
      .delete(userBadges)
      .where(and(
        sql`expires_at IS NOT NULL`,
        lt(userBadges.expiresAt, new Date())
      ));
  }

  async updateUserLoginTime(userId: number, additionalMinutes: number): Promise<void> {
    await db
      .update(users)
      .set({ 
        totalLoginTime: sql`${users.totalLoginTime} + ${additionalMinutes}`,
        lastLoginAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async processNewcomerBadge(userId: number): Promise<void> {
    // Get user's current login time
    const [user] = await db.select({ totalLoginTime: users.totalLoginTime })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) return;

    const totalHours = user.totalLoginTime / 60;

    // Check if user has newcomer badge
    const [existingBadge] = await db
      .select()
      .from(userBadges)
      .where(and(
        eq(userBadges.userId, userId),
        eq(userBadges.badgeType, 'newcomer')
      ));

    if (totalHours < 24) {
      // User should have newcomer badge
      if (!existingBadge) {
        await this.createUserBadge({
          userId,
          badgeType: 'newcomer',
          assignedBy: 'system',
          expiresAt: new Date(Date.now() + (24 - totalHours) * 60 * 60 * 1000) // Expires when user reaches 24 hours
        });
      }
    } else {
      // User should not have newcomer badge anymore
      if (existingBadge) {
        await this.deleteUserBadge(existingBadge.id);
      }
    }
  }

  // Leaderboard operations
  async addUserPointsHistory(pointsHistory: InsertUserPointsHistory): Promise<UserPointsHistory> {
    const [points] = await db.insert(userPointsHistory).values(pointsHistory).returning();
    return points;
  }

  async deleteHistoricMigrationPoints(): Promise<void> {
    // Delete all points history entries with "Historic Migration" in description
    await db.delete(userPointsHistory).where(
      sql`${userPointsHistory.description} LIKE '%Historic Migration%'`
    );
    console.log('🗑️ Deleted historic migration points from user_points_history');
  }

  async rebuildLeaderboards(): Promise<void> {
    // Clear all monthly and weekly leaderboard entries
    await db.delete(monthlyLeaderboard);
    await db.delete(weeklyLeaderboard);
    console.log('🗑️ Cleared all leaderboard entries');
    
    // Rebuild from remaining points history
    const pointsRecords = await db.select().from(userPointsHistory).orderBy(userPointsHistory.createdAt);
    
    console.log(`📊 Rebuilding leaderboards from ${pointsRecords.length} points records...`);
    
    // Aggregate data by user+period FIRST to avoid duplicates
    const monthlyData = new Map<string, InsertMonthlyLeaderboard>();
    const weeklyData = new Map<string, InsertWeeklyLeaderboard>();
    
    for (const record of pointsRecords) {
      const timestamp = new Date(record.createdAt);
      const month = String(timestamp.getMonth() + 1).padStart(2, '0');
      const year = timestamp.getFullYear();
      const monthKey = `${year}-${month}`;
      
      // Calculate week using ISO week calculation
      const startOfYear = new Date(timestamp.getFullYear(), 0, 1);
      const days = Math.floor((timestamp.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      const week = `${year}-W${String(weekNumber).padStart(2, '0')}`;
      
      // Aggregate monthly data
      const monthMapKey = `${record.userId}-${monthKey}-${year}`;
      const existing = monthlyData.get(monthMapKey) || {
        userId: record.userId,
        month: monthKey,
        year,
        uploadsCount: 0,
        likesGivenCount: 0,
        commentsCount: 0,
        firesGivenCount: 0,
        viewsCount: 0,
        totalPoints: 0,
      };
      
      existing.uploadsCount = (existing.uploadsCount || 0) + (record.action === 'upload' ? 1 : 0);
      existing.likesGivenCount = (existing.likesGivenCount || 0) + (record.action === 'like' ? 1 : 0);
      existing.commentsCount = (existing.commentsCount || 0) + (record.action === 'comment' ? 1 : 0);
      existing.firesGivenCount = (existing.firesGivenCount || 0) + (record.action === 'fire' ? 1 : 0);
      existing.viewsCount = (existing.viewsCount || 0) + (record.action === 'view' ? 1 : 0);
      existing.totalPoints = (existing.totalPoints || 0) + record.points;
      
      monthlyData.set(monthMapKey, existing);
      
      // Aggregate weekly data
      const weekMapKey = `${record.userId}-${week}-${year}`;
      const existingWeek = weeklyData.get(weekMapKey) || {
        userId: record.userId,
        week,
        year,
        uploadsCount: 0,
        likesGivenCount: 0,
        commentsCount: 0,
        firesGivenCount: 0,
        viewsCount: 0,
        totalPoints: 0,
      };
      
      existingWeek.uploadsCount = (existingWeek.uploadsCount || 0) + (record.action === 'upload' ? 1 : 0);
      existingWeek.likesGivenCount = (existingWeek.likesGivenCount || 0) + (record.action === 'like' ? 1 : 0);
      existingWeek.commentsCount = (existingWeek.commentsCount || 0) + (record.action === 'comment' ? 1 : 0);
      existingWeek.firesGivenCount = (existingWeek.firesGivenCount || 0) + (record.action === 'fire' ? 1 : 0);
      existingWeek.viewsCount = (existingWeek.viewsCount || 0) + (record.action === 'view' ? 1 : 0);
      existingWeek.totalPoints = (existingWeek.totalPoints || 0) + record.points;
      
      weeklyData.set(weekMapKey, existingWeek);
    }
    
    // Insert aggregated monthly data using upsert to handle conflicts
    console.log(`📊 Inserting ${monthlyData.size} monthly leaderboard entries...`);
    for (const entry of Array.from(monthlyData.values())) {
      await db.insert(monthlyLeaderboard)
        .values(entry)
        .onConflictDoUpdate({
          target: [monthlyLeaderboard.userId, monthlyLeaderboard.month, monthlyLeaderboard.year],
          set: {
            uploadsCount: sql`${monthlyLeaderboard.uploadsCount} + ${entry.uploadsCount}`,
            likesGivenCount: sql`${monthlyLeaderboard.likesGivenCount} + ${entry.likesGivenCount}`,
            commentsCount: sql`${monthlyLeaderboard.commentsCount} + ${entry.commentsCount}`,
            firesGivenCount: sql`${monthlyLeaderboard.firesGivenCount} + ${entry.firesGivenCount}`,
            viewsCount: sql`${monthlyLeaderboard.viewsCount} + ${entry.viewsCount}`,
            totalPoints: sql`${monthlyLeaderboard.totalPoints} + ${entry.totalPoints}`,
          }
        });
    }
    
    // Insert aggregated weekly data using upsert to handle conflicts
    console.log(`📊 Inserting ${weeklyData.size} weekly leaderboard entries...`);
    for (const entry of Array.from(weeklyData.values())) {
      await db.insert(weeklyLeaderboard)
        .values(entry)
        .onConflictDoUpdate({
          target: [weeklyLeaderboard.userId, weeklyLeaderboard.week, weeklyLeaderboard.year],
          set: {
            uploadsCount: sql`${weeklyLeaderboard.uploadsCount} + ${entry.uploadsCount}`,
            likesGivenCount: sql`${weeklyLeaderboard.likesGivenCount} + ${entry.likesGivenCount}`,
            commentsCount: sql`${weeklyLeaderboard.commentsCount} + ${entry.commentsCount}`,
            firesGivenCount: sql`${weeklyLeaderboard.firesGivenCount} + ${entry.firesGivenCount}`,
            viewsCount: sql`${weeklyLeaderboard.viewsCount} + ${entry.viewsCount}`,
            totalPoints: sql`${weeklyLeaderboard.totalPoints} + ${entry.totalPoints}`,
          }
        });
    }
    
    // Recalculate all rankings
    const months = await db.selectDistinct({ month: monthlyLeaderboard.month, year: monthlyLeaderboard.year }).from(monthlyLeaderboard);
    for (const { month, year } of months) {
      await this.recalculateMonthlyRankings(month, year);
    }
    
    const weeks = await db.selectDistinct({ week: weeklyLeaderboard.week, year: weeklyLeaderboard.year }).from(weeklyLeaderboard);
    for (const { week, year } of weeks) {
      await this.recalculateWeeklyRankings(week, year);
    }
    
    console.log('✅ Leaderboards rebuilt successfully');
  }

  async getMonthlyLeaderboardEntry(userId: number, month: string, year: number): Promise<MonthlyLeaderboard | undefined> {
    const [entry] = await db
      .select()
      .from(monthlyLeaderboard)
      .where(and(
        eq(monthlyLeaderboard.userId, userId),
        eq(monthlyLeaderboard.month, month),
        eq(monthlyLeaderboard.year, year)
      ));
    return entry || null;
  }

  async createMonthlyLeaderboardEntry(entry: InsertMonthlyLeaderboard): Promise<MonthlyLeaderboard> {
    const [leaderboardEntry] = await db.insert(monthlyLeaderboard).values(entry).returning();
    return leaderboardEntry;
  }

  async updateMonthlyLeaderboardEntry(id: number, updates: Partial<MonthlyLeaderboard>): Promise<MonthlyLeaderboard | undefined> {
    const [updatedEntry] = await db
      .update(monthlyLeaderboard)
      .set(updates)
      .where(eq(monthlyLeaderboard.id, id))
      .returning();
    return updatedEntry;
  }

  async getMonthlyLeaderboard(month: string, year: number, limit?: number): Promise<(MonthlyLeaderboard & { user: User })[]> {
    const query = db
      .select()
      .from(monthlyLeaderboard)
      .leftJoin(users, eq(monthlyLeaderboard.userId, users.id))
      .where(and(
        eq(monthlyLeaderboard.month, month),
        eq(monthlyLeaderboard.year, year),
        gt(monthlyLeaderboard.totalPoints, 0)
      ))
      .orderBy(desc(monthlyLeaderboard.totalPoints));

    if (limit) {
      query.limit(limit);
    }

    const results = await query;
    return results.map(row => ({
      ...row.monthly_leaderboard,
      user: row.users!
    }));
  }

  async recalculateMonthlyRankings(month: string, year: number): Promise<void> {
    // Get all entries for the month sorted by total points
    const entries = await db
      .select()
      .from(monthlyLeaderboard)
      .where(and(
        eq(monthlyLeaderboard.month, month),
        eq(monthlyLeaderboard.year, year)
      ))
      .orderBy(desc(monthlyLeaderboard.totalPoints));

    // Update rankings
    for (let i = 0; i < entries.length; i++) {
      await db
        .update(monthlyLeaderboard)
        .set({ rank: i + 1 })
        .where(eq(monthlyLeaderboard.id, entries[i].id));
    }
  }

  async getAllTimeLeaderboard(limit: number = 10): Promise<Array<{
    userId: number;
    uploadsCount: number;
    likesGivenCount: number;
    commentsCount: number;
    firesGivenCount: number;
    viewsCount: number;
    totalPoints: number;
    rank: number;
    user: User;
  }>> {
    // Aggregate all monthly leaderboard data by user
    const aggregated = await db
      .select({
        userId: monthlyLeaderboard.userId,
        uploadsCount: sql<number>`CAST(SUM(${monthlyLeaderboard.uploadsCount}) AS INTEGER)`,
        likesGivenCount: sql<number>`CAST(SUM(${monthlyLeaderboard.likesGivenCount}) AS INTEGER)`,
        commentsCount: sql<number>`CAST(SUM(${monthlyLeaderboard.commentsCount}) AS INTEGER)`,
        firesGivenCount: sql<number>`CAST(SUM(${monthlyLeaderboard.firesGivenCount}) AS INTEGER)`,
        viewsCount: sql<number>`CAST(SUM(${monthlyLeaderboard.viewsCount}) AS INTEGER)`,
        totalPoints: sql<number>`CAST(SUM(${monthlyLeaderboard.totalPoints}) AS INTEGER)`,
      })
      .from(monthlyLeaderboard)
      .groupBy(monthlyLeaderboard.userId)
      .having(sql`SUM(${monthlyLeaderboard.totalPoints}) > 0`)
      .orderBy(desc(sql`SUM(${monthlyLeaderboard.totalPoints})`))
      .limit(limit);

    // Get user details for each entry
    const results = await Promise.all(
      aggregated.map(async (entry, index) => {
        const user = await this.getUser(entry.userId);
        return {
          ...entry,
          rank: index + 1,
          user: user!
        };
      })
    );

    return results;
  }

  // Weekly leaderboard operations
  async getWeeklyLeaderboardEntry(userId: number, week: string, year: number): Promise<WeeklyLeaderboard | null> {
    const [entry] = await db
      .select()
      .from(weeklyLeaderboard)
      .where(and(
        eq(weeklyLeaderboard.userId, userId),
        eq(weeklyLeaderboard.week, week),
        eq(weeklyLeaderboard.year, year)
      ));
    return entry || null;
  }

  async createWeeklyLeaderboardEntry(entry: InsertWeeklyLeaderboard): Promise<WeeklyLeaderboard> {
    const [leaderboardEntry] = await db.insert(weeklyLeaderboard).values(entry).returning();
    return leaderboardEntry;
  }

  async updateWeeklyLeaderboardEntry(id: number, updates: Partial<WeeklyLeaderboard>): Promise<WeeklyLeaderboard | null> {
    const [updatedEntry] = await db
      .update(weeklyLeaderboard)
      .set(updates)
      .where(eq(weeklyLeaderboard.id, id))
      .returning();
    return updatedEntry || null;
  }

  async getWeeklyLeaderboard(week: string, year: number, limit?: number): Promise<(WeeklyLeaderboard & { user: User })[]> {
    const query = db
      .select()
      .from(weeklyLeaderboard)
      .leftJoin(users, eq(weeklyLeaderboard.userId, users.id))
      .where(and(
        eq(weeklyLeaderboard.week, week),
        eq(weeklyLeaderboard.year, year),
        gt(weeklyLeaderboard.totalPoints, 0)
      ))
      .orderBy(desc(weeklyLeaderboard.totalPoints));

    if (limit) {
      query.limit(limit);
    }

    const results = await query;
    return results.map(row => ({
      ...row.weekly_leaderboard,
      user: row.users!
    }));
  }

  async recalculateWeeklyRankings(week: string, year: number): Promise<void> {
    // Get all entries for the week sorted by total points
    const entries = await db
      .select()
      .from(weeklyLeaderboard)
      .where(and(
        eq(weeklyLeaderboard.week, week),
        eq(weeklyLeaderboard.year, year)
      ))
      .orderBy(desc(weeklyLeaderboard.totalPoints));

    // Update rankings
    for (let i = 0; i < entries.length; i++) {
      await db
        .update(weeklyLeaderboard)
        .set({ rank: i + 1 })
        .where(eq(weeklyLeaderboard.id, entries[i].id));
    }
  }

  // Top contributors operations
  async createTopContributor(contributor: InsertTopContributor): Promise<TopContributor> {
    const [topContributor] = await db.insert(topContributors).values(contributor).returning();
    return topContributor;
  }

  async getTopContributors(periodType: string, limit?: number): Promise<(TopContributor & { user: User })[]> {
    const query = db
      .select()
      .from(topContributors)
      .leftJoin(users, eq(topContributors.userId, users.id))
      .where(eq(topContributors.periodType, periodType))
      .orderBy(desc(topContributors.totalPoints));

    if (limit) {
      query.limit(limit);
    }

    const results = await query;
    return results.map(row => ({
      ...row.top_contributors,
      user: row.users!
    }));
  }

  async getTopContributorsByPeriod(periodType: string, period: string, year: number): Promise<(TopContributor & { user: User })[]> {
    const results = await db
      .select()
      .from(topContributors)
      .leftJoin(users, eq(topContributors.userId, users.id))
      .where(and(
        eq(topContributors.periodType, periodType),
        eq(topContributors.period, period),
        eq(topContributors.year, year)
      ))
      .orderBy(desc(topContributors.totalPoints));

    return results.map(row => ({
      ...row.top_contributors,
      user: row.users!
    }));
  }

  // XP operations
  async addUserXPHistory(xpHistory: InsertUserXPHistory): Promise<UserXPHistory> {
    const [xp] = await db.insert(userXPHistory).values(xpHistory).returning();
    return xp;
  }

  async incrementUserXP(userId: number, xpAmount: number): Promise<void> {
    await db
      .update(users)
      .set({ totalXP: sql`${users.totalXP} + ${xpAmount}` })
      .where(eq(users.id, userId));
  }

  async getUserXPHistory(userId: number, limit: number = 50): Promise<(UserXPHistory & { clip?: Clip | null })[]> {
    const results = await db
      .select()
      .from(userXPHistory)
      .leftJoin(clips, eq(userXPHistory.clipId, clips.id))
      .where(eq(userXPHistory.userId, userId))
      .orderBy(desc(userXPHistory.createdAt))
      .limit(limit);

    return results.map(row => ({
      ...row.user_xp_history,
      clip: row.clips || null
    }));
  }
  
  // Get user's points history
  async getUserPointsHistory(userId: number, limit: number = 999999): Promise<UserPointsHistory[]> {
    const results = await db
      .select()
      .from(userPointsHistory)
      .where(eq(userPointsHistory.userId, userId))
      .orderBy(desc(userPointsHistory.createdAt))
      .limit(limit);

    return results;
  }

  // Check if user has already earned points for a specific content
  async hasUserEarnedPointsForContent(userId: number, action: string, contentType: string, contentId: number): Promise<boolean> {
    const descriptionPattern = `%${contentType} #${contentId}%`;
    const [result] = await db
      .select()
      .from(userPointsHistory)
      .where(
        and(
          eq(userPointsHistory.userId, userId),
          eq(userPointsHistory.action, action),
          sql`${userPointsHistory.description} LIKE ${descriptionPattern}`
        )
      )
      .limit(1);

    return !!result;
  }

  // Increment user's total points (stored in totalXP field for DB compatibility)
  async incrementUserPoints(userId: number, points: number): Promise<void> {
    await db
      .update(users)
      .set({ totalXP: sql`${users.totalXP} + ${points}` })
      .where(eq(users.id, userId));
  }

  async getXPLeaderboard(limit: number = 10): Promise<Array<{ id: number; username: string; displayName: string; avatarUrl: string | null; totalXP: number }>> {
    const results = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        totalXP: users.totalXP
      })
      .from(users)
      .orderBy(desc(users.totalXP))
      .limit(limit);

    return results;
  }

  async getEngagementLeaderboard(limit: number = 10): Promise<Array<{
    user: User;
    likesReceived: number;
    commentsReceived: number;
    clipsUploaded: number;
    totalScore: number;
    rank: number;
  }>> {
    try {
      // Calculate leaderboard scores using SQL aggregation
      const leaderboardQuery = await db
        .select({
          userId: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          bio: users.bio,
          role: users.role,
          clipsUploaded: sql<number>`cast(count(distinct ${clips.id}) as integer)`.as('clipsUploaded'),
          likesReceived: sql<number>`cast(count(distinct ${likes.id}) as integer)`.as('likesReceived'),
          commentsReceived: sql<number>`cast(count(distinct ${comments.id}) as integer)`.as('commentsReceived'),
          totalScore: sql<number>`cast(count(distinct ${clips.id}) + count(distinct ${likes.id}) + count(distinct ${comments.id}) as integer)`.as('totalScore')
        })
        .from(users)
        .leftJoin(clips, eq(users.id, clips.userId))
        .leftJoin(likes, eq(clips.id, likes.clipId))
        .leftJoin(comments, eq(clips.id, comments.clipId))
        .groupBy(users.id, users.username, users.displayName, users.avatarUrl, users.bio, users.role)
        .orderBy(sql`cast(count(distinct ${clips.id}) + count(distinct ${likes.id}) + count(distinct ${comments.id}) as integer) DESC`)
        .limit(limit);

      // Add ranking to results
      const results = leaderboardQuery.map((row, index) => ({
        user: {
          id: row.userId,
          username: row.username,
          displayName: row.displayName,
          avatarUrl: row.avatarUrl,
          bio: row.bio,
          role: row.role,
        } as User,
        likesReceived: row.likesReceived,
        commentsReceived: row.commentsReceived,
        clipsUploaded: row.clipsUploaded,
        totalScore: row.totalScore,
        rank: index + 1,
      }));

      return results;
    } catch (error) {
      console.error("Error fetching engagement leaderboard:", error);
      return [];
    }
  }

  // Content filtering operations
  async getContentFilterSettings(fieldName?: string): Promise<ContentFilterSettings[]> {
    const query = db.select().from(contentFilterSettings);

    if (fieldName) {
      return await query.where(eq(contentFilterSettings.fieldName, fieldName));
    }

    return await query;
  }

  async updateContentFilterSettings(fieldName: string, updates: Partial<ContentFilterSettings>): Promise<ContentFilterSettings | undefined> {
    const [updated] = await db
      .update(contentFilterSettings)
      .set(updates)
      .where(eq(contentFilterSettings.fieldName, fieldName))
      .returning();

    return updated;
  }

  async createContentFilterSettings(settings: InsertContentFilterSettings): Promise<ContentFilterSettings> {
    const [created] = await db.insert(contentFilterSettings).values(settings).returning();
    return created;
  }

  // Banned words operations
  async getAllBannedWords(): Promise<BannedWord[]> {
    return await db.select().from(bannedWords).orderBy(asc(bannedWords.word));
  }

  async getActiveBannedWords(): Promise<BannedWord[]> {
    return await db
      .select()
      .from(bannedWords)
      .where(eq(bannedWords.isActive, true))
      .orderBy(asc(bannedWords.word));
  }

  async addBannedWord(word: InsertBannedWord): Promise<BannedWord> {
    const [created] = await db.insert(bannedWords).values({
      ...word,
      word: word.word.toLowerCase() // Store words in lowercase for consistent filtering
    }).returning();
    return created;
  }

  async removeBannedWord(word: string): Promise<boolean> {
    const result = await db
      .delete(bannedWords)
      .where(eq(bannedWords.word, word.toLowerCase()));
    return Array.isArray(result) ? result.length > 0 : (result as any).count > 0;
  }

  async deactivateBannedWord(word: string): Promise<boolean> {
    const [updated] = await db
      .update(bannedWords)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(bannedWords.word, word.toLowerCase()))
      .returning();
    return !!updated;
  }

  async reactivateBannedWord(word: string): Promise<boolean> {
    const [updated] = await db
      .update(bannedWords)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(bannedWords.word, word.toLowerCase()))
      .returning();
    return !!updated;
  }

  async getBannedWord(word: string): Promise<BannedWord | null> {
    const [found] = await db
      .select()
      .from(bannedWords)
      .where(eq(bannedWords.word, word.toLowerCase()));
    return found || null;
  }

  // Content reporting operations
  async createClipReport(report: InsertClipReport): Promise<ClipReport> {
    const [created] = await db.insert(clipReports).values(report).returning();
    return created;
  }

  async createScreenshotReport(report: InsertScreenshotReport): Promise<ScreenshotReport> {
    const [created] = await db.insert(screenshotReports).values(report).returning();
    return created;
  }

  async getClipReportsByClipId(clipId: number): Promise<ClipReport[]> {
    return await db
      .select()
      .from(clipReports)
      .where(eq(clipReports.clipId, clipId))
      .orderBy(desc(clipReports.createdAt), desc(clipReports.id));
  }

  async getScreenshotReportsByScreenshotId(screenshotId: number): Promise<ScreenshotReport[]> {
    return await db
      .select()
      .from(screenshotReports)
      .where(eq(screenshotReports.screenshotId, screenshotId))
      .orderBy(desc(screenshotReports.createdAt), desc(screenshotReports.id));
  }

  async getAllReports(status?: string): Promise<(ClipReport | ScreenshotReport | CommentReport)[]> {
    const clipReportsQuery = db.select().from(clipReports);
    const screenshotReportsQuery = db.select().from(screenshotReports);
    const commentReportsQuery = db.select().from(commentReports);

    if (status) {
      clipReportsQuery.where(eq(clipReports.status, status));
      screenshotReportsQuery.where(eq(screenshotReports.status, status));
      commentReportsQuery.where(eq(commentReports.status, status));
    }

    const [clipResults, screenshotResults, commentResults] = await Promise.all([
      clipReportsQuery.orderBy(desc(clipReports.createdAt), desc(clipReports.id)),
      screenshotReportsQuery.orderBy(desc(screenshotReports.createdAt), desc(screenshotReports.id)),
      commentReportsQuery.orderBy(desc(commentReports.createdAt), desc(commentReports.id))
    ]);

    return [...clipResults, ...screenshotResults, ...commentResults]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateClipReportStatus(id: number, status: string, reviewedBy?: number): Promise<ClipReport | undefined> {
    const [updated] = await db
      .update(clipReports)
      .set({ 
        status, 
        reviewedBy,
        reviewedAt: new Date() 
      })
      .where(eq(clipReports.id, id))
      .returning();
    return updated;
  }

  async updateScreenshotReportStatus(id: number, status: string, reviewedBy?: number): Promise<ScreenshotReport | undefined> {
    const [updated] = await db
      .update(screenshotReports)
      .set({ 
        status, 
        reviewedBy,
        reviewedAt: new Date() 
      })
      .where(eq(screenshotReports.id, id))
      .returning();
    return updated;
  }

  async updateCommentReportStatus(id: number, status: string, reviewedBy?: number): Promise<CommentReport | undefined> {
    const [updated] = await db
      .update(commentReports)
      .set({ 
        status, 
        reviewedBy,
        reviewedAt: new Date() 
      })
      .where(eq(commentReports.id, id))
      .returning();
    return updated;
  }

  // Hero text settings operations
  async getHeroTextSettings(textType: string): Promise<HeroTextSettings | null> {
    const [result] = await db
      .select()
      .from(heroTextSettings)
      .where(and(eq(heroTextSettings.textType, textType), eq(heroTextSettings.isActive, true)))
      .limit(1);
    return result || null;
  }

  async updateHeroTextSettings(textType: string, settings: { title: string; subtitle: string; updatedBy: number }): Promise<HeroTextSettings> {
    // First check if settings exist
    const existing = await this.getHeroTextSettings(textType);
    
    if (existing) {
      // Update existing settings
      const [updated] = await db
        .update(heroTextSettings)
        .set({
          title: settings.title,
          subtitle: settings.subtitle,
          updatedBy: settings.updatedBy,
          updatedAt: new Date()
        })
        .where(eq(heroTextSettings.textType, textType))
        .returning();
      return updated;
    } else {
      // Create new settings
      const [created] = await db
        .insert(heroTextSettings)
        .values({
          textType,
          title: settings.title,
          subtitle: settings.subtitle,
          updatedBy: settings.updatedBy,
          isActive: true
        })
        .returning();
      return created;
    }
  }

  // NFT Watchlist operations
  async addToNftWatchlist(watchlistData: InsertNftWatchlist): Promise<NftWatchlist> {
    const [result] = await db
      .insert(nftWatchlist)
      .values(watchlistData)
      .returning();
    return result;
  }

  async removeFromNftWatchlist(userId: number, nftId: number): Promise<boolean> {
    const result = await db
      .delete(nftWatchlist)
      .where(and(
        eq(nftWatchlist.userId, userId),
        eq(nftWatchlist.nftId, nftId)
      ));
    return true;
  }

  async getNftWatchlist(userId: number): Promise<NftWatchlist[]> {
    const results = await db
      .select()
      .from(nftWatchlist)
      .where(eq(nftWatchlist.userId, userId))
      .orderBy(desc(nftWatchlist.createdAt));
    return results;
  }

  async isNftInWatchlist(userId: number, nftId: number): Promise<boolean> {
    const [result] = await db
      .select()
      .from(nftWatchlist)
      .where(and(
        eq(nftWatchlist.userId, userId),
        eq(nftWatchlist.nftId, nftId)
      ))
      .limit(1);
    return !!result;
  }

  // Recommendation operations
  async getRecommendedClips(userId: number, limit: number = 8): Promise<ClipWithUser[]> {
    try {
      // Get games from clips the user has liked
      const likedClipsGames = await db
        .selectDistinct({ gameId: clips.gameId })
        .from(likes)
        .innerJoin(clips, eq(likes.clipId, clips.id))
        .where(
          and(
            eq(likes.userId, userId),
            isNotNull(clips.gameId)
          )
        );
      
      // Get user's favorite games
      const favoriteGames = await this.getUserGameFavorites(userId);
      
      // Combine game IDs from both liked clips and favorite games
      const gameIdsFromLikes = likedClipsGames.map(item => item.gameId).filter(id => id != null) as number[];
      const gameIdsFromFavorites = favoriteGames.map(game => game.id).filter(id => id != null && id !== undefined);
      
      // Merge and deduplicate game IDs
      const allGameIds = Array.from(new Set([...gameIdsFromLikes, ...gameIdsFromFavorites]));
      
      // If no game IDs from interactions or favorites, fallback to trending clips
      if (allGameIds.length === 0) {
        return this.getTrendingClips('day', limit, undefined, userId);
      }
      
      const gameIds = allGameIds;
      
      // Find clips from those games, excluding the user's own clips
      const recommendedClips = await db
        .select({
          id: clips.id,
          title: clips.title,
          description: clips.description,
          videoUrl: clips.videoUrl,
          thumbnailUrl: clips.thumbnailUrl,
          userId: clips.userId,
          gameId: clips.gameId,
          views: clips.views,
          duration: clips.duration,
          videoType: clips.videoType,
          createdAt: clips.createdAt,
          updatedAt: clips.updatedAt,
          // User fields with aliases
          userUsername: users.username,
          userDisplayName: users.displayName,
          userAvatarUrl: users.avatarUrl,
          userAvatarBorderColor: users.avatarBorderColor,
          userAccentColor: users.accentColor,
          userPrimaryColor: users.primaryColor,
          userBackgroundColor: users.backgroundColor,
          userCardColor: users.cardColor,
          // Game fields with aliases
          gameName: games.name,
          gameImageUrl: games.imageUrl,
        })
        .from(clips)
        .innerJoin(users, eq(clips.userId, users.id))
        .leftJoin(games, eq(clips.gameId, games.id))
        .where(
          and(
            inArray(clips.gameId, gameIds),
            ne(clips.userId, userId) // Exclude user's own clips
          )
        )
        .orderBy(desc(clips.views), desc(clips.createdAt), desc(clips.id))
        .limit(limit);
      
      // Transform the flat result into the expected nested structure
      const transformedClips = recommendedClips.map(clip => ({
        id: clip.id,
        title: clip.title,
        description: clip.description,
        videoUrl: clip.videoUrl,
        thumbnailUrl: clip.thumbnailUrl,
        userId: clip.userId,
        gameId: clip.gameId,
        views: clip.views,
        duration: clip.duration,
        videoType: clip.videoType,
        createdAt: clip.createdAt,
        updatedAt: clip.updatedAt,
        user: {
          id: clip.userId,
          username: clip.userUsername,
          displayName: clip.userDisplayName,
          avatarUrl: clip.userAvatarUrl,
          avatarBorderColor: clip.userAvatarBorderColor,
          accentColor: clip.userAccentColor,
          primaryColor: clip.userPrimaryColor,
          backgroundColor: clip.userBackgroundColor,
          cardColor: clip.userCardColor,
        },
        game: clip.gameId ? {
          id: clip.gameId,
          name: clip.gameName,
          imageUrl: clip.gameImageUrl,
        } : null
      }));
      
      // If not enough clips from favorite games, supplement with trending clips
      if (transformedClips.length < limit) {
        const remainingLimit = limit - transformedClips.length;
        const trendingClips = await this.getTrendingClips('day', remainingLimit, undefined, userId);
        
        // Filter out clips already in recommendations and user's own clips
        const existingClipIds = new Set(transformedClips.map(clip => clip.id));
        const additionalClips = trendingClips.filter(
          clip => !existingClipIds.has(clip.id) && clip.userId !== userId
        );
        
        transformedClips.push(...additionalClips.slice(0, remainingLimit));
      }
      
      return transformedClips;
    } catch (error) {
      console.error('Error getting recommended clips:', error);
      // Fallback to trending clips if recommendations fail
      return this.getTrendingClips('day', limit, undefined, userId);
    }
  }

  // Screenshot admin operations
  async getAllScreenshots(limit: number = 10, offset: number = 0): Promise<Array<{
    id: number;
    title: string;
    description?: string | null;
    imageUrl: string;
    thumbnailUrl?: string | null;
    views: number;
    createdAt: Date;
    updatedAt: Date;
    userId: number;
    gameId?: number | null;
    user: { id: number; username: string; displayName: string; avatarUrl?: string | null } | null;
    game?: { id: number; name: string; imageUrl?: string | null } | null;
  }>> {
    try {
      const screenshots = await db
        .select({
          id: screenshots.id,
          title: screenshots.title,
          description: screenshots.description,
          imageUrl: screenshots.imageUrl,
          thumbnailUrl: screenshots.thumbnailUrl,
          views: screenshots.views,
          createdAt: screenshots.createdAt,
          updatedAt: screenshots.updatedAt,
          userId: screenshots.userId,
          gameId: screenshots.gameId,
          user: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl
          },
          game: {
            id: games.id,
            name: games.name,
            imageUrl: games.imageUrl
          }
        })
        .from(screenshots)
        .leftJoin(users, eq(screenshots.userId, users.id))
        .leftJoin(games, eq(screenshots.gameId, games.id))
        .orderBy(desc(screenshots.createdAt), desc(screenshots.id)) // Stable pagination with tie-breaker
        .limit(limit)
        .offset(offset);
      
      return screenshots.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        imageUrl: row.imageUrl,
        thumbnailUrl: row.thumbnailUrl,
        views: row.views,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        userId: row.userId,
        gameId: row.gameId,
        user: row.user?.id ? { ...row.user } : null,
        game: row.game?.id ? { ...row.game } : null
      }));
    } catch (error) {
      console.error('Error getting all screenshots:', error);
      return [];
    }
  }

  async getScreenshotCount(): Promise<number> {
    try {
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(screenshots);
      return result?.count || 0;
    } catch (error) {
      console.error('Error getting screenshot count:', error);
      return 0;
    }
  }

  // Unified content moderation operations
  async getRecentContent(limit: number = 20, offset: number = 0, contentType?: string): Promise<Array<{
    id: number;
    type: 'clip' | 'reel' | 'screenshot';
    title: string;
    description?: string | null;
    user: { id: number; username: string; displayName: string } | null;
    game?: { id: number; name: string };
    createdAt: Date;
    url: string;
    thumbnailUrl?: string | null;
    views: number;
  }>> {
    try {
      // Optimize: when contentType is specified, run only the matching SELECT
      if (contentType === 'clip') {
        const clipsData = await db
          .select({
            id: clips.id,
            title: clips.title,
            description: clips.description,
            videoType: clips.videoType,
            videoUrl: clips.videoUrl,
            thumbnailUrl: clips.thumbnailUrl,
            views: clips.views,
            createdAt: clips.createdAt,
            user: {
              id: users.id,
              username: users.username,
              displayName: users.displayName
            },
            game: {
              id: games.id,
              name: games.name
            }
          })
          .from(clips)
          .leftJoin(users, eq(clips.userId, users.id))
          .leftJoin(games, eq(clips.gameId, games.id))
          .where(eq(clips.videoType, 'clip'))
          .orderBy(desc(clips.createdAt), desc(clips.id))
          .limit(limit)
          .offset(offset);

        return clipsData.map(clip => ({
          id: clip.id,
          type: 'clip' as const,
          title: clip.title,
          description: clip.description,
          user: clip.user?.id ? { ...clip.user } : null,
          game: clip.game?.id ? { ...clip.game } : null,
          createdAt: clip.createdAt,
          url: clip.videoUrl,
          thumbnailUrl: clip.thumbnailUrl,
          views: clip.views
        }));
      }

      if (contentType === 'reel') {
        const reelsData = await db
          .select({
            id: clips.id,
            title: clips.title,
            description: clips.description,
            videoType: clips.videoType,
            videoUrl: clips.videoUrl,
            thumbnailUrl: clips.thumbnailUrl,
            views: clips.views,
            createdAt: clips.createdAt,
            user: {
              id: users.id,
              username: users.username,
              displayName: users.displayName
            },
            game: {
              id: games.id,
              name: games.name
            }
          })
          .from(clips)
          .leftJoin(users, eq(clips.userId, users.id))
          .leftJoin(games, eq(clips.gameId, games.id))
          .where(eq(clips.videoType, 'reel'))
          .orderBy(desc(clips.createdAt), desc(clips.id))
          .limit(limit)
          .offset(offset);

        return reelsData.map(reel => ({
          id: reel.id,
          type: 'reel' as const,
          title: reel.title,
          description: reel.description,
          user: reel.user?.id ? { ...reel.user } : null,
          game: reel.game?.id ? { ...reel.game } : null,
          createdAt: reel.createdAt,
          url: reel.videoUrl,
          thumbnailUrl: reel.thumbnailUrl,
          views: reel.views
        }));
      }

      if (contentType === 'screenshot') {
        const screenshotsData = await db
          .select({
            id: screenshots.id,
            title: screenshots.title,
            description: screenshots.description,
            imageUrl: screenshots.imageUrl,
            thumbnailUrl: screenshots.thumbnailUrl,
            views: screenshots.views,
            createdAt: screenshots.createdAt,
            user: {
              id: users.id,
              username: users.username,
              displayName: users.displayName
            },
            game: {
              id: games.id,
              name: games.name
            }
          })
          .from(screenshots)
          .leftJoin(users, eq(screenshots.userId, users.id))
          .leftJoin(games, eq(screenshots.gameId, games.id))
          .orderBy(desc(screenshots.createdAt), desc(screenshots.id))
          .limit(limit)
          .offset(offset);

        return screenshotsData.map(screenshot => ({
          id: screenshot.id,
          type: 'screenshot' as const,
          title: screenshot.title,
          description: screenshot.description,
          user: screenshot.user?.id ? { ...screenshot.user } : null,
          game: screenshot.game?.id ? { ...screenshot.game } : null,
          createdAt: screenshot.createdAt,
          url: screenshot.imageUrl,
          thumbnailUrl: screenshot.thumbnailUrl,
          views: screenshot.views
        }));
      }

      // For unified view (no contentType filter), get all content types and merge
      const [clipsData, screenshotsData] = await Promise.all([
        // Get clips and reels
        db
          .select({
            id: clips.id,
            title: clips.title,
            description: clips.description,
            videoType: clips.videoType,
            videoUrl: clips.videoUrl,
            thumbnailUrl: clips.thumbnailUrl,
            views: clips.views,
            createdAt: clips.createdAt,
            user: {
              id: users.id,
              username: users.username,
              displayName: users.displayName
            },
            game: {
              id: games.id,
              name: games.name
            }
          })
          .from(clips)
          .leftJoin(users, eq(clips.userId, users.id))
          .leftJoin(games, eq(clips.gameId, games.id))
          .orderBy(desc(clips.createdAt), desc(clips.id))
          .limit(Math.ceil(limit * 1.5)), // Get more to ensure we have enough after merging

        // Get screenshots
        db
          .select({
            id: screenshots.id,
            title: screenshots.title,
            description: screenshots.description,
            imageUrl: screenshots.imageUrl,
            thumbnailUrl: screenshots.thumbnailUrl,
            views: screenshots.views,
            createdAt: screenshots.createdAt,
            user: {
              id: users.id,
              username: users.username,
              displayName: users.displayName
            },
            game: {
              id: games.id,
              name: games.name
            }
          })
          .from(screenshots)
          .leftJoin(users, eq(screenshots.userId, users.id))
          .leftJoin(games, eq(screenshots.gameId, games.id))
          .orderBy(desc(screenshots.createdAt), desc(screenshots.id))
          .limit(Math.ceil(limit * 1.5)) // Get more to ensure we have enough after merging
      ]);

      // Transform and merge all content
      const allContent: Array<{
        id: number;
        type: 'clip' | 'reel' | 'screenshot';
        title: string;
        description?: string | null;
        user: { id: number; username: string; displayName: string };
        game?: { id: number; name: string };
        createdAt: Date;
        url: string;
        thumbnailUrl?: string | null;
        views: number;
      }> = [];

      // Add clips and reels
      allContent.push(...clipsData.map(clip => ({
        id: clip.id,
        type: (clip.videoType || 'clip') as 'clip' | 'reel',
        title: clip.title,
        description: clip.description,
        user: clip.user?.id ? { ...clip.user } : null,
        game: clip.game?.id ? { ...clip.game } : null,
        createdAt: clip.createdAt,
        url: clip.videoUrl,
        thumbnailUrl: clip.thumbnailUrl,
        views: clip.views
      })));

      // Add screenshots
      allContent.push(...screenshotsData.map(screenshot => ({
        id: screenshot.id,
        type: 'screenshot' as const,
        title: screenshot.title,
        description: screenshot.description,
        user: screenshot.user?.id ? { ...screenshot.user } : null,
        game: screenshot.game?.id ? { ...screenshot.game } : null,
        createdAt: screenshot.createdAt,
        url: screenshot.imageUrl,
        thumbnailUrl: screenshot.thumbnailUrl,
        views: screenshot.views
      })));

      // Sort by creation date and apply pagination
      const sortedContent = allContent
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(offset, offset + limit);

      return sortedContent;
    } catch (error) {
      console.error('Error getting recent content:', error);
      return [];
    }
  }

  async getRecentContentCount(contentType?: string): Promise<number> {
    try {
      // Optimize: when contentType is specified, run only the matching COUNT
      if (contentType === 'clip') {
        const [result] = await db
          .select({ count: sql<number>`count(*)` })
          .from(clips)
          .where(eq(clips.videoType, 'clip'));
        return result?.count || 0;
      }

      if (contentType === 'reel') {
        const [result] = await db
          .select({ count: sql<number>`count(*)` })
          .from(clips)
          .where(eq(clips.videoType, 'reel'));
        return result?.count || 0;
      }

      if (contentType === 'screenshot') {
        const [result] = await db
          .select({ count: sql<number>`count(*)` })
          .from(screenshots);
        return result?.count || 0;
      }

      // For unified count (no contentType filter), sum all content types
      const [clipResult, screenshotResult] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(clips),
        db.select({ count: sql<number>`count(*)` }).from(screenshots)
      ]);

      return (clipResult[0]?.count || 0) + (screenshotResult[0]?.count || 0);
    } catch (error) {
      console.error('Error getting recent content count:', error);
      return 0;
    }
  }

  // Banner settings operations
  async getBannerSettings(): Promise<BannerSettings | null> {
    try {
      const [settings] = await db
        .select()
        .from(bannerSettings)
        .limit(1);
      return settings || null;
    } catch (error) {
      // Silently return null if table doesn't exist - default settings will be used
      return null;
    }
  }

  async createBannerSettings(settings: InsertBannerSettings): Promise<BannerSettings> {
    try {
      const [created] = await db
        .insert(bannerSettings)
        .values(settings)
        .returning();
      return created;
    } catch (error) {
      console.error('Error creating banner settings:', error);
      throw error;
    }
  }

  async updateBannerSettings(settings: Partial<BannerSettings>): Promise<BannerSettings | null> {
    try {
      // Get the existing settings first to get the ID
      const existing = await this.getBannerSettings();
      if (!existing) {
        return null;
      }

      const [updated] = await db
        .update(bannerSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(bannerSettings.id, existing.id))
        .returning();
      
      return updated || null;
    } catch (error) {
      console.error('Error updating banner settings:', error);
      return null;
    }
  }

  // Asset reward operations
  async createAssetReward(reward: InsertAssetReward): Promise<AssetReward> {
    const [created] = await db
      .insert(assetRewards)
      .values(reward)
      .returning();
    return created;
  }

  async getAllAssetRewards(): Promise<AssetReward[]> {
    return await db
      .select()
      .from(assetRewards)
      .orderBy(desc(assetRewards.createdAt));
  }

  async getAssetReward(id: number): Promise<AssetReward | null> {
    const [reward] = await db
      .select()
      .from(assetRewards)
      .where(eq(assetRewards.id, id));
    return reward || null;
  }

  async getAssetRewardWithClaims(id: number): Promise<AssetRewardWithClaims | null> {
    const reward = await this.getAssetReward(id);
    if (!reward) return null;

    const claimsWithUsers = await db
      .select({
        id: assetRewardClaims.id,
        rewardId: assetRewardClaims.rewardId,
        userId: assetRewardClaims.userId,
        claimedAt: assetRewardClaims.claimedAt,
        user: users,
      })
      .from(assetRewardClaims)
      .innerJoin(users, eq(assetRewardClaims.userId, users.id))
      .where(eq(assetRewardClaims.rewardId, id))
      .orderBy(desc(assetRewardClaims.claimedAt));

    return {
      ...reward,
      claims: claimsWithUsers.map(c => ({
        id: c.id,
        rewardId: c.rewardId,
        userId: c.userId,
        claimedAt: c.claimedAt,
        user: c.user,
      })),
    };
  }

  async updateAssetReward(id: number, updates: Partial<AssetReward>): Promise<AssetReward | null> {
    const [updated] = await db
      .update(assetRewards)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(assetRewards.id, id))
      .returning();
    return updated || null;
  }

  async deleteAssetReward(id: number): Promise<boolean> {
    const result = await db
      .delete(assetRewards)
      .where(eq(assetRewards.id, id));
    return true;
  }

  async createAssetRewardClaim(claim: InsertAssetRewardClaim): Promise<AssetRewardClaim> {
    const [created] = await db
      .insert(assetRewardClaims)
      .values(claim)
      .returning();
    
    // Increment the times rewarded counter
    await db
      .update(assetRewards)
      .set({ 
        timesRewarded: sql`${assetRewards.timesRewarded} + 1`,
        updatedAt: new Date() 
      })
      .where(eq(assetRewards.id, claim.rewardId));

    return created;
  }

  async getAssetRewardClaims(rewardId: number): Promise<(AssetRewardClaim & { user: User })[]> {
    const claims = await db
      .select({
        id: assetRewardClaims.id,
        rewardId: assetRewardClaims.rewardId,
        userId: assetRewardClaims.userId,
        claimedAt: assetRewardClaims.claimedAt,
        user: users,
      })
      .from(assetRewardClaims)
      .innerJoin(users, eq(assetRewardClaims.userId, users.id))
      .where(eq(assetRewardClaims.rewardId, rewardId))
      .orderBy(desc(assetRewardClaims.claimedAt));

    return claims.map(c => ({
      id: c.id,
      rewardId: c.rewardId,
      userId: c.userId,
      claimedAt: c.claimedAt,
      user: c.user,
    }));
  }

  // Free avatar borders available to all users (IDs of borders everyone can use)
  private readonly FREE_AVATAR_BORDER_IDS = [17]; // HUD Corner Brackets

  // Get ALL avatar borders (for Pro users who have access to everything)
  async getAllAvatarBorders(): Promise<AssetReward[]> {
    return await db
      .select()
      .from(assetRewards)
      .where(
        and(
          eq(assetRewards.assetType, "avatar_border"),
          eq(assetRewards.isActive, true)
        )
      )
      .orderBy(assetRewards.rarity, assetRewards.id);
  }

  // Get user's unlocked avatar borders
  async getUserUnlockedAvatarBorders(userId: number): Promise<AssetReward[]> {
    // Get user's claimed borders from lootbox
    const claims = await db
      .select({
        reward: assetRewards,
      })
      .from(assetRewardClaims)
      .innerJoin(assetRewards, eq(assetRewardClaims.rewardId, assetRewards.id))
      .where(
        and(
          eq(assetRewardClaims.userId, userId),
          eq(assetRewards.assetType, "avatar_border"),
          eq(assetRewards.isActive, true)
        )
      );

    const claimedBorders = claims.map(c => c.reward);
    const claimedIds = new Set(claimedBorders.map(b => b.id));

    // Get free borders that user hasn't already claimed
    const freeBorders = await db
      .select()
      .from(assetRewards)
      .where(
        and(
          inArray(assetRewards.id, this.FREE_AVATAR_BORDER_IDS),
          eq(assetRewards.assetType, "avatar_border"),
          eq(assetRewards.isActive, true)
        )
      );

    // Combine claimed and free borders (avoiding duplicates)
    const allBorders = [...claimedBorders];
    for (const freeBorder of freeBorders) {
      if (!claimedIds.has(freeBorder.id)) {
        allBorders.push(freeBorder);
      }
    }

    return allBorders;
  }

  // Check if user has unlocked a specific reward
  async userHasUnlockedReward(userId: number, rewardId: number): Promise<boolean> {
    // Check if it's a free border (available to everyone)
    if (this.FREE_AVATAR_BORDER_IDS.includes(rewardId)) {
      return true;
    }

    const [claim] = await db
      .select()
      .from(assetRewardClaims)
      .where(
        and(
          eq(assetRewardClaims.userId, userId),
          eq(assetRewardClaims.rewardId, rewardId)
        )
      );

    return !!claim;
  }

  // Update user's selected avatar border
  async updateUserAvatarBorder(userId: number, avatarBorderId: number | null): Promise<void> {
    await db
      .update(users)
      .set({ 
        selectedAvatarBorderId: avatarBorderId,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId));
  }

  // Daily lootbox operations
  async getDailyLootboxStatus(userId: number): Promise<{ canOpen: boolean; lastOpenedAt: Date | null; nextOpenAt: Date | null }> {
    const [record] = await db
      .select()
      .from(userDailyLootbox)
      .where(eq(userDailyLootbox.userId, userId))
      .orderBy(desc(userDailyLootbox.lastOpenedAt))
      .limit(1);

    if (!record) {
      return { canOpen: true, lastOpenedAt: null, nextOpenAt: null };
    }

    const now = new Date();
    const lastOpened = new Date(record.lastOpenedAt);
    
    // Reset at midnight UTC
    const todayMidnight = new Date(now);
    todayMidnight.setUTCHours(0, 0, 0, 0);
    
    const lastOpenedDate = new Date(lastOpened);
    lastOpenedDate.setUTCHours(0, 0, 0, 0);
    
    const canOpen = lastOpenedDate < todayMidnight;
    
    // Calculate next open time (next midnight UTC)
    const nextOpenAt = new Date(todayMidnight);
    nextOpenAt.setUTCDate(nextOpenAt.getUTCDate() + 1);

    return { 
      canOpen, 
      lastOpenedAt: record.lastOpenedAt, 
      nextOpenAt: canOpen ? null : nextOpenAt 
    };
  }

  async openDailyLootbox(userId: number): Promise<{ reward: AssetReward; isDuplicate: boolean; consumed: boolean } | null> {
    // Check if user can open
    const status = await this.getDailyLootboxStatus(userId);
    if (!status.canOpen) {
      return null;
    }

    // 20% chance to win a name tag from the lootbox
    const lootboxNameTags = await db
      .select()
      .from(nameTags)
      .where(and(eq(nameTags.isActive, true), eq(nameTags.availableInLootbox, true)));

    if (lootboxNameTags.length > 0 && Math.random() < 0.03) {
      const randomNameTag = lootboxNameTags[Math.floor(Math.random() * lootboxNameTags.length)];
      const alreadyHas = await this.userHasUnlockedNameTag(userId, randomNameTag.id);

      if (!alreadyHas) {
        await this.unlockNameTagForUser(userId, randomNameTag.id);
      }

      // Create a virtual AssetReward object for the name tag
      const nameTagReward: AssetReward = {
        id: -randomNameTag.id,
        name: randomNameTag.name,
        imageUrl: randomNameTag.imageUrl,
        assetType: 'name_tag',
        category: 'static',
        rarity: randomNameTag.rarity,
        unlockChance: 10,
        rewardValue: null,
        timesRewarded: 0,
        isActive: true,
        availableInLootbox: true,
        availableInStore: false,
        proOnly: false,
        freeItem: false,
        redeemable: false,
        rewardCategory: 'lootbox',
        storePrice: null,
        sourceBucket: 'gamefolio-name-tags',
        sourcePath: null,
        createdBy: null,
        createdAt: randomNameTag.createdAt,
        updatedAt: randomNameTag.createdAt,
      };

      await db.insert(userDailyLootbox).values({
        userId,
        lastOpenedAt: new Date(),
        rewardId: null,
        openCount: 1,
      });

      return { reward: nameTagReward, isDuplicate: alreadyHas, consumed: false };
    }

    // 3% chance to win a profile border from the lootbox (only circle-shape borders for regular profile pics)
    const lootboxBorders = await db
      .select()
      .from(profileBorders)
      .where(and(eq(profileBorders.isActive, true), eq(profileBorders.availableInLootbox, true), eq(profileBorders.shape, 'circle')));

    if (lootboxBorders.length > 0 && Math.random() < 0.03) {
      const randomBorder = lootboxBorders[Math.floor(Math.random() * lootboxBorders.length)];
      const alreadyHasBorder = await this.userHasUnlockedBorder(userId, randomBorder.id);

      if (!alreadyHasBorder) {
        await this.unlockBorderForUser(userId, randomBorder.id);
      }

      const borderReward: AssetReward = {
        id: -10000 - randomBorder.id,
        name: randomBorder.name,
        imageUrl: randomBorder.imageUrl,
        assetType: 'profile_border',
        category: 'static',
        rarity: randomBorder.rarity,
        unlockChance: 10,
        rewardValue: null,
        timesRewarded: 0,
        isActive: true,
        availableInLootbox: true,
        availableInStore: false,
        proOnly: true,
        freeItem: false,
        redeemable: false,
        rewardCategory: 'lootbox',
        storePrice: null,
        sourceBucket: 'gamefolio-profile-borders',
        sourcePath: null,
        createdBy: null,
        createdAt: randomBorder.createdAt,
        updatedAt: randomBorder.createdAt,
      };

      await db.insert(userDailyLootbox).values({
        userId,
        lastOpenedAt: new Date(),
        rewardId: null,
        openCount: 1,
      });

      return { reward: borderReward, isDuplicate: alreadyHasBorder, consumed: false };
    }

    // Get all active rewards
    const rewards = await this.getActiveRewardsForLootbox();
    if (rewards.length === 0) {
      return null;
    }

    // Calculate total weight based on unlock chance
    const totalWeight = rewards.reduce((sum, r) => sum + r.unlockChance, 0);
    
    // Random weighted selection
    let random = Math.random() * totalWeight;
    let selectedReward: AssetReward | null = null;
    
    for (const reward of rewards) {
      random -= reward.unlockChance;
      if (random <= 0) {
        selectedReward = reward;
        break;
      }
    }
    
    // Fallback to first reward if none selected
    if (!selectedReward) {
      selectedReward = rewards[0];
    }

    // Check if this is a consumable reward (XP, GF tokens)
    const isConsumable = selectedReward.assetType === 'xp_reward';
    let alreadyHas = false;
    let consumed = false;

    if (isConsumable) {
      const rewardValue = selectedReward.rewardValue || 0;
      
      if (selectedReward.assetType === 'xp_reward' && rewardValue > 0) {
        const currentUser = await this.getUser(userId);
        const newXP = (currentUser?.totalXP || 0) + rewardValue;
        const newLevel = calculateLevel(newXP);
        await db.update(users)
          .set({ totalXP: newXP, level: newLevel })
          .where(eq(users.id, userId));
        
        await db.insert(userXPHistory).values({
          userId,
          xpAmount: rewardValue,
          source: 'lootbox',
          description: `Earned ${rewardValue} XP from Daily Lootbox (${selectedReward.rarity} reward)`,
        });
        
        consumed = true;
      }
      
      // Still create a claim record to track history
      await this.createAssetRewardClaim({
        rewardId: selectedReward.id,
        userId: userId,
      });
    } else {
      // For collectible rewards, check if user already has it
      alreadyHas = await this.userHasUnlockedReward(userId, selectedReward.id);
      
      if (!alreadyHas) {
        // Create the reward claim only if user doesn't have it
        await this.createAssetRewardClaim({
          rewardId: selectedReward.id,
          userId: userId,
        });
      }
    }

    // Record the lootbox open
    await db.insert(userDailyLootbox).values({
      userId,
      lastOpenedAt: new Date(),
      rewardId: selectedReward.id,
      openCount: 1,
    });

    return { reward: selectedReward, isDuplicate: alreadyHas, consumed };
  }

  async getUserClaimedRewards(userId: number): Promise<AssetReward[]> {
    const claims = await db
      .select({
        reward: assetRewards,
      })
      .from(assetRewardClaims)
      .innerJoin(assetRewards, eq(assetRewardClaims.rewardId, assetRewards.id))
      .where(eq(assetRewardClaims.userId, userId))
      .orderBy(desc(assetRewardClaims.claimedAt));

    return claims.map(c => c.reward);
  }

  async getActiveRewardsForLootbox(): Promise<AssetReward[]> {
    return db
      .select()
      .from(assetRewards)
      .where(eq(assetRewards.isActive, true))
      .orderBy(assetRewards.rarity);
  }

  async getUserCollectionData(userId: number): Promise<{
    stats: {
      totalLootboxesOpened: number;
      totalXpEarned: number;
      legendaryCount: number;
      epicCount: number;
      rareCount: number;
      commonCount: number;
    };
    items: Array<{
      id: number;
      name: string;
      imageUrl: string;
      rarity: string;
      rewardType: string;
      claimedAt: Date;
    }>;
  }> {
    // Get total lootboxes opened
    const lootboxRecord = await db
      .select({ openCount: userDailyLootbox.openCount })
      .from(userDailyLootbox)
      .where(eq(userDailyLootbox.userId, userId))
      .limit(1);
    
    const totalLootboxesOpened = lootboxRecord[0]?.openCount || 0;

    // Get total XP earned from lootboxes (handle missing table gracefully)
    let totalXpEarned = 0;
    try {
      const xpResult = await db
        .select({ total: sql<number>`COALESCE(SUM(${xpHistory.xpAmount}), 0)` })
        .from(xpHistory)
        .where(and(
          eq(xpHistory.userId, userId),
          eq(xpHistory.source, 'lootbox')
        ));
      totalXpEarned = Number(xpResult[0]?.total || 0);
    } catch (error) {
      // xp_history table may not exist yet, default to 0
      totalXpEarned = 0;
    }

    // Get all claimed rewards with claim dates
    const claimedItems = await db
      .select({
        id: assetRewards.id,
        name: assetRewards.name,
        imageUrl: assetRewards.imageUrl,
        rarity: assetRewards.rarity,
        rewardType: assetRewards.assetType,
        claimedAt: assetRewardClaims.claimedAt,
      })
      .from(assetRewardClaims)
      .innerJoin(assetRewards, eq(assetRewardClaims.rewardId, assetRewards.id))
      .where(eq(assetRewardClaims.userId, userId))
      .orderBy(desc(assetRewardClaims.claimedAt));

    // Count by rarity
    const legendaryCount = claimedItems.filter(i => i.rarity === 'legendary').length;
    const epicCount = claimedItems.filter(i => i.rarity === 'epic').length;
    const rareCount = claimedItems.filter(i => i.rarity === 'rare').length;
    const commonCount = claimedItems.filter(i => i.rarity === 'common').length;

    return {
      stats: {
        totalLootboxesOpened,
        totalXpEarned,
        legendaryCount,
        epicCount,
        rareCount,
        commonCount,
      },
      items: claimedItems,
    };
  }

  // Admin lootbox operations
  async getAllLootboxOpens(): Promise<Array<{
    id: number;
    userId: number;
    lastOpenedAt: Date;
    rewardId: number | null;
    openCount: number;
    user: { id: number; username: string; displayName: string; avatarUrl: string | null };
    reward: { id: number; name: string; rarity: string; imageUrl: string } | null;
  }>> {
    const records = await db
      .select({
        id: userDailyLootbox.id,
        userId: userDailyLootbox.userId,
        lastOpenedAt: userDailyLootbox.lastOpenedAt,
        rewardId: userDailyLootbox.rewardId,
        openCount: userDailyLootbox.openCount,
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
        reward: {
          id: assetRewards.id,
          name: assetRewards.name,
          rarity: assetRewards.rarity,
          imageUrl: assetRewards.imageUrl,
        },
      })
      .from(userDailyLootbox)
      .innerJoin(users, eq(userDailyLootbox.userId, users.id))
      .leftJoin(assetRewards, eq(userDailyLootbox.rewardId, assetRewards.id))
      .orderBy(desc(userDailyLootbox.lastOpenedAt));

    return records.map(r => ({
      id: r.id,
      userId: r.userId,
      lastOpenedAt: r.lastOpenedAt,
      rewardId: r.rewardId,
      openCount: r.openCount,
      user: r.user,
      reward: r.reward?.id ? r.reward : null,
    }));
  }

  async resetUserLootbox(userId: number): Promise<boolean> {
    // First check if the user has a lootbox record
    const [existing] = await db
      .select({ id: userDailyLootbox.id })
      .from(userDailyLootbox)
      .where(eq(userDailyLootbox.userId, userId))
      .limit(1);
    
    if (!existing) {
      return false;
    }
    
    // Set lastOpenedAt to yesterday to allow another open today
    // This preserves the openCount and history while resetting the daily lockout
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);
    
    await db
      .update(userDailyLootbox)
      .set({ lastOpenedAt: yesterday })
      .where(eq(userDailyLootbox.userId, userId));
    
    return true;
  }

  // ==================== DAILY UPLOAD QUOTA OPERATIONS ====================

  // Upload limit constants
  private readonly FREE_MAX_CLIPS_PER_DAY = 3;
  private readonly FREE_MAX_REELS_PER_DAY = 3;
  private readonly FREE_MAX_SCREENSHOTS_PER_DAY = 3;
  private readonly FREE_MAX_VIDEO_SIZE_MB = 100;
  private readonly FREE_MAX_IMAGE_SIZE_MB = 10;
  private readonly PRO_MAX_VIDEO_SIZE_MB = 500;
  private readonly PRO_MAX_IMAGE_SIZE_MB = 100;
  private readonly FREE_MAX_CLIPS_TOTAL = 15;
  private readonly FREE_MAX_REELS_TOTAL = 15;
  private readonly FREE_MAX_SCREENSHOTS_TOTAL = 10;

  private getTodayDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD in UTC
  }

  private getCurrentMonthString(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`; // YYYY-MM
  }

  async getUserDailyUploads(userId: number, date: string): Promise<UserDailyUploads | null> {
    const [record] = await db
      .select()
      .from(userDailyUploads)
      .where(and(
        eq(userDailyUploads.userId, userId),
        eq(userDailyUploads.uploadDate, date)
      ))
      .limit(1);
    return record || null;
  }

  async incrementDailyUploadCount(userId: number, contentType: 'clip' | 'reel' | 'screenshot'): Promise<UserDailyUploads> {
    const today = this.getTodayDateString();
    
    // Try to get existing record for today
    const existing = await this.getUserDailyUploads(userId, today);
    
    if (existing) {
      // Update existing record
      const updates: Partial<UserDailyUploads> = { updatedAt: new Date() };
      if (contentType === 'clip') {
        updates.clipsCount = existing.clipsCount + 1;
      } else if (contentType === 'reel') {
        updates.reelsCount = existing.reelsCount + 1;
      } else if (contentType === 'screenshot') {
        updates.screenshotsCount = existing.screenshotsCount + 1;
      }
      
      const [updated] = await db
        .update(userDailyUploads)
        .set(updates)
        .where(eq(userDailyUploads.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new record for today
      const newRecord: any = {
        userId,
        uploadDate: today,
        clipsCount: contentType === 'clip' ? 1 : 0,
        reelsCount: contentType === 'reel' ? 1 : 0,
        screenshotsCount: contentType === 'screenshot' ? 1 : 0,
      };
      
      const [created] = await db
        .insert(userDailyUploads)
        .values(newRecord)
        .returning();
      return created;
    }
  }

  private async getUserExistingContentCounts(userId: number): Promise<{ totalClips: number; totalReels: number; totalScreenshots: number }> {
    const [clipsResult, reelsResult, screenshotsResult] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(clips)
        .where(and(eq(clips.userId, userId), eq(clips.videoType, 'clip'))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(clips)
        .where(and(eq(clips.userId, userId), eq(clips.videoType, 'reel'))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(screenshots)
        .where(eq(screenshots.userId, userId)),
    ]);

    return {
      totalClips: clipsResult[0]?.count ?? 0,
      totalReels: reelsResult[0]?.count ?? 0,
      totalScreenshots: screenshotsResult[0]?.count ?? 0,
    };
  }

  async getUploadLimits(userId: number): Promise<UploadLimits> {
    // Get user to check Pro status
    const user = await this.getUser(userId);
    const isPro = user?.isPro || user?.role === 'admin' || false;
    
    // Get today's upload counts
    const today = this.getTodayDateString();
    const [dailyUploads, existingCounts] = await Promise.all([
      this.getUserDailyUploads(userId, today),
      this.getUserExistingContentCounts(userId),
    ]);
    
    const clipsUploadedToday = dailyUploads?.clipsCount || 0;
    const reelsUploadedToday = dailyUploads?.reelsCount || 0;
    const screenshotsUploadedToday = dailyUploads?.screenshotsCount || 0;

    const { totalClips, totalReels, totalScreenshots } = existingCounts;
    
    if (isPro) {
      // Pro users have unlimited uploads
      return {
        isPro: true,
        maxClipsPerDay: -1, // -1 means unlimited
        maxReelsPerDay: -1,
        maxScreenshotsPerDay: -1,
        maxVideoSizeMB: this.PRO_MAX_VIDEO_SIZE_MB,
        maxImageSizeMB: this.PRO_MAX_IMAGE_SIZE_MB,
        clipsUploadedToday,
        reelsUploadedToday,
        screenshotsUploadedToday,
        canUploadClip: true,
        canUploadReel: true,
        canUploadScreenshot: true,
        totalClipsExisting: totalClips,
        totalReelsExisting: totalReels,
        totalScreenshotsExisting: totalScreenshots,
        maxClipsTotal: -1,
        maxReelsTotal: -1,
        maxScreenshotsTotal: -1,
      };
    } else {
      // Free users have daily limits AND concurrent content limits
      const withinDailyClip = clipsUploadedToday < this.FREE_MAX_CLIPS_PER_DAY;
      const withinDailyReel = reelsUploadedToday < this.FREE_MAX_REELS_PER_DAY;
      const withinDailyScreenshot = screenshotsUploadedToday < this.FREE_MAX_SCREENSHOTS_PER_DAY;
      const withinTotalClip = totalClips < this.FREE_MAX_CLIPS_TOTAL;
      const withinTotalReel = totalReels < this.FREE_MAX_REELS_TOTAL;
      const withinTotalScreenshot = totalScreenshots < this.FREE_MAX_SCREENSHOTS_TOTAL;

      return {
        isPro: false,
        maxClipsPerDay: this.FREE_MAX_CLIPS_PER_DAY,
        maxReelsPerDay: this.FREE_MAX_REELS_PER_DAY,
        maxScreenshotsPerDay: this.FREE_MAX_SCREENSHOTS_PER_DAY,
        maxVideoSizeMB: this.FREE_MAX_VIDEO_SIZE_MB,
        maxImageSizeMB: this.FREE_MAX_IMAGE_SIZE_MB,
        clipsUploadedToday,
        reelsUploadedToday,
        screenshotsUploadedToday,
        canUploadClip: withinDailyClip && withinTotalClip,
        canUploadReel: withinDailyReel && withinTotalReel,
        canUploadScreenshot: withinDailyScreenshot && withinTotalScreenshot,
        totalClipsExisting: totalClips,
        totalReelsExisting: totalReels,
        totalScreenshotsExisting: totalScreenshots,
        maxClipsTotal: this.FREE_MAX_CLIPS_TOTAL,
        maxReelsTotal: this.FREE_MAX_REELS_TOTAL,
        maxScreenshotsTotal: this.FREE_MAX_SCREENSHOTS_TOTAL,
      };
    }
  }

  // ==================== PRO LOOTBOX GRANT OPERATIONS ====================

  async hasProLootboxGrant(userId: number, grantType: 'initial' | 'monthly', month?: string): Promise<boolean> {
    const conditions = [
      eq(proLootboxGrants.userId, userId),
      eq(proLootboxGrants.grantType, grantType)
    ];
    
    if (grantType === 'monthly' && month) {
      conditions.push(eq(proLootboxGrants.grantedForMonth, month));
    }
    
    const [existing] = await db
      .select({ id: proLootboxGrants.id })
      .from(proLootboxGrants)
      .where(and(...conditions))
      .limit(1);
    
    return !!existing;
  }

  async createProLootboxGrant(userId: number, grantType: 'initial' | 'monthly', rewardId?: number): Promise<ProLootboxGrant> {
    const grantedForMonth = grantType === 'monthly' ? this.getCurrentMonthString() : null;
    
    const [grant] = await db
      .insert(proLootboxGrants)
      .values({
        userId,
        grantType,
        grantedForMonth,
        rewardId: rewardId || null,
      })
      .returning();
    
    return grant;
  }

  async grantProLootbox(userId: number, grantType: 'initial' | 'monthly'): Promise<{ reward: AssetReward; isDuplicate: boolean } | null> {
    const currentMonth = this.getCurrentMonthString();
    
    // Check if already granted
    const alreadyGranted = await this.hasProLootboxGrant(userId, grantType, grantType === 'monthly' ? currentMonth : undefined);
    if (alreadyGranted) {
      return null; // Already received this grant
    }
    
    // Get available rewards for lootbox
    const availableRewards = await this.getActiveRewardsForLootbox();
    if (availableRewards.length === 0) {
      // Create the grant record even if no rewards available
      await this.createProLootboxGrant(userId, grantType);
      return null;
    }
    
    // Pick a random reward based on rarity weights
    const rarityWeights: Record<string, number> = {
      'common': 50,
      'uncommon': 30,
      'rare': 15,
      'epic': 4,
      'legendary': 1
    };
    
    const totalWeight = availableRewards.reduce((sum, r) => sum + (rarityWeights[r.rarity] || 10), 0);
    let random = Math.random() * totalWeight;
    let selectedReward = availableRewards[0];
    
    for (const reward of availableRewards) {
      random -= (rarityWeights[reward.rarity] || 10);
      if (random <= 0) {
        selectedReward = reward;
        break;
      }
    }
    
    // Check if user already has this reward
    const alreadyHas = await this.userHasUnlockedReward(userId, selectedReward.id);
    
    if (!alreadyHas) {
      // Claim the reward for the user
      await this.createAssetRewardClaim({
        userId,
        rewardId: selectedReward.id,
      });
      
      // Update times rewarded count
      await db
        .update(assetRewards)
        .set({ timesRewarded: (selectedReward.timesRewarded || 0) + 1 })
        .where(eq(assetRewards.id, selectedReward.id));
    }
    
    // Record the grant
    await this.createProLootboxGrant(userId, grantType, selectedReward.id);
    
    return {
      reward: selectedReward,
      isDuplicate: alreadyHas
    };
  }

  // Name tag operations
  async getAllNameTags(): Promise<NameTag[]> {
    return await db
      .select()
      .from(nameTags)
      .where(eq(nameTags.isActive, true))
      .orderBy(nameTags.name);
  }

  async getNameTag(id: number): Promise<NameTag | null> {
    const [nameTag] = await db
      .select()
      .from(nameTags)
      .where(eq(nameTags.id, id));
    return nameTag || null;
  }

  async createNameTag(nameTag: InsertNameTag): Promise<NameTag> {
    const [created] = await db.insert(nameTags).values(nameTag).returning();
    return created;
  }

  async updateNameTag(id: number, updates: Partial<NameTag>): Promise<NameTag | null> {
    const [updated] = await db
      .update(nameTags)
      .set(updates)
      .where(eq(nameTags.id, id))
      .returning();
    return updated || null;
  }

  async deleteNameTag(id: number): Promise<boolean> {
    const result = await db.delete(nameTags).where(eq(nameTags.id, id));
    return true;
  }

  async getUserUnlockedNameTags(userId: number): Promise<NameTag[]> {
    // Get user to check for admin role
    const user = await this.getUser(userId);
    const isAdmin = user?.role === 'admin' || user?.username === 'mod_tom' || user?.username === 'player1';

    // If admin, they have all active name tags
    if (isAdmin) {
      return await db.select().from(nameTags).where(eq(nameTags.isActive, true));
    }

    // Get user's unlocked name tags
    const unlocked = await db
      .select({ nameTag: nameTags })
      .from(userUnlockedNameTags)
      .innerJoin(nameTags, eq(userUnlockedNameTags.nameTagId, nameTags.id))
      .where(
        and(
          eq(userUnlockedNameTags.userId, userId),
          eq(nameTags.isActive, true)
        )
      );

    // Also get default name tags that everyone has access to
    const defaultTags = await db
      .select()
      .from(nameTags)
      .where(
        and(
          eq(nameTags.isDefault, true),
          eq(nameTags.isActive, true)
        )
      );

    // Combine and deduplicate
    const unlockedTags = unlocked.map((u) => u.nameTag);
    const uniqueTags = [...unlockedTags, ...defaultTags].filter(
      (tag, index, self) => index === self.findIndex((t) => t.id === tag.id)
    );

    return uniqueTags;
  }

  async unlockNameTagForUser(userId: number, nameTagId: number): Promise<UserUnlockedNameTag> {
    const [unlock] = await db
      .insert(userUnlockedNameTags)
      .values({ userId, nameTagId })
      .returning();
    return unlock;
  }

  async userHasUnlockedNameTag(userId: number, nameTagId: number): Promise<boolean> {
    // Check if user is admin
    const user = await this.getUser(userId);
    if (user?.role === 'admin' || user?.username === 'mod_tom' || user?.username === 'player1') {
      return true;
    }

    // Check if it's a default tag (everyone has it)
    const [nameTag] = await db
      .select()
      .from(nameTags)
      .where(eq(nameTags.id, nameTagId));
    
    if (nameTag?.isDefault) {
      return true;
    }

    // Check if user has specifically unlocked it
    const [unlock] = await db
      .select()
      .from(userUnlockedNameTags)
      .where(
        and(
          eq(userUnlockedNameTags.userId, userId),
          eq(userUnlockedNameTags.nameTagId, nameTagId)
        )
      );
    return !!unlock;
  }

  async updateUserNameTag(userId: number, nameTagId: number | null): Promise<void> {
    await db
      .update(users)
      .set({ 
        selectedNameTagId: nameTagId,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId));
  }

  // Profile border operations
  async getAllProfileBordersFromTable(): Promise<ProfileBorder[]> {
    return await db
      .select()
      .from(profileBorders)
      .where(eq(profileBorders.isActive, true))
      .orderBy(profileBorders.name);
  }

  async getProfileBorder(id: number): Promise<ProfileBorder | null> {
    const [border] = await db
      .select()
      .from(profileBorders)
      .where(eq(profileBorders.id, id));
    return border || null;
  }

  async createProfileBorder(border: InsertProfileBorder): Promise<ProfileBorder> {
    const [created] = await db.insert(profileBorders).values(border).returning();
    return created;
  }

  async updateProfileBorder(id: number, updates: Partial<ProfileBorder>): Promise<ProfileBorder | null> {
    const [updated] = await db
      .update(profileBorders)
      .set(updates)
      .where(eq(profileBorders.id, id))
      .returning();
    return updated || null;
  }

  async deleteProfileBorder(id: number): Promise<boolean> {
    await db.delete(profileBorders).where(eq(profileBorders.id, id));
    return true;
  }

  async getUserUnlockedBorders2(userId: number): Promise<ProfileBorder[]> {
    const unlocked = await db
      .select({ border: profileBorders })
      .from(userUnlockedBorders)
      .innerJoin(profileBorders, eq(userUnlockedBorders.borderId, profileBorders.id))
      .where(
        and(
          eq(userUnlockedBorders.userId, userId),
          eq(profileBorders.isActive, true)
        )
      );

    const defaultBorders = await db
      .select()
      .from(profileBorders)
      .where(
        and(
          eq(profileBorders.isDefault, true),
          eq(profileBorders.isActive, true)
        )
      );

    const unlockedBorders = unlocked.map((u) => u.border);
    const allBorders = [...unlockedBorders, ...defaultBorders];
    const uniqueBorders = allBorders.filter(
      (border, index, self) => index === self.findIndex((b) => b.id === border.id)
    );

    return uniqueBorders;
  }

  async unlockBorderForUser(userId: number, borderId: number): Promise<UserUnlockedBorder> {
    const [unlock] = await db
      .insert(userUnlockedBorders)
      .values({ userId, borderId })
      .returning();
    return unlock;
  }

  async userHasUnlockedBorder(userId: number, borderId: number): Promise<boolean> {
    const [border] = await db
      .select()
      .from(profileBorders)
      .where(eq(profileBorders.id, borderId));

    if (border?.isDefault) {
      return true;
    }

    const [unlock] = await db
      .select()
      .from(userUnlockedBorders)
      .where(
        and(
          eq(userUnlockedBorders.userId, userId),
          eq(userUnlockedBorders.borderId, borderId)
        )
      );
    return !!unlock;
  }

  async updateUserBorder(userId: number, borderId: number | null): Promise<void> {
    await db
      .update(users)
      .set({
        selectedBorderId: borderId,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  // Verification badge operations
  async getAllVerificationBadges(): Promise<VerificationBadge[]> {
    return await db
      .select()
      .from(verificationBadges)
      .where(eq(verificationBadges.isActive, true))
      .orderBy(verificationBadges.name);
  }

  async getVerificationBadge(id: number): Promise<VerificationBadge | null> {
    const [badge] = await db
      .select()
      .from(verificationBadges)
      .where(eq(verificationBadges.id, id));
    return badge || null;
  }

  async createVerificationBadge(badge: InsertVerificationBadge): Promise<VerificationBadge> {
    const [created] = await db.insert(verificationBadges).values(badge).returning();
    return created;
  }

  async updateVerificationBadge(id: number, updates: Partial<VerificationBadge>): Promise<VerificationBadge | null> {
    const [updated] = await db
      .update(verificationBadges)
      .set(updates)
      .where(eq(verificationBadges.id, id))
      .returning();
    return updated || null;
  }

  async deleteVerificationBadge(id: number): Promise<boolean> {
    await db.delete(verificationBadges).where(eq(verificationBadges.id, id));
    return true;
  }

  async getUserUnlockedVerificationBadges(userId: number): Promise<VerificationBadge[]> {
    const unlocked = await db
      .select({ badge: verificationBadges })
      .from(userUnlockedVerificationBadges)
      .innerJoin(verificationBadges, eq(userUnlockedVerificationBadges.badgeId, verificationBadges.id))
      .where(
        and(
          eq(userUnlockedVerificationBadges.userId, userId),
          eq(verificationBadges.isActive, true)
        )
      );

    const defaultBadges = await db
      .select()
      .from(verificationBadges)
      .where(
        and(
          eq(verificationBadges.isDefault, true),
          eq(verificationBadges.isActive, true)
        )
      );

    const unlockedBadges = unlocked.map((u) => u.badge);
    const allBadges = [...unlockedBadges, ...defaultBadges];
    const uniqueBadges = allBadges.filter(
      (badge, index, self) => index === self.findIndex((b) => b.id === badge.id)
    );

    return uniqueBadges;
  }

  async unlockVerificationBadgeForUser(userId: number, badgeId: number): Promise<UserUnlockedVerificationBadge> {
    const [unlock] = await db
      .insert(userUnlockedVerificationBadges)
      .values({ userId, badgeId })
      .returning();
    return unlock;
  }

  async userHasUnlockedVerificationBadge(userId: number, badgeId: number): Promise<boolean> {
    const [badge] = await db
      .select()
      .from(verificationBadges)
      .where(eq(verificationBadges.id, badgeId));

    if (badge?.isDefault) {
      return true;
    }

    const [unlock] = await db
      .select()
      .from(userUnlockedVerificationBadges)
      .where(
        and(
          eq(userUnlockedVerificationBadges.userId, userId),
          eq(userUnlockedVerificationBadges.badgeId, badgeId)
        )
      );
    return !!unlock;
  }

  async updateUserVerificationBadge(userId: number, badgeId: number | null): Promise<void> {
    await db
      .update(users)
      .set({
        selectedVerificationBadgeId: badgeId,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  // Daily fire limit operations
  async getUserDailyFires(userId: number, date: string): Promise<UserDailyFires | null> {
    const [record] = await db
      .select()
      .from(userDailyFires)
      .where(
        and(
          eq(userDailyFires.userId, userId),
          eq(userDailyFires.fireDate, date)
        )
      );
    return record || null;
  }

  async incrementDailyFireCount(userId: number): Promise<UserDailyFires> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const existing = await this.getUserDailyFires(userId, today);
    
    if (existing) {
      // Update existing record
      const [updated] = await db
        .update(userDailyFires)
        .set({ 
          firesCount: existing.firesCount + 1,
          updatedAt: new Date()
        })
        .where(eq(userDailyFires.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new record for today
      const [created] = await db
        .insert(userDailyFires)
        .values({
          userId,
          fireDate: today,
          firesCount: 1
        })
        .returning();
      return created;
    }
  }

  async getFireLimits(userId: number): Promise<FireLimits> {
    const user = await this.getUser(userId);
    const isPro = user?.isPro ?? false;
    
    // Pro users get 3 fires per day, regular users get 1
    const maxFiresPerDay = isPro ? 3 : 1;
    
    const today = new Date().toISOString().split('T')[0];
    const dailyFires = await this.getUserDailyFires(userId, today);
    const firesUsedToday = dailyFires?.firesCount ?? 0;
    
    return {
      isPro,
      maxFiresPerDay,
      firesUsedToday,
      canFire: firesUsedToday < maxFiresPerDay
    };
  }

  async getXpSettings(): Promise<XpSetting[]> {
    return await db.select().from(xpSettings).orderBy(xpSettings.category, xpSettings.key);
  }

  async updateXpSetting(key: string, value: number, updatedBy?: number): Promise<XpSetting> {
    const [updated] = await db
      .update(xpSettings)
      .set({ value, updatedAt: new Date(), updatedBy: updatedBy ?? null })
      .where(eq(xpSettings.key, key))
      .returning();
    if (!updated) throw new Error(`XP setting '${key}' not found`);
    return updated;
  }

  async upsertXpSetting(setting: InsertXpSetting): Promise<XpSetting> {
    const [result] = await db
      .insert(xpSettings)
      .values({ ...setting, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: xpSettings.key,
        set: {
          value: setting.value,
          label: setting.label,
          description: setting.description,
          category: setting.category,
          updatedAt: new Date(),
          updatedBy: setting.updatedBy ?? null,
        },
      })
      .returning();
    return result;
  }
}