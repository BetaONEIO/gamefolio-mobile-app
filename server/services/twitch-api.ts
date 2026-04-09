import axios from 'axios';

// Check if required environment variables are set
if (!process.env.TWITCH_CLIENT_ID) {
  console.error('TWITCH_CLIENT_ID environment variable is not set');
}

if (!process.env.TWITCH_CLIENT_SECRET) {
  console.error('TWITCH_CLIENT_SECRET environment variable is not set');
}

// Interface for Twitch API access token response
interface TwitchAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

// Interface for Twitch game data
export interface TwitchGame {
  id: string;
  name: string;
  box_art_url: string;
  igdb_id?: string;
}

// Twitch API service
class TwitchApiService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private readonly clientId: string;
  private readonly clientSecret: string;
  
  constructor() {
    this.clientId = process.env.TWITCH_CLIENT_ID || '';
    this.clientSecret = process.env.TWITCH_CLIENT_SECRET || '';
  }
  
  /**
   * Check if Twitch API is properly configured
   */
  private isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  /**
   * Get an access token from the Twitch API
   */
  private async getAccessToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Twitch API credentials not configured');
    }

    // If we already have a valid token, return it
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }
    
    // Otherwise, get a new token
    try {
      const response = await axios.post<TwitchAuthResponse>(
        'https://id.twitch.tv/oauth2/token',
        null,
        {
          params: {
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'client_credentials'
          }
        }
      );
      
      this.accessToken = response.data.access_token;
      // Set expiry time (subtract 60 seconds for safety)
      this.tokenExpiresAt = Date.now() + (response.data.expires_in - 60) * 1000;
      
      return this.accessToken;
    } catch (error) {
      console.error('Error getting Twitch access token:', error);
      throw new Error('Failed to authenticate with Twitch API');
    }
  }
  
  /**
   * Get top games from Twitch API with cursor-based pagination
   */
  async getTopGames(limit: number = 20, cursor?: string): Promise<{ games: TwitchGame[], nextCursor?: string }> {
    if (!this.isConfigured()) {
      throw new Error('Twitch API credentials not configured');
    }
    
    try {
      const token = await this.getAccessToken();

      const params: Record<string, any> = { first: Math.min(limit, 100) };
      if (cursor) params.after = cursor;

      const response = await axios.get('https://api.twitch.tv/helix/games/top', {
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${token}`
        },
        params
      });
      
      // Filter out non-gaming categories
      const excludedCategories = [
        'Just Chatting',
        'Music',
        'Art',
        'Talk Shows & Podcasts',
        'ASMR',
        'Pools, Hot Tubs, and Beaches',
        'Sports',
        'Travel & Outdoors',
        'Science & Technology',
        'Food & Drink',
        'Beauty & Body Art',
        'Special Events',
        'IRL',
        'Makers & Crafting',
        'Politics',
        'Animals, Aquariums, and Zoos'
      ];

      const filteredGames = (response.data.data || []).filter((game: any) => 
        !excludedCategories.includes(game.name)
      );

      const games = filteredGames.map((game: any) => {
        let boxArtUrl = game.box_art_url || '';
        
        if (boxArtUrl.includes('{width}x{height}')) {
          boxArtUrl = boxArtUrl.replace('{width}x{height}', '600x800');
        } else if (boxArtUrl.includes('{width}') && boxArtUrl.includes('{height}')) {
          boxArtUrl = boxArtUrl.replace('{width}', '600').replace('{height}', '800');
        }
        
        return {
          id: game.id,
          name: game.name,
          box_art_url: boxArtUrl,
          igdb_id: game.igdb_id
        };
      });

      const nextCursor = response.data.pagination?.cursor || undefined;

      return { games, nextCursor };
    } catch (error) {
      console.error('Error fetching top games from Twitch:', error);
      throw new Error('Failed to fetch top games from Twitch API');
    }
  }
  
  /**
   * Search for games on Twitch using the search API
   * This uses a different endpoint that allows for partial name matching
   */
  async searchGames(query: string, limit: number = 20): Promise<TwitchGame[]> {
    if (!this.isConfigured()) {
      throw new Error('Twitch API credentials not configured');
    }
    
    try {
      const token = await this.getAccessToken();
      
      // Use the search API which supports partial matches
      const response = await axios.get('https://api.twitch.tv/helix/search/categories', {
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${token}`
        },
        params: {
          query: query,
          first: limit
        }
      });
      
      // Filter out non-gaming categories
      const excludedCategories = [
        'Just Chatting',
        'Music',
        'Art',
        'Talk Shows & Podcasts',
        'ASMR',
        'Pools, Hot Tubs, and Beaches',
        'Sports',
        'Travel & Outdoors',
        'Science & Technology',
        'Food & Drink',
        'Beauty & Body Art',
        'Special Events',
        'IRL',
        'Makers & Crafting',
        'Politics',
        'Animals, Aquariums, and Zoos'
      ];

      const filteredGames = response.data.data.filter((game: any) => 
        !excludedCategories.includes(game.name)
      );
      
      return filteredGames.map((game: any) => {
        let boxArtUrl = game.box_art_url || '';
        
        // Handle template format: {width}x{height}
        if (boxArtUrl.includes('{width}x{height}')) {
          boxArtUrl = boxArtUrl.replace('{width}x{height}', '600x800');
        } else if (boxArtUrl.includes('{width}') && boxArtUrl.includes('{height}')) {
          boxArtUrl = boxArtUrl.replace('{width}', '600').replace('{height}', '800');
        } else {
          // search/categories returns hardcoded sizes like _IGDB-52x72.jpg or -52x72.jpg
          // Replace any hardcoded dimensions with 600x800
          boxArtUrl = boxArtUrl.replace(/_IGDB-\d+x\d+\./, '_IGDB-600x800.').replace(/-\d+x\d+\./, '-600x800.');
        }
        
        return {
          id: game.id,
          name: game.name,
          box_art_url: boxArtUrl,
          igdb_id: game.igdb_id || ''
        };
      });
    } catch (error) {
      console.error('Error searching games on Twitch:', error);
      throw new Error('Failed to search games on Twitch API');
    }
  }
  
  /**
   * Get game by ID
   */
  async getGameById(gameId: string): Promise<TwitchGame | null> {
    if (!this.isConfigured()) {
      throw new Error('Twitch API credentials not configured');
    }
    
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get('https://api.twitch.tv/helix/games', {
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${token}`
        },
        params: {
          id: gameId
        }
      });
      
      if (response.data.data.length === 0) {
        return null;
      }
      
      const game = response.data.data[0];
      let boxArtUrl = game.box_art_url;
      
      // Handle both possible template formats
      if (boxArtUrl.includes('{width}x{height}')) {
        boxArtUrl = boxArtUrl.replace('{width}x{height}', '285x380');
      } else if (boxArtUrl.includes('{width}') && boxArtUrl.includes('{height}')) {
        boxArtUrl = boxArtUrl.replace('{width}', '285').replace('{height}', '380');
      }
      
      return {
        id: game.id,
        name: game.name,
        box_art_url: boxArtUrl,
        igdb_id: game.igdb_id
      };
    } catch (error) {
      console.error('Error fetching game from Twitch:', error);
      throw new Error('Failed to fetch game from Twitch API');
    }
  }
  
  /**
   * Get game by name
   */
  async getGameByName(name: string): Promise<TwitchGame | null> {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get('https://api.twitch.tv/helix/games', {
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${token}`
        },
        params: {
          name: name
        }
      });
      
      if (response.data.data.length === 0) {
        return null;
      }
      
      const game = response.data.data[0];
      let boxArtUrl = game.box_art_url;
      
      // Handle both possible template formats
      if (boxArtUrl.includes('{width}x{height}')) {
        boxArtUrl = boxArtUrl.replace('{width}x{height}', '285x380');
      } else if (boxArtUrl.includes('{width}') && boxArtUrl.includes('{height}')) {
        boxArtUrl = boxArtUrl.replace('{width}', '285').replace('{height}', '380');
      }
      
      return {
        id: game.id,
        name: game.name,
        box_art_url: boxArtUrl,
        igdb_id: game.igdb_id
      };
    } catch (error) {
      console.error('Error fetching game from Twitch:', error);
      throw new Error('Failed to fetch game from Twitch API');
    }
  }
}

// Create and export a singleton instance
export const twitchApi = new TwitchApiService();