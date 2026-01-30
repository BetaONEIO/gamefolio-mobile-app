import { createTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@/backend/trpc/app-router';
import { Env } from '@/constants/Env';
import superjson from 'superjson';

export const trpc = createTRPCReact<AppRouter>();

let authTokenGetter: (() => Promise<string | null>) | null = null;

export const setTRPCAuthToken = (getter: () => Promise<string | null>) => {
  authTokenGetter = getter;
};

function getTRPCUrl(): string {
  // Always use the configured backend URL for tRPC requests
  const backendUrl = Env.BACKEND_URL;
  console.log('[tRPC Client] Backend URL:', backendUrl);
  return `${backendUrl}/api/trpc`;
}

export function createTRPCClientForReact() {
  const url = getTRPCUrl();
  console.log('[tRPC Client] 🚀 Initializing tRPC Client');
  console.log('[tRPC Client] Full tRPC URL:', url);
  
  return trpc.createClient({
    links: [
      httpBatchLink({
        url,
        transformer: superjson,
        headers: async () => {
          const token = authTokenGetter ? await authTokenGetter() : null;
          const headers: Record<string, string> = {};
          
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            console.log('[tRPC Client] ✅ Including Authorization header');
          } else {
            console.log('[tRPC Client] ⚠️  No auth token available');
          }
          
          return headers;
        },
      }),
    ],
  });
}

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: getTRPCUrl(),
      transformer: superjson,
      headers: async () => {
        const token = authTokenGetter ? await authTokenGetter() : null;
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
      },
    }),
  ],
});
