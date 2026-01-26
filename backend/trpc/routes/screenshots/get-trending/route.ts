import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { generateSignedUrl } from "@/backend/lib/signed-urls";

export default publicProcedure
  .input(
    z.object({
      period: z.enum(['recent', '1w', '1m', 'ever']).default('recent'),
      limit: z.number().default(10),
      gameId: z.number().optional(),
    })
  )
  .query(async ({ input }) => {
    console.log('==========================================');
    console.log('[tRPC Screenshots] Fetching trending screenshots');
    console.log('[tRPC Screenshots] Input:', JSON.stringify(input, null, 2));
    console.log('[tRPC Screenshots] Period value:', input.period);
    
    const period = input.period || 'recent';
    let dateFilter: Date | null = null;
    const now = new Date();

    switch (period) {
      case 'recent':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '1w':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '1m':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'ever':
        dateFilter = null;
        break;
      default:
        dateFilter = null;
    }

    console.log('[tRPC Screenshots] Building query...');
    
    let query = supabaseAdmin
      .from('screenshots')
      .select(`
        *,
        user:users(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `);
    
    console.log('[tRPC Screenshots] Query built successfully');

    console.log('[tRPC Screenshots] Date filter:', dateFilter ? dateFilter.toISOString() : 'NO FILTER (all time)');
    console.log('[tRPC Screenshots] Game ID filter:', input.gameId || 'NONE');
    
    if (dateFilter) {
      query = query.gte('created_at', dateFilter.toISOString());
    }

    if (input.gameId) {
      query = query.eq('game_id', input.gameId);
    }

    query = query
      .order('views', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(input.limit || 10);

    console.log('[tRPC Screenshots] Executing query...');
    const { data: screenshots, error } = await query;

    console.log('[tRPC Screenshots] Query response received');
    console.log('[tRPC Screenshots] Data:', screenshots ? `Array with ${screenshots.length} items` : 'null or undefined');
    console.log('[tRPC Screenshots] Error:', error ? JSON.stringify(error) : 'none');

    if (error) {
      console.error('[tRPC Screenshots] ❌ Error fetching:', error);
      console.error('[tRPC Screenshots] Error details:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to fetch trending screenshots: ${error.message}`);
    }

    console.log('[tRPC Screenshots] ✓ Query executed successfully');
    console.log('[tRPC Screenshots] Found screenshots:', screenshots?.length || 0);
    if (screenshots && screenshots.length > 0) {
      console.log('[tRPC Screenshots] Sample IDs:', screenshots.slice(0, 3).map(s => s.id));
      console.log('[tRPC Screenshots] Views:', screenshots.map(s => ({ id: s.id, views: s.views, created_at: s.created_at })));
    }
    
    if (!screenshots || screenshots.length === 0) {
      console.log('[tRPC Screenshots] ⚠️  No screenshots found for period:', period);
      
      const { count: totalCount } = await supabaseAdmin
        .from('screenshots')
        .select('*', { count: 'exact', head: true });
      console.log('[tRPC Screenshots] Total screenshots in database:', totalCount);
      
      const { data: allScreenshots } = await supabaseAdmin
        .from('screenshots')
        .select('id, views, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      console.log('[tRPC Screenshots] Latest 5 screenshots:', allScreenshots);
      
      if (dateFilter) {
        const { count: filteredCount } = await supabaseAdmin
          .from('screenshots')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dateFilter.toISOString());
        console.log('[tRPC Screenshots] Screenshots within date range:', filteredCount);
      }
    }

    const formattedScreenshots = await Promise.all(screenshots?.map(async (screenshot: any) => {
      const { count: likesCount } = await supabaseAdmin
        .from('screenshot_likes')
        .select('*', { count: 'exact', head: true })
        .eq('screenshot_id', screenshot.id);

      const { count: commentsCount } = await supabaseAdmin
        .from('screenshot_comments')
        .select('*', { count: 'exact', head: true })
        .eq('screenshot_id', screenshot.id);

      const { count: reactionsCount } = await supabaseAdmin
        .from('screenshot_reactions')
        .select('*', { count: 'exact', head: true })
        .eq('screenshot_id', screenshot.id);

      return {
        id: screenshot.id,
        userId: screenshot.user_id,
        gameId: screenshot.game_id,
        title: screenshot.title,
        description: screenshot.description || null,
        imageUrl: await generateSignedUrl(screenshot.image_url),
        thumbnailUrl: await generateSignedUrl(screenshot.thumbnail_url),
        shareCode: screenshot.share_code,
        views: screenshot.views || 0,
        ageRestricted: screenshot.age_restricted || false,
        createdAt: screenshot.created_at,
        user: {
          id: screenshot.user.id,
          username: screenshot.user.username,
          displayName: screenshot.user.display_name,
          avatarUrl: screenshot.user.avatar_url,
        },
        game: screenshot.game ? {
          id: screenshot.game.id,
          name: screenshot.game.name,
          imageUrl: screenshot.game.image_url,
          twitchId: screenshot.game.twitch_id,
        } : null,
        _count: {
          likes: likesCount || 0,
          comments: commentsCount || 0,
          reactions: reactionsCount || 0,
        }
      };
    }) || []);

    console.log('[tRPC Screenshots] Returning', formattedScreenshots.length, 'formatted screenshots');
    console.log('==========================================');
    return formattedScreenshots;
  });
