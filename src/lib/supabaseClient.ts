import { createClient } from '@supabase/supabase-js';

// Populate these in a local .env file (never commit real values):
//   VITE_SUPABASE_URL=...
//   VITE_SUPABASE_ANON_KEY=...
// The anon key is safe to expose in frontend code by design — every
// sensitive operation is still enforced server-side via RLS policies
// (see supabase/migrations/0002_rls_policies.sql). Never put the
// service_role key in frontend code.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly during development rather than silently breaking auth calls.
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Create a .env file — see .env.example.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
