# Gamefolio

## Overview

Gamefolio is a mobile-first social platform for gamers built with React Native and Expo. It allows users to create gaming profiles, share clips/reels/screenshots, connect gaming platform accounts (Steam, Xbox, PlayStation, Discord, etc.), and engage with other gamers through follows, likes, and comments. The app features a freemium model with Pro subscriptions, loot box collections, and a leveling system.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React Native with Expo SDK 54
- **Navigation**: Expo Router with file-based routing, using drawer navigation for main app sections
- **State Management**: 
  - React Context for global state (Auth, User, Lootbox, RevenueCat, Notifications)
  - TanStack React Query for server state and caching
  - Zustand-style patterns in contexts
- **Styling**: React Native StyleSheet with consistent dark theme (#0F1520 background, #4ADE80 accent)
- **UI Components**: Custom component library with modals, cards, and animated elements using expo-linear-gradient and expo-blur

### Backend Architecture
- **API Framework**: Hono web framework running on the server
- **RPC Layer**: tRPC for type-safe API communication between client and server
- **Authentication**: Custom JWT-based auth with access and refresh tokens, bcrypt for password hashing
- **OAuth Support**: Google and Discord OAuth for social login (native platforms only)

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts`
- **Migrations**: Drizzle Kit with migrations in `./migrations`
- **Media Storage**: Supabase for file storage (private buckets with signed URLs)
  - All media URLs are signed server-side via `generateSignedUrl()` before being sent to clients
  - Signing applied in both `backend/hono.ts` (REST API) and all `backend/trpc/routes/` (tRPC routes)
  - Signed URLs expire after 1 hour (3600 seconds)
  - Upload utility (`lib/supabase-upload.ts`) stores authenticated (non-public) path references
  - URL signing logic lives in `backend/lib/signed-urls.ts` (import as `@/backend/lib/signed-urls`)
  - Frontend cache key utility at `lib/image-utils.ts` strips token params for stable expo-image caching
  - Game `imageUrl` fields are Twitch CDN URLs and are NOT signed
- **Local Storage**: expo-secure-store for tokens, async-storage for preferences

### Authentication & Authorization
- JWT tokens with refresh token rotation
- Email verification flow with 6-digit codes
- Password reset via email
- OAuth integration (Google, Discord) for mobile platforms
- Role-based user types with visibility controls

### Key Features
- User profiles with customizable themes, avatars, and banners
- Gaming platform account linking (Steam, Xbox, PSN, Epic, Nintendo, Discord)
- Content upload system for clips, reels, and screenshots
- Loot box collection system with virtual items
- Leveling and XP progression
- Pro subscription tier via RevenueCat
- Push notifications via expo-notifications
- Birthday celebrations and profile badges

## External Dependencies

### Third-Party Services
- **Supabase**: Database hosting, authentication fallback, file storage
- **Firebase**: Push notifications and analytics (google-services.json configured)
- **RevenueCat**: Subscription management and in-app purchases
- **Twitch API**: Game data, box art, and game search functionality
- **Google Mobile Ads**: AdMob banner ads for free tier users

### APIs & SDKs
- **Expo Services**: EAS Build, updates, notifications
- **Google OAuth**: iOS and Android client IDs configured
- **Discord OAuth**: Mobile app authentication

### Development Tools
- **Drizzle Kit**: Database migrations and schema management
- **ESLint**: Expo-flavored linting configuration
- **TypeScript**: Strict mode enabled with path aliases (@/*)

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for signing JWT tokens
- `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET`: Twitch API credentials
- `GOOGLE_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID` / `GOOGLE_ANDROID_CLIENT_ID`: OAuth credentials
- `DISCORD_CLIENT_ID` / `DISCORD_MOBILE_CLIENT_ID`: Discord OAuth credentials
- Supabase and RevenueCat credentials as needed