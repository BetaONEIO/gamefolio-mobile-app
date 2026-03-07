import { pgTable, text, serial, integer, boolean, timestamp, json, unique, real, uniqueIndex, uuid, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").unique(),
  emailVerified: boolean("email_verified").default(false),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url").default("/api/static/telegram-cloud-photo-size-4-5929334272504744521-y_1749637964973.jpg"),
  // Customization options
  accentColor: text("accent_color").default("#4C8"), // Default green accent
  primaryColor: text("primary_color").default("#02172C"), // Default navy primary
  backgroundColor: text("background_color").default("#0B2232"), // Default navy background
  cardColor: text("card_color").default("#1E3A8A"), // Default card background
  avatarBorderColor: text("avatar_border_color").default("#4ADE80"), // Default avatar border color
  profileFont: text("profile_font").default("default"),
  profileFontEffect: text("profile_font_effect").default("none"),
  profileFontAnimation: text("profile_font_animation").default("none"),
  profileFontColor: text("profile_font_color").default("#FFFFFF"),
  profileBackgroundImageUrl: text("profile_background_image_url"),
  profileBackgroundPositionX: text("profile_background_position_x").default("50"),
  profileBackgroundPositionY: text("profile_background_position_y").default("50"),
  profileBackgroundZoom: text("profile_background_zoom").default("100"),
  profileBackgroundDesktopX: text("profile_background_desktop_x").default("50"),
  profileBackgroundDesktopY: text("profile_background_desktop_y").default("50"),
  profileBackgroundDesktopZoom: text("profile_background_desktop_zoom").default("100"),
  hideBanner: boolean("hide_banner").default(false),
  layoutStyle: text("layout_style").default("grid"), // grid, masonry, classic
  // Platform connections
  steamUsername: text("steam_username"),
  xboxUsername: text("xbox_username"),
  playstationUsername: text("playstation_username"),
  twitterUsername: text("twitter_username"),  // X/Twitter
  youtubeUsername: text("youtube_username"),  // YouTube
  discordUsername: text("discord_username"),  // Discord
  epicUsername: text("epic_username"),        // Epic Games
  nintendoUsername: text("nintendo_username"), // Nintendo
  instagramUsername: text("instagram_username"), // Instagram
  facebookUsername: text("facebook_username"), // Facebook
  // Onboarding data for analytics and personalization
  userType: text("user_type"), // User type selection
  showUserType: boolean("show_user_type").default(true), // Whether to show user type badge on profile
  ageRange: text("age_range"), // Age range: 13-17, 18-24, 25-34, 35-44, 45-54, 55+
  // Authentication provider fields
  authProvider: text("auth_provider").default("local"), // "local", "google", "discord", "steam"
  externalId: text("external_id"), // Provider-specific user ID
  // User status and role
  role: text("role").default("user").notNull(), // "user", "admin", "moderator"
  status: text("status").default("active").notNull(), // "active", "banned", "suspended"
  lastLoginAt: timestamp("last_login_at"),
  totalLoginTime: integer("total_login_time").default(0).notNull(), // Total time in minutes
  bannedReason: text("banned_reason"),
  // Privacy preferences
  messagingEnabled: boolean("messaging_enabled").default(true),
  isPrivate: boolean("is_private").default(false),
  // XP System
  totalXP: real("total_xp").default(0).notNull(), // Total experience points earned from views
  level: integer("level").default(1).notNull(), // User level based on XP
  // Login Streak System
  currentStreak: integer("current_streak").default(0).notNull(), // Current consecutive login days
  longestStreak: integer("longest_streak").default(0).notNull(), // Longest streak ever achieved
  lastStreakUpdate: timestamp("last_streak_update"), // Last date streak was updated
  // Crossmint Wallet
  walletAddress: text("wallet_address"),
  walletChain: text("wallet_chain").default("skale-nebula-testnet"),
  walletCreatedAt: timestamp("wallet_created_at"),
  encryptedPrivateKey: text("encrypted_private_key"),
  // GF Token Balance
  gfTokenBalance: real("gf_token_balance").default(0).notNull(),
  // Gamefolio Pro subscription
  isPro: boolean("is_pro").default(false).notNull(), // Gamefolio Pro subscriber status
  proSubscriptionType: text("pro_subscription_type"), // "yearly", "monthly", etc.
  proSubscriptionStartDate: timestamp("pro_subscription_start_date"), // When subscription started
  proSubscriptionEndDate: timestamp("pro_subscription_end_date"), // When subscription expires
  stripeCustomerId: text("stripe_customer_id"), // Stripe customer ID for recurring billing
  stripeSubscriptionId: text("stripe_subscription_id"), // Stripe subscription ID for managing recurring payments
  // Selected Avatar Border (from lootbox rewards)
  selectedAvatarBorderId: integer("selected_avatar_border_id"), // References asset_rewards table
  // Selected Name Tag
  selectedNameTagId: integer("selected_name_tag_id"), // References name_tags table
  // Selected Profile Border
  selectedBorderId: integer("selected_border_id"), // References profile_borders table
  // Selected Verification Badge
  selectedVerificationBadgeId: integer("selected_verification_badge_id"), // References verification_badges table
  // NFT Profile Picture
  nftProfileTokenId: integer("nft_profile_token_id"),
  nftProfileImageUrl: text("nft_profile_image_url"),
  activeProfilePicType: text("active_profile_pic_type").default("upload"),
  // Date of Birth (full date for age verification)
  dateOfBirth: text("date_of_birth"), // Stored as YYYY-MM-DD format for age verification
  // Birthday
  birthday: text("birthday"), // Stored as MM-DD format for annual birthday checks
  lastBirthdayNotificationYear: integer("last_birthday_notification_year"), // Year when last birthday notification was sent
  // NFT Permissions (beta bypass)
  canMintNfts: boolean("can_mint_nfts").default(false).notNull(),
  canSellNfts: boolean("can_sell_nfts").default(false).notNull(),
  // Welcome Pack
  welcomePackClaimed: boolean("welcome_pack_claimed").default(false).notNull(), // Whether the user has claimed their welcome pack
  // Two-Factor Authentication
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
  twoFactorSecret: text("two_factor_secret"), // Encrypted TOTP secret
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Games table
export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  imageUrl: text("image_url"),
  twitchId: text("twitch_id"),
  isUserAdded: boolean("is_user_added").default(false).notNull(),
  showContactBanner: boolean("show_contact_banner").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Clips table
export const clips = pgTable("clips", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  gameId: integer("game_id").references(() => games.id),
  title: text("title").notNull(),
  description: text("description"),
  videoUrl: text("video_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  gameName: text("game_name"),
  gameImageUrl: text("game_image_url"),
  views: integer("views").default(0),
  filter: text("filter").default("none"),
  tags: text("tags").array(),
  duration: integer("duration").default(0),
  trimStart: integer("trim_start").default(0),
  trimEnd: integer("trim_end").default(0),
  videoType: text("video_type").default("clip"), // "clip" or "reel"
  ageRestricted: boolean("age_restricted").default(false).notNull(),
  shareCode: text("share_code").unique(),
  pinnedAt: timestamp("pinned_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Likes table
export const likes = pgTable("likes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  clipId: integer("clip_id").references(() => clips.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Screenshot likes table (Added missing FKs)
export const screenshotLikes = pgTable("screenshot_likes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  screenshotId: integer("screenshot_id").references(() => screenshots.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Comments table
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  clipId: integer("clip_id").notNull().references(() => clips.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Screenshots table
export const screenshots = pgTable("screenshots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  gameId: integer("game_id").references(() => games.id),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  tags: text("tags").array(),
  views: integer("views").default(0),
  ageRestricted: boolean("age_restricted").default(false).notNull(),
  shareCode: text("share_code").unique(),
  pinnedAt: timestamp("pinned_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// UserGameFavorites table
export const userGameFavorites = pgTable("user_game_favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  gameId: integer("game_id").notNull().references(() => games.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Game stats table - for tracking player achievements and stats
export const gameStats = pgTable("game_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  gameId: integer("game_id").notNull().references(() => games.id),
  statName: text("stat_name").notNull(),
  statValue: text("stat_value").notNull(),
  verified: boolean("verified").default(false).notNull(),
  verificationImage: text("verification_image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Follows table
export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").notNull().references(() => users.id),
  followingId: integer("following_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Prevent duplicate follows between the same two users
  uniqueFollow: unique().on(table.followerId, table.followingId),
}));

// Follow Requests table
export const followRequests = pgTable("follow_requests", {
  id: serial("id").primaryKey(),
  requesterId: integer("requester_id").notNull().references(() => users.id),
  addresseeId: integer("addressee_id").notNull().references(() => users.id),
  status: text("status").default("pending").notNull(), // "pending", "approved", "rejected"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Messages table
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  receiverId: integer("receiver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User blocks table
export const userBlocks = pgTable("user_blocks", {
  id: serial("id").primaryKey(),
  blockerId: integer("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  blockedId: integer("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Predefined banners for users to choose from
export const profileBanners = pgTable("profile_banners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  category: text("category").notNull(), // "abstract", "gaming", "esports", etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Track which banners users have unlocked
export const userUnlockedBanners = pgTable("user_unlocked_banners", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bannerId: integer("banner_id").notNull().references(() => profileBanners.id, { onDelete: "cascade" }),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
});

export const insertUserUnlockedBannerSchema = createInsertSchema(userUnlockedBanners).omit({
  id: true,
  unlockedAt: true,
});

export type UserUnlockedBanner = typeof userUnlockedBanners.$inferSelect;
export type InsertUserUnlockedBanner = z.infer<typeof insertUserUnlockedBannerSchema>;

// Name tags for profile customization
export const nameTags = pgTable("name_tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  rarity: text("rarity").notNull().default("common"), // common, rare, epic, legendary
  gfCost: integer("gf_cost").default(0), // GF token cost to purchase in store (0 = not for sale)
  unlockCondition: text("unlock_condition"), // Description of how to unlock (e.g., "Reach level 10", "Complete 50 uploads")
  isDefault: boolean("is_default").default(false).notNull(), // If true, all users have this unlocked
  isActive: boolean("is_active").default(true).notNull(),
  availableInStore: boolean("available_in_store").default(false).notNull(), // If true, can be purchased in store
  availableInLootbox: boolean("available_in_lootbox").default(false).notNull(), // If true, can be won from lootbox
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Track which name tags users have unlocked
export const userUnlockedNameTags = pgTable("user_unlocked_name_tags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nameTagId: integer("name_tag_id").notNull().references(() => nameTags.id, { onDelete: "cascade" }),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
});

export const insertNameTagSchema = createInsertSchema(nameTags).omit({
  id: true,
  createdAt: true,
});

export const insertUserUnlockedNameTagSchema = createInsertSchema(userUnlockedNameTags).omit({
  id: true,
  unlockedAt: true,
});

export type NameTag = typeof nameTags.$inferSelect;
export type InsertNameTag = z.infer<typeof insertNameTagSchema>;
export type UserUnlockedNameTag = typeof userUnlockedNameTags.$inferSelect;
export type InsertUserUnlockedNameTag = z.infer<typeof insertUserUnlockedNameTagSchema>;

// Profile borders for profile customization
export const profileBorders = pgTable("profile_borders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  rarity: text("rarity").notNull().default("common"), // common, rare, epic, legendary
  gfCost: integer("gf_cost").default(0), // GF token cost to purchase in store (0 = not for sale)
  unlockCondition: text("unlock_condition"), // Description of how to unlock
  isDefault: boolean("is_default").default(false).notNull(), // If true, all users have this unlocked
  isActive: boolean("is_active").default(true).notNull(),
  availableInStore: boolean("available_in_store").default(false).notNull(), // If true, can be purchased in store
  availableInLootbox: boolean("available_in_lootbox").default(false).notNull(), // If true, can be won from lootbox
  proOnly: boolean("pro_only").default(true).notNull(), // Borders are Pro-only
  shape: text("shape").notNull().default("circle"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Track which profile borders users have unlocked
export const userUnlockedBorders = pgTable("user_unlocked_borders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  borderId: integer("border_id").notNull().references(() => profileBorders.id, { onDelete: "cascade" }),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
});

export const insertProfileBorderSchema = createInsertSchema(profileBorders).omit({
  id: true,
  createdAt: true,
});

export const insertUserUnlockedBorderSchema = createInsertSchema(userUnlockedBorders).omit({
  id: true,
  unlockedAt: true,
});

export type ProfileBorder = typeof profileBorders.$inferSelect;
export type InsertProfileBorder = z.infer<typeof insertProfileBorderSchema>;
export type UserUnlockedBorder = typeof userUnlockedBorders.$inferSelect;
export type InsertUserUnlockedBorder = z.infer<typeof insertUserUnlockedBorderSchema>;

// Verification badges for profile customization
export const verificationBadges = pgTable("verification_badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  rarity: text("rarity").notNull().default("common"),
  gfCost: integer("gf_cost").default(0),
  isDefault: boolean("is_default").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  availableInStore: boolean("available_in_store").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userUnlockedVerificationBadges = pgTable("user_unlocked_verification_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  badgeId: integer("badge_id").notNull().references(() => verificationBadges.id, { onDelete: "cascade" }),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
});

export const insertVerificationBadgeSchema = createInsertSchema(verificationBadges).omit({
  id: true,
  createdAt: true,
});

export const insertUserUnlockedVerificationBadgeSchema = createInsertSchema(userUnlockedVerificationBadges).omit({
  id: true,
  unlockedAt: true,
});

export type VerificationBadge = typeof verificationBadges.$inferSelect;
export type InsertVerificationBadge = z.infer<typeof insertVerificationBadgeSchema>;
export type UserUnlockedVerificationBadge = typeof userUnlockedVerificationBadges.$inferSelect;
export type InsertUserUnlockedVerificationBadge = z.infer<typeof insertUserUnlockedVerificationBadgeSchema>;

// Notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id), // Who receives the notification
  type: text("type").notNull(), // "like", "comment", "follow", "upload", "reply", "clip_mention", "comment_mention"
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  // References to related entities
  fromUserId: integer("from_user_id").references(() => users.id), // Who triggered the notification
  clipId: integer("clip_id").references(() => clips.id), // Related clip (if applicable)
  screenshotId: integer("screenshot_id").references(() => screenshots.id), // Related screenshot (if applicable)
  commentId: integer("comment_id").references(() => comments.id), // Related comment (if applicable)
  // Metadata for additional context (JSON format)
  metadata: json("metadata"), // For storing additional context like mention details
  // Metadata
  actionUrl: text("action_url"), // URL to navigate to when clicked
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Clip mentions table - for tracking user mentions in clip uploads
export const clipMentions = pgTable("clip_mentions", {
  id: serial("id").primaryKey(),
  clipId: integer("clip_id").notNull().references(() => clips.id, { onDelete: "cascade" }),
  mentionedUserId: integer("mentioned_user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // User who was mentioned
  mentionedByUserId: integer("mentioned_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // User who created the mention
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Comment mentions table - for tracking user mentions in comments
export const commentMentions = pgTable("comment_mentions", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
  mentionedUserId: integer("mentioned_user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // User who was mentioned
  mentionedByUserId: integer("mentioned_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // User who created the mention
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Screenshot comment mentions table - for tracking user mentions in screenshot comments
export const screenshotCommentMentions = pgTable("screenshot_comment_mentions", {
  id: serial("id").primaryKey(),
  screenshotCommentId: integer("screenshot_comment_id").notNull().references(() => screenshotComments.id, { onDelete: "cascade" }),
  mentionedUserId: integer("mentioned_user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // User who was mentioned
  mentionedByUserId: integer("mentioned_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // User who created the mention
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Email verification tokens table
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  token: text("token").notNull(), // Unique token for email verification
  code: text("code").notNull(), // 6-digit verification code
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Allow multiple codes per user but only track the most recent one
});

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull(),
  code: text("code"),
  email: text("email"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Emoji reactions table
export const clipReactions = pgTable("clip_reactions", {
  id: serial("id").primaryKey(),
  clipId: integer("clip_id").notNull().references(() => clips.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(), // The emoji character (e.g., "❤️", "🔥", "😂")
  positionX: integer("position_x").notNull().default(50), // Position on video (0-100)
  positionY: integer("position_y").notNull().default(50), // Position on video (0-100)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Screenshot comments table
export const screenshotComments = pgTable("screenshot_comments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  screenshotId: integer("screenshot_id").notNull().references(() => screenshots.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Screenshot reactions table (Added missing FKs)
export const screenshotReactions = pgTable("screenshot_reactions", {
  id: serial("id").primaryKey(),
  screenshotId: integer("screenshot_id").notNull().references(() => screenshots.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(), // The emoji character (e.g., "❤️", "🔥", "😂")
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Comment likes table for clip comments
export const commentLikes = pgTable("comment_likes", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserComment: uniqueIndex("comment_likes_user_comment_unique").on(table.userId, table.commentId),
}));

// Screenshot comment likes table
export const screenshotCommentLikes = pgTable("screenshot_comment_likes", {
  id: serial("id").primaryKey(),
  screenshotCommentId: integer("screenshot_comment_id").notNull().references(() => screenshotComments.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserScreenshotComment: uniqueIndex("screenshot_comment_likes_user_comment_unique").on(table.userId, table.screenshotCommentId),
}));

// Comment reports table for moderation
export const commentReports = pgTable("comment_reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  commentId: integer("comment_id").references(() => comments.id, { onDelete: "cascade" }),
  screenshotCommentId: integer("screenshot_comment_id").references(() => screenshotComments.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  additionalMessage: text("additional_message"),
  status: text("status").default("pending").notNull(), // "pending", "reviewed", "dismissed", "action_taken"
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Clip reports table for content moderation
export const clipReports = pgTable("clip_reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clipId: integer("clip_id").notNull().references(() => clips.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  additionalMessage: text("additional_message"),
  status: text("status").default("pending").notNull(), // "pending", "reviewed", "dismissed", "action_taken"
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Screenshot reports table for content moderation
export const screenshotReports = pgTable("screenshot_reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  screenshotId: integer("screenshot_id").notNull().references(() => screenshots.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  additionalMessage: text("additional_message"),
  status: text("status").default("pending").notNull(), // "pending", "reviewed", "dismissed", "action_taken"
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// NFT Watchlist table - for tracking NFTs users want to watch
export const nftWatchlist = pgTable("nft_watchlist", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nftId: integer("nft_id").notNull(), // NFT identifier (for now just the ID from the NFT collection)
  nftName: text("nft_name").notNull(),
  nftImage: text("nft_image").notNull(),
  nftPrice: real("nft_price").notNull(), // GF token price when added to watchlist
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Prevent duplicate watchlist entries for the same user and NFT
  uniqueWatchlist: unique().on(table.userId, table.nftId),
}));

// Content filter settings and custom banned words table
export const contentFilterSettings = pgTable("content_filter_settings", {
  id: serial("id").primaryKey(),
  fieldName: text("field_name").notNull().unique(), // "comments", "messages", "bio", "displayName", etc.
  isEnabled: boolean("is_enabled").default(true).notNull(),
  maxLength: integer("max_length"),
  allowProfanity: boolean("allow_profanity").default(false).notNull(),
  cleanAutomatically: boolean("clean_automatically").default(false).notNull(),
  updatedBy: integer("updated_by").references(() => users.id), // Admin who last updated
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Custom banned words table for persistent storage
export const bannedWords = pgTable("banned_words", {
  id: serial("id").primaryKey(),
  word: text("word").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  addedBy: integer("added_by").notNull().references(() => users.id), // Admin who added the word
  reason: text("reason"), // Optional reason for banning the word
  addedAt: timestamp("added_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Site-wide banner settings table
export const bannerSettings = pgTable("banner_settings", {
  id: serial("id").primaryKey(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  title: text("title").default("Alpha Stage").notNull(),
  message: text("message").default("This app is currently in Alpha. You may encounter issues while using it.").notNull(),
  linkText: text("link_text").default("report a bug"),
  linkUrl: text("link_url").default("/contact"),
  variant: text("variant").default("primary").notNull(), // "primary", "warning", "info", "danger"
  showIcon: boolean("show_icon").default(true).notNull(),
  isDismissible: boolean("is_dismissible").default(true).notNull(),
  updatedBy: integer("updated_by").references(() => users.id), // Admin who last updated
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User uploaded banners table for banner history
export const uploadedBanners = pgTable("uploaded_banners", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bannerUrl: text("banner_url").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schema for inserting a user
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  gfTokenBalance: true,
});

// Schema for password reset request
export const passwordResetRequestSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

// Schema for password reset confirmation
export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

// Schema for email verification
export const emailVerificationSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

// Types
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>;
export type EmailVerification = z.infer<typeof emailVerificationSchema>;

// Schema for inserting a game
export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
  createdAt: true,
});

// Schema for inserting a clip
export const insertClipSchema = createInsertSchema(clips).omit({
  id: true,
  views: true,
  createdAt: true,
}).extend({
  shareCode: z.string().optional(),
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or less"),
  description: z.string().max(5000, "Description must be 5000 characters or less").optional(),
  tags: z.array(z.string().max(50, "Each tag must be 50 characters or less")).max(20, "Maximum 20 tags allowed").optional(),
});

// Schema for inserting a like
export const insertLikeSchema = createInsertSchema(likes).omit({
  id: true,
  createdAt: true,
});

// Schema for inserting a comment
export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

// Schema for inserting a screenshot
export const insertScreenshotSchema = createInsertSchema(screenshots).omit({
  id: true,
  views: true,
  createdAt: true,
}).extend({
  shareCode: z.string().optional(),
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or less"),
  description: z.string().max(5000, "Description must be 5000 characters or less").optional(),
  tags: z.array(z.string().max(50, "Each tag must be 50 characters or less")).max(20, "Maximum 20 tags allowed").optional(),
});

// Schema for inserting a user game favorite
export const insertUserGameFavoriteSchema = createInsertSchema(userGameFavorites).omit({
  id: true,
  createdAt: true,
});

// Schema for inserting a follow
export const insertFollowSchema = createInsertSchema(follows).omit({
  id: true,
  createdAt: true,
});

// Schema for inserting a follow request
export const insertFollowRequestSchema = createInsertSchema(followRequests).omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  isRead: true,
  createdAt: true,
});

// Schema for inserting a user block
export const insertUserBlockSchema = createInsertSchema(userBlocks).omit({
  id: true,
  createdAt: true,
});



// Schema for inserting a game stat
export const insertGameStatSchema = createInsertSchema(gameStats).omit({
  id: true,
  verified: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for inserting a profile banner
export const insertProfileBannerSchema = createInsertSchema(profileBanners).omit({
  id: true,
  createdAt: true,
});

// Schema for inserting a notification
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  isRead: true,
  createdAt: true,
});

// Schema for inserting content filter settings
export const insertContentFilterSettingsSchema = createInsertSchema(contentFilterSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for inserting banned words
export const insertBannedWordSchema = createInsertSchema(bannedWords).omit({
  id: true,
  addedAt: true,
  updatedAt: true,
});

// Schema for inserting banner settings
export const insertBannerSettingsSchema = createInsertSchema(bannerSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for content filtering
export type ContentFilterSettings = typeof contentFilterSettings.$inferSelect;
export type InsertContentFilterSettings = typeof contentFilterSettings.$inferInsert;
export type BannedWord = typeof bannedWords.$inferSelect;
export type InsertBannedWord = typeof bannedWords.$inferInsert;

// Types for banner settings
export type BannerSettings = typeof bannerSettings.$inferSelect;
export type InsertBannerSettings = typeof bannerSettings.$inferInsert;

// Schema for inserting uploaded banners
export const insertUploadedBannerSchema = createInsertSchema(uploadedBanners).omit({
  id: true,
  createdAt: true,
});

// Types for uploaded banners
export type UploadedBanner = typeof uploadedBanners.$inferSelect;
export type InsertUploadedBanner = z.infer<typeof insertUploadedBannerSchema>;

// Sessions table for express-session with connect-pg-simple
export const sessions = pgTable("sessions", {
  sid: text("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { mode: 'date' }).notNull(),
});

// Monthly Leaderboard table
export const monthlyLeaderboard = pgTable("monthly_leaderboard", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  month: text("month").notNull(), // Format: "2024-01", "2024-02", etc.
  year: integer("year").notNull(),
  uploadsCount: integer("uploads_count").default(0).notNull(),
  likesGivenCount: integer("likes_given_count").default(0).notNull(),
  commentsCount: integer("comments_count").default(0).notNull(),
  firesGivenCount: integer("fires_given_count").default(0).notNull(),
  viewsCount: integer("views_count").default(0).notNull(),
  totalPoints: real("total_points").default(0).notNull(),
  rank: integer("rank").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserMonth: unique().on(table.userId, table.month, table.year),
}));

// User Points History table
export const userPointsHistory = pgTable("user_points_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  action: text("action").notNull(), // "upload", "like", "comment", "fire"
  points: real("points").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User XP History table - tracks XP earned from various sources
export const userXPHistory = pgTable("user_xp_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  clipId: integer("clip_id").references(() => clips.id), // Optional - only for clip-related XP
  xpAmount: integer("xp_amount").notNull(), // XP earned
  viewCount: integer("view_count"), // Optional - for view milestones
  source: text("source").notNull().default("view"), // "view", "lootbox", "like_received", "fire_received", "upload", "daily_login", "welcome_bonus", "other"
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Weekly Leaderboard table
export const weeklyLeaderboard = pgTable("weekly_leaderboard", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  week: text("week").notNull(), // Format: "2024-W01", "2024-W02", etc.
  year: integer("year").notNull(),
  uploadsCount: integer("uploads_count").default(0).notNull(),
  likesGivenCount: integer("likes_given_count").default(0).notNull(),
  commentsCount: integer("comments_count").default(0).notNull(),
  firesGivenCount: integer("fires_given_count").default(0).notNull(),
  viewsCount: integer("views_count").default(0).notNull(),
  totalPoints: real("total_points").default(0).notNull(),
  rank: integer("rank").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserWeek: unique().on(table.userId, table.week, table.year),
}));

// Top Contributors table - stores historical winners when periods end
export const topContributors = pgTable("top_contributors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  periodType: text("period_type").notNull(), // "weekly" or "monthly"
  period: text("period").notNull(), // Format: "2024-W01" for weekly, "2024-01" for monthly
  year: integer("year").notNull(),
  totalPoints: real("total_points").notNull(),
  uploadsCount: integer("uploads_count").default(0).notNull(),
  likesGivenCount: integer("likes_given_count").default(0).notNull(),
  commentsCount: integer("comments_count").default(0).notNull(),
  firesGivenCount: integer("fires_given_count").default(0).notNull(),
  viewsCount: integer("views_count").default(0).notNull(),
  achievedAt: timestamp("achieved_at").defaultNow().notNull(), // When they achieved this top position
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schema for inserting monthly leaderboard entries
export const insertMonthlyLeaderboardSchema = createInsertSchema(monthlyLeaderboard).omit({
  id: true,
  rank: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for inserting user points history
export const insertUserPointsHistorySchema = createInsertSchema(userPointsHistory).omit({
  id: true,
}).partial({ createdAt: true }); // Make createdAt optional for historic migrations

// Schema for inserting user XP history
export const insertUserXPHistorySchema = createInsertSchema(userXPHistory).omit({
  id: true,
  createdAt: true,
}).extend({
  clipId: z.number().optional(),
  viewCount: z.number().optional(),
});

// Schema for inserting weekly leaderboard entries
export const insertWeeklyLeaderboardSchema = createInsertSchema(weeklyLeaderboard).omit({
  id: true,
  rank: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for inserting top contributors
export const insertTopContributorSchema = createInsertSchema(topContributors).omit({
  id: true,
  achievedAt: true,
  createdAt: true,
});

// Schema for inserting clip reactions
export const insertClipReactionSchema = createInsertSchema(clipReactions).omit({
  id: true,
  createdAt: true,
});

// Schema for inserting screenshot comments
export const insertScreenshotCommentSchema = createInsertSchema(screenshotComments).omit({
  id: true,
  createdAt: true,
});

// Schema for inserting screenshot reactions
export const insertScreenshotReactionSchema = createInsertSchema(screenshotReactions).omit({
  id: true,
  createdAt: true,
});

// Schema for inserting comment likes
export const insertCommentLikeSchema = createInsertSchema(commentLikes).omit({
  id: true,
  createdAt: true,
});

// Schema for inserting screenshot comment likes
export const insertScreenshotCommentLikeSchema = createInsertSchema(screenshotCommentLikes).omit({
  id: true,
  createdAt: true,
});

// Schema for inserting comment reports
export const insertCommentReportSchema = createInsertSchema(commentReports).omit({
  id: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
});

// Schema for inserting clip reports
export const insertClipReportSchema = createInsertSchema(clipReports).omit({
  id: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
});

// Schema for inserting screenshot reports
export const insertScreenshotReportSchema = createInsertSchema(screenshotReports).omit({
  id: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
});

// Badges definition table - stores custom badge types
export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // Badge name like "Newcomer", "Founder", etc.
  description: text("description"), // Optional description
  imageUrl: text("image_url"), // Badge image/icon URL
  textColor: text("text_color").default("#FFFFFF").notNull(), // Text color for badge
  backgroundColor: text("background_color").default("#6B7280").notNull(), // Background color
  isActive: boolean("is_active").default(true).notNull(), // Whether badge can be assigned
  isSystemBadge: boolean("is_system_badge").default(false).notNull(), // System badges vs custom badges
  createdBy: integer("created_by").references(() => users.id), // Admin who created the badge
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User badges table - links users to their badges
export const userBadges = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  badgeId: integer("badge_id").notNull().references(() => badges.id, { onDelete: "cascade" }),
  assignedBy: text("assigned_by").notNull(), // "system" or "admin"
  assignedById: integer("assigned_by_id").references(() => users.id), // ID of admin who assigned (if manually assigned)
  expiresAt: timestamp("expires_at"), // For automatic expiration (e.g., newcomer badge)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schema for inserting badges
export const insertBadgeSchema = createInsertSchema(badges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for inserting user badges
export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({
  id: true,
  createdAt: true,
});

// Rarity tiers for asset rewards
export const rarityTiers = ["common", "rare", "epic", "legendary"] as const;
export type RarityTier = typeof rarityTiers[number];

// Asset types for categorizing where rewards are used
export const assetTypes = ["avatar_border", "profile_banner", "profile_background", "badge", "emoji", "sound_effect", "xp_reward", "gf_tokens", "other"] as const;
export type AssetType = typeof assetTypes[number];

// Border categories for avatar borders
export const borderCategories = ["static", "animated", "pro"] as const;
export type BorderCategory = typeof borderCategories[number];

// Reward categories for categorizing how items are obtained
export const rewardCategories = ["pro_user", "lootbox", "free_item", "store_item", "redeemable", "other"] as const;
export type RewardCategory = typeof rewardCategories[number];

// Asset rewards table for loot box rewards
export const assetRewards = pgTable("asset_rewards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  assetType: text("asset_type").notNull().default("other"), // avatar_border, profile_banner, profile_background, badge, emoji, sound_effect, xp_reward, gf_tokens, other
  category: text("category").default("static"), // static, animated, pro - for avatar borders
  rarity: text("rarity").notNull().default("common"), // common, rare, epic, legendary
  unlockChance: real("unlock_chance").notNull().default(10), // Percentage chance (0-100)
  rewardValue: integer("reward_value"), // For consumable rewards like XP or GF tokens - the amount to grant
  timesRewarded: integer("times_rewarded").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  availableInLootbox: boolean("available_in_lootbox").default(true).notNull(),
  availableInStore: boolean("available_in_store").default(false).notNull(),
  proOnly: boolean("pro_only").default(false).notNull(),
  freeItem: boolean("free_item").default(false).notNull(), // Available to all users for free
  redeemable: boolean("redeemable").default(false).notNull(), // Can be redeemed via code/promotion
  rewardCategory: text("reward_category").default("other"), // Primary category: pro_user, lootbox, free_item, store_item, redeemable, other
  storePrice: integer("store_price"),
  sourceBucket: text("source_bucket"), // Supabase bucket name: gamefolio-name-tags, gamefolio-assets
  sourcePath: text("source_path"), // Path within the bucket
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Asset reward claims - tracks who received which rewards
export const assetRewardClaims = pgTable("asset_reward_claims", {
  id: serial("id").primaryKey(),
  rewardId: integer("reward_id").notNull().references(() => assetRewards.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  claimedAt: timestamp("claimed_at").defaultNow().notNull(),
});

// Hero text settings table for customizable homepage text
export const heroTextSettings = pgTable("hero_text_settings", {
  id: serial("id").primaryKey(),
  textType: text("text_type").notNull(), // "experienced_users" - for users who have uploaded content
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  buttonText: text("button_text"), // Optional button text
  buttonUrl: text("button_url"), // Optional button URL/path
  targetAudience: text("target_audience").notNull().default("experienced_users"), // "new_users", "existing_users", "users_with_content", "all_users"
  isActive: boolean("is_active").default(true).notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Schema for inserting hero text settings
export const insertHeroTextSettingsSchema = createInsertSchema(heroTextSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for inserting asset rewards
export const insertAssetRewardSchema = createInsertSchema(assetRewards).omit({
  id: true,
  timesRewarded: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for inserting asset reward claims
export const insertAssetRewardClaimSchema = createInsertSchema(assetRewardClaims).omit({
  id: true,
  claimedAt: true,
});

// Daily lootbox tracking table
export const userDailyLootbox = pgTable("user_daily_lootbox", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastOpenedAt: timestamp("last_opened_at").defaultNow().notNull(),
  rewardId: integer("reward_id").references(() => assetRewards.id),
  openCount: integer("open_count").default(1).notNull(),
});

// Schema for inserting daily lootbox record
export const insertUserDailyLootboxSchema = createInsertSchema(userDailyLootbox).omit({
  id: true,
});

// Daily upload tracking table - tracks uploads per user per day for quota enforcement
export const userDailyUploads = pgTable("user_daily_uploads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  uploadDate: text("upload_date").notNull(), // YYYY-MM-DD format in UTC
  clipsCount: integer("clips_count").default(0).notNull(),
  reelsCount: integer("reels_count").default(0).notNull(),
  screenshotsCount: integer("screenshots_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserDate: unique().on(table.userId, table.uploadDate),
}));

// Schema for inserting daily upload record
export const insertUserDailyUploadsSchema = createInsertSchema(userDailyUploads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Pro lootbox grants table - tracks initial and monthly lootbox grants for Pro subscribers
export const proLootboxGrants = pgTable("pro_lootbox_grants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  grantType: text("grant_type").notNull(), // 'initial' or 'monthly'
  grantedForMonth: text("granted_for_month"), // YYYY-MM format for monthly grants
  rewardId: integer("reward_id").references(() => assetRewards.id),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
});

// Daily fire reactions tracking table - tracks fire reactions per user per day
// Regular users: 1 fire/day, Pro users: 3 fires/day
// Fire reactions cannot be removed once given
export const userDailyFires = pgTable("user_daily_fires", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fireDate: text("fire_date").notNull(), // YYYY-MM-DD format in UTC
  firesCount: integer("fires_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserDate: unique().on(table.userId, table.fireDate),
}));

// Schema for inserting daily fire record
export const insertUserDailyFiresSchema = createInsertSchema(userDailyFires).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for inserting pro lootbox grant
export const insertProLootboxGrantSchema = createInsertSchema(proLootboxGrants).omit({
  id: true,
  grantedAt: true,
});

// Extended types for frontend use
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type MonthlyLeaderboard = typeof monthlyLeaderboard.$inferSelect;
export type InsertMonthlyLeaderboard = z.infer<typeof insertMonthlyLeaderboardSchema>;
export type WeeklyLeaderboard = typeof weeklyLeaderboard.$inferSelect;
export type InsertWeeklyLeaderboard = z.infer<typeof insertWeeklyLeaderboardSchema>;
export type TopContributor = typeof topContributors.$inferSelect;
export type InsertTopContributor = z.infer<typeof insertTopContributorSchema>;
export type UserPointsHistory = typeof userPointsHistory.$inferSelect;
export type InsertUserPointsHistory = z.infer<typeof insertUserPointsHistorySchema>;
export type UserXPHistory = typeof userXPHistory.$inferSelect;
export type InsertUserXPHistory = z.infer<typeof insertUserXPHistorySchema>;
export type ClipReaction = typeof clipReactions.$inferSelect;
export type InsertClipReaction = z.infer<typeof insertClipReactionSchema>;

export type ScreenshotComment = typeof screenshotComments.$inferSelect;
export type InsertScreenshotComment = z.infer<typeof insertScreenshotCommentSchema>;

export type ScreenshotReaction = typeof screenshotReactions.$inferSelect;
export type InsertScreenshotReaction = z.infer<typeof insertScreenshotReactionSchema>;

export type CommentLike = typeof commentLikes.$inferSelect;
export type InsertCommentLike = z.infer<typeof insertCommentLikeSchema>;

export type ScreenshotCommentLike = typeof screenshotCommentLikes.$inferSelect;
export type InsertScreenshotCommentLike = z.infer<typeof insertScreenshotCommentLikeSchema>;

export type CommentReport = typeof commentReports.$inferSelect;
export type InsertCommentReport = z.infer<typeof insertCommentReportSchema>;

export type ClipReport = typeof clipReports.$inferSelect;
export type InsertClipReport = z.infer<typeof insertClipReportSchema>;

export type ScreenshotReport = typeof screenshotReports.$inferSelect;
export type InsertScreenshotReport = z.infer<typeof insertScreenshotReportSchema>;

export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;

export type Clip = typeof clips.$inferSelect;
export type InsertClip = z.infer<typeof insertClipSchema>;

export type Like = typeof likes.$inferSelect;
export type InsertLike = z.infer<typeof insertLikeSchema>;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;

export type UserGameFavorite = typeof userGameFavorites.$inferSelect;
export type InsertUserGameFavorite = z.infer<typeof insertUserGameFavoriteSchema>;

export type Follow = typeof follows.$inferSelect;
export type InsertFollow = z.infer<typeof insertFollowSchema>;

export type FollowRequest = typeof followRequests.$inferSelect;
export type InsertFollowRequest = z.infer<typeof insertFollowRequestSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type UserBlock = typeof userBlocks.$inferSelect;
export type InsertUserBlock = z.infer<typeof insertUserBlockSchema>;

export type ProfileBanner = typeof profileBanners.$inferSelect;
export type InsertProfileBanner = z.infer<typeof insertProfileBannerSchema>;

export type Screenshot = typeof screenshots.$inferSelect;
export type InsertScreenshot = z.infer<typeof insertScreenshotSchema>;

export type Badge = typeof badges.$inferSelect;
export type InsertBadge = z.infer<typeof insertBadgeSchema>;

export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;

export type HeroTextSettings = typeof heroTextSettings.$inferSelect;
export type InsertHeroTextSettings = z.infer<typeof insertHeroTextSettingsSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// Schema for inserting clip mentions
export const insertClipMentionSchema = createInsertSchema(clipMentions).omit({
  id: true,
  createdAt: true,
});

// Schema for inserting comment mentions
export const insertCommentMentionSchema = createInsertSchema(commentMentions).omit({
  id: true,
  createdAt: true,
});

// Schema for inserting screenshot comment mentions
export const insertScreenshotCommentMentionSchema = createInsertSchema(screenshotCommentMentions).omit({
  id: true,
  createdAt: true,
});

// Types for mentions
export type ClipMention = typeof clipMentions.$inferSelect;
export type InsertClipMention = z.infer<typeof insertClipMentionSchema>;

export type CommentMention = typeof commentMentions.$inferSelect;
export type InsertCommentMention = z.infer<typeof insertCommentMentionSchema>;

export type ScreenshotCommentMention = typeof screenshotCommentMentions.$inferSelect;
export type InsertScreenshotCommentMention = z.infer<typeof insertScreenshotCommentMentionSchema>;

// Schema for inserting NFT watchlist items
export const insertNftWatchlistSchema = createInsertSchema(nftWatchlist).omit({
  id: true,
  createdAt: true,
});

// Types for NFT watchlist
export type NftWatchlist = typeof nftWatchlist.$inferSelect;
export type InsertNftWatchlist = z.infer<typeof insertNftWatchlistSchema>;

// Extended types with relational data
export type ClipWithUser = Clip & {
  user: User;
  game?: Game;
  _count?: {
    likes: number;
    comments: number;
    reactions: number;
  };
};

export type ScreenshotLike = typeof screenshotLikes.$inferSelect;

export type CommentWithUser = Comment & {
  user: User;
};

export type ScreenshotCommentWithUser = ScreenshotComment & {
  user: User;
};

export type UserWithStats = User & {
  _count?: {
    followers: number;
    following: number;
    clips: number;
    screenshots: number;
    clipViews: number;
    likesReceived: number;
    firesReceived: number;
  };
  favoriteGames?: Game[];
};

export type UserWithBadges = User & {
  badges: (UserBadge & { badge: Badge })[];
};

export type BadgeWithStats = Badge & {
  _count: {
    users: number;
  };
};

// Types for asset rewards
export type AssetReward = typeof assetRewards.$inferSelect;
export type InsertAssetReward = z.infer<typeof insertAssetRewardSchema>;
export type AssetRewardClaim = typeof assetRewardClaims.$inferSelect;
export type InsertAssetRewardClaim = z.infer<typeof insertAssetRewardClaimSchema>;
export type UserDailyLootbox = typeof userDailyLootbox.$inferSelect;
export type InsertUserDailyLootbox = z.infer<typeof insertUserDailyLootboxSchema>;

// Extended type for asset reward with claim info
export type AssetRewardWithClaims = AssetReward & {
  claims: (AssetRewardClaim & { user: User })[];
};

// Types for daily upload tracking
export type UserDailyUploads = typeof userDailyUploads.$inferSelect;
export type InsertUserDailyUploads = z.infer<typeof insertUserDailyUploadsSchema>;

// Types for Pro lootbox grants
export type ProLootboxGrant = typeof proLootboxGrants.$inferSelect;
export type InsertProLootboxGrant = z.infer<typeof insertProLootboxGrantSchema>;

// Types for daily fire tracking
export type UserDailyFires = typeof userDailyFires.$inferSelect;
export type InsertUserDailyFires = z.infer<typeof insertUserDailyFiresSchema>;

// Fire limits configuration type
export interface FireLimits {
  isPro: boolean;
  maxFiresPerDay: number;
  firesUsedToday: number;
  canFire: boolean;
}

// Upload limits configuration type
export interface UploadLimits {
  isPro: boolean;
  maxClipsPerDay: number;
  maxReelsPerDay: number;
  maxScreenshotsPerDay: number;
  maxVideoSizeMB: number;
  maxImageSizeMB: number;
  clipsUploadedToday: number;
  reelsUploadedToday: number;
  screenshotsUploadedToday: number;
  canUploadClip: boolean;
  canUploadReel: boolean;
  canUploadScreenshot: boolean;
  totalClipsExisting: number;
  totalReelsExisting: number;
  totalScreenshotsExisting: number;
  maxClipsTotal: number;
  maxReelsTotal: number;
  maxScreenshotsTotal: number;
}

// GF Token Orders table - for tracking GF token purchases via Stripe
export const gfOrders = pgTable("gf_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  walletAddress: text("wallet_address"),
  gbpAmount: real("gbp_amount").notNull(),
  gfAmount: real("gf_amount").notNull(),
  priceUsed: real("price_used").notNull(),
  status: text("status").notNull().default("pending"), // "pending", "processing", "completed", "failed", "refunded"
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  txHash: text("tx_hash"),
  errorReason: text("error_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("gf_orders_user_id_idx").on(table.userId),
  stripeSessionIdIdx: index("gf_orders_stripe_session_id_idx").on(table.stripeSessionId),
  statusIdx: index("gf_orders_status_idx").on(table.status),
}));

export const insertGfOrderSchema = createInsertSchema(gfOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type GfOrder = typeof gfOrders.$inferSelect;
export type InsertGfOrder = z.infer<typeof insertGfOrderSchema>;

export const storeItems = pgTable("store_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  image: text("image"),
  gfCost: real("gf_cost").notNull(),
  category: text("category").notNull().default("general"),
  rarity: text("rarity").default("common"),
  available: boolean("available").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStoreItemSchema = createInsertSchema(storeItems).omit({
  id: true,
  createdAt: true,
});
export type InsertStoreItem = z.infer<typeof insertStoreItemSchema>;
export type StoreItem = typeof storeItems.$inferSelect;

export const storePurchases = pgTable("store_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }).notNull(),
  itemId: integer("item_id").references(() => storeItems.id, { onDelete: "cascade" }).notNull(),
  walletAddress: text("wallet_address").notNull(),
  gfAmount: real("gf_amount").notNull(),
  status: text("status").notNull().default("pending"),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  userIdIdx: index("store_purchases_user_id_idx").on(table.userId),
  itemIdIdx: index("store_purchases_item_id_idx").on(table.itemId),
  statusIdx: index("store_purchases_status_idx").on(table.status),
}));

export const insertStorePurchaseSchema = createInsertSchema(storePurchases).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});
export type InsertStorePurchase = z.infer<typeof insertStorePurchaseSchema>;
export type StorePurchase = typeof storePurchases.$inferSelect;

export const heroSlides = pgTable("hero_slides", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  buttonText: text("button_text"),
  buttonLink: text("button_link"),
  imageUrl: text("image_url").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  visibility: text("visibility").notNull().default("everyone"),
  textAlign: text("text_align").notNull().default("left"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHeroSlideSchema = createInsertSchema(heroSlides).omit({
  id: true,
  createdAt: true,
});
export type InsertHeroSlide = z.infer<typeof insertHeroSlideSchema>;
export type HeroSlide = typeof heroSlides.$inferSelect;

export const previousAvatars = pgTable("previous_avatars", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  avatarUrl: text("avatar_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PreviousAvatar = typeof previousAvatars.$inferSelect;

export const xpSettings = pgTable("xp_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: real("value").notNull(),
  label: text("label").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by"),
});

export const insertXpSettingsSchema = createInsertSchema(xpSettings).omit({ id: true, updatedAt: true });
export type InsertXpSetting = z.infer<typeof insertXpSettingsSchema>;

export const userStaking = pgTable("user_staking", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  stakedAmount: real("staked_amount").notNull().default(0),
  stakedAt: timestamp("staked_at").defaultNow().notNull(),
  lastClaimAt: timestamp("last_claim_at").defaultNow().notNull(),
  totalEarned: real("total_earned").notNull().default(0),
});

export const userStakingHistory = pgTable("user_staking_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  balanceAfter: real("balance_after").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UserStaking = typeof userStaking.$inferSelect;
export type UserStakingHistory = typeof userStakingHistory.$inferSelect;
export type XpSetting = typeof xpSettings.$inferSelect;