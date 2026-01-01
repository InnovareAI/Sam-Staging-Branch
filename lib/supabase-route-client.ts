import { pool } from '@/lib/db';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client for API routes with proper Next.js 15 cookie handling
 * Use this in API route handlers instead of createRouteHandlerClient
 */
export async function createSupabaseRouteClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Handle middleware/server component edge cases
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Handle middleware/server component edge cases
          }
        },
      },
    }
  );
}
