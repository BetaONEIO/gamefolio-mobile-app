import express from 'express';
import { storage } from '../storage';
import { twitchApi } from '../services/twitch-api';
import { InsertGame } from '@shared/schema';

const router = express.Router();

// Get top games from Twitch
router.get('/twitch/games/top', async (req: express.Request, res: express.Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const games = await twitchApi.getTopGames(limit, offset);

    res.json(games);
  } catch (error) {
    console.error('Error fetching top games from Twitch:', error);

    // Return a user-friendly error with fallback suggestion
    if (error instanceof Error && error.message.includes('credentials not configured')) {
      res.status(503).json({
        message: 'Twitch API integration is not configured. Please set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET environment variables.',
        fallback: 'You can still browse existing games in the database.'
      });
    } else {
      res.status(500).json({ message: 'Failed to fetch top games from Twitch' });
    }
  }
});

// Search for games on Twitch
router.get('/twitch/games/search', async (req: express.Request, res: express.Response) => {
  try {
    const query = req.query.q as string;

    if (!query) {
      return res.status(400).json({ message: 'Query parameter (q) is required' });
    }

    const games = await twitchApi.searchGames(query);
    res.json(games);
  } catch (error) {
    console.error('Error searching games on Twitch:', error);

    // Return a user-friendly error with fallback suggestion
    if (error instanceof Error && error.message.includes('credentials not configured')) {
      res.status(503).json({
        message: 'Twitch API integration is not configured. Please set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET environment variables.',
        fallback: 'You can still browse existing games in the database.'
      });
    } else {
      res.status(500).json({ message: 'Failed to search games on Twitch' });
    }
  }
});

// Get game by ID from Twitch
router.get('/twitch/games/:id', async (req: express.Request, res: express.Response) => {
  try {
    const gameId = req.params.id;
    const game = await twitchApi.getGameById(gameId);

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    res.json(game);
  } catch (error) {
    console.error('Error fetching game from Twitch:', error);

    // Return a user-friendly error with fallback suggestion
    if (error instanceof Error && error.message.includes('credentials not configured')) {
      res.status(503).json({
        message: 'Twitch API integration is not configured. Please set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET environment variables.',
        fallback: 'You can still browse existing games in the database.'
      });
    } else {
      res.status(500).json({ message: 'Failed to fetch game from Twitch' });
    }
  }
});

// Add a Twitch game to our database
router.post('/twitch/games/add', async (req: express.Request, res: express.Response) => {
  try {
    const { gameId } = req.body;

    if (!gameId) {
      return res.status(400).json({ message: 'Game ID is required' });
    }

    // Fetch the game from Twitch first
    const twitchGame = await twitchApi.getGameById(gameId);

    if (!twitchGame) {
      return res.status(404).json({ message: 'Game not found on Twitch' });
    }

    // Check if the game already exists in our database by name
    const existingGame = await storage.getGameByName(twitchGame.name);
    if (existingGame) {
      return res.json(existingGame);
    }

    // Add the game to our database - use higher resolution for crisp display
    const newGame: InsertGame = {
      name: twitchGame.name,
      imageUrl: twitchGame.box_art_url?.replace('{width}', '600').replace('{height}', '800'),
    };

    const createdGame = await storage.createGame(newGame);
    res.status(201).json(createdGame);
  } catch (error) {
    console.error('Error adding Twitch game to database:', error);

    // Return a user-friendly error with fallback suggestion
    if (error instanceof Error && error.message.includes('credentials not configured')) {
      res.status(503).json({
        message: 'Twitch API integration is not configured. Please set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET environment variables.',
        fallback: 'You can still browse existing games in the database.'
      });
    } else {
      res.status(500).json({ message: 'Failed to add Twitch game to database' });
    }
  }
});

// Add a user-created custom game (not on Twitch)
router.post('/games/custom', async (req: express.Request, res: express.Response) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Game name is required' });
    }

    const trimmedName = name.trim();

    const existingGame = await storage.getGameByName(trimmedName);
    if (existingGame) {
      return res.json(existingGame);
    }

    const newGame: InsertGame = {
      name: trimmedName,
      imageUrl: '/favicon.png',
      isUserAdded: true,
    };

    const createdGame = await storage.createGame(newGame);
    res.status(201).json(createdGame);
  } catch (error: any) {
    console.error('Error creating custom game:', error);
    if (error.code === '23505') {
      const existingGame = await storage.getGameByName(req.body.name?.trim());
      if (existingGame) {
        return res.json(existingGame);
      }
    }
    res.status(500).json({ message: 'Failed to create custom game' });
  }
});

