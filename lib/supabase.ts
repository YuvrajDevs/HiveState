import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  // We only throw if we are on the server and missing keys.
  // This prevents build-time / bundling crashes in some environments.
  if (typeof window === 'undefined') {
    console.error("⛔ Supabase: Missing Server Environment Variables!");
    throw new Error("Missing Supabase Server Environment Variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)");
  }
} else {
  // Production Debugging Helper (Server Side Only)
  if (typeof window === 'undefined') {
    console.log(`📡 Supabase: Initializing client...`);
    console.log(`   URL: ${supabaseUrl.substring(0, 15)}...`);
    console.log(`   KEY: ${supabaseServiceKey.substring(0, 10)}...[MASKED]...${supabaseServiceKey.substring(supabaseServiceKey.length - 5)}`);
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
