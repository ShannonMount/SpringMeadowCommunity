import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";

export function getTrustedSupabaseKey() {
  const supabaseKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseKey) {
    throw new Error("Missing Supabase trusted server configuration.");
  }

  return supabaseKey;
}

export function createServiceRoleClient() {
  const { supabaseUrl } = getSupabaseConfig();

  return createClient(supabaseUrl, getTrustedSupabaseKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
