# Replit OAuth Backend Implementation Guide

## Overview
This document provides a complete implementation guide for integrating "Login with Replit" authentication into your Gamefolio backend (Express.js + Supabase PostgreSQL).

---

## 1. Environment Variables

Add these environment variables to your backend (Replit Secrets or `.env` file):

```env
REPLIT_CLIENT_ID=your_replit_client_id
REPLIT_CLIENT_SECRET=your_replit_client_secret
JWT_SECRET=Jkdjsl\$22Awj2@32kjlskjfads232s
```

**To get Replit OAuth credentials:**
1. Go to https://replit.com/account
2. Navigate to "Applications" or "OAuth Apps"
3. Create a new OAuth application
4. Set the redirect URI to: `https://app.gamefolio.com/api/auth/replit/callback`
5. Copy the Client ID and Client Secret

---

## 2. Database Schema Update

Ensure your `users` table supports the Replit provider:

```sql
-- Update authProvider enum if needed
ALTER TABLE users 
  ALTER COLUMN "authProvider" TYPE text;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_provider_external 
  ON users("authProvider", "externalId");
```

The `authProvider` field should accept: `'local'`, `'google'`, `'discord'`, `'replit'`

---

## 3. Backend API Endpoint Implementation

### 3.1 Install Required Dependencies

```bash
npm install axios
```

### 3.2 Create Replit Auth Route (`/api/auth/token/replit`)

**File: `routes/auth.js` (or similar)**

```javascript
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const router = express.Router();

// PostgreSQL pool or Supabase client
const { pool } = require('../config/database'); // Adjust to your setup

/**
 * POST /api/auth/token/replit
 * Exchange Replit authorization code for user tokens
 * 
 * Body:
 * - code: Authorization code from Replit
 * - redirectUri: OAuth redirect URI used by mobile app
 */
router.post('/api/auth/token/replit', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({ 
        message: 'Missing required fields: code, redirectUri' 
      });
    }

    console.log('[Replit Auth] Exchanging code for access token...');

    // Step 1: Exchange authorization code for access token
    const tokenResponse = await axios.post('https://replit.com/oauth/token', {
      grant_type: 'authorization_code',
      code: code,
      client_id: process.env.REPLIT_CLIENT_ID,
      client_secret: process.env.REPLIT_CLIENT_SECRET,
      redirect_uri: redirectUri,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const { access_token } = tokenResponse.data;

    if (!access_token) {
      throw new Error('No access token received from Replit');
    }

    console.log('[Replit Auth] Access token received, fetching user info...');

    // Step 2: Fetch user information from Replit
    const userResponse = await axios.get('https://replit.com/api/v1/user', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const replitUser = userResponse.data;
    console.log('[Replit Auth] User info:', replitUser);

    /*
     * Replit user object typically contains:
     * - id: Replit user ID
     * - username: Replit username
     * - name: Display name
     * - email: Email (may not always be present)
     * - avatar: Avatar URL
     * - bio: User bio
     */

    // Step 3: Find or create user in database
    const externalId = replitUser.id.toString();
    
    let user = await pool.query(
      `SELECT * FROM users 
       WHERE "authProvider" = 'replit' AND "externalId" = $1`,
      [externalId]
    );

    if (user.rows.length === 0) {
      console.log('[Replit Auth] Creating new user...');
      
      // Generate unique username if needed
      let username = replitUser.username;
      const existingUsername = await pool.query(
        `SELECT id FROM users WHERE username = $1`,
        [username]
      );

      if (existingUsername.rows.length > 0) {
        username = `${username}_${Math.random().toString(36).substring(2, 8)}`;
      }

      // Create new user
      const newUser = await pool.query(
        `INSERT INTO users (
          username,
          "displayName",
          email,
          "authProvider",
          "externalId",
          "avatarUrl",
          "emailVerified",
          bio,
          role,
          "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *`,
        [
          username,
          replitUser.name || replitUser.username,
          replitUser.email || null,
          'replit',
          externalId,
          replitUser.avatar || null,
          true, // Assume verified if from Replit
          replitUser.bio || null,
          'user'
        ]
      );

      user = newUser;
    } else {
      console.log('[Replit Auth] User found, updating...');
      
      // Update existing user (optional: refresh avatar, display name, etc.)
      const updatedUser = await pool.query(
        `UPDATE users 
         SET "avatarUrl" = $1, 
             "displayName" = $2,
             bio = $3,
             "lastLoginAt" = NOW()
         WHERE "authProvider" = 'replit' AND "externalId" = $4
         RETURNING *`,
        [
          replitUser.avatar || null,
          replitUser.name || replitUser.username,
          replitUser.bio || null,
          externalId
        ]
      );

      user = updatedUser;
    }

    const dbUser = user.rows[0];

    // Step 4: Handle login streak (optional)
    const streakInfo = await updateLoginStreak(dbUser.id); // Implement this function

    // Step 5: Generate JWT tokens
    const accessTokenPayload = {
      userId: dbUser.id,
      username: dbUser.username,
      role: dbUser.role,
    };

    const jwtAccessToken = jwt.sign(
      accessTokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' } // 7 days
    );

    const jwtRefreshToken = jwt.sign(
      { userId: dbUser.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' } // 30 days
    );

    // Step 6: Return response matching mobile app's AuthResponse interface
    return res.status(200).json({
      user: {
        id: dbUser.id,
        username: dbUser.username,
        displayName: dbUser.displayName,
        email: dbUser.email,
        emailVerified: dbUser.emailVerified || true,
        role: dbUser.role,
        totalXP: dbUser.totalXP || 0,
        level: dbUser.level || 1,
        currentStreak: dbUser.currentStreak || 0,
        longestStreak: dbUser.longestStreak || 0,
        avatarUrl: dbUser.avatarUrl,
        bannerUrl: dbUser.bannerUrl,
        bio: dbUser.bio,
        messagingEnabled: dbUser.messagingEnabled ?? true,
        isPrivate: dbUser.isPrivate ?? false,
        userType: dbUser.userType,
        ageRange: dbUser.ageRange,
        gfTokenBalance: dbUser.gfTokenBalance || 0,
      },
      accessToken: jwtAccessToken,
      refreshToken: jwtRefreshToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
      streakInfo: streakInfo,
    });

  } catch (error) {
    console.error('[Replit Auth] Error:', error);
    
    if (error.response) {
      // Axios error with response
      return res.status(error.response.status).json({
        message: error.response.data.message || 'Failed to authenticate with Replit',
      });
    }

    return res.status(500).json({
      message: 'Internal server error during authentication',
    });
  }
});

