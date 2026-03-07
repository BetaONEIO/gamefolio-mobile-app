import {
  users, games, clips, likes, comments, userGameFavorites, follows, messages, profileBanners,
  monthlyLeaderboard, weeklyLeaderboard, topContributors, userPointsHistory, userXPHistory, notifications, userBadges, contentFilterSettings, bannedWords,
  heroTextSettings, bannerSettings, uploadedBanners, clipMentions, commentMentions, screenshotCommentMentions, nftWatchlist, assetRewards, assetRewardClaims,
  userDailyUploads, proLootboxGrants, nameTags, userUnlockedNameTags, userDailyFires, profileBorders, userUnlockedBorders, verificationBadges, userUnlockedVerificationBadges, xpSettings,
  type User, type InsertUser,
  type Game, type InsertGame,
  type Clip, type InsertClip,
  type Like, type InsertLike,
  type Comment, type InsertComment,
  type UserGameFavorite, type InsertUserGameFavorite,
  type Follow, type InsertFollow,
  type Message, type InsertMessage,
  type UserBlock, type InsertUserBlock,
  type ProfileBanner,
  type MonthlyLeaderboard, type InsertMonthlyLeaderboard,
  type WeeklyLeaderboard, type InsertWeeklyLeaderboard,
  type TopContributor, type InsertTopContributor,
  type UserPointsHistory, type InsertUserPointsHistory,
  type UserXPHistory, type InsertUserXPHistory,
  type Notification, type InsertNotification,
  type UserBadge, type InsertUserBadge,
  type ContentFilterSettings, type InsertContentFilterSettings,
  type BannedWord, type InsertBannedWord,
  type HeroTextSettings, type InsertHeroTextSettings,
  type BannerSettings, type InsertBannerSettings,
  type UploadedBanner, type InsertUploadedBanner,
  type ClipMention, type InsertClipMention,
  type CommentMention, type InsertCommentMention,
  type ScreenshotCommentMention, type InsertScreenshotCommentMention,
  type NftWatchlist, type InsertNftWatchlist,
  type AssetReward, type InsertAssetReward,
  type AssetRewardClaim, type InsertAssetRewardClaim,
  type AssetRewardWithClaims,
  type UserDailyUploads, type InsertUserDailyUploads,
  type ProLootboxGrant, type InsertProLootboxGrant,
  type UploadLimits,
  type UserDailyFires, type InsertUserDailyFires,
  type FireLimits,
  type NameTag, type InsertNameTag,
  type UserUnlockedNameTag, type InsertUserUnlockedNameTag,
  type ProfileBorder, type InsertProfileBorder,
  type UserUnlockedBorder, type InsertUserUnlockedBorder,
  type VerificationBadge, type InsertVerificationBadge,
  type UserUnlockedVerificationBadge, type InsertUserUnlockedVerificationBadge,
  type ClipWithUser,
  type CommentWithUser,
  type UserWithStats,
  type UserWithBadges,
  type Badge, type InsertBadge,
  type BadgeWithStats,
  type Screenshot, type InsertScreenshot,
  type InsertScreenshot as InsertScreenshotData,
  type ScreenshotComment, type InsertScreenshotComment,
  type ScreenshotCommentWithUser,
  type XpSetting, type InsertXpSetting
} from "@shared/schema";

export interface IStorage {
  // Session store
  sessionStore: any;

