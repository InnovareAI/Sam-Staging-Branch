/**
 * Utility for resolving LinkedIn vanity URLs to provider_ids before queue insertion
 *
 * CRITICAL FIX (Dec 19): Prevent "User ID does not match format (expected ACo)" errors
 * by resolving vanity slugs to provider_ids BEFORE inserting into send_queue
 */

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

async function unipileRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${UNIPILE_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.title || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Extract LinkedIn slug from URL or return as-is if already a slug
 */
export function extractLinkedInSlug(urlOrSlug: string): string {
  if (!urlOrSlug) return '';
  // If it's already just a slug, return it
  if (!urlOrSlug.includes('/') && !urlOrSlug.includes('http')) return urlOrSlug;
  // Extract slug from URL like https://www.linkedin.com/in/john-doe/
  const match = urlOrSlug.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  return match ? match[1] : urlOrSlug;
}

/**
 * Resolve LinkedIn URL or vanity to provider_id
 *
 * If already a provider_id (starts with ACo or ACw), return as-is
 * Otherwise, extract vanity from URL and lookup via Unipile
 *
 * @param linkedinUserIdOrUrl - LinkedIn URL, vanity slug, or provider_id
 * @param unipileAccountId - Unipile account ID to use for lookup
 * @returns Provider ID (ACo... or ACw...)
 */
export async function resolveToProviderId(linkedinUserIdOrUrl: string, unipileAccountId: string): Promise<string> {
  // Already a provider_id (ACo or ACw format - both are valid LinkedIn provider IDs)
  if (linkedinUserIdOrUrl.startsWith('ACo') || linkedinUserIdOrUrl.startsWith('ACw')) {
    return linkedinUserIdOrUrl;
  }

  // Extract slug from URL before resolving
  const vanity = extractLinkedInSlug(linkedinUserIdOrUrl);

  console.log(`🔍 Resolving vanity "${vanity}" to provider_id...`);

  // Use legacy endpoint (NOT /api/v1/users/profile?identifier= which is broken for vanities with numbers)
  const profile = await unipileRequest(`/api/v1/users/${encodeURIComponent(vanity)}?account_id=${unipileAccountId}`);

  if (!profile.provider_id) {
    throw new Error(`Could not resolve provider_id for: ${vanity}`);
  }

  console.log(`✅ Resolved "${vanity}" to provider_id: ${profile.provider_id}`);
  return profile.provider_id;
}
