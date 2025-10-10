import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

// Lazy initialization to avoid build-time issues
let _supabase: any = null;
let _supabaseAdmin: any = null;

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://latxadqrvrrrcvkktrog.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTk5ODYsImV4cCI6MjA2ODI3NTk4Nn0.3WkAgXpk_MyQioVf_SED9O_ArjcT9nH0uy9we2okftE';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  return { supabaseUrl, supabaseAnonKey, supabaseServiceKey };
}

// Client-side Supabase client with COOKIES (not localStorage) - matches server-side SSR
export const supabase = new Proxy({}, {
  get(target, prop) {
    if (!_supabase) {
      const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

      // CRITICAL: Check if running in browser before using document.cookie
      if (typeof window === 'undefined') {
        // Server-side: use basic client (no auth persistence needed server-side)
        _supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
      } else {
        // Browser: Use createBrowserClient with cookie storage
        _supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
          cookies: {
            getAll() {
              if (typeof document === 'undefined') return [];
              return document.cookie.split(';').map(c => {
                const [name, ...rest] = c.trim().split('=');
                return { name, value: rest.join('=') };
              }).filter(c => c.name);
            },
            setAll(cookies) {
              if (typeof document === 'undefined') return;
              cookies.forEach(({ name, value, options }) => {
                let cookie = `${name}=${value}`;
                if (options?.maxAge) cookie += `; max-age=${options.maxAge}`;
                if (options?.path) cookie += `; path=${options.path}`;
                if (options?.domain) cookie += `; domain=${options.domain}`;
                if (options?.sameSite) cookie += `; samesite=${options.sameSite}`;
                if (options?.secure) cookie += '; secure';
                document.cookie = cookie;
              });
            }
          }
        });
      }
    }
    return _supabase[prop];
  }
});

// Server-side Supabase client with service role key (for admin operations)
export const supabaseAdmin = () => {
  if (!_supabaseAdmin) {
    const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
    }
    _supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return _supabaseAdmin;
};

// Export function for server routes compatibility
export function createServerClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}

// Also export the proxy as createClient for backward compatibility
export { supabase as createClient };