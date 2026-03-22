import { Platform } from 'react-native';

function getBackendUrl(): string {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[Env] 🔍 Backend URL Configuration');
  console.log('[Env] Platform:', Platform.OS);
  console.log('[Env] EXPO_PUBLIC_BACKEND_URL:', process.env.EXPO_PUBLIC_BACKEND_URL || 'NOT SET');
  console.log('[Env] EXPO_PUBLIC_DOMAIN:', process.env.EXPO_PUBLIC_DOMAIN || 'NOT SET');
  console.log('[Env] EXPO_PUBLIC_RORK_API_BASE_URL:', process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'NOT SET');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // EXPO_PUBLIC_DOMAIN is set by the Replit dev workflow to point to the local backend.
  // It takes priority so all dev traffic goes to the local server (which has the latest API endpoints).
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    let url = process.env.EXPO_PUBLIC_DOMAIN.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    url = url.replace(/\/+$/, '');
    console.log('[Env] ✅ USING LOCAL BACKEND (EXPO_PUBLIC_DOMAIN):', url);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return url;
  }

  // Check if explicit backend URL override is set and valid (not just the Expo dev server)
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    let url = process.env.EXPO_PUBLIC_BACKEND_URL.trim();
    
    // Ignore if it's just the Expo dev server URL
    if (url && !url.includes('.exp.direct') && !url.includes('localhost')) {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      url = url.replace(/\/+$/, '');
      
      console.log('[Env] ✅ USING ENV BACKEND:', url);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return url;
    }
  }
  
  // Use Rork API base URL (automatically provided by the platform)
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    const rorkUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL.replace(/\/+$/, '');
    console.log('[Env] ✅ USING RORK BACKEND:', rorkUrl);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return rorkUrl;
  }
  
  // Fallback for web development
  const fallbackUrl = typeof window !== 'undefined' ? window.location.origin : '';
  console.log('[Env] ⚠️ USING FALLBACK URL:', fallbackUrl);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  return fallbackUrl;
}

export const Env = {
  BACKEND_URL: getBackendUrl(),
  TWITCH_CLIENT_ID: "2xvtsvhbex42odv6r1cjosl0615dnq",
  TWITCH_CLIENT_SECRET: "kwj1vxzy9g2mrfxtvz3mxvqnmgm267",
  // Other keys provided but not immediately used for this specific task, storing them for future use
  VITE_FIREBASE_API_KEY: "AIzaSyBXKtoMNdwmcifiWrqqvBL3pZlhbIdKdF8",
  VITE_FIREBASE_APP_ID: "1:349320760496:web:f4a1dfe82d2d0d5230bf75",
  VITE_FIREBASE_PROJECT_ID: "gamefolio-df931",
  SITE_URL: "https://app.gamefolio.com",
  DISCORD_CLIENT_ID: "1411278287866433566",
  VITE_DISCORD_CLIENT_ID: "1411278287866433566",
  DISCORD_CLIENT_SECRET: "Q2NZm9I8xSp7RiEw9z17qXmFvvK9wmQ3",
  // Mobile Discord OAuth (separate app to avoid breaking web)
  DISCORD_MOBILE_CLIENT_ID: "1454431347874594921",
  DISCORD_MOBILE_CLIENT_SECRET: process.env.EXPO_PUBLIC_DISCORD_MOBILE_CLIENT_SECRET || "",
  GOOGLE_CLIENT_ID: "203672150024-8f69dg3dboaafmf69jmr638b0ruh19ph.apps.googleusercontent.com",
  GOOGLE_IOS_CLIENT_ID: "203672150024-jiibs6emo1qkqmusjsfr8qnus8ut0raa.apps.googleusercontent.com",
  GOOGLE_ANDROID_CLIENT_ID: "203672150024-9o57aovsdgim84jisgatn004korgtrr9.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "",
  JWT_SECRET: "Jkdjsl$22Awj2@32kjlskjfads232s",
  VITE_CROSSMINT_CLIENT_API_KEY: "sk_production_5TGyr883rroECYXkfd8BtyPbZg7rVb8EEQw76cCYM4ojxYtTwvMaKftY7rhmBgxFhwvXvbnx1pLSthfkHQ1VrxyxSawma2sVVjyyJkuEJyWUQqcVGyGYCexX9H4ZWSsXhpvQNjgpsTZLcbyY8hh8rpWqUqQvJWyWgFMeaZR4vnWbsbAYxrTzo9h5U735iDvaG84vbt9sX9mguhJknNyz68FL",
  VITE_CROSSMINT_API_KEY: "sk_production_5TGyr883rroECYXkfd8BtyPbZg7rVb8EEQw76cCYM4ojxYtTwvMZbNZwGCWhFEmzGCvfvM8Pn5g46c5MngDgVUY51iHTcQatcqiznuxiRu3bomSKF9XQruQibnjugssxEdgKRmSbD39ZM1xeSVbBjtXEyvbVEgR4kXCjMi77CULKr9Z6qq1rHCkMqJFP1dkGWEkY4SZoys8VZuTPGknSs9MG",
  CROSSMINT_API_KEY: "sk_production_21WuJUScYEYmgKUMmYkKL2SxrzoQuF5MfqUDFs7hBSLCYcmjot4QK3hzmbN4T3ek7wArnffazJ1U2dgBKAETrNzhwBKasiugJAx5AR3vQEDBR5PDz2es21e5hp1Ub4sv8WCsRPS6UzsbUAeTn7qaCYi6JSW4zabQC7J3PotzoPuUQWAbRmTs4CoEUjoskvhF1WsgDq9rLex39pPAjgGr8Lk",
  SUPABASE_URL: "https://rupzmxqyhqktpifgfmzc.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cHpteHF5aHFrdHBpZmdmbXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTMyNjksImV4cCI6MjA2ODI2OTI2OX0.azmpGPtYcXhq3RbCMA9rRgVbT_Ook8TDTwdLz9ADUDU",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cHpteHF5aHFrdHBpZmdmbXpjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5MzI2OSwiZXhwIjoyMDY4MjY5MjY5fQ.Deza81HvmqT8Ms1ro__mfGmWlu7SgBP3Q3671_1g-4M",
  REPLIT_CLIENT_ID: "",
  REPLIT_CLIENT_SECRET: "",
};
