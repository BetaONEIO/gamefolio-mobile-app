import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import registerRoute from "./routes/auth/register/route";
import loginRoute from "./routes/auth/login/route";
import tokenLoginRoute from "./routes/auth/token-login/route";
import tokenRegisterRoute from "./routes/auth/token-register/route";
import getUserRoute from "./routes/auth/get-user/route";
import logoutRoute from "./routes/auth/logout/route";
import tokenRefreshRoute from "./routes/auth/token-refresh/route";
import updateProfileRoute from "./routes/user/update-profile/route";
import getTrendingTagsRoute from "./routes/tags/get-trending/route";
import getUserClipsRoute from "./routes/clips/get-user-clips/route";
import getClipRoute from "./routes/clips/get-clip/route";
import getClipCommentsRoute from "./routes/clips/get-comments/route";
import likeClipRoute from "./routes/clips/like/route";
import fireClipRoute from "./routes/clips/fire/route";
import addClipCommentRoute from "./routes/clips/add-comment/route";
import deleteClipRoute from "./routes/clips/delete/route";
import getClipByShareCodeRoute from "./routes/clips/get-by-share-code/route";
import getUserScreenshotsRoute from "./routes/screenshots/get-user-screenshots/route";
import getScreenshotsTrendingRoute from "./routes/screenshots/get-trending/route";
import getScreenshotCommentsRoute from "./routes/screenshots/get-comments/route";
import likeScreenshotRoute from "./routes/screenshots/like/route";
import fireScreenshotRoute from "./routes/screenshots/fire/route";
import addScreenshotCommentRoute from "./routes/screenshots/add-comment/route";
import deleteScreenshotRoute from "./routes/screenshots/delete/route";
import getScreenshotByShareCodeRoute from "./routes/screenshots/get-by-share-code/route";
import getUserFavoritesRoute from "./routes/users/get-favorites/route";
import getUserProfileRoute from "./routes/users/get-profile/route";
import searchRoute from "./routes/search/search/route";
import searchGamesRoute from "./routes/twitch/search-games/route";
import getTopGamesRoute from "./routes/twitch/get-top-games/route";
import getClipsFeedRoute from "./routes/clips/get-feed/route";
import getClipsTrendingRoute from "./routes/clips/get-trending/route";
import getReelsLatestRoute from "./routes/reels/get-latest/route";
import getReelsTrendingRoute from "./routes/reels/get-trending/route";
import getClipsLatestRoute from "./routes/clips/get-latest/route";
import getTrendingUsersRoute from "./routes/users/get-trending/route";
import getLatestUploadsRoute from "./routes/clips/get-latest-uploads/route";
import updateOnlineStatusRoute from "./routes/user/update-online-status/route";
import addXPRoute from "./routes/user/add-xp/route";
import claimDailyLootboxRoute from "./routes/user/claim-daily-lootbox/route";
import getConversationsRoute from "./routes/messages/get-conversations/route";
import getMessagesRoute from "./routes/messages/get-messages/route";
import sendMessageRoute from "./routes/messages/send/route";
import startConversationRoute from "./routes/messages/start-conversation/route";
import deleteMessageRoute from "./routes/messages/delete-message/route";
import deleteConversationRoute from "./routes/messages/delete-conversation/route";
import markReadRoute from "./routes/messages/mark-read/route";
import searchUsersRoute from "./routes/users/search/route";
import blockUserRoute from "./routes/users/block/route";
import unblockUserRoute from "./routes/users/unblock/route";
import getBlockedUsersRoute from "./routes/users/get-blocked/route";
import getAllRewardsRoute from "./routes/rewards/get-all/route";
import getUserRewardsRoute from "./routes/rewards/get-user-rewards/route";
import addRewardRoute from "./routes/rewards/add-reward/route";
import redeemCodeRoute from "./routes/rewards/redeem-code/route";
import getActiveAssetRewardsRoute from "./routes/asset-rewards/get-active/route";
import claimAssetRewardRoute from "./routes/asset-rewards/claim/route";
import getAvatarBordersRoute from "./routes/user/get-avatar-borders/route";
import updateAvatarBorderRoute from "./routes/user/update-avatar-border/route";
import getUserAvatarBorderRoute from "./routes/users/get-avatar-border/route";
import getSampleProfileRoute from "./routes/users/get-sample-profile/route";
import getSampleClipsRoute from "./routes/clips/get-sample-clips/route";
import getSampleScreenshotsRoute from "./routes/screenshots/get-sample-screenshots/route";
import getSampleFavoritesRoute from "./routes/users/get-sample-favorites/route";
import submitReportRoute from "./routes/reports/submit/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  auth: createTRPCRouter({
    register: registerRoute,
    login: loginRoute,
    tokenLogin: tokenLoginRoute,
    tokenRegister: tokenRegisterRoute,
    tokenRefresh: tokenRefreshRoute,
    getUser: getUserRoute,
    logout: logoutRoute,
  }),
  user: createTRPCRouter({
    updateProfile: updateProfileRoute,
    updateOnlineStatus: updateOnlineStatusRoute,
    addXP: addXPRoute,
    claimDailyLootbox: claimDailyLootboxRoute,
    getAvatarBorders: getAvatarBordersRoute,
    updateAvatarBorder: updateAvatarBorderRoute,
  }),
  tags: createTRPCRouter({
    getTrending: getTrendingTagsRoute,
  }),
  clips: createTRPCRouter({
    getUserClips: getUserClipsRoute,
    getClip: getClipRoute,
    getComments: getClipCommentsRoute,
    getFeed: getClipsFeedRoute,
    getTrending: getClipsTrendingRoute,
    getLatest: getClipsLatestRoute,
    getLatestUploads: getLatestUploadsRoute,
    like: likeClipRoute,
    fire: fireClipRoute,
    addComment: addClipCommentRoute,
    delete: deleteClipRoute,
    getByShareCode: getClipByShareCodeRoute,
    getSampleClips: getSampleClipsRoute,
  }),
  screenshots: createTRPCRouter({
    getUserScreenshots: getUserScreenshotsRoute,
    getTrending: getScreenshotsTrendingRoute,
    getComments: getScreenshotCommentsRoute,
    like: likeScreenshotRoute,
    fire: fireScreenshotRoute,
    addComment: addScreenshotCommentRoute,
    delete: deleteScreenshotRoute,
    getByShareCode: getScreenshotByShareCodeRoute,
    getSampleScreenshots: getSampleScreenshotsRoute,
  }),
  reels: createTRPCRouter({
    getLatest: getReelsLatestRoute,
    getTrending: getReelsTrendingRoute,
  }),
  users: createTRPCRouter({
    getFavorites: getUserFavoritesRoute,
    getProfile: getUserProfileRoute,
    getTrending: getTrendingUsersRoute,
    search: searchUsersRoute,
    block: blockUserRoute,
    unblock: unblockUserRoute,
    getBlocked: getBlockedUsersRoute,
    getAvatarBorder: getUserAvatarBorderRoute,
    getSampleProfile: getSampleProfileRoute,
    getSampleFavorites: getSampleFavoritesRoute,
  }),
  messages: createTRPCRouter({
    getConversations: getConversationsRoute,
    getMessages: getMessagesRoute,
    send: sendMessageRoute,
    startConversation: startConversationRoute,
    deleteMessage: deleteMessageRoute,
    deleteConversation: deleteConversationRoute,
    markRead: markReadRoute,
  }),
  search: createTRPCRouter({
    search: searchRoute,
  }),
  twitch: createTRPCRouter({
    searchGames: searchGamesRoute,
    getTopGames: getTopGamesRoute,
  }),
  rewards: createTRPCRouter({
    getAll: getAllRewardsRoute,
    getUserRewards: getUserRewardsRoute,
    add: addRewardRoute,
    redeemCode: redeemCodeRoute,
  }),
  assetRewards: createTRPCRouter({
    getActive: getActiveAssetRewardsRoute,
    claim: claimAssetRewardRoute,
  }),
  reports: createTRPCRouter({
    submit: submitReportRoute,
  }),
});

export type AppRouter = typeof appRouter;
