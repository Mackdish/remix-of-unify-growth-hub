import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Supabase client that only ever uses the PUBLISHABLE key.
 *
 * - With no argument it is an anonymous client (used to sign up a new login).
 * - With an access token it acts as that signed-in user, so row level security
 *   and the admin database functions see the real caller.
 *
 * Only call this from inside server handlers.
 */

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export function createPublicSupabaseClient(accessToken?: string) {
  const url = process.env["SUPABASE_URL"] || import.meta.env.VITE_SUPABASE_URL;
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase public configuration is missing");
  }

  return createClient<Database>(url, key, {
    global: {
      fetch: createSupabaseFetch(key),
      ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
