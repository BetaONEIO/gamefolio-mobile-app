import { User } from "@shared/schema";

// Create a test user to have conversations with the demo user
export const getTestUser = (): User => {
  return {
    id: 23,
    username: "goliath",
    password: "$2a$10$XJXQyZHlG8soJ4TxBv9wGedwS1Uo6F.S5LpsTm5PcbcW0kRRZwE/C", // hashed "password"
    email: "goliath@gamefolio.com",
    emailVerified: true,
    displayName: "Goliath",
    bio: "Test user for messaging functionality",
    avatarUrl: "/attached_assets/gamefolio social logo 3d circle web.png",
    bannerUrl: null,
    backgroundColor: "#0B2232",
    cardColor: "#1E3A5F",
    accentColor: "#4ADE80",
    primaryColor: "#041F3E",
    layoutStyle: "grid",
    steamUsername: null,
    xboxUsername: null,
    playstationUsername: null,
    twitterUsername: null,
    youtubeUsername: null,
    discordUsername: null,
    epicUsername: null,
    nintendoUsername: null,
    userType: "Casual Gamer",
    ageRange: "18-24",
    authProvider: "local",
    externalId: null,
    role: "user",
    status: "active",
    lastLoginAt: null,
    bannedReason: null,
    messagingEnabled: true,
    createdAt: new Date(2022, 0, 1),
    updatedAt: new Date()
  };
};