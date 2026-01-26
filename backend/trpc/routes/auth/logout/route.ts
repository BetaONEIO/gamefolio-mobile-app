import { publicProcedure } from '../../../create-context';

export default publicProcedure
  .mutation(async ({ ctx }) => {
    const authHeader = ctx.req.headers.get('authorization');
    
    console.log('[AUTH] Logout request');

    if (authHeader) {
      console.log('[AUTH] Token invalidated on client side');
    }

    console.log('[AUTH] Logout successful');

    return {
      message: 'Logged out successfully',
    };
  });
