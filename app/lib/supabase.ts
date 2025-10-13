import { createBrowserClient as createBrowserSupabaseClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://latxadqrvrrrcvkktrog.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTk5ODYsImV4cCI6MjA2ODI3NTk4Nn0.3WkAgXpk_MyQioVf_SED9O_ArjcT9nH0uy9we2okftE';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  return { supabaseUrl, supabaseAnonKey, supabaseServiceKey };
}

// Browser client - use @supabase/ssr createBrowserClient
export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  // Only use cookie-based auth in browser
  if (typeof window !== 'undefined') {
    return createBrowserSupabaseClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return document.cookie.split(';').map(cookie => {
              const [name, ...v] = cookie.trim().split('=');
              let value = v.join('=');

              // FIX: Remove "base64-" prefix and decode if present (corrupted cookie bug)
              if (value && value.startsWith('base64-')) {
                console.warn(`Fixing corrupted cookie: ${name} - decoding base64`);
                try {
                  // Strip "base64-" prefix and decode the base64 string
                  const base64Value = value.substring(7);
                  value = atob(base64Value); // Decode base64 to original JSON string
                } catch (e) {
                  console.error(`Failed to decode corrupted cookie ${name}:`, e);
                  // If decoding fails, just remove the prefix
                  value = value.substring(7);
                }
              }

              return { name, value };
            });
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              // FIX: Ensure we never write "base64-" prefix
              let cleanValue = value;
              if (cleanValue && cleanValue.startsWith('base64-')) {
                console.warn(`Preventing corrupted cookie write: ${name}`);
                cleanValue = cleanValue.substring(7);
              }

              let cookie = `${name}=${cleanValue}`;
              if (options?.path) cookie += `; path=${options.path}`;
              if (options?.maxAge) cookie += `; max-age=${options.maxAge}`;
              if (options?.domain) cookie += `; domain=${options.domain}`;
              if (options?.sameSite) cookie += `; samesite=${options.sameSite}`;
              if (options?.secure) cookie += '; secure';
              document.cookie = cookie;
            });
          }
        }
      }
    );
  }

  // Server-side: return basic client (no auth needed for server components importing this)
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}

// Admin client with service role key (server-side only)
export function supabaseAdmin() {
  const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();

  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Server-side route helper - export for routes that need it
export { createServerClient } from '@supabase/ssr';

// Legacy exports for backward compatibility
let _supabase: any = null;
export const supabase = new Proxy({}, {
  get(target, prop) {
    if (!_supabase) {
      _supabase = createClient();
    }
    return _supabase[prop];
  }
});