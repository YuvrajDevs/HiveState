import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  // Fail loudly on the server; never log any part of the key.
  throw new Error("Missing Supabase server environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)");
}

/**
 * Server-side client with the service-role key. It bypasses row-level security, so it must never be
 * imported from client components (`server-only` enforces this at build time). RLS is enabled with
 * no policies on every table, so the public anon key can read nothing.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
