import { type IStorage } from './storage';
import { getRealtimeNotificationService } from './realtime-notification-service';

export interface MentionMatch {
  username: string;
  userId: number;
  startIndex: number;
  endIndex: number;
}

export class MentionService {
  constructor(private storage: IStorage) {}

  /**
   * Extracts @username mentions from text and validates them against the database
   * @param text The text to parse for mentions
   * @returns Array of valid mention matches with user IDs
   */
  async parseMentions(text: string): Promise<MentionMatch[]> {
    // Regex pattern to match @username mentions
    // Matches @username where username can contain letters, numbers, underscores, and hyphens
    const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
    const mentions: MentionMatch[] = [];
    let match;

    // Extract all @username patterns from the text
    const potentialMentions: Array<{ username: string; startIndex: number; endIndex: number }> = [];
    while ((match = mentionRegex.exec(text)) !== null) {
      potentialMentions.push({
        username: match[1], // The captured username without @
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    if (potentialMentions.length === 0) {
      return [];
    }

    // Get all unique usernames to validate in a single query
    const uniqueUsernames = Array.from(new Set(potentialMentions.map(m => m.username)));
    
    // Validate usernames against the database
    const validUsers = await this.storage.getUsersByUsernames(uniqueUsernames);
    const validUsernameMap = new Map(validUsers.map(user => [user.username.toLowerCase(), user]));

    // Build the final mentions array with user IDs
    for (const potential of potentialMentions) {
      const user = validUsernameMap.get(potential.username.toLowerCase());
      if (user) {
        mentions.push({
          username: user.username, // Use the actual username from DB (preserves case)
          userId: user.id,
          startIndex: potential.startIndex,
          endIndex: potential.endIndex
        });
      }
    }

    return mentions;
  }

  /**
   * Creates mention records and notifications for a clip upload
   * @param clipId The ID of the clip
   * @param mentionedUserIds Array of user IDs that were mentioned
   * @param mentionedByUserId The ID of the user who created the mention
   * @param clipTitle The title of the clip for notification context
   */
  async createClipMentions(
    clipId: number, 
    mentionedUserIds: number[], 
    mentionedByUserId: number,
    clipTitle: string
  ): Promise<void> {
    if (mentionedUserIds.length === 0) return;

    // Get the user who created the mention for notification context
    const mentionCreator = await this.storage.getUserById(mentionedByUserId);
    if (!mentionCreator) return;

    // Remove duplicates and self-mentions
    const uniqueUserIds = Array.from(new Set(mentionedUserIds)).filter(id => id !== mentionedByUserId);

    for (const userId of uniqueUserIds) {
      // Create mention record
      await this.storage.createClipMention({
        clipId,
        mentionedUserId: userId,
        mentionedByUserId
      });

      // Create notification for the mentioned user
      await this.storage.createNotification({
        userId: userId,
        type: 'clip_mention',
        title: `@${mentionCreator.username} mentioned you in a clip`,
        message: `${mentionCreator.displayName} mentioned you in "${clipTitle}"`,
        fromUserId: mentionedByUserId,
        clipId: clipId,
        actionUrl: `/clips/${clipId}`,
        metadata: {
          mentionType: 'clip',
          clipTitle,
          mentionedBy: {
            id: mentionCreator.id,
            username: mentionCreator.username,
            displayName: mentionCreator.displayName
          }
        }
      });

      // Send real-time notification via WebSocket
      const realtimeService = getRealtimeNotificationService();
      if (realtimeService) {
        realtimeService.sendMentionNotification(userId, {
          type: 'clip_mention',
          mentionedByUserId: mentionedByUserId,
          mentionedByUsername: mentionCreator.username,
          contentId: clipId,
          contentTitle: clipTitle
        });
      }
    }
  }

  /**
   * Creates mention records and notifications for a comment
   * @param commentId The ID of the comment
   * @param mentionedUserIds Array of user IDs that were mentioned
   * @param mentionedByUserId The ID of the user who created the mention
   * @param clipId The ID of the clip being commented on
   */
  async createCommentMentions(
    commentId: number,
    mentionedUserIds: number[],
    mentionedByUserId: number,
    clipId: number
  ): Promise<void> {
    if (mentionedUserIds.length === 0) return;

    // Get the user who created the mention for notification context
    const mentionCreator = await this.storage.getUserById(mentionedByUserId);
    if (!mentionCreator) return;

    // Remove duplicates and self-mentions
    const uniqueUserIds = Array.from(new Set(mentionedUserIds)).filter(id => id !== mentionedByUserId);

    for (const userId of uniqueUserIds) {
      // Create mention record
      await this.storage.createCommentMention({
        commentId,
        mentionedUserId: userId,
        mentionedByUserId
      });

      // Create notification for the mentioned user
      await this.storage.createNotification({
        userId: userId,
        type: 'comment_mention',
        title: `@${mentionCreator.username} mentioned you in a comment`,
        message: `${mentionCreator.displayName} mentioned you in a comment`,
        fromUserId: mentionedByUserId,
        clipId: clipId,
        commentId: commentId,
        actionUrl: `/clips/${clipId}#comment-${commentId}`,
        metadata: {
          mentionType: 'comment',
          mentionedBy: {
            id: mentionCreator.id,
            username: mentionCreator.username,
            displayName: mentionCreator.displayName
          }
        }
      });

      // Send real-time notification via WebSocket
      const realtimeService = getRealtimeNotificationService();
      if (realtimeService) {
        realtimeService.sendMentionNotification(userId, {
          type: 'comment_mention',
          mentionedByUserId: mentionedByUserId,
          mentionedByUsername: mentionCreator.username,
          contentId: commentId,
          contentText: `Comment on clip #${clipId}`
        });
      }
    }
  }

  /**
   * Creates mention records and notifications for a screenshot comment
   * @param screenshotCommentId The ID of the screenshot comment
   * @param mentionedUserIds Array of user IDs that were mentioned
   * @param mentionedByUserId The ID of the user who created the mention
   * @param screenshotId The ID of the screenshot being commented on
   */
  async createScreenshotCommentMentions(
    screenshotCommentId: number,
    mentionedUserIds: number[],
    mentionedByUserId: number,
    screenshotId: number
  ): Promise<void> {
    if (mentionedUserIds.length === 0) return;

    // Get the user who created the mention for notification context
    const mentionCreator = await this.storage.getUserById(mentionedByUserId);
    if (!mentionCreator) return;

    // Remove duplicates and self-mentions
    const uniqueUserIds = Array.from(new Set(mentionedUserIds)).filter(id => id !== mentionedByUserId);

    for (const userId of uniqueUserIds) {
      // Create mention record
      await this.storage.createScreenshotCommentMention({
        screenshotCommentId,
        mentionedUserId: userId,
        mentionedByUserId
      });

      // Create notification for the mentioned user
      await this.storage.createNotification({
        userId: userId,
        type: 'comment_mention',
        title: `@${mentionCreator.username} mentioned you in a comment`,
        message: `${mentionCreator.displayName} mentioned you in a comment on a screenshot`,
        fromUserId: mentionedByUserId,
        screenshotId: screenshotId,
        actionUrl: `/screenshots/${screenshotId}#comment-${screenshotCommentId}`,
        metadata: {
          mentionType: 'screenshot_comment',
          mentionedBy: {
            id: mentionCreator.id,
            username: mentionCreator.username,
            displayName: mentionCreator.displayName
          }
        }
      });
    }
  }

  /**
   * Renders text with mention highlights for display
   * @param text The text containing mentions
   * @param mentions Array of mention matches
   * @returns Text with HTML span elements around mentions
   */
  renderMentionsAsHTML(text: string, mentions: MentionMatch[]): string {
    if (mentions.length === 0) return text;

    // Sort mentions by start index in descending order to avoid index shifting
    const sortedMentions = [...mentions].sort((a, b) => b.startIndex - a.startIndex);
    
    let result = text;
    for (const mention of sortedMentions) {
      const beforeMention = result.substring(0, mention.startIndex);
      const afterMention = result.substring(mention.endIndex);
      const mentionHtml = `<span class="mention" data-user-id="${mention.userId}">@${mention.username}</span>`;
      result = beforeMention + mentionHtml + afterMention;
    }

    return result;
  }
}