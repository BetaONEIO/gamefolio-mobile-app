import { createClient } from '@supabase/supabase-js';
import { Env } from '@/constants/Env';

export const supabase = createClient(
  Env.SUPABASE_URL,
  Env.SUPABASE_ANON_KEY
);

export const supabaseAdmin = createClient(
  Env.SUPABASE_URL,
  Env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
