# Messaging REST API Implementation

## Overview
The messaging feature uses REST API with JWT Bearer token authentication to communicate with the Gamefolio backend at `https://app.gamefolio.com`.

## Authentication

All API requests require JWT Bearer token authentication:

```typescript
Headers: {
  'Authorization': 'Bearer <accessToken>',
  'Content-Type': 'application/json'
}
```

### Getting the Access Token

The app uses `AuthContext` to manage authentication tokens:

```typescript
const { getAccessToken } = useAuth();
const token = await getAccessToken();
```

This automatically:
- Retrieves the current access token
- Checks if it's expired
- Refreshes if needed
- Returns `null` if authentication fails

## API Endpoints

### 1. Get Conversations
**Endpoint:** `GET /api/messages/conversations`

**Description:** Fetches all conversations for the authenticated user

**Response:**
```typescript
Conversation[] = [
  {
    id: number;
    recipientId: number;
    recipient: {
      id: number;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
    lastMessage: {
      id: number;
      content: string;
      senderId: number;
      createdAt: string;
    } | null;
    unreadCount: number;
    updatedAt: string;
  }
]
```

**Usage:**
```typescript
const conversations = await api.messages.getConversations(token);
```

### 2. Get Messages with User
**Endpoint:** `GET /api/messages/{userId}`

**Description:** Fetches all messages in a conversation with a specific user

**Response:**
```typescript
Message[] = [
  {
    id: number;
    content: string;
    senderId: number;
    receiverId: number;
    createdAt: string;
    isRead: boolean;
  }
]
```

**Usage:**
```typescript
const messages = await api.messages.getMessages(userId, token);
```

### 3. Send Message
**Endpoint:** `POST /api/messages`

**Description:** Sends a message to a user

**Request Body:**
```typescript
{
  receiverId: number;
  content: string;
}
```

**Response:**
```typescript
Message = {
  id: number;
  content: string;
  senderId: number;
  receiverId: number;
  createdAt: string;
  isRead: boolean;
}
```

**Usage:**
```typescript
const message = await api.messages.send({ receiverId, content }, token);
```

### 4. Start Conversation
**Endpoint:** `POST /api/messages/start`

**Description:** Starts a new conversation with a user (alternative to send if conversation doesn't exist)

**Request Body:**
```typescript
{
  username: string;
  content: string;
}
```

**Response:**
```typescript
{
  conversation: Conversation;
  message: Message;
}
```

**Usage:**
```typescript
const result = await api.messages.startConversation({ username, content }, token);
```

### 5. Delete Message
**Endpoint:** `DELETE /api/messages/{messageId}`

**Description:** Deletes a specific message

**Response:**
```typescript
{
  messageId: number;
}
```

**Usage:**
```typescript
const result = await api.messages.deleteMessage(messageId, token);
```

### 6. Delete Conversation
**Endpoint:** `DELETE /api/messages/conversations/{userId}`

**Description:** Deletes entire conversation with a user

**Response:**
```typescript
{
  success: boolean;
}
```

**Usage:**
```typescript
const result = await api.messages.deleteConversation(userId, token);
```

### 7. Mark Messages as Read
**Endpoint:** `POST /api/messages/{userId}/read`

**Description:** Marks all messages from a user as read

**Response:**
```typescript
{
  success: boolean;
}
```

**Usage:**
```typescript
const result = await api.messages.markRead(userId, token);
```

### 8. Search Users
**Endpoint:** `GET /api/users/search?q={searchQuery}`

**Description:** Searches for users to start a conversation with

**Response:**
```typescript
{
  users: User[];
}
```

**Usage:**
```typescript
const result = await api.search.users(query, token);
```

### 9. Block User
**Endpoint:** `POST /api/users/{userId}/block`

**Description:** Blocks a user

**Request Body:**
```typescript
{
  userId: number;
}
```

**Response:**
```typescript
{
  success: boolean;
}
```

**Usage:**
```typescript
const result = await api.blocking.block(userId, token);
```

### 10. Unblock User
**Endpoint:** `POST /api/users/{userId}/unblock`

**Description:** Unblocks a user

**Request Body:**
```typescript
{
  userId: number;
}
```

**Response:**
```typescript
{
  success: boolean;
}
```

**Usage:**
```typescript
const result = await api.blocking.unblock(userId, token);
```

### 11. Get Blocked Users
**Endpoint:** `GET /api/users/blocked`

**Description:** Gets list of blocked users

**Response:**
```typescript
{
  blockedUsers: User[];
}
```

**Usage:**
```typescript
const result = await api.blocking.getBlocked(token);
```

## Error Handling

### 401 Unauthorized
If you receive a 401 error, it means:
1. Token is expired or invalid
2. Token was signed with a different JWT secret
3. User needs to log out and log in again

**Solution:**
```typescript
if (error.status === 401) {
  await logout();
  router.replace('/index');
}
```

### Other Errors
All errors are wrapped in `APIError` class:
```typescript
class APIError extends Error {
  status?: number;
  data?: unknown;
}
```

## Configuration

The backend URL is configured via environment variable:

```
EXPO_PUBLIC_BACKEND_URL=https://app.gamefolio.com
```

If not set, it falls back to `window.location.origin` on web.

## Files

- **`lib/api.ts`** - Core API client with all endpoint definitions
- **`context/AuthContext.tsx`** - Authentication state management
- **`app/(drawer)/messages.tsx`** - Messages list screen
- **`app/conversation/[id].tsx`** - Individual conversation screen
- **`components/NewConversationModal.tsx`** - User search modal

## React Query Integration

All API calls use React Query for:
- Caching
- Automatic refetching
- Loading/error states
- Optimistic updates

Example:
```typescript
const conversationsQuery = useQuery({
  queryKey: ['conversations'],
  queryFn: async () => {
    const token = await getAccessToken();
    return api.messages.getConversations(token);
  },
  enabled: isAuthenticated,
  refetchInterval: 10000,
});
```

## Debugging

Enable detailed logging by checking the console:
- `[API]` - Low-level HTTP requests/responses
- `[Messages API]` - Message-specific operations
- `[Messages]` - UI component logs
- `[Conversation]` - Conversation screen logs

All token details (payload, expiry, etc.) are logged for debugging authentication issues.