/**
 * Helper function to update login streak
 * Implement according to your streak logic
 */
async function updateLoginStreak(userId) {
  // Implement your streak logic here
  // Return streak info object
  return {
    currentStreak: 1,
    bonusAwarded: 0,
    message: 'Welcome back!',
    isNewMilestone: false,
  };
}

module.exports = router;
```

---

## 4. Replit OAuth Application Configuration

### 4.1 Create Replit OAuth App

1. Visit: https://replit.com/account
2. Go to "OAuth Applications" or similar section
3. Click "Create Application"
4. Fill in:
   - **Application Name**: Gamefolio Mobile
   - **Description**: Mobile app for Gamefolio gaming platform
   - **Redirect URIs**: 
     ```
     https://app.gamefolio.com/api/auth/replit/callback
     gamefolio://auth/replit
     ```
   - **Scopes**: `user:read`

5. Save and copy:
   - Client ID
   - Client Secret

### 4.2 Update Mobile App Environment

In your mobile app, update `constants/Env.ts`:

```typescript
export const Env = {
  BACKEND_URL: "https://app.gamefolio.com",
  REPLIT_CLIENT_ID: "YOUR_REPLIT_CLIENT_ID_HERE",
  REPLIT_CLIENT_SECRET: "", // Not needed in mobile app
  // ... other env vars
};
```

---

## 5. Testing the Implementation

### 5.1 Test Flow

1. **Mobile App**: User clicks "Continue with Replit"
2. **OAuth**: Browser opens Replit authorization page
3. **User**: Authorizes the application
4. **Callback**: Replit redirects back to mobile app with code
5. **Mobile App**: Sends code to backend endpoint
6. **Backend**: Exchanges code for tokens, creates/updates user
7. **Response**: Returns JWT tokens and user info
8. **Mobile App**: Stores tokens and navigates to home screen

### 5.2 Test Requests

**Using curl:**

```bash
# Simulate mobile app request (you'll need a real code from OAuth flow)
curl -X POST https://app.gamefolio.com/api/auth/token/replit \
  -H "Content-Type: application/json" \
  -d '{
    "code": "AUTHORIZATION_CODE_FROM_REPLIT",
    "redirectUri": "gamefolio://auth/replit"
  }'
