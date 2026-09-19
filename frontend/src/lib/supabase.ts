import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://example.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "public-anon-key-missing";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Used by api/backend.ts to authenticate calls to the Express backend, which
// now requires a valid Supabase session on every route.
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