  // User operations
  getUser(id: number): Promise<User | null>;
  getUserById(id: number): Promise<User | null>; // Alias for getUser for mention service compatibility
  getUserByUsername(username: string): Promise<User | null>;
  getUsersByUsernames(usernames: string[]): Promise<User[]>; // For bulk username validation
  getUserByEmail(email: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | null>;
  updateUserType(id: number, userType: string): Promise<User | null>;
  deleteUser(id: number): Promise<boolean>;
  getUserWithStats(id: number): Promise<UserWithStats | null>;
  getFeaturedUsers(limit?: number): Promise<User[]>;
  updateUserStreak?(data: {userId: number, currentStreak: number, longestStreak: number, lastStreakUpdate: Date}): Promise<void>;

  // Admin operations
  getAllUsers(limit?: number, offset?: number, search?: string): Promise<UserWithBadges[]>;
  getUserCount(search?: string): Promise<number>;
  getAdminCount(): Promise<number>;
  getClipCount(): Promise<number>;
  getGameCount(): Promise<number>;
  getAllClips(limit?: number, offset?: number, currentUserId?: number): Promise<ClipWithUser[]>;
  getUserTypeDistribution(): Promise<{type: string, count: number}[]>;
  getAgeRangeDistribution(): Promise<{range: string, count: number}[]>;
  getTopGames(limit?: number): Promise<Game[]>;
  getRecentClips(limit?: number): Promise<ClipWithUser[]>;
  getProSubscribers(): Promise<Array<{
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
  }>>;

  // Game operations
  getGame(id: number): Promise<Game | null>;
  getGameByName(name: string): Promise<Game | null>;
  getGameByTwitchId(twitchId: string): Promise<Game | null>;
  createGame(game: InsertGame): Promise<Game>;
  updateGame(id: number, data: Partial<InsertGame>): Promise<Game | null>;
  deleteGame(id: number): Promise<boolean>;
  getAllGames(): Promise<Game[]>;
  getTrendingGames(limit?: number): Promise<Game[]>;

  // Clip operations
  getClip(id: number): Promise<Clip | null>;
  getClipWithUser(id: number): Promise<ClipWithUser | null>;
  getClipByShareCode(shareCode: string): Promise<Clip | null>;
  createClip(clipData: InsertClip): Promise<Clip>;
  updateClip(id: number, clip: Partial<Clip>): Promise<Clip | null>;
  updateClipDuration(id: number, duration: number): Promise<boolean>;
  deleteClip(id: number): Promise<boolean>;
  incrementClipViews(id: number): Promise<void>;
  incrementScreenshotViews(id: number): Promise<void>;
  getClipsByUserId(userId: number): Promise<ClipWithUser[]>;
  getClipsByGameId(gameId: number, limit?: number): Promise<ClipWithUser[]>;
  getClipsWithDuration(duration: number): Promise<Clip[]>;
  getFeedClips(period?: string, limit?: number): Promise<ClipWithUser[]>;
  getTrendingClips(period: string, limit: number, gameId?: number, currentUserId?: number): Promise<ClipWithUser[]>;
  getTrendingReels(period: string, limit: number, gameId?: number, currentUserId?: number): Promise<ClipWithUser[]>;
  getLatestReels(limit: number, currentUserId?: number): Promise<ClipWithUser[]>;
  getClipById(id: number): Promise<ClipWithUser | null>;

  // Like operations
  createLike(like: InsertLike): Promise<Like>;
  deleteLike(userId: number, clipId: number): Promise<boolean>;
  getLikesByClipId(clipId: number): Promise<Like[]>;
  getLikesByUserId(userId: number): Promise<Like[]>;
  hasUserLikedClip(userId: number, clipId: number): Promise<boolean>;

  // Comment operations
  getComment(id: number): Promise<Comment | null>;
  createComment(comment: InsertComment): Promise<Comment>;
  getCommentsByClipId(clipId: number): Promise<CommentWithUser[]>;
  deleteComment(id: number): Promise<boolean>;

  // Mention operations
  createClipMention(mention: InsertClipMention): Promise<ClipMention>;
  createCommentMention(mention: InsertCommentMention): Promise<CommentMention>;
  createScreenshotCommentMention(mention: InsertScreenshotCommentMention): Promise<ScreenshotCommentMention>;

  // Screenshot comment operations
  createScreenshotComment(commentData: InsertScreenshotComment): Promise<ScreenshotComment>;
  getScreenshotComments(screenshotId: number): Promise<ScreenshotCommentWithUser[]>;
  deleteScreenshotComment(id: number): Promise<boolean>;

  // Comment like operations
  likeComment(commentId: number, userId: number): Promise<boolean>;
  unlikeComment(commentId: number, userId: number): Promise<boolean>;
  hasUserLikedComment(commentId: number, userId: number): Promise<boolean>;
  getCommentLikeCount(commentId: number): Promise<number>;
  
  // Screenshot comment like operations
  likeScreenshotComment(screenshotCommentId: number, userId: number): Promise<boolean>;
  unlikeScreenshotComment(screenshotCommentId: number, userId: number): Promise<boolean>;
  hasUserLikedScreenshotComment(screenshotCommentId: number, userId: number): Promise<boolean>;
  getScreenshotCommentLikeCount(screenshotCommentId: number): Promise<number>;

  // User game favorites operations
  addUserGameFavorite(favorite: InsertUserGameFavorite): Promise<UserGameFavorite>;
  removeUserGameFavorite(userId: number, gameId: number): Promise<boolean>;
  getUserGameFavorites(userId: number): Promise<Game[]>;

  // Follow operations
  createFollow(follow: InsertFollow): Promise<Follow>;
  deleteFollow(followerId: number, followingId: number): Promise<boolean>;
  getFollowersByUserId(userId: number): Promise<User[]>;
  getFollowingByUserId(userId: number): Promise<User[]>;
  isFollowing(followerId: number, followingId: number): Promise<boolean>;
  getFollowerCount(userId: number): Promise<number>;
  getFollowingCount(userId: number): Promise<number>;

  // Follow request operations
  createFollowRequest(requesterId: number, requestedId: number): Promise<void>;
  getPendingFollowRequests(userId: number): Promise<any[]>;
  getFollowRequest(requestId: number): Promise<any>;
  hasFollowRequest(requesterId: number, requestedId: number): Promise<string | null>;
  acceptFollowRequest(requestId: number): Promise<boolean>;
  declineFollowRequest(requestId: number): Promise<boolean>;
  removeFollowRequest(requesterId: number, requestedId: number): Promise<void>;

  // Message operations
  createMessage(message: InsertMessage): Promise<Message>;
  deleteMessage(messageId: number, senderId: number): Promise<boolean>;
  deleteConversationHistory(userId1: number, userId2: number): Promise<boolean>;
  getMessagesBetweenUsers(userId1: number, userId2: number): Promise<Message[]>;
  getConversations(userId: number): Promise<any[]>;
  markMessagesAsRead(currentUserId: number, otherUserId: number): Promise<void>;

  // User blocking operations
  blockUser(blockerId: number, blockedId: number): Promise<UserBlock>;
  unblockUser(blockerId: number, blockedId: number): Promise<boolean>;
  getBlockedUsers(userId: number): Promise<User[]>;
  isUserBlocked(userId1: number, userId2: number): Promise<boolean>;

  // Search operations
  searchUsers(query: string): Promise<User[]>;
  searchGames(query: string): Promise<Game[]>;
  searchClips(query: string): Promise<ClipWithUser[]>;
  searchReels(query: string): Promise<ClipWithUser[]>;
  searchScreenshots(query: string): Promise<Screenshot[]>;

  // Profile customization operations
  getAllProfileBanners(): Promise<ProfileBanner[]>;
  getProfileBannersByCategory(category: string): Promise<ProfileBanner[]>;
  
  // User unlocked banners operations
  getUserUnlockedBanners(userId: number): Promise<ProfileBanner[]>;
  unlockBannerForUser(userId: number, bannerId: number): Promise<void>;
  hasUserUnlockedBanner(userId: number, bannerId: number): Promise<boolean>;

  // Uploaded banner operations
  createUploadedBanner(userId: number, bannerUrl: string): Promise<UploadedBanner>;
  getUserUploadedBanners(userId: number): Promise<UploadedBanner[]>;
  setActiveBanner(userId: number, bannerId: number): Promise<boolean>;
  deleteUploadedBanner(userId: number, bannerId: number): Promise<boolean>;

  // Leaderboard operations
  addUserPointsHistory(pointsHistory: InsertUserPointsHistory): Promise<UserPointsHistory>;
  deleteHistoricMigrationPoints(): Promise<void>;
  rebuildLeaderboards(): Promise<void>;
  getMonthlyLeaderboardEntry(userId: number, month: string, year: number): Promise<MonthlyLeaderboard | undefined>;
  createMonthlyLeaderboardEntry(entry: InsertMonthlyLeaderboard): Promise<MonthlyLeaderboard>;
  updateMonthlyLeaderboardEntry(id: number, updates: Partial<MonthlyLeaderboard>): Promise<MonthlyLeaderboard | undefined>;
  getMonthlyLeaderboard(month: string, year: number, limit?: number): Promise<(MonthlyLeaderboard & { user: User })[]>;
  recalculateMonthlyRankings(month: string, year: number): Promise<void>;
  getAllTimeLeaderboard(limit?: number): Promise<Array<{
    userId: number;
    uploadsCount: number;
    likesGivenCount: number;
    commentsCount: number;
    firesGivenCount: number;
    viewsCount: number;
    totalPoints: number;
    rank: number;
    user: User;
  }>>;
  
  // Weekly leaderboard operations
  getWeeklyLeaderboardEntry(userId: number, week: string, year: number): Promise<WeeklyLeaderboard | null>;
  createWeeklyLeaderboardEntry(entry: InsertWeeklyLeaderboard): Promise<WeeklyLeaderboard>;
  updateWeeklyLeaderboardEntry(id: number, updates: Partial<WeeklyLeaderboard>): Promise<WeeklyLeaderboard | null>;
  getWeeklyLeaderboard(week: string, year: number, limit?: number): Promise<(WeeklyLeaderboard & { user: User })[]>;
  recalculateWeeklyRankings(week: string, year: number): Promise<void>;
  
  // Top contributors operations
  createTopContributor(contributor: InsertTopContributor): Promise<TopContributor>;
  getTopContributors(periodType: string, limit?: number): Promise<(TopContributor & { user: User })[]>;
  getTopContributorsByPeriod(periodType: string, period: string, year: number): Promise<(TopContributor & { user: User })[]>;

  // XP operations (legacy - kept for backward compatibility, totalXP now stores points)
  addUserXPHistory(xpHistory: InsertUserXPHistory): Promise<UserXPHistory>;
  incrementUserXP(userId: number, xpAmount: number): Promise<void>;
  getUserXPHistory(userId: number, limit?: number): Promise<(UserXPHistory & { clip?: Clip | null })[]>;
  getXPLeaderboard(limit?: number): Promise<Array<{ id: number; username: string; displayName: string; avatarUrl: string | null; totalXP: number }>>;
  
  // Points operations (primary system for leveling and leaderboards)
  getUserPointsHistory(userId: number, limit?: number): Promise<UserPointsHistory[]>;
  incrementUserPoints(userId: number, points: number): Promise<void>;
  hasUserEarnedPointsForContent(userId: number, action: string, contentType: string, contentId: number): Promise<boolean>;

  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUserId(userId: number): Promise<Notification[]>;
  getNotification(id: number): Promise<any>;
  getUnreadNotificationsCount(userId: number): Promise<number>;
  markNotificationAsRead(id: number): Promise<boolean>;
  getFollowRequestByUsers(requesterId: number, addresseeId: number): Promise<any>;
  markAllNotificationsAsRead(userId: number): Promise<boolean>;
  deleteNotification(id: number): Promise<boolean>;
  deleteAllNotifications(userId: number): Promise<boolean>;

  // Badge definition operations
  createBadge(badge: InsertBadge): Promise<Badge>;
  getAllBadges(): Promise<Badge[]>;
  getActiveBadges(): Promise<Badge[]>;
  getBadge(id: number): Promise<Badge | null>;
  getBadgeByName(name: string): Promise<Badge | null>;
  updateBadge(id: number, badge: Partial<Badge>): Promise<Badge | null>;
  deleteBadge(id: number): Promise<boolean>;
  getBadgesWithStats(): Promise<BadgeWithStats[]>;

  // User badge operations
  createUserBadge(badge: InsertUserBadge): Promise<UserBadge>;
  getUserBadges(userId: number): Promise<UserBadge[]>;
  deleteBadgesByType(userId: number, badgeType: string): Promise<boolean>;
  deleteUserBadge(badgeId: number): Promise<boolean>;
  cleanupExpiredBadges(): Promise<void>;
  updateUserLoginTime(userId: number, additionalMinutes: number): Promise<void>;
  processNewcomerBadge(userId: number): Promise<void>;

  // Content filtering operations
  getContentFilterSettings(fieldName?: string): Promise<ContentFilterSettings[]>;
  updateContentFilterSettings(fieldName: string, settings: Partial<ContentFilterSettings>): Promise<ContentFilterSettings | null>;
  createContentFilterSettings(settings: InsertContentFilterSettings): Promise<ContentFilterSettings>;

  // Banned words operations
  getAllBannedWords(): Promise<BannedWord[]>;
  getActiveBannedWords(): Promise<BannedWord[]>;
  addBannedWord(word: InsertBannedWord): Promise<BannedWord>;
  removeBannedWord(word: string): Promise<boolean>;
  deactivateBannedWord(word: string): Promise<boolean>;
  reactivateBannedWord(word: string): Promise<boolean>;
  getBannedWord(word: string): Promise<BannedWord | null>;

  // Banner settings operations
  getBannerSettings(): Promise<BannerSettings | null>;
  updateBannerSettings(settings: Partial<BannerSettings>): Promise<BannerSettings | null>;
  createBannerSettings(settings: InsertBannerSettings): Promise<BannerSettings>;

  // Screenshot operations
  getScreenshot(id: number): Promise<Screenshot | null>;
  getScreenshotByShareCode(shareCode: string): Promise<Screenshot | null>;
  getAllScreenshots(limit?: number, offset?: number): Promise<Array<{
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
    game?: { id: number; name: string; boxArtUrl?: string | null } | null;
  }>>;
  getScreenshotCount(): Promise<number>;
  createScreenshot(screenshotData: InsertScreenshotData): Promise<Screenshot>;
  deleteScreenshot(id: number): Promise<boolean>;


  // Content reporting operations
  createClipReport(report: any): Promise<any>;
  createScreenshotReport(report: any): Promise<any>;
  getClipReportsByClipId(clipId: number): Promise<any[]>;
  getScreenshotReportsByScreenshotId(screenshotId: number): Promise<any[]>;
  getAllReports(status?: string): Promise<any[]>;
  updateClipReportStatus(id: number, status: string, reviewedBy?: number): Promise<any>;
  updateScreenshotReportStatus(id: number, status: string, reviewedBy?: number): Promise<any>;
  updateCommentReportStatus(id: number, status: string, reviewedBy?: number): Promise<any>;

  // Hero text settings operations
  getHeroTextSettings(textType: string): Promise<HeroTextSettings | null>;
  updateHeroTextSettings(textType: string, settings: { title: string; subtitle: string; updatedBy: number }): Promise<HeroTextSettings>;

  // NFT Watchlist operations
  addToNftWatchlist(watchlistData: InsertNftWatchlist): Promise<NftWatchlist>;
  removeFromNftWatchlist(userId: number, nftId: number): Promise<boolean>;
  getNftWatchlist(userId: number): Promise<NftWatchlist[]>;
  isNftInWatchlist(userId: number, nftId: number): Promise<boolean>;

  // Leaderboard operations
  getEngagementLeaderboard(limit?: number): Promise<Array<{
    user: User;
    likesReceived: number;
    commentsReceived: number;
    clipsUploaded: number;
    totalScore: number;
    rank: number;
  }>>;

  // Recommendation operations
  getRecommendedClips(userId: number, limit?: number): Promise<ClipWithUser[]>;

  // Asset reward operations
  createAssetReward(reward: InsertAssetReward): Promise<AssetReward>;
  getAllAssetRewards(): Promise<AssetReward[]>;
  getAssetReward(id: number): Promise<AssetReward | null>;
  getAssetRewardWithClaims(id: number): Promise<AssetRewardWithClaims | null>;
  updateAssetReward(id: number, updates: Partial<AssetReward>): Promise<AssetReward | null>;
  deleteAssetReward(id: number): Promise<boolean>;
  createAssetRewardClaim(claim: InsertAssetRewardClaim): Promise<AssetRewardClaim>;
  getAssetRewardClaims(rewardId: number): Promise<(AssetRewardClaim & { user: User })[]>;
  getUserUnlockedAvatarBorders(userId: number): Promise<AssetReward[]>;
  userHasUnlockedReward(userId: number, rewardId: number): Promise<boolean>;
  updateUserAvatarBorder(userId: number, avatarBorderId: number | null): Promise<void>;

  // Daily lootbox operations
  getDailyLootboxStatus(userId: number): Promise<{ canOpen: boolean; lastOpenedAt: Date | null; nextOpenAt: Date | null }>;
  openDailyLootbox(userId: number): Promise<{ reward: AssetReward; isDuplicate: boolean; consumed: boolean } | null>;
  getUserClaimedRewards(userId: number): Promise<AssetReward[]>;
  getActiveRewardsForLootbox(): Promise<AssetReward[]>;
  getUserCollectionData(userId: number): Promise<{
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
  }>;
  
  // Admin lootbox operations
  getAllLootboxOpens(): Promise<Array<{
    id: number;
    userId: number;
    lastOpenedAt: Date;
    rewardId: number | null;
    openCount: number;
    user: { id: number; username: string; displayName: string; avatarUrl: string | null };
    reward: { id: number; name: string; rarity: string; imageUrl: string } | null;
  }>>;
  resetUserLootbox(userId: number): Promise<boolean>;

  // Unified content moderation operations  
  getRecentContent(limit?: number, offset?: number, contentType?: string): Promise<Array<{
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
  }>>;
  getRecentContentCount(contentType?: string): Promise<number>;

  // Daily upload quota operations
  getUserDailyUploads(userId: number, date: string): Promise<UserDailyUploads | null>;
  incrementDailyUploadCount(userId: number, contentType: 'clip' | 'reel' | 'screenshot'): Promise<UserDailyUploads>;
  getUploadLimits(userId: number): Promise<UploadLimits>;

  // Pro lootbox grant operations
  hasProLootboxGrant(userId: number, grantType: 'initial' | 'monthly', month?: string): Promise<boolean>;
  createProLootboxGrant(userId: number, grantType: 'initial' | 'monthly', rewardId?: number): Promise<ProLootboxGrant>;
  grantProLootbox(userId: number, grantType: 'initial' | 'monthly'): Promise<{ reward: AssetReward; isDuplicate: boolean } | null>;

  // Name tag operations
  getAllNameTags(): Promise<NameTag[]>;
  getNameTag(id: number): Promise<NameTag | null>;
  createNameTag(nameTag: InsertNameTag): Promise<NameTag>;
  updateNameTag(id: number, updates: Partial<NameTag>): Promise<NameTag | null>;
  deleteNameTag(id: number): Promise<boolean>;
  getUserUnlockedNameTags(userId: number): Promise<NameTag[]>;
  unlockNameTagForUser(userId: number, nameTagId: number): Promise<UserUnlockedNameTag>;
  userHasUnlockedNameTag(userId: number, nameTagId: number): Promise<boolean>;
  updateUserNameTag(userId: number, nameTagId: number | null): Promise<void>;

  // Profile border operations
  getAllProfileBordersFromTable(): Promise<ProfileBorder[]>;
  getProfileBorder(id: number): Promise<ProfileBorder | null>;
  createProfileBorder(border: InsertProfileBorder): Promise<ProfileBorder>;
  updateProfileBorder(id: number, updates: Partial<ProfileBorder>): Promise<ProfileBorder | null>;
  deleteProfileBorder(id: number): Promise<boolean>;
  getUserUnlockedBorders2(userId: number): Promise<ProfileBorder[]>;
  unlockBorderForUser(userId: number, borderId: number): Promise<UserUnlockedBorder>;
  userHasUnlockedBorder(userId: number, borderId: number): Promise<boolean>;
  updateUserBorder(userId: number, borderId: number | null): Promise<void>;

  // Verification badge operations
  getAllVerificationBadges(): Promise<VerificationBadge[]>;
  getVerificationBadge(id: number): Promise<VerificationBadge | null>;
  createVerificationBadge(badge: InsertVerificationBadge): Promise<VerificationBadge>;
  updateVerificationBadge(id: number, updates: Partial<VerificationBadge>): Promise<VerificationBadge | null>;
  deleteVerificationBadge(id: number): Promise<boolean>;
  getUserUnlockedVerificationBadges(userId: number): Promise<VerificationBadge[]>;
  unlockVerificationBadgeForUser(userId: number, badgeId: number): Promise<UserUnlockedVerificationBadge>;
  userHasUnlockedVerificationBadge(userId: number, badgeId: number): Promise<boolean>;
  updateUserVerificationBadge(userId: number, badgeId: number | null): Promise<void>;

  // Daily fire limit operations (1/day for regular users, 3/day for Pro users)
  getUserDailyFires(userId: number, date: string): Promise<UserDailyFires | null>;
  incrementDailyFireCount(userId: number): Promise<UserDailyFires>;
  getFireLimits(userId: number): Promise<FireLimits>;

  // XP settings operations
  getXpSettings(): Promise<XpSetting[]>;
  updateXpSetting(key: string, value: number, updatedBy?: number): Promise<XpSetting>;
  upsertXpSetting(setting: InsertXpSetting): Promise<XpSetting>;
}

// Use DatabaseStorage with Supabase - no fallback to in-memory storage
import { DatabaseStorage } from "./database-storage";

// Ensure DATABASE_URL is set for Supabase connection
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Please configure your Supabase database connection.");
}

// Ensure Supabase storage is configured
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error("Supabase storage environment variables must be set. Please configure SUPABASE_URL and SUPABASE_ANON_KEY.");
}

// Always use DatabaseStorage with Supabase - no local database files or media storage
export const storage = new DatabaseStorage();

console.log('🔒 Storage initialized in Supabase-only mode - no local storage fallbacks enabled');