import { storage } from "./storage";
import { InsertNotification } from "@shared/schema";

export class NotificationService {
  // Create notification for when someone likes a clip
  static async createLikeNotification(clipId: number, likedByUserId: number) {
    try {
      // Get clip details and owner
      const clip = await storage.getClipWithUser(clipId);
      if (!clip) return;

      // Don't notify if user likes their own clip
      if (clip.userId === likedByUserId) return;

      // Get the user who liked the clip
      const likedByUser = await storage.getUser(likedByUserId);
      if (!likedByUser) return;

      const notification: InsertNotification = {
        userId: clip.userId,
        type: "like",
        title: "New Like",
        message: `${likedByUser.username} liked your clip "${clip.title}"`,
        fromUserId: likedByUserId,
        clipId: clipId,
        actionUrl: `/clips/${clipId}`
      };

      await storage.createNotification(notification);
    } catch (error) {
      console.error("Error creating like notification:", error);
    }
  }

  // Create notification for when someone comments on a clip
  static async createCommentNotification(clipId: number, commentedByUserId: number, commentContent: string, commentId?: number) {
    try {
      // Get clip details and owner
      const clip = await storage.getClipWithUser(clipId);
      if (!clip) return;

      // Don't notify if user comments on their own clip
      if (clip.userId === commentedByUserId) return;

      // Get the user who commented
      const commentedByUser = await storage.getUser(commentedByUserId);
      if (!commentedByUser) return;

      const truncatedComment = commentContent.length > 50 
        ? commentContent.substring(0, 50) + "..." 
        : commentContent;

      const notification: InsertNotification = {
        userId: clip.userId,
        type: "comment",
        title: "New Comment",
        message: `${commentedByUser.username} commented on your clip "${clip.title}": "${truncatedComment}"`,
        fromUserId: commentedByUserId,
        clipId: clipId,
        actionUrl: `/clips/${clipId}?openComments=true${commentId ? `&highlightComment=${commentId}` : ''}`
      };

      await storage.createNotification(notification);
    } catch (error) {
      console.error("Error creating comment notification:", error);
    }
  }

  // Create notification for when someone follows a user
  static async createFollowNotification(followedUserId: number, followerUserId: number) {
    try {
      // Don't notify if user follows themselves
      if (followedUserId === followerUserId) return;

      // Get the follower user
      const followerUser = await storage.getUser(followerUserId);
      if (!followerUser) return;

      const notification: InsertNotification = {
        userId: followedUserId,
        type: "follow",
        title: "New Follower",
        message: `${followerUser.username} started following you`,
        fromUserId: followerUserId,
        actionUrl: `/profile/${followerUser.username}`
      };

      await storage.createNotification(notification);
    } catch (error) {
      console.error("Error creating follow notification:", error);
    }
  }

  // Create notification for follow requests
  static async createFollowRequestNotification(requestedUserId: number, requesterUserId: number) {
    try {
      // Don't notify if user requests themselves
      if (requestedUserId === requesterUserId) return;

      // Get the requester user
      const requesterUser = await storage.getUser(requesterUserId);
      if (!requesterUser) return;

      const notification: InsertNotification = {
        userId: requestedUserId,
        type: "follow_request",
        title: "Follow Request",
        message: `${requesterUser.username} wants to follow you`,
        fromUserId: requesterUserId,
        actionUrl: `/settings/follow-requests`
      };

      await storage.createNotification(notification);
    } catch (error) {
      console.error("Error creating follow request notification:", error);
    }
  }

  // Create notification when follow request is accepted
  static async createFollowRequestAcceptedNotification(requesterUserId: number, acceptedByUserId: number) {
    try {
      // Don't notify if user accepts their own request
      if (requesterUserId === acceptedByUserId) return;

      // Get the user who accepted
      const acceptedByUser = await storage.getUser(acceptedByUserId);
      if (!acceptedByUser) return;

      const notification: InsertNotification = {
        userId: requesterUserId,
        type: "follow_request_accepted",
        title: "Follow Request Accepted",
        message: `${acceptedByUser.username} accepted your follow request`,
        fromUserId: acceptedByUserId,
        actionUrl: `/profile/${acceptedByUser.username}`
      };

      await storage.createNotification(notification);
    } catch (error) {
      console.error("Error creating follow request accepted notification:", error);
    }
  }

