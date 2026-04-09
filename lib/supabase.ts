import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  // We only throw if we are on the server and missing keys.
  // This prevents build-time / bundling crashes in some environments.
  if (typeof window === 'undefined') {
    throw new Error("Missing Supabase Server Environment Variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)");
  }
}

// User's .env.local uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
export const supabaseAdmin = createClient(
  supabaseUrl || '',
  supabaseServiceKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
