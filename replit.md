# Gamefolio Mobile App

## Overview
Gamefolio is a gaming portfolio mobile app built with Expo (React Native) and tRPC backend. Users can showcase their gaming achievements, track collections, share clips/screenshots, and connect with other gamers.

## Project Structure

```
/
├── app/                    # Expo Router pages (file-based routing)
│   ├── (drawer)/          # Drawer navigation screens
│   │   ├── (tabs)/        # Tab navigation screens
│   │   │   ├── home.tsx
│   │   │   ├── explore.tsx
│   │   │   ├── create.tsx
│   │   │   ├── leaderboard.tsx
│   │   │   ├── profile.tsx
│   │   │   └── clips/
│   │   │       └── latest.tsx
│   │   ├── messages.tsx
│   │   ├── collections.tsx
│   │   ├── store.tsx
│   │   └── wallet.tsx
│   ├── onboarding/        # Onboarding flow screens
│   ├── clip/[id].tsx      # Clip detail page
│   ├── user/[id].tsx      # User profile page
│   ├── game/[id].tsx      # Game detail page
│   ├── index.tsx          # Auth/Login screen
│   └── _layout.tsx        # Root layout with providers
├── components/            # Shared React Native components
├── context/               # React Context providers
│   ├── AuthContext.tsx    # Authentication state
│   ├── UserContext.tsx    # User data
│   └── LootboxCollectionContext.tsx
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
│   ├── api.ts            # REST API client
│   ├── trpc.ts           # tRPC client setup
│   ├── supabase.ts       # Supabase client
│   └── gamefolio-api.ts  # Gamefolio-specific API
├── constants/            # App constants
│   ├── colors.ts         # Color palette
│   └── Env.ts            # Environment configuration
├── backend/              # tRPC backend routes
│   └── trpc/
│       ├── app-router.ts # Main router
│       └── routes/       # API route handlers
├── assets/               # Static assets
│   └── images/
└── server/               # Express server (proxy/static)
```

## Tech Stack

- **Frontend**: Expo (React Native) with expo-router
- **State Management**: React Context + TanStack Query + Zustand
- **Backend**: tRPC with Hono
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT-based with secure token storage
- **Navigation**: expo-router (file-based) + React Navigation

## Key Features

1. **Authentication**
   - Email/password login and registration
   - Token-based auth with refresh mechanism
   - Secure token storage (expo-secure-store)

2. **User Profiles**
   - Customizable avatars and banners
   - Gaming stats and achievements
   - Level system with XP

3. **Content Sharing**
   - Upload gaming clips and screenshots
   - Social engagement (likes, comments, shares)
   - Trending content feed

4. **Social Features**
   - Direct messaging
   - Friend system
   - Activity feed

5. **Gamification**
   - Daily lootbox rewards
   - Achievement system
   - Leaderboards

## Environment Configuration

The app uses `constants/Env.ts` for environment configuration:
- `BACKEND_URL`: API endpoint (defaults to https://app.gamefolio.com)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key

## Running the App

### Development
1. Start the frontend: `npm run expo:dev`
2. Start the backend: `npm run server:dev`
3. Scan QR code with Expo Go app

### Color Palette
- Primary: #4ADE80 (green)
- Background: #0F1520 (dark blue)
- Surface: #1E293B (lighter blue)
- Text: #FFFFFF
- Text Dim: #94A3B8

## Recent Changes
- Imported from GitHub repository BetaONEIO/gamefolio-mobile-app
- Configured for Replit environment
- Updated app.json with Gamefolio branding
