import { createClient } from '@supabase/supabase-js';

// Server-side Supabase for admin operations (API routes only)
const serverSupabaseUrl = process.env.SUPABASE_URL;
const serverSupabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serverSupabaseUrl || !serverSupabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server environment');
}

export const serverSupabase = createClient(serverSupabaseUrl, serverSupabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
