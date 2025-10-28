import { createBrowserClient as createBrowserSupabaseClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://latxadqrvrrrcvkktrog.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTk5ODYsImV4cCI6MjA2ODI3NTk4Nn0.3WkAgXpk_MyQioVf_SED9O_ArjcT9nH0uy9we2okftE';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  return { supabaseUrl, supabaseAnonKey, supabaseServiceKey };
}

// Utility to clean cookie values - ONLY clean if truly corrupted
// Valid cookies with base64- prefix should be kept as-is
function cleanCookieValue(value: string): string {
  if (!value) return value;

  // IMPORTANT: base64- prefix is NOT always corruption
  // Only "clean" if the value is malformed and can't be used
  // In most cases, we should return the value as-is
  return value;
}

// Browser client - use @supabase/ssr createBrowserClient
export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  // Only use cookie-based auth in browser
  if (typeof window !== 'undefined') {
    // Clean corrupted localStorage (but leave cookies alone - they work despite warnings)
    try {
      const storageKeys = Object.keys(localStorage);
      storageKeys.forEach(key => {
        if (key.includes('supabase') || key.includes('sb-')) {
          const value = localStorage.getItem(key);
          if (value && value.startsWith('base64-')) {
            console.log(`🔧 Removing corrupted localStorage: ${key}`);
            localStorage.removeItem(key);
          }
        }
      });
    } catch (e) {
      console.warn('Could not clean storage:', e);
    }

    return createBrowserSupabaseClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return document.cookie.split(';').map(cookie => {
              const [name, ...v] = cookie.trim().split('=');
              const value = cleanCookieValue(v.join('='));
              return { name, value };
            });
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Write cookies as-is - don't modify the value
              // Supabase knows how to handle its own cookie format
              let cookie = `${name}=${value}`;
              if (options?.path) cookie += `; path=${options.path}`;
              if (options?.maxAge) cookie += `; max-age=${options.maxAge}`;
              if (options?.domain) cookie += `; domain=${options.domain}`;
              if (options?.sameSite) cookie += `; samesite=${options.sameSite}`;
              if (options?.secure) cookie += '; secure';
              document.cookie = cookie;
            });
          }
        },
        cookieOptions: {
          // Force cookies to be used as primary storage
          // This prevents localStorage corruption issues
          global: {
            secure: true,
            sameSite: 'lax'
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