import { User, UserWithStats, ClipWithUser, Game } from "@shared/schema";

export const getDemoUser = (): User => {
  return {
    id: 999,
    username: "demo",
    password: "$2a$10$XJXQyZHlG8soJ4TxBv9wGedwS1Uo6F.S5LpsTm5PcbcW0kRRZwE/C", // hashed "password"
    email: "demo@gamefolio.com",
    emailVerified: true,
    displayName: "Demo User",
    bio: "This is a demo account for Gamefolio. Feel free to explore all features!",
    avatarUrl: "/attached_assets/gamefolio social logo 3d circle web.png",
    bannerUrl: "/api/static/telegram-cloud-photo-size-4-5929334272504744521-y_1749637964973.jpg",
    backgroundColor: "#0B2232",
    cardColor: "#1E3A5F",
    accentColor: "#4ADE80",
    primaryColor: "#041F3E",
    layoutStyle: "grid",
    steamUsername: "gamefolio_demo",
    xboxUsername: "gamefolio_demo",
    playstationUsername: "gamefolio_demo",
    twitterUsername: "gamefolio_demo",
    youtubeUsername: null,
    discordUsername: "gamefolio_demo",
    epicUsername: "gamefolio_demo",
    nintendoUsername: "gamefolio_demo",
    userType: "Streamer,Content Creator,Professional Gamer",
    ageRange: "25-34",
    authProvider: "local",
    externalId: null,
    role: "admin",
    status: "active",
    lastLoginAt: null,
    bannedReason: null,
    messagingEnabled: true, // Enable messaging by default for demo user
    createdAt: new Date(2022, 0, 1),
    updatedAt: new Date()
  };
};

export const getDemoUserWithStats = (): UserWithStats => {
  return {
    ...getDemoUser(),
    _count: {
      followers: 0,
      following: 0,
      clips: 0,
      clipViews: 0
    }
  };
};

export const getDemoClips = (): ClipWithUser[] => {
  // Use timestamp-based consistent IDs for demo clips
  const baseId = 1700000000000; // Fixed timestamp base for consistency
  return [
    {
      id: baseId + 1,
      userId: 999,
      url: "https://clips.twitch.tv/demoClip1",
      thumbnailUrl: "https://clips.twitch.tv/demoClip1_thumbnail.jpg",
      title: "Awesome Clip 1",
      description: "This is the first demo clip.",
      gameId: 1,
      views: 100,
      createdAt: new Date(2022, 0, 2),
      updatedAt: new Date(2022, 0, 2)
    },
    {
      id: baseId + 2,
      userId: 999,
      url: "https://clips.twitch.tv/demoClip2",
      thumbnailUrl: "https://clips.twitch.tv/demoClip2_thumbnail.jpg",
      title: "Incredible Play 2",
      description: "Check out this amazing play!",
      gameId: 2,
      views: 150,
      createdAt: new Date(2022, 0, 3),
      updatedAt: new Date(2022, 0, 3)
    },
    {
      id: baseId + 3,
      userId: 999,
      url: "https://clips.twitch.tv/demoClip3",
      thumbnailUrl: "https://clips.twitch.tv/demoClip3_thumbnail.jpg",
      title: "Funny Moment 3",
      description: "A moment that will make you laugh.",
      gameId: 5,
      views: 200,
      createdAt: new Date(2022, 0, 4),
      updatedAt: new Date(2022, 0, 4)
    }
  ];
};

export const getDemoFavoriteGames = (): Game[] => {
  return [
    {
      id: 1,
      name: "Valorant",
      imageUrl: "https://static-cdn.jtvnw.net/ttv-boxart/516575-285x380.jpg",
      createdAt: new Date(2022, 0, 1)
    },
    {
      id: 2,
      name: "Fortnite",
      imageUrl: "https://static-cdn.jtvnw.net/ttv-boxart/33214-285x380.jpg",
      createdAt: new Date(2022, 0, 1)
    },
    {
      id: 5,
      name: "League of Legends",
      imageUrl: "https://static-cdn.jtvnw.net/ttv-boxart/21779-285x380.jpg",
      createdAt: new Date(2022, 0, 1)
    },
    {
      id: 6,
      name: "Call of Duty: Warzone",
      imageUrl: "https://static-cdn.jtvnw.net/ttv-boxart/512710-285x380.jpg",
      createdAt: new Date(2022, 0, 1)
    },
    {
      id: 7,
      name: "Apex Legends",
      imageUrl: "https://static-cdn.jtvnw.net/ttv-boxart/506416-285x380.jpg",
      createdAt: new Date(2022, 0, 1)
    }
  ];
};