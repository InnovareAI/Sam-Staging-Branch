/**
 * Validates prospect names to prevent LinkedIn username extraction bugs
 *
 * CRITICAL: Ensures names are real human names, not LinkedIn profile slugs
 */

export interface NameValidationResult {
  valid: boolean;
  firstName: string;
  lastName: string;
  warnings: string[];
  errors: string[];
}

/**
 * Validates and cleans prospect names
 *
 * @param firstName - The first name to validate
 * @param lastName - The last name to validate
 * @param linkedinUrl - Optional LinkedIn URL for context
 * @returns Validation result with cleaned names and any warnings/errors
 */
export function validateProspectNames(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  linkedinUrl?: string | null
): NameValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  let cleanFirstName = (firstName || '').trim();
  let cleanLastName = (lastName || '').trim();

  // CRITICAL CHECK 1: Reject empty names
  if (!cleanFirstName || cleanFirstName === '') {
    errors.push('First name is required and cannot be empty');
  }

  if (!cleanLastName || cleanLastName === '') {
    errors.push('Last name is required and cannot be empty');
  }

  // CRITICAL CHECK 2: Detect LinkedIn usernames
  // LinkedIn usernames are typically lowercase, no spaces, may have hyphens
  const looksLikeUsername = /^[a-z0-9-]+$/.test(cleanFirstName) || /^[a-z0-9-]+$/.test(cleanLastName);

  if (looksLikeUsername) {
    warnings.push('Name looks like a LinkedIn username (all lowercase with hyphens)');

    // If we have the LinkedIn URL, check if name matches the profile slug
    if (linkedinUrl) {
      const match = linkedinUrl.match(/\/in\/([^\/\?]+)/);
      if (match) {
        const profileSlug = match[1];
        if (cleanFirstName === profileSlug || cleanLastName === profileSlug ||
            cleanFirstName === profileSlug.split('-')[0]) {
          errors.push(`Name "${cleanFirstName} ${cleanLastName}" appears to be extracted from LinkedIn URL (${profileSlug})`);
        }
      }
    }
  }

  // CRITICAL CHECK 3: Detect placeholder/fallback names
  const placeholderNames = ['unknown', 'user', 'test', 'testuser', 'prospect'];
  const isPlaceholder = placeholderNames.includes(cleanFirstName.toLowerCase()) ||
                       placeholderNames.includes(cleanLastName.toLowerCase());

  if (isPlaceholder) {
    warnings.push(`Name contains placeholder value: "${cleanFirstName} ${cleanLastName}"`);
  }

  // CRITICAL CHECK 4: Names should start with capital letter
  const startsWithCapital = /^[A-Z]/.test(cleanFirstName) && /^[A-Z]/.test(cleanLastName);

  if (!startsWithCapital && !looksLikeUsername) {
    warnings.push('Name should start with capital letter');
  }

  // CRITICAL CHECK 5: Names should contain only letters (and some special chars)
  const validNamePattern = /^[A-Za-zÀ-ÿ\s'-]+$/;

  if (!validNamePattern.test(cleanFirstName)) {
    warnings.push(`First name contains unusual characters: "${cleanFirstName}"`);
  }

  if (!validNamePattern.test(cleanLastName)) {
    warnings.push(`Last name contains unusual characters: "${cleanLastName}"`);
  }

  const valid = errors.length === 0;

  return {
    valid,
    firstName: cleanFirstName,
    lastName: cleanLastName,
    warnings,
    errors
  };
}

/**
 * Strict validation - throws error if names are invalid
 * Use this when creating campaign prospects
 */
export function assertValidProspectNames(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  linkedinUrl?: string | null
): void {
  const result = validateProspectNames(firstName, lastName, linkedinUrl);

  if (!result.valid) {
    throw new Error(`Invalid prospect names: ${result.errors.join(', ')}`);
  }

  // Log warnings even if valid
  if (result.warnings.length > 0) {
    console.warn('⚠️ Name validation warnings:', {
      name: `${firstName} ${lastName}`,
      warnings: result.warnings
    });
  }
}

/**
 * Detects if a name was likely extracted from a LinkedIn URL
 */
export function isLinkedInUsername(name: string): boolean {
  return /^[a-z0-9-]+$/.test(name.trim());
}