// Get game by slug from local database
router.get('/games/slug/:slug', async (req: express.Request, res: express.Response) => {
  try {
    const slug = req.params.slug;

    if (!slug) {
      console.error('ERROR: No slug provided');
      return res.status(400).json({ message: 'Game slug is required' });
    }

    console.error(`\n=== GAME SLUG SEARCH START: ${slug} ===`);
    console.log(`Looking for game with slug: ${slug}`);

    // First try to get game by exact name match (treating slug as name)
    let game = await storage.getGameByName(slug);
    console.log(`Direct name search result:`, game ? game.name : 'not found');

    // If not found, try to get game by a name that would generate this slug
    if (!game) {
      // Convert slug back to potential game name (replace hyphens with spaces, title case, etc.)
      const potentialNames = [
        slug.replace(/-/g, ' '), // "call-of-duty" -> "call of duty"
        slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // "call-of-duty" -> "Call Of Duty"
        slug.replace(/-/g, ' ').toLowerCase(), // "call-of-duty" -> "call of duty"
        slug.replace(/-/g, ': '), // "call-of-duty-warzone" -> "call: of: duty: warzone"
        slug.replace(/-/g, ': ').replace(/\b\w/g, l => l.toUpperCase()), // "Call: Of: Duty: Warzone"
        slug, // exact slug match
      ];

      console.log(`Trying potential names:`, potentialNames);

      // Try each potential name
      for (const name of potentialNames) {
        game = await storage.getGameByName(name);
        if (game) {
          console.log(`Found game with name "${name}":`, game.name);
          break;
        }
      }
    }

    // If still not found, try searching all games for a partial match
    if (!game) {
      console.log(`Searching all games for partial matches...`);
      const allGames = await storage.getAllGames();
      const searchTerm = slug.replace(/-/g, ' ').toLowerCase();

      console.log(`Searching ${allGames.length} games for term: "${searchTerm}"`);

      game = allGames.find(g => {
        const gameName = g.name.toLowerCase();
        const gameSlug = gameName.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
        const gameSlugNoSpaces = gameName.replace(/[^a-z0-9]/g, '');

        return gameName.includes(searchTerm) ||
               gameSlug === slug.toLowerCase() ||
               gameSlugNoSpaces === slug.toLowerCase() ||
               slug.toLowerCase().includes(gameName.replace(/[^a-z0-9]/g, ''));
      });

      if (game) {
        console.log(`Found partial match:`, game.name);
      } else {
        console.log(`No partial matches found`);
      }
    }

    // If still not found in local database, try to find it on Twitch and add it
    if (!game) {
      try {
        // Convert slug to search terms for Twitch
        const searchTerms = [
          slug.replace(/-/g, ' '),
          slug.replace(/-/g, ': ').replace(/\b\w/g, l => l.toUpperCase()),
          slug.replace(/([a-z])([A-Z])/g, '$1 $2'), // camelCase to words
          slug
        ];

        console.log(`Searching Twitch for game slug: ${slug}, terms:`, searchTerms);

        let twitchGame = null;

        // Try searching Twitch with different search terms
        for (const searchTerm of searchTerms) {
          console.log(`Searching Twitch with term: "${searchTerm}"`);
          const searchResults = await twitchApi.searchGames(searchTerm);
          console.log(`Found ${searchResults.length} results for "${searchTerm}":`, searchResults.map(g => g.name));

          // Look for exact matches or close matches
          twitchGame = searchResults.find(g => {
            const gameSlug = g.name
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, '')
              .replace(/\s+/g, '-')
              .replace(/^-+|-+$/g, '');
            const gameSlugNoSpaces = g.name.toLowerCase().replace(/[^a-z0-9]/g, '');

            console.log(`Comparing "${slug}" with game "${g.name}" (slug: "${gameSlug}", nospaces: "${gameSlugNoSpaces}")`);

            return gameSlug === slug.toLowerCase() ||
                   gameSlugNoSpaces === slug.toLowerCase() ||
                   g.name.toLowerCase().replace(/[^a-z0-9]/g, '') === slug.toLowerCase();
          });

          if (twitchGame) break;
        }

        // If found on Twitch, add it to our database (if it doesn't already exist)
        if (twitchGame) {
          // Check if the game already exists by name before creating
          const existingGame = await storage.getGameByName(twitchGame.name);
          if (existingGame) {
            game = existingGame;
            console.log(`Found existing game: ${twitchGame.name}`);
          } else {
            try {
              const newGame: InsertGame = {
                name: twitchGame.name,
                imageUrl: twitchGame.box_art_url?.replace('{width}', '600').replace('{height}', '800'),
              };

              game = await storage.createGame(newGame);
              console.log(`Auto-added game from Twitch: ${twitchGame.name}`);
            } catch (createError: any) {
              if (createError.code === '23505') {
                // Duplicate key error - game was created by another request
                game = await storage.getGameByName(twitchGame.name);
                console.log(`Game already exists, fetched: ${twitchGame.name}`);
              } else {
                throw createError;
              }
            }
          }
        }
      } catch (twitchError) {
        console.error('Error searching Twitch for game:', twitchError);
        // Continue to return 404 if Twitch search fails
      }
    }

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    res.json(game);
  } catch (error) {
    console.error('Error fetching game by slug:', error);
    res.status(500).json({ message: 'Failed to fetch game by slug' });
  }
});

export default router;