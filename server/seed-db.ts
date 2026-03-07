import { db } from './db';
import { games, users, profileBanners } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

async function seedGames() {
  console.log('Seeding games table...');
  
  // Popular game data
  const gameData = [
    { name: 'Fortnite', imageUrl: 'https://placehold.co/200x120/222/444?text=Fortnite' },
    { name: 'Minecraft', imageUrl: 'https://placehold.co/200x120/222/444?text=Minecraft' },
    { name: 'Call of Duty: Warzone', imageUrl: 'https://placehold.co/200x120/222/444?text=Warzone' },
    { name: 'League of Legends', imageUrl: 'https://placehold.co/200x120/222/444?text=LoL' },
    { name: 'Apex Legends', imageUrl: 'https://placehold.co/200x120/222/444?text=Apex' },
    { name: 'Grand Theft Auto V', imageUrl: 'https://placehold.co/200x120/222/444?text=GTA V' },
    { name: 'Valorant', imageUrl: 'https://placehold.co/200x120/222/444?text=Valorant' },
    { name: 'Overwatch', imageUrl: 'https://placehold.co/200x120/222/444?text=Overwatch' },
    { name: 'Rainbow Six Siege', imageUrl: 'https://placehold.co/200x120/222/444?text=R6S' },
    { name: 'Rocket League', imageUrl: 'https://placehold.co/200x120/222/444?text=Rocket League' },
    { name: 'Dota 2', imageUrl: 'https://placehold.co/200x120/222/444?text=Dota 2' },
    { name: 'Counter-Strike', imageUrl: 'https://placehold.co/200x120/222/444?text=CS' },
    { name: 'FIFA 23', imageUrl: 'https://placehold.co/200x120/222/444?text=FIFA 23' },
    { name: 'Among Us', imageUrl: 'https://placehold.co/200x120/222/444?text=Among Us' },
    { name: 'Roblox', imageUrl: 'https://placehold.co/200x120/222/444?text=Roblox' },
    { name: 'World of Warcraft', imageUrl: 'https://placehold.co/200x120/222/444?text=WoW' },
    { name: 'Destiny 2', imageUrl: 'https://placehold.co/200x120/222/444?text=Destiny 2' },
    { name: 'Elden Ring', imageUrl: 'https://placehold.co/200x120/222/444?text=Elden Ring' },
    { name: 'Genshin Impact', imageUrl: 'https://placehold.co/200x120/222/444?text=Genshin' },
    { name: 'Cyberpunk 2077', imageUrl: 'https://placehold.co/200x120/222/444?text=Cyberpunk' }
  ];
  
  let insertedCount = 0;
  
  // Insert games one by one, skipping duplicates
  for (const gameInfo of gameData) {
    try {
      const existingGame = await db.select().from(games).where(eq(games.name, gameInfo.name)).limit(1);
      
      if (existingGame.length === 0) {
        await db.insert(games).values(gameInfo);
        insertedCount++;
        console.log(`Added game: ${gameInfo.name}`);
      } else {
        console.log(`Game already exists: ${gameInfo.name}`);
      }
    } catch (error) {
      console.log(`Skipped duplicate game: ${gameInfo.name}`);
    }
  }
  
  console.log(`Seeded ${insertedCount} new games.`);
}

async function seedUsers() {
  console.log('Seeding users table...');
  
  // Check if users already exist
  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) {
    console.log(`Found ${existingUsers.length} existing users, skipping seed.`);
    return;
  }
  
  // Sample user data
  const userData = [
    {
      username: 'admin',
      displayName: 'Admin User',
      password: await hashPassword('password123'),
      bio: 'Administrator account',
      avatarUrl: 'https://placehold.co/150x150/222/444?text=Admin',
      bannerUrl: 'https://placehold.co/1200x300/222/444?text=Admin+Banner'
    },
    {
      username: 'gamerpro',
      displayName: 'Gamer Pro',
      password: await hashPassword('password123'),
      bio: 'Professional gamer and content creator',
      avatarUrl: 'https://placehold.co/150x150/222/444?text=GamerPro',
      bannerUrl: 'https://placehold.co/1200x300/222/444?text=GamerPro+Banner'
    },
    {
      username: 'streamer123',
      displayName: 'Top Streamer',
      password: await hashPassword('password123'),
      bio: 'Streaming your favorite games daily',
      avatarUrl: 'https://placehold.co/150x150/222/444?text=Streamer',
      bannerUrl: 'https://placehold.co/1200x300/222/444?text=Streamer+Banner'
    }
  ];
  
  // Insert users
  const result = await db.insert(users).values(userData).returning();
  console.log(`Seeded ${result.length} users.`);
}

async function seedProfileBanners() {
  console.log('Seeding profile banners...');
  
  // Clear existing banners to replace with new ones
  await db.delete(profileBanners);
  console.log('Cleared existing banners.');
  
  // New banner data with gradient and abstract themes
  const bannerData = [
    // Gradient themed banners
    { 
      name: 'Monochrome Gradient', 
      imageUrl: '/attached_assets/blackwhite_1756234272342.png', 
      category: 'gradient' 
    },
    { 
      name: 'Red-Green Gradient', 
      imageUrl: '/attached_assets/redgreen_1756234272360.png', 
      category: 'gradient' 
    },
    { 
      name: 'Blue-Yellow Gradient', 
      imageUrl: '/attached_assets/blueyellow_1756234272363.png', 
      category: 'gradient' 
    },
    { 
      name: 'Purple Gradient', 
      imageUrl: '/attached_assets/purple_1756234272365.png', 
      category: 'gradient' 
    },
    { 
      name: 'Green Gradient', 
      imageUrl: '/attached_assets/green_1756234272368.png', 
      category: 'gradient' 
    },
    
    // Solid themed banners
    { 
      name: 'Ice Blue', 
      imageUrl: '/attached_assets/Ice_1756234272366.png', 
      category: 'solid' 
    },
    { 
      name: 'Teal', 
      imageUrl: '/attached_assets/Teal_1756234272366.png', 
      category: 'solid' 
    },
    { 
      name: 'White Texture', 
      imageUrl: '/attached_assets/White_1756234272367.png', 
      category: 'solid' 
    },
    { 
      name: 'Gold', 
      imageUrl: '/attached_assets/Gold_1756234272367.png', 
      category: 'solid' 
    }
  ];
  
  // Insert banners
  const result = await db.insert(profileBanners).values(bannerData).returning();
  console.log(`Seeded ${result.length} profile banners.`);
}

async function main() {
  console.log('Starting database seed...');
  
  try {
    await seedGames();
    await seedUsers();
    await seedProfileBanners();
    console.log('Database seed completed successfully.');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    process.exit(0);
  }
}

// Run the seed function
main();