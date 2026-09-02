import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Browser Supabase client, or `null` when the project is not configured.
 *
 * Returning null rather than throwing is deliberate and matches how the rest of
 * the pipeline handles an absent input — speciesLink skips without its API key,
 * and `resolveActiveComponents` drops a component it cannot compute. The map,
 * the ranking and the methodology panel are the product; community contribution
 * is an additional layer over them. A fork of this repo with no Supabase
 * project, or a preview deploy missing its env vars, should still render the
 * frontier analysis rather than a blank error page.
 *
 * Callers therefore check for null and hide the contribution UI entirely. There
 * is no degraded half-state where a form renders but cannot submit.
 */
const url     = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * The anon key is public by design: it ships in the browser bundle and
 * identifies the project, nothing more. Row Level Security is what actually
 * protects the data — see supabase/migrations. Never put the service_role key
 * in a NEXT_PUBLIC_ variable; it bypasses RLS entirely.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // Implicit flow keeps the whole magic-link round trip in the browser.
          // PKCE would need a server route to exchange the code, and this app
          // is otherwise a statically rendered client map with no server
          // session of its own.
          flowType: 'implicit',
          detectSessionInUrl: true,
        },
      })
    : null

export const communityEnabled = supabase !== null
