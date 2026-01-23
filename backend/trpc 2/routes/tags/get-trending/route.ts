import { publicProcedure } from "../../../create-context";

const TRENDING_TAGS = [
  "gaming", "fortnite", "valorant", "cod", "minecraft",
  "funny", "fails", "clutch", "esports", "twitch",
  "streamer", "fps", "rpg", "gta", "leagueoflegends",
  "overwatch", "csgo", "roblox", "apexlegends", "callofduty"
];

export default publicProcedure
  .query(async () => {
    // In a real app, this would query the database for most used tags in the last 24h
    return TRENDING_TAGS;
  });
