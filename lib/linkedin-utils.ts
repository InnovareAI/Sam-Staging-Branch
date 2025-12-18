/**
 * LinkedIn Utility Functions
 *
 * Centralized utilities for handling LinkedIn URLs, slugs, and provider IDs.
 * CRITICAL: These functions prevent "User ID does not match provider's expected format" errors.
 *
 * LinkedIn ID Formats:
 * - Provider ID: "ACoAABhJW8ABC123..." or "ACwAABhJW8ABC123..." (internal LinkedIn ID)
 * - Vanity Slug: "john-doe" (custom URL slug)
 * - Full URL: "https://www.linkedin.com/in/john-doe"
 *
 * The linkedin_user_id column should contain EITHER:
 * 1. A provider_id (ACo.../ACw...) - best, requires no resolution
 * 2. A vanity slug (john-doe) - needs resolution via Unipile API
 *
 * NEVER store full URLs in linkedin_user_id - this causes API failures.
 */

/**
 * Extract LinkedIn slug from URL or return as-is if already a slug/provider_id
 *
 * Examples:
 * - "https://www.linkedin.com/in/john-doe" → "john-doe"
 * - "https://linkedin.com/in/john-doe/" → "john-doe"
 * - "john-doe" → "john-doe" (already a slug)
 * - "ACoAABhJW8ABC123" → "ACoAABhJW8ABC123" (already a provider_id)
 * - null → null
 *
 * @param urlOrSlug - A LinkedIn URL, vanity slug, or provider_id
 * @returns The extracted slug/provider_id, or null if input was null/empty
 */
export function extractLinkedInSlug(urlOrSlug: string | null | undefined): string | null {
  if (!urlOrSlug) return null;

  const trimmed = urlOrSlug.trim();
  if (!trimmed) return null;

  // If it's already a provider_id (ACo or ACw format), return as-is
  if (trimmed.startsWith('ACo') || trimmed.startsWith('ACw')) {
    return trimmed;
  }

  // If it's already just a slug (no URL parts), return it
  if (!trimmed.includes('/') && !trimmed.includes('http')) {
    return trimmed;
  }

  // Extract slug from URL like https://www.linkedin.com/in/john-doe/
  const match = trimmed.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  return match ? match[1] : trimmed;
}

/**
 * Check if a string is a valid LinkedIn provider_id
 * Provider IDs start with "ACo" or "ACw" followed by alphanumeric characters
 *
 * @param value - The string to check
 * @returns true if it's a provider_id format
 */
export function isLinkedInProviderId(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith('ACo') || value.startsWith('ACw');
}

/**
 * Check if a string is a full LinkedIn URL
 *
 * @param value - The string to check
 * @returns true if it's a LinkedIn URL
 */
export function isLinkedInUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.includes('linkedin.com');
}

/**
 * Normalize a LinkedIn URL for comparison/deduplication
 * Removes protocol, www, trailing slashes, and query parameters
 *
 * @param url - The LinkedIn URL to normalize
 * @returns Normalized URL or null
 */
export function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    let normalized = url.toLowerCase().trim();

    // Remove protocol
    normalized = normalized.replace(/^https?:\/\//, '');

    // Remove www
    normalized = normalized.replace(/^www\./, '');

    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');

    // Remove query parameters
    normalized = normalized.split('?')[0];

    return normalized;
  } catch {
    return url;
  }
}

/**
 * Extract the best identifier for sending LinkedIn messages
 * Priority: provider_id > slug > extracted from URL
 *
 * @param prospect - Object containing linkedin_user_id and/or linkedin_url
 * @returns The best identifier to use for API calls
 */
export function getBestLinkedInIdentifier(prospect: {
  linkedin_user_id?: string | null;
  linkedin_url?: string | null;
}): string | null {
  // If we have a provider_id, use it directly
  if (prospect.linkedin_user_id && isLinkedInProviderId(prospect.linkedin_user_id)) {
    return prospect.linkedin_user_id;
  }

  // If linkedin_user_id is set but not a provider_id, extract slug from it
  if (prospect.linkedin_user_id) {
    return extractLinkedInSlug(prospect.linkedin_user_id);
  }

  // Fall back to extracting from linkedin_url
  if (prospect.linkedin_url) {
    return extractLinkedInSlug(prospect.linkedin_url);
  }

  return null;
}
