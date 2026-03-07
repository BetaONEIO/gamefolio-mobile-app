import axios from 'axios';
import { Game, insertGameSchema } from '@shared/schema';
import { db } from '../db';
import { games } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

// RAWG API types
interface RAWGGame {
  id: number;
  name: string;
  background_image: string;
  released?: string;
  metacritic?: number;
}

interface RAWGResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: RAWGGame[];
}

export class RAWGService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.RAWG_API_KEY || '';
    this.baseUrl = 'https://api.rawg.io/api';
    
    if (!this.apiKey) {
      console.warn('RAWG_API_KEY not found! Game search functionality will be limited.');
    }
  }

  async searchGames(query: string): Promise<Game[]> {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      // First, try to find partial matches in our local database
      const localGames = await db.select()
        .from(games)
        .where(
          // Use SQL LIKE for partial matches with Drizzle's syntax
          sql`${games.name} LIKE ${`%${query}%`}`
        )
        .limit(10);

      // If we have enough results locally, return them
      if (localGames.length >= 5) {
        return localGames;
      }

      // Otherwise, also fetch from RAWG API
      console.log(`Searching RAWG API for: "${query}"`);
      const response = await axios.get<RAWGResponse>(`${this.baseUrl}/games`, {
        params: {
          key: this.apiKey,
          search: query,
          page_size: 10,
          search_exact: false,
        }
      });

      const rawgGames = response.data.results;
      const mappedGames: Game[] = [];
      
      // Add any local games we already found
      mappedGames.push(...localGames);
      
      // Track the games we've already added to avoid duplicates
      const addedGames = new Set(localGames.map(g => g.name.toLowerCase()));

      for (const rawgGame of rawgGames) {
        // Skip if we already have this game in our results
        if (addedGames.has(rawgGame.name.toLowerCase())) {
          continue;
        }
        
        // Create a new game with a temporary ID
        // We don't need to save this to the database as it's just for the search results
        mappedGames.push({
          id: Math.abs(rawgGame.id % 10000), // Make sure id fits in our db schema
          name: rawgGame.name,
          imageUrl: rawgGame.background_image || null,
          createdAt: new Date()
        });
        
        addedGames.add(rawgGame.name.toLowerCase());
      }

      return mappedGames;
    } catch (error) {
      console.error('Error searching games:', error);
      
      // Log more detailed error information for debugging
      if (axios.isAxiosError(error)) {
        console.error('API error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
      }
      
      // Return any local games we can find as fallback
      return db.select()
        .from(games)
        .where(
          sql`${games.name} LIKE ${`%${query}%`}`
        )
        .limit(10);
    }
  }

  async getGameDetails(gameId: number): Promise<Game | null> {
    try {
      // First check if we have this game in our database
      const [existingGame] = await db.select().from(games).where(eq(games.id, gameId));
      if (existingGame) {
        return existingGame;
      }

      return null;
    } catch (error) {
      console.error('Error getting game details:', error);
      return null;
    }
  }
  
  async getTrendingGames(limit: number = 10): Promise<Game[]> {
    try {
      console.log('RAWG API Key:', this.apiKey.substring(0, 4) + '...');
      console.log('Fetching trending games from RAWG API...');
      
      // Directly fetch from RAWG API regardless of database content
      const response = await axios.get<RAWGResponse>(`${this.baseUrl}/games`, {
        params: {
          key: this.apiKey,
          ordering: '-rating', // Order by highest rated
          page_size: limit,
          dates: '2022-01-01,2025-12-31' // Recent games
        }
      });

      console.log(`RAWG API returned ${response.data.results.length} games`);
      
      const rawgGames = response.data.results;
      
      // Map the RAWG games to our Game type
      // The id field won't match our database, but that's OK for this temporary view
      const mappedGames = rawgGames.map(rawgGame => ({
        id: Math.abs(rawgGame.id % 1000), // Make sure id fits in our db schema 
        name: rawgGame.name,
        imageUrl: rawgGame.background_image || null, 
        createdAt: new Date()
      }));
      
      console.log('First game image URL:', mappedGames[0]?.imageUrl);
      
      return mappedGames;
    } catch (error) {
      console.error('Error fetching trending games from RAWG API:', error);
      
      // Log more detailed error information
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
      }
      
      // Return whatever games we have in the database as fallback
      return db.select().from(games).limit(limit);
    }
  }
}

// Create singleton instance
export const rawgService = new RAWGService();