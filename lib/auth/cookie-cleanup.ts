/**
 * Cookie Cleanup Utility
 *
 * Automatically detects and clears corrupted authentication cookies
 * to ensure seamless user experience without manual intervention.
 *
 * Handles cookies from previous auth implementations that are incompatible
 * with the current Supabase SSR setup.
 */

/**
 * List of all Supabase auth cookie names to check and potentially clear
 */
const SUPABASE_COOKIE_NAMES = [
  'sb-latxadqrvrrrcvkktrog-auth-token',
  'sb-latxadqrvrrrcvkktrog-auth-token-code-verifier',
  'sb-latxadqrvrrrcvkktrog-auth-token.0',
  'sb-latxadqrvrrrcvkktrog-auth-token.1',
];

/**
 * Patterns that indicate a cookie is corrupted or in an invalid format
 */
const CORRUPTED_COOKIE_PATTERNS = [
  /^base64-\{/,           // Old base64 encoding format
  /^base64-eyJ/,          // Base64 with "eyJ" prefix (double encoding)
  /^undefined$/,          // Literal "undefined" string
  /^null$/,               // Literal "null" string
  /^\[object Object\]$/,  // Stringified object
];

/**
 * Check if a cookie value appears to be corrupted
 */
function isCorruptedCookie(value: string): boolean {
  if (!value || value.trim() === '') {
    return false; // Empty cookies are fine (will be recreated)
  }

  return CORRUPTED_COOKIE_PATTERNS.some(pattern => pattern.test(value));
}

/**
 * CLIENT-SIDE: Detect and clear corrupted cookies in the browser
 * Returns true if corrupted cookies were found and cleared
 */
export function detectAndClearCorruptedCookies(): boolean {
  if (typeof window === 'undefined') {
    return false; // Only run in browser
  }

  let foundCorrupted = false;
  const cookies = document.cookie.split(';');

  for (const cookie of cookies) {
    const [nameWithSpaces, value] = cookie.split('=');
    const name = nameWithSpaces?.trim();

    if (!name || !value) continue;

    // Check if this is a Supabase auth cookie
    const isSupabaseCookie = SUPABASE_COOKIE_NAMES.some(cookieName =>
      name.startsWith('sb-') || name === cookieName
    );

    if (isSupabaseCookie && isCorruptedCookie(value)) {
      console.warn(`[Cookie Cleanup] Detected corrupted cookie: ${name}`);
      foundCorrupted = true;

      // Clear the corrupted cookie
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
  }

  if (foundCorrupted) {
    console.log('[Cookie Cleanup] Cleared corrupted cookies - clean auth state restored');
  }

  return foundCorrupted;
}

/**
 * SERVER-SIDE: Check if request contains corrupted cookies
 * Returns array of corrupted cookie names
 */
export function detectCorruptedCookiesInRequest(cookies: Array<{ name: string; value: string }>): string[] {
  const corruptedCookies: string[] = [];

  for (const cookie of cookies) {
    const isSupabaseCookie = SUPABASE_COOKIE_NAMES.some(cookieName =>
      cookie.name.startsWith('sb-') || cookie.name === cookieName
    );

    if (isSupabaseCookie && isCorruptedCookie(cookie.value)) {
      console.warn(`[Cookie Cleanup] Server detected corrupted cookie: ${cookie.name}`);
      corruptedCookies.push(cookie.name);
    }
  }

  return corruptedCookies;
}

/**
 * SERVER-SIDE: Clear corrupted cookies in response
 * Used in middleware and API routes
 */
export function clearCorruptedCookiesInResponse(
  response: Response,
  corruptedCookieNames: string[]
): void {
  for (const cookieName of corruptedCookieNames) {
    // Set cookie to expire immediately
    response.headers.append(
      'Set-Cookie',
      `${cookieName}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`
    );
  }

  if (corruptedCookieNames.length > 0) {
    console.log(`[Cookie Cleanup] Cleared ${corruptedCookieNames.length} corrupted cookies in response`);
  }
}

/**
 * SERVER-SIDE: Clear all Supabase auth cookies (nuclear option)
 * Used when cookie parsing completely fails
 */
export function clearAllAuthCookies(response: Response): void {
  console.warn('[Cookie Cleanup] Clearing ALL auth cookies due to parsing failure');

  for (const cookieName of SUPABASE_COOKIE_NAMES) {
    response.headers.append(
      'Set-Cookie',
      `${cookieName}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`
    );
  }

  // Also clear any sb-* cookies we might have missed
  response.headers.append(
    'Set-Cookie',
    'sb-latxadqrvrrrcvkktrog-auth-token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax'
  );
}
