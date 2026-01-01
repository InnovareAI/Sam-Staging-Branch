import { pool } from '@/lib/db';
import { cookies } from 'next/headers'

/**
 * Utility to clean corrupted cookie values on server-side
 * Fixes cookies with "base64-" prefix that break Supabase auth
 */
function cleanCookieValue(value: string): string {
  if (!value) return value;
  
  // If value starts with "base64-", it's corrupted - remove prefix and decode
  if (value.startsWith('base64-')) {
    try {
      const base64Value = value.substring(7);
      const decoded = Buffer.from(base64Value, 'base64').toString('utf-8');
      console.log('🔧 Fixed corrupted server-side cookie (decoded base64)');
      return decoded;
    } catch (e) {
      console.log('🔧 Fixed corrupted server-side cookie (removed prefix)');
      return value.substring(7);
    }
  }
  
  return value;
}

/**
 * Creates a Supabase Route Handler Client with automatic cookie cleaning
 * Use this instead of createRouteHandlerClient directly to handle corrupted cookies
 * 
 * @example
 * ```ts
 * import { createCleanRouteHandlerClient } from '@/lib/supabase-server'
 * 
 * export async function GET(request: NextRequest) {
 *   const supabase = await createCleanRouteHandlerClient()
 *   const { data: { session } } = await supabase.auth.getSession()
 *   // ...
 * }
 * ```
 */
// Alias for backward compatibility
export const createClient = createCleanRouteHandlerClient;

export async function createCleanRouteHandlerClient() {
  const cookieStore = await cookies()
  
  // Clean corrupted cookies before passing to Supabase
  const cleanedCookies = () => {
    const originalCookies = cookieStore.getAll()
    return {
      getAll: () => originalCookies.map(cookie => ({
        ...cookie,
        value: cleanCookieValue(cookie.value)
      })),
      get: (name: string) => {
        const cookie = cookieStore.get(name)
        if (!cookie) return undefined
        return {
          ...cookie,
          value: cleanCookieValue(cookie.value)
        }
      },
      set: cookieStore.set,
      delete: cookieStore.delete
    }
  }
  
  return createRouteHandlerClient({ cookies: cleanedCookies })
}
