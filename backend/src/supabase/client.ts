import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

// Service-role client: bypasses RLS. Only used server-side for booking
// results, tracking-poller writes, and bulk-upload inserts.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
