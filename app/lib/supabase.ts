import { createBrowserClient as createBrowserSupabaseClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://latxadqrvrrrcvkktrog.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTk5ODYsImV4cCI6MjA2ODI3NTk4Nn0.3WkAgXpk_MyQioVf_SED9O_ArjcT9nH0uy9we2okftE';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  return { supabaseUrl, supabaseAnonKey, supabaseServiceKey };
}

// Utility to clean cookie values - removes base64- prefix and decodes if needed
function cleanCookieValue(value: string): string {
  if (!value) return value;

  // If value starts with "base64-", it's corrupted
  if (value.startsWith('base64-')) {
    try {
      // Remove prefix and try to decode
      const base64Value = value.substring(7);
      const decoded = atob(base64Value);
      console.log('🔧 Fixed corrupted cookie (decoded base64)');
      return decoded;
    } catch (e) {
      // If decode fails, just remove prefix
      console.log('🔧 Fixed corrupted cookie (removed prefix)');
      return value.substring(7);
    }
  }

  return value;
}

// Browser client - use @supabase/ssr createBrowserClient
export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  // Only use cookie-based auth in browser
  if (typeof window !== 'undefined') {
    // CRITICAL: Clean corrupted localStorage on initialization
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
      console.warn('Could not clean localStorage:', e);
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
              // NEVER write base64- prefix - clean before writing
              const cleanValue = value && value.startsWith('base64-')
                ? value.substring(7)
                : value;

              let cookie = `${name}=${cleanValue}`;
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