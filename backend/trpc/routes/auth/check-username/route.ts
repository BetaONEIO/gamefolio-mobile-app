import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';

export default publicProcedure
  .input(
    z.object({
      username: z.string(),
    })
  )
  .query(async ({ input }) => {
    const { username } = input;

    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('username')
      .ilike('username', username)
      .maybeSingle();

    return { available: !existingUser };
  });
