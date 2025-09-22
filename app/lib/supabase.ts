import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time issues
let _supabase: any = null;
let _supabaseAdmin: any = null;

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://latxadqrvrrrcvkktrog.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTk5ODYsImV4cCI6MjA2ODI3NTk4Nn0.3WkAgXpk_MyQioVf_SED9O_ArjcT9nH0uy9we2okftE';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  return { supabaseUrl, supabaseAnonKey, supabaseServiceKey };
}

// Client-side Supabase client (lazy)
export const supabase = new Proxy({}, {
  get(target, prop) {
    if (!_supabase) {
      const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
      _supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
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