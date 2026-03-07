import { db } from "./db";
import { games } from "@shared/schema";
import { eq } from "drizzle-orm";

// Sample popular games with actual image URLs
const popularGames = [
  {
    name: "The Witcher 3: Wild Hunt",
    imageUrl: "https://media.rawg.io/media/games/618/618c2031a07bbff6b4f611f10b6bcdbc.jpg"
  },
  {
    name: "Grand Theft Auto V",
    imageUrl: "https://media.rawg.io/media/games/456/456dea5e1c7e3cd07060c14e96612001.jpg"
  },
  {
    name: "Portal 2",
    imageUrl: "https://media.rawg.io/media/games/328/3283617cb7d75d67257fc58339188742.jpg"
  },
  {
    name: "Red Dead Redemption 2",
    imageUrl: "https://media.rawg.io/media/games/511/5118aff5091cb3efec399c808f8c598f.jpg"
  },
  {
    name: "The Elder Scrolls V: Skyrim",
    imageUrl: "https://media.rawg.io/media/games/7cf/7cfc9220b401b7a300e409e539c9afd5.jpg"
  },
  {
    name: "Doom (2016)",
    imageUrl: "https://media.rawg.io/media/games/c4b/c4b0cab189e73432de3a250d8cf1c84e.jpg"
  },
  {
    name: "God of War (2018)",
    imageUrl: "https://media.rawg.io/media/games/4be/4be6a6ad0364751a96229c56bf69be59.jpg"
  },
  {
    name: "Horizon Zero Dawn",
    imageUrl: "https://media.rawg.io/media/games/b7d/b7d3f1715fa8381a4e780173a197a615.jpg"
  },
  {
    name: "Cyberpunk 2077",
    imageUrl: "https://media.rawg.io/media/games/26d/26d4437715bee60138dab4a7c8c59c92.jpg"
  },
  {
    name: "Ghost of Tsushima",
    imageUrl: "https://media.rawg.io/media/games/f24/f2493ea338fe7bd3c7d73750a85a0959.jpg"
  },
  {
    name: "Fortnite",
    imageUrl: "https://media.rawg.io/media/games/dcb/dcbb0ac1cf89a5c64a1b08fb78e96df5.jpg"
  },
  {
    name: "Call of Duty: Warzone",
    imageUrl: "https://media.rawg.io/media/games/7e3/7e327a055bedb9b6d1be86593bef473d.jpg"
  }
];

async function seedGames() {
  console.log("Seeding popular games...");
  
  for (const game of popularGames) {
    const existingGame = await db.select().from(games).where(eq(games.name, game.name)).limit(1);
    
    if (existingGame.length > 0) {
      // Update existing game with a proper imageUrl
      await db.update(games)
        .set({ imageUrl: game.imageUrl })
        .where(eq(games.id, existingGame[0].id));
      console.log(`Updated game: ${game.name}`);
    } else {
      // Insert new game
      await db.insert(games).values({
        name: game.name,
        imageUrl: game.imageUrl,
      });
      console.log(`Added new game: ${game.name}`);
    }
  }
  
  console.log("Games seeding complete");
}

// Run the seeding function
seedGames().catch(error => {
  console.error("Error seeding games:", error);
});