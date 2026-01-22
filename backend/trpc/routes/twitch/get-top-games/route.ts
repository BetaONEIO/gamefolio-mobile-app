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

const getTopGamesRoute = publicProcedure
  .input(z.object({
    limit: z.number().optional().default(20),
    cursor: z.string().optional(),
  }))
  .query(async ({ input }) => {
    const { limit, cursor } = input;
    
    console.log(`[Twitch] Fetching top ${limit} games`);
    
    try {
      const accessToken = await getTwitchToken();
      
      const url = new URL("https://api.twitch.tv/helix/games/top");
      url.searchParams.set("first", limit.toString());
      if (cursor) {
        url.searchParams.set("after", cursor);
      }
      
      const response = await fetch(url.toString(), {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Client-Id": TWITCH_CLIENT_ID,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Twitch] Get top games failed:", errorText);
        throw new Error("Failed to get top games from Twitch");
      }

      const data: { data: TwitchGame[]; pagination?: { cursor?: string } } = await response.json();
      
      console.log(`[Twitch] Found ${data.data.length} top games`);
      
      const games = data.data.map((game) => ({
        id: game.id,
        name: game.name,
        boxArt: game.box_art_url
          .replace("{width}", "285")
          .replace("{height}", "380"),
      }));

      return { 
        games,
        nextCursor: data.pagination?.cursor,
      };
    } catch (error) {
      console.error("[Twitch] Error getting top games:", error);
      return { games: [], nextCursor: undefined };
    }
  });

export default getTopGamesRoute;