  // Create notification for followers when someone uploads a new clip
  static async createUploadNotification(userId: number, clipId: number) {
    try {
      // Get the user who uploaded
      const uploader = await storage.getUser(userId);
      if (!uploader) return;

      // Get clip details
      const clip = await storage.getClip(clipId);
      if (!clip) return;

      // Get all followers of the user
      const followers = await storage.getFollowersByUserId(userId);

      // Create notifications for all followers
      const notifications: InsertNotification[] = followers.map(follower => ({
        userId: follower.id,
        type: "upload",
        title: "New Upload",
        message: `${uploader.username} uploaded a new clip: "${clip.title}"`,
        fromUserId: userId,
        clipId: clipId,
        actionUrl: `/clips/${clipId}`
      }));

      // Create all notifications
      for (const notification of notifications) {
        await storage.createNotification(notification);
      }
    } catch (error) {
      console.error("Error creating upload notifications:", error);
    }
  }

  // Create notification for emoji reaction on a clip
  static async createReactionNotification(clipId: number, reactedByUserId: number, emoji: string) {
    try {
      // Get clip details and owner
      const clip = await storage.getClipWithUser(clipId);
      if (!clip) return;

      // Don't notify if user reacts to their own clip
      if (clip.userId === reactedByUserId) return;

      // Get the user who reacted
      const reactedByUser = await storage.getUser(reactedByUserId);
      if (!reactedByUser) return;

      const notification: InsertNotification = {
        userId: clip.userId,
        type: "like", // Using 'like' type for reactions
        title: "New Reaction",
        message: `${reactedByUser.username} reacted with ${emoji} to your clip "${clip.title}"`,
        fromUserId: reactedByUserId,
        clipId: clipId,
        actionUrl: `/clips/${clipId}`
      };

      await storage.createNotification(notification);
    } catch (error) {
      console.error("Error creating reaction notification:", error);
    }
  }

  // Create notification for new message
  static async createMessageNotification(senderId: number, receiverId: number, messageContent: string) {
    try {
      // Don't notify if user messages themselves
      if (senderId === receiverId) return;

      // Get the sender user
      const senderUser = await storage.getUser(senderId);
      if (!senderUser) return;

      // Truncate message content for notification
      const truncatedMessage = messageContent.length > 50 
        ? messageContent.substring(0, 50) + "..." 
        : messageContent;

      const notification: InsertNotification = {
        userId: receiverId,
        type: "message",
        title: "New Message",
        message: `${senderUser.username} sent you a message: "${truncatedMessage}"`,
        fromUserId: senderId,
        actionUrl: `/messages?user=${senderUser.username}`
      };

      await storage.createNotification(notification);
    } catch (error) {
      console.error("Error creating message notification:", error);
    }
  }

  // Create notification for when someone likes a screenshot
  static async createScreenshotLikeNotification(screenshotId: number, likedByUserId: number) {
    try {
      // Get screenshot details and owner
      const screenshot = await storage.getScreenshotWithUser(screenshotId);
      if (!screenshot) return;

      // Don't notify if user likes their own screenshot
      if (screenshot.userId === likedByUserId) return;

      // Get the user who liked the screenshot
      const likedByUser = await storage.getUser(likedByUserId);
      if (!likedByUser) return;

      const notification: InsertNotification = {
        userId: screenshot.userId,
        type: "like",
        title: "New Like",
        message: `${likedByUser.username} liked your screenshot "${screenshot.title}"`,
        fromUserId: likedByUserId,
        screenshotId: screenshotId,
        actionUrl: `/@${screenshot.user.username}/screenshots/${screenshotId}`
      };

      await storage.createNotification(notification);
    } catch (error) {
      console.error("Error creating screenshot like notification:", error);
    }
  }

  // Create notification for when someone comments on a screenshot
  static async createScreenshotCommentNotification(screenshotId: number, commentedByUserId: number, commentContent: string, commentId?: number) {
    try {
      // Get screenshot details and owner
      const screenshot = await storage.getScreenshotWithUser(screenshotId);
      if (!screenshot) return;

      // Don't notify if user comments on their own screenshot
      if (screenshot.userId === commentedByUserId) return;

      // Get the user who commented
      const commentedByUser = await storage.getUser(commentedByUserId);
      if (!commentedByUser) return;

      const truncatedComment = commentContent.length > 50 
        ? commentContent.substring(0, 50) + "..." 
        : commentContent;

      const notification: InsertNotification = {
        userId: screenshot.userId,
        type: "comment",
        title: "New Comment",
        message: `${commentedByUser.username} commented on your screenshot "${screenshot.title}": "${truncatedComment}"`,
        fromUserId: commentedByUserId,
        screenshotId: screenshotId,
        actionUrl: `/@${screenshot.user.username}/screenshots/${screenshotId}?openComments=true${commentId ? `&highlightComment=${commentId}` : ''}`
      };

      await storage.createNotification(notification);
    } catch (error) {
      console.error("Error creating screenshot comment notification:", error);
    }
  }
}