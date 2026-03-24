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
- **API Framework**: Express.js REST API server (`server/`) on port 5000
- **Client Layer**: All data fetching uses TanStack Query (`useQuery`/`useMutation`) calling `lib/api.ts` REST methods
- **Authentication**: Custom JWT-based auth with access and refresh tokens, bcrypt for password hashing
- **OAuth Support**: Google and Discord OAuth for social login (native platforms only)
- **Note**: The `backend/` directory contains a legacy tRPC/Hono server that is no longer used by the app. All API calls go through `server/` REST endpoints via `lib/api.ts`.

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts`
- **Migrations**: Drizzle Kit with migrations in `./migrations`
- **Media Storage**: Supabase for file storage (private buckets with signed URLs)
  - All media URLs are signed server-side via `generateSignedUrl()` before being sent to clients
  - Signing applied in both `backend/hono.ts` (REST API) and all `backend/trpc/routes/` (tRPC routes)
  - Client-side signing via `signSupabaseUrls()` in `apiFetch` (lib/api.ts) as belt-and-suspenders
  - Signed URLs expire after 1 hour (3600 seconds)
  - Upload utility (`lib/supabase-upload.ts`) stores authenticated (non-public) path references
  - URL signing logic lives in `backend/lib/signed-urls.ts` (import as `@/backend/lib/signed-urls`)
  - Frontend cache key utility at `lib/image-utils.ts` strips token params for stable expo-image caching
  - Game `imageUrl` fields are Twitch CDN URLs and are NOT signed
- **Profile Pictures**: Uses `activeProfilePicType` field to determine avatar source
  - "upload" (default): uses `avatarUrl`
  - "nft": uses `nftProfileImageUrl`
  - Helper function `getEffectiveAvatarUrl(user)` in `lib/api.ts` handles this logic
- **User Interface**: `User` type in `lib/api.ts` includes platform usernames, pro subscription details, profile font settings, and `createdAt`
- **API Response Handling**: `auth.getUser()` handles both wrapped `{ user: {...} }` and flat response formats from the live backend
- **Local Storage**: expo-secure-store for tokens, async-storage for preferences

### Authentication & Authorization
- JWT tokens with refresh token rotation
- Email verification flow with 6-digit codes
- Password reset via email
- OAuth integration (Google, Discord) for mobile platforms
- Role-based user types with visibility controls

### Notifications
- `NotificationsContext.tsx` provides global notification state: `notifications`, `unreadCount`, `markAllRead()`, `clearAll()`, `removeNotification(id)`, `markRead(id)`
- Fetches from `GET /api/notifications` and `GET /api/notifications/unread-count` on auth (gracefully handles 404 if endpoints don't exist on live backend)
- Incoming push notifications are added to the local list in real-time
- `NotificationDropdown.tsx` and `AppHeader.tsx` bell badge consume context data (no mock data)
- API functions in `api.notifications.*` (`list`, `unreadCount`, `markAllRead`, `markRead`, `delete`, `clearAll`) all fail gracefully

### Profile Theme System
- **Themes**: 11 themes: `none` (Default), `zombie`, `cyberpunk`, `neo`, `gothic`, `blocks`, `forest`, `watermelon`, `cartoon`, `mac`, `pink`
- **Definition**: `constants/themes.ts` exports `ProfileThemeTokens` interface with 20+ tokens, `PROFILE_THEMES` map, `SELECTABLE_PROFILE_THEMES` array, and `getProfileTheme(name)` helper
- **Database Table**: `profile_themes` — admin-managed. Columns: `id` (text PK/slug), `name`, `description`, `bg`, `accent`, `preview` (text[]), `display_order`, `is_active`. Created and seeded from `SELECTABLE_PROFILE_THEMES` at startup if empty.
- **Admin API**: `GET /api/admin/themes` — read-only view of all themes (protected by `adminMiddleware`). Themes are predefined; to add/change one, update `SELECTABLE_PROFILE_THEMES` in `constants/themes.ts` and clear the `profile_themes` DB table to re-seed.
- **Public API**: `GET /api/themes` — returns active themes ordered by `display_order` from the DB
- **Key Tokens**: `bg`, `accent`, `secondary`, `textPrimary`, `textHandle`, `statNumberColor`, `bioTextColor`, `nametagGradient`, `collectionGradient`, `cardBorderRadius`, `avatarBg`, `isLight`, etc.
- **Profile Page**: `app/user/[id].tsx` uses `getProfileTheme(user?.profileTheme)` and passes tokens to `createStyles()`. Supports `?previewTheme=pink` URL param for previewing without DB change.
- **DB Column**: `profile_theme text DEFAULT 'default'` in `users` table. Auto-added via startup migration in `server/index.ts`.
- **API**: `profileTheme` included in `User` interface (`lib/api.ts`) and mapped in `mapRawUser()`. Added to `ALLOWED_PROFILE_FIELDS` in `PATCH /api/users/:id` so users can set their theme.
- **Activation**: Set `profile_theme = 'zombie'` for a user via `PATCH /api/users/:id` with `{ profileTheme: 'zombie' }`.

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
- **TypeScript**: Strict mode enabled with path aliases (`@/*` and `@shared/*`)

### Deployment Architecture
- **Deployment**: Autoscale (Replit Cloud Run) via `node scripts/build.js` + `NODE_ENV=production tsx server/index.ts`
- **Build Process**: `scripts/build.js` starts Metro, downloads iOS/Android bundles, creates `static-build/` with manifests
- **Static Serving**: `server/static.ts` serves Expo manifests at `/ios` and `/android`, bundle files from `static-build/`
- **No Vite**: The server does not use Vite (this is an Expo app). `server/static.ts` handles production static serving
- **Path Aliases**: `tsconfig.json` maps `@shared/*` → `./shared/*` and `@/*` → `./*` with `baseUrl: "."`

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for signing JWT tokens
- `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET`: Twitch API credentials
- `GOOGLE_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID` / `GOOGLE_ANDROID_CLIENT_ID`: OAuth credentials
- `DISCORD_CLIENT_ID` / `DISCORD_MOBILE_CLIENT_ID`: Discord OAuth credentials
- Supabase and RevenueCat credentials as needed