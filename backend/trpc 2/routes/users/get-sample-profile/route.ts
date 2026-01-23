import { publicProcedure } from "../../../create-context";

export default publicProcedure.query(async () => {
  console.log('[tRPC] get-sample-profile called');

  const sampleUser = {
    id: 999999,
    username: 'sample_gamer',
    displayName: 'Sample Gamer',
    email: 'sample@gamefolio.com',
    emailVerified: true,
    role: 'user',
    totalXP: 12500,
    level: 15,
    currentStreak: 7,
    longestStreak: 21,
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=400&fit=crop',
    bio: 'Pro gamer | Streamer | Content Creator | Sharing my best gaming moments 🎮',
    messagingEnabled: true,
    isPrivate: false,
    userType: 'creator',
    ageRange: '18-24',
    gfTokenBalance: 2500,
    accentColor: '#4ADE80',
    backgroundColor: '#0F1520',
    isOnline: true,
    lastActive: new Date().toISOString(),
    _count: {
      followers: 1247,
      following: 523,
      clips: 48,
    }
  };

  console.log('[tRPC] Returning sample profile:', sampleUser.username);
  return { user: sampleUser };
});
