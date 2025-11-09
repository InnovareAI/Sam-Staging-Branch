import { createBrowserClient as createBrowserSupabaseClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://latxadqrvrrrcvkktrog.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTk5ODYsImV4cCI6MjA2ODI3NTk4Nn0.3WkAgXpk_MyQioVf_SED9O_ArjcT9nH0uy9we2okftE';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  return { supabaseUrl, supabaseAnonKey, supabaseServiceKey };
}

// Singleton browser client to prevent multiple GoTrueClient instances
let browserClient: ReturnType<typeof createBrowserSupabaseClient> | null = null;

// Browser client - use @supabase/ssr createBrowserClient with minimal configuration
export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  // Only use cookie-based auth in browser
  if (typeof window !== 'undefined') {
    // Return existing singleton instance if available
    if (browserClient) {
      return browserClient;
    }

    // Helper to check if a cookie value is corrupted
    function isCookieCorrupted(value: string): boolean {
      if (!value) return false;
      // Detect patterns of corrupted cookies
      return value.includes('base64-{') ||
             value.includes('base64-eyJ') ||
             value === 'undefined' ||
             value === 'null' ||
             value.includes('[object Object]');
    }

    // Create new singleton instance with CUSTOM cookie handlers
    // This filters out corrupted cookies BEFORE Supabase tries to parse them
    browserClient = createBrowserSupabaseClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            const cookies = document.cookie.split(';').map(cookie => {
              const [name, ...v] = cookie.trim().split('=');
              const value = v.join('=');
              return { name, value };
            });

            // Filter out corrupted Supabase cookies
            return cookies.filter(cookie => {
              if (cookie.name.startsWith('sb-') && isCookieCorrupted(cookie.value)) {
                console.warn(`[Browser Client] Removing corrupted cookie: ${cookie.name}`);
                // Delete the corrupted cookie
                document.cookie = `${cookie.name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                return false; // Exclude from list
              }
              return true; // Keep valid cookies
            });
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
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
          // CRITICAL: These settings must match server-side configuration
          global: {
            secure: true, // Always true - HTTPS required for Supabase auth
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7 // 7 days in seconds
          }
        },
        auth: {
          // CRITICAL: Session persistence configuration
          persistSession: true,        // Enable 7-day session persistence
          autoRefreshToken: true,       // Auto-refresh before token expires
          detectSessionInUrl: true,     // Required for magic links & OAuth
          storageKey: 'sb-auth-token',  // Cookie storage key
          flowType: 'pkce'             // PKCE flow for better security
        }
      }
    );

    return browserClient;
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

// Server-side route helper - properly configured createServerClient
export { createServerClient } from '@supabase/ssr';

/**
 * Create a properly configured Supabase server client for API routes
 * This ensures consistent cookie handling across all server-side code
 *
 * @example
 * import { createServerSupabaseClient } from '@/app/lib/supabase';
 *
 * export async function GET() {
 *   const supabase = await createServerSupabaseClient();
 *   const { data, error } = await supabase.auth.getUser();
 * }
 */
export async function createServerSupabaseClient() {
  const { cookies } = await import('next/headers');
  const { createServerClient } = await import('@supabase/ssr');

  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  // Note: Cookie cleanup is handled in middleware and route-auth helpers
  // This function creates a clean client for API routes
  // If you're using requireAuth(), cookie cleanup is automatic

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Cookie setting can fail in middleware/API route context
            // This is expected and safe to ignore
          }
        }
      },
      cookieOptions: {
        // CRITICAL: Must match browser client configuration
        global: {
          secure: true, // Always true for HTTPS
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7 // 7 days in seconds
        }
      }
    }
  );
}

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