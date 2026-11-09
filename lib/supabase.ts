import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side client with the service-role key. It bypasses row-level security, so it must never be
 * imported from client components (`server-only` enforces this at build time). RLS is enabled with
 * no policies on every table, so the public anon key can read nothing.
 *
 * Created lazily: `next build` imports route modules to collect page data, and the build must not
 * depend on runtime secrets. A missing variable fails loudly on first use instead. The key is never logged.
 */
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase server environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)");
  }
  client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return client;
}

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
