import { protectedProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import { TRPCError } from '@trpc/server';

export default protectedProcedure
  .query(async ({ ctx }) => {
    const userId = ctx.userId;

    const { data: referrals, error } = await supabaseAdmin
      .from('referrals')
      .select('xp_awarded')
      .eq('referrer_id', userId);

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch referral stats',
      });
    }

    const referralCount = referrals?.length ?? 0;
    const totalXpEarned = referrals?.reduce((sum, r) => sum + (r.xp_awarded ?? 0), 0) ?? 0;
    const referralLink = `https://gamefolio.app/ref/${userId}`;

    return {
      referralCount,
      totalXpEarned,
      referralLink,
      referralCode: String(userId),
    };
  });