```

**Expected Response:**

```json
{
  "user": {
    "id": "user_uuid",
    "username": "replituser",
    "displayName": "Replit User",
    "email": "user@example.com",
    "emailVerified": true,
    "role": "user",
    "totalXP": 0,
    "level": 1,
    ...
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800
}
```

---

## 6. Security Best Practices

### 6.1 Environment Variables
- ✅ Store `REPLIT_CLIENT_SECRET` securely (never in mobile app)
- ✅ Use environment-specific secrets (dev, staging, production)
- ✅ Rotate secrets periodically

### 6.2 Token Management
- ✅ Use short-lived access tokens (7 days recommended)
- ✅ Implement refresh token rotation
- ✅ Validate JWT signatures on all protected routes
- ✅ Store tokens securely on mobile (expo-secure-store)

### 6.3 Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later',
});

router.post('/api/auth/token/replit', authLimiter, async (req, res) => {
  // ... implementation
});
```

### 6.4 CORS Configuration
```javascript
const cors = require('cors');

app.use(cors({
  origin: [
    'https://app.gamefolio.com',
    'exp://localhost:8081', // Expo development
  ],
  credentials: true,
}));
```

---

## 7. Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `400 Bad Request` | Missing code or redirectUri | Validate request body |
| `401 Unauthorized` | Invalid code or expired | User must re-authenticate |
| `403 Forbidden` | Invalid client credentials | Check REPLIT_CLIENT_ID and SECRET |
| `500 Internal Error` | Database or network issue | Check logs, database connection |

### Error Response Format

```json
{
  "message": "Human-readable error message",
  "error": "error_code",
  "details": {} // Optional additional details
}
```

---

## 8. Monitoring and Logging

### Key Metrics to Track

1. **Authentication Success Rate**
   ```javascript
   console.log('[Metrics] Replit auth success:', userId);
   ```

2. **Failed Attempts**
   ```javascript
   console.error('[Metrics] Replit auth failed:', error.message);
   ```

3. **New User Signups**
   ```javascript
   console.log('[Metrics] New user from Replit:', username);
   ```

4. **Response Times**
   ```javascript
   const startTime = Date.now();
   // ... auth logic
   console.log('[Metrics] Replit auth took:', Date.now() - startTime, 'ms');
   ```

---

## 9. Mobile App Integration (Already Implemented)

The mobile app side is complete with:
- ✅ "Continue with Replit" button in login screen
- ✅ OAuth flow handling using `expo-auth-session`
- ✅ Code exchange and token storage
- ✅ Automatic redirect to home screen after login

**Mobile Redirect URI**: `gamefolio://auth/replit`

---

## 10. Testing Checklist

- [ ] Replit OAuth app created and configured
- [ ] Environment variables set on backend
- [ ] Database schema supports `authProvider: 'replit'`
- [ ] Backend endpoint `/api/auth/token/replit` implemented
- [ ] Mobile app Env.ts updated with `REPLIT_CLIENT_ID`
- [ ] Test authentication flow end-to-end
- [ ] Verify new user creation
- [ ] Verify existing user login
- [ ] Test error scenarios (invalid code, network errors)
- [ ] Confirm JWT tokens are valid and work with protected routes

---

## 11. Deployment Notes

### Backend Deployment (Replit/Railway/Heroku)

1. Set environment variables:
   ```bash
   export REPLIT_CLIENT_ID="your_client_id"
   export REPLIT_CLIENT_SECRET="your_client_secret"
   export JWT_SECRET="your_jwt_secret"
   ```

2. Ensure CORS allows mobile app access

3. Update Replit OAuth redirect URIs to production URL

### Mobile App Deployment

1. Update `constants/Env.ts` with production values
2. Build and publish to App Store / Google Play
3. Register production redirect URI scheme in app config

---

## 12. Additional Resources

- **Replit OAuth Docs**: https://docs.replit.com/hosting/oauth
- **JWT Best Practices**: https://jwt.io/introduction
- **Expo AuthSession**: https://docs.expo.dev/versions/latest/sdk/auth-session/
- **PostgreSQL User Management**: https://www.postgresql.org/docs/

---

## Support

If you encounter issues:
1. Check console logs on both mobile app and backend
2. Verify Replit OAuth app configuration
3. Ensure redirect URIs match exactly
4. Test with Postman/curl to isolate mobile vs backend issues
5. Check database connection and user table structure

---

**Implementation Status**: ✅ Mobile app complete | ⏳ Backend pending implementation
