import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export default publicProcedure
  .input(
    z.object({
      username: z.string(),
    })
  )
  .query(async ({ input }) => {
    console.log('[tRPC] Fetching favorite games for user:', input.username);
    
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', input.username)
      .single();

    if (userError || !user) {
      console.error('[tRPC] Error fetching user:', userError);
      return [];
    }

    const { data: favorites, error: favError } = await supabaseAdmin
      .from('user_favorite_games')
      .select(`
        game:games(id, name, image_url, twitch_id)
      `)
      .eq('user_id', user.id);

    if (favError) {
      console.error('[tRPC] Error fetching favorites:', favError);
      return [];
    }

    console.log('[tRPC] Found favorite games:', favorites?.length || 0);

    const formattedGames = favorites?.map((fav: any) => ({
      id: fav.game.id,
      name: fav.game.name,
      imageUrl: fav.game.image_url,
      twitchId: fav.game.twitch_id,
    })).filter((g: any) => g.id) || [];

    return formattedGames;
  });
