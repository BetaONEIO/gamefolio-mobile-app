import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'url';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
}

export class RealtimeNotificationService {
  private wss: WebSocketServer;
  private connectedUsers = new Map<number, Set<AuthenticatedWebSocket>>();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/api/ws/notifications',
      verifyClient: (info: { req: any }) => {
        // Basic URL parsing to check if it's the notifications endpoint
        const { pathname } = parse(info.req.url || '');
        return pathname === '/api/ws/notifications';
      }
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    console.log('🔔 WebSocket Notification Service initialized');
  }

  private handleConnection(ws: AuthenticatedWebSocket, req: any) {
    console.log('🔗 New WebSocket connection established');

    // Parse user ID from query params or headers
    const url = parse(req.url || '', true);
    const userId = url.query.userId ? parseInt(url.query.userId as string) : null;

    if (!userId) {
      console.log('❌ WebSocket connection rejected: No user ID provided');
      ws.close(1008, 'Authentication required');
      return;
    }

    ws.userId = userId;
    
    // Add user to connected users map
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(ws);

    console.log(`✅ User ${userId} connected to notifications WebSocket`);

    // Handle connection close
    ws.on('close', () => {
      console.log(`👋 User ${userId} disconnected from notifications WebSocket`);
      const userConnections = this.connectedUsers.get(userId);
      if (userConnections) {
        userConnections.delete(ws);
        if (userConnections.size === 0) {
          this.connectedUsers.delete(userId);
        }
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`❌ WebSocket error for user ${userId}:`, error);
    });

    // Send welcome message
    this.sendToUser(userId, {
      type: 'connection_established',
      message: 'Connected to real-time notifications'
    });
  }

  // Send notification to a specific user
  sendToUser(userId: number, notification: any) {
    const userConnections = this.connectedUsers.get(userId);
    if (!userConnections || userConnections.size === 0) {
      console.log(`📭 No active connections for user ${userId}`);
      return false;
    }

    const message = JSON.stringify(notification);
    let sentCount = 0;

    userConnections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
          sentCount++;
        } catch (error) {
          console.error(`Failed to send notification to user ${userId}:`, error);
          userConnections.delete(ws);
        }
      } else {
        // Remove closed connections
        userConnections.delete(ws);
      }
    });

    console.log(`📢 Sent notification to ${sentCount} connections for user ${userId}`);
    return sentCount > 0;
  }

  // Send mention notification
  sendMentionNotification(mentionedUserId: number, mentionData: {
    type: 'clip_mention' | 'comment_mention';
    mentionedByUserId: number;
    mentionedByUsername: string;
    contentId: number;
    contentTitle?: string;
    contentText?: string;
  }) {
    const notification = {
      type: 'mention_notification',
      data: {
        mentionType: mentionData.type,
        mentionedBy: {
          id: mentionData.mentionedByUserId,
          username: mentionData.mentionedByUsername
        },
        content: {
          id: mentionData.contentId,
          title: mentionData.contentTitle,
          text: mentionData.contentText
        },
        timestamp: new Date().toISOString()
      }
    };

    return this.sendToUser(mentionedUserId, notification);
  }

  // Get connected users count
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Get total connections count
  getTotalConnectionsCount(): number {
    let total = 0;
    this.connectedUsers.forEach((connections) => {
      total += connections.size;
    });
    return total;
  }

  // Broadcast to all connected users (admin functionality)
  broadcast(notification: any) {
    const message = JSON.stringify(notification);
    let sentCount = 0;

    this.connectedUsers.forEach((userConnections) => {
      userConnections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(message);
            sentCount++;
          } catch (error) {
            console.error('Failed to broadcast notification:', error);
          }
        }
      });
    });

    console.log(`📢 Broadcast sent to ${sentCount} total connections`);
    return sentCount;
  }
}

// Singleton instance
let realtimeNotificationService: RealtimeNotificationService | null = null;

export function initializeRealtimeNotificationService(server: Server): RealtimeNotificationService {
  if (!realtimeNotificationService) {
    realtimeNotificationService = new RealtimeNotificationService(server);
  }
  return realtimeNotificationService;
}

export function getRealtimeNotificationService(): RealtimeNotificationService | null {
  return realtimeNotificationService;
}