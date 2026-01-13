import { publicProcedure } from "@/backend/trpc/create-context";
import { z } from "zod";
import { Env } from "@/constants/Env";

const mockHashtags = [
  { id: '1', name: 'valorant', count: 15420 },
  { id: '2', name: 'fortnite', count: 12300 },
  { id: '3', name: 'apex', count: 9800 },
  { id: '4', name: 'csgo', count: 8500 },
  { id: '5', name: 'leagueoflegends', count: 7200 },
  { id: '6', name: 'minecraft', count: 6800 },
  { id: '7', name: 'overwatch', count: 5400 },
  { id: '8', name: 'rocketleague', count: 4200 },
  { id: '9', name: 'callofduty', count: 3900 },
  { id: '10', name: 'gta', count: 3500 },
  { id: '11', name: 'league', count: 5600 },
  { id: '12', name: 'leagueclips', count: 3200 },
];

const mockUsers = [
  { id: '999999', username: 'sample_gamer', displayName: 'Sample Gamer', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop', verified: true, followers: 1247 },
  { id: '1', username: 'ProGamer123', displayName: 'Pro Gamer', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100', verified: true, followers: 125000 },
  { id: '2', username: 'NinjaStreamer', displayName: 'Ninja Streamer', avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100', verified: true, followers: 89000 },
  { id: '3', username: 'GameMaster', displayName: 'Game Master', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100', verified: false, followers: 45000 },
  { id: '4', username: 'ValPlayer', displayName: 'Valorant Player', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100', verified: true, followers: 67000 },
  { id: '5', username: 'ApexPro', displayName: 'Apex Professional', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcabd36?w=100', verified: false, followers: 23000 },
  { id: '6', username: 'LeagueFan', displayName: 'League Fan', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100', verified: false, followers: 34000 },
  { id: '7', username: 'LeaguePro', displayName: 'League Pro Player', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', verified: true, followers: 156000 },
];

interface TwitchToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface TwitchGame {
  id: string;
  name: string;
  box_art_url: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getTwitchToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    console.log("[Search/Twitch] Using cached token");
    return cachedToken.token;
  }

  console.log("[Search/Twitch] Fetching new access token...");
  console.log("[Search/Twitch] Using client_id:", Env.TWITCH_CLIENT_ID);
  
  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: Env.TWITCH_CLIENT_ID,
      client_secret: Env.TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });

  console.log("[Search/Twitch] Token response status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Search/Twitch] Token fetch failed:", response.status, errorText);
    throw new Error(`Failed to get Twitch access token: ${response.status}`);
  }

  const data: TwitchToken = await response.json();
  console.log("[Search/Twitch] Token response:", JSON.stringify(data).slice(0, 100));
  
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  console.log("[Search/Twitch] Token acquired successfully");
  return cachedToken.token;
}

async function searchTwitchGames(query: string, limit: number): Promise<{ id: string; name: string; icon: string; category: string; players: number }[]> {
  console.log(`[Search/Twitch] Starting search for: "${query}"`);
  console.log(`[Search/Twitch] Client ID: ${Env.TWITCH_CLIENT_ID ? "Set" : "Missing"}`);
  console.log(`[Search/Twitch] Client Secret: ${Env.TWITCH_CLIENT_SECRET ? "Set" : "Missing"}`);
  
  if (!Env.TWITCH_CLIENT_ID || !Env.TWITCH_CLIENT_SECRET) {
    console.error("[Search/Twitch] Missing Twitch credentials");
    return [];
  }
  
  try {
    const accessToken = await getTwitchToken();
    console.log(`[Search/Twitch] Got access token: ${accessToken ? "Yes" : "No"}`);
    
    const searchUrl = new URL("https://api.twitch.tv/helix/search/categories");
    searchUrl.searchParams.set("query", query);
    searchUrl.searchParams.set("first", limit.toString());
    
    console.log(`[Search/Twitch] Fetching: ${searchUrl.toString()}`);
    
    const response = await fetch(searchUrl.toString(), {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Client-Id": Env.TWITCH_CLIENT_ID,
      },
    });

    console.log(`[Search/Twitch] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Search/Twitch] Search failed:", response.status, errorText);
      return [];
    }

    const data: { data: TwitchGame[] } = await response.json();
    
    console.log(`[Search/Twitch] Found ${data.data?.length || 0} games for "${query}"`);
    
    if (!data.data || data.data.length === 0) {
      return [];
    }
    
    return data.data.map((game) => ({
      id: game.id,
      name: game.name,
      icon: game.box_art_url
        .replace("{width}", "100")
        .replace("{height}", "100"),
      category: "Game",
      players: 0,
    }));
  } catch (error) {
    console.error("[Search/Twitch] Error searching games:", error);
    return [];
  }
}

const searchRoute = publicProcedure
  .input(z.object({
    query: z.string().min(1),
    limit: z.number().optional().default(5),
  }))
  .query(async ({ input }) => {
    const { query, limit } = input;
    const searchTerm = query.toLowerCase();
    
    console.log(`[Search] Searching for: "${query}"`);

    const hashtags = mockHashtags
      .filter(tag => tag.name.toLowerCase().includes(searchTerm))
      .slice(0, limit);
    
    console.log(`[Search] Found ${hashtags.length} hashtags`);

    const users = mockUsers
      .filter(user => 
        user.username.toLowerCase().includes(searchTerm) || 
        user.displayName.toLowerCase().includes(searchTerm)
      )
      .slice(0, limit);
    
    console.log(`[Search] Found ${users.length} users`);

    let games: { id: string; name: string; icon: string; category: string; players: number }[] = [];
    try {
      games = await searchTwitchGames(query, limit);
      console.log(`[Search] Found ${games.length} games from Twitch`);
    } catch (error) {
      console.error(`[Search] Failed to search Twitch games:`, error);
    }

    const result = {
      hashtags,
      users,
      games,
    };
    
    console.log(`[Search] Returning results:`, JSON.stringify(result).slice(0, 200));

    return result;
  });

export default searchRoute;
