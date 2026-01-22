import { publicProcedure } from "@/backend/trpc/create-context";
import { z } from "zod";

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || "2xvtsvhbex42odv6r1cjosl0615dnq";
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || "kwj1vxzy9g2mrfxtvz3mxvqnmgm267";

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
    return cachedToken.token;
  }

  console.log("[Twitch] Fetching new access token...");
  
  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Twitch] Token fetch failed:", errorText);
    throw new Error("Failed to get Twitch access token");
  }

  const data: TwitchToken = await response.json();
  
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  console.log("[Twitch] Token acquired successfully");
  return cachedToken.token;
}

const searchGamesRoute = publicProcedure
  .input(z.object({
    query: z.string().min(1),
    limit: z.number().optional().default(5),
  }))
  .query(async ({ input }) => {
    const { query, limit } = input;
    
    console.log(`[Twitch] Searching games for: "${query}"`);
    
    try {
      const accessToken = await getTwitchToken();
      
      const searchUrl = new URL("https://api.twitch.tv/helix/search/categories");
      searchUrl.searchParams.set("query", query);
      searchUrl.searchParams.set("first", limit.toString());
      
      const response = await fetch(searchUrl.toString(), {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Client-Id": TWITCH_CLIENT_ID,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Twitch] Search failed:", errorText);
        throw new Error("Failed to search Twitch games");
      }

      const data: { data: TwitchGame[] } = await response.json();
      
      console.log(`[Twitch] Found ${data.data.length} games`);
      
      const games = data.data.map((game) => ({
        id: game.id,
        name: game.name,
        icon: game.box_art_url
          .replace("{width}", "100")
          .replace("{height}", "100"),
        category: "Game",
        players: 0,
      }));

      return { games };
    } catch (error) {
      console.error("[Twitch] Error searching games:", error);
      return { games: [] };
    }
  });

export default searchGamesRoute;
