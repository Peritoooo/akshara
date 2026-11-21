import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/**
 * Supabase is optional at build time: a build without VITE_SUPABASE_URL runs
 * exactly like the original local-only app. With the variables present, the
 * app requires a signed-in account and syncs reading metadata.
 *
 * The anon key is public by design — row-level security in Postgres is what
 * protects user data. Never ship the service_role key here.
 */
const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

export const isSupabaseConfigured =
  /^https?:\/\//.test(url) && anonKey.length > 20;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
