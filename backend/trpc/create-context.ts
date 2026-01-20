import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import jwt from 'jsonwebtoken';
import { Env } from '@/constants/Env';

const JWT_SECRET = Env.JWT_SECRET;

export const createContext = async (opts: FetchCreateContextFnOptions) => {
  return {
    req: opts.req,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const authHeader = ctx.req.headers.get('authorization');
  
  if (!authHeader) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated',
    });
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
    const userId = typeof decoded.userId === 'number' ? decoded.userId : parseInt(decoded.userId);

    if (isNaN(userId)) {
      console.error('[AUTH] Invalid userId in token:', decoded.userId);
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid token payload',
      });
    }

    return next({
      ctx: {
        ...ctx,
        userId,
        accessToken: token,
      },
    });
  } catch (error) {
    console.error('[AUTH] Token verification failed:', error);
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid token',
    });
  }
});
