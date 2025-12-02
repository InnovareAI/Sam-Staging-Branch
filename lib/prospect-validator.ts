/**
 * Prospect Validation - Data Quality Gate
 * Prevents bad prospects from entering campaigns
 */

export interface ProspectValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  severity: 'valid' | 'warning' | 'error';
}

export interface ProspectToValidate {
  id?: string;
  contact_email?: string | null;
  contact_linkedin_url?: string | null;
  contact_name?: string | null;
  company_name?: string | null;
  contact_title?: string | null;
}

/**
 * Validate a single prospect for campaign eligibility
 */
export function validateProspect(prospect: ProspectToValidate): ProspectValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // CRITICAL: Must have at least ONE contact method
  const hasEmail = !!prospect.contact_email?.trim();
  const hasLinkedIn = !!prospect.contact_linkedin_url?.trim();

  if (!hasEmail && !hasLinkedIn) {
    errors.push('Missing both email and LinkedIn URL - no way to contact');
  }

  // Required fields
  if (!prospect.contact_name?.trim()) {
    errors.push('Missing contact name');
  }

  if (!prospect.company_name?.trim()) {
    errors.push('Missing company name');
  }

  // Warnings for incomplete data
  if (!prospect.contact_title?.trim()) {
    warnings.push('Missing contact title');
  }

  if (hasEmail && !isValidEmail(prospect.contact_email!)) {
    errors.push('Invalid email format');
  }

  if (hasLinkedIn && !isValidLinkedInUrl(prospect.contact_linkedin_url!)) {
    warnings.push('LinkedIn URL format looks suspicious');
  }

  // Determine severity
  let severity: 'valid' | 'warning' | 'error' = 'valid';
  if (errors.length > 0) {
    severity = 'error';
  } else if (warnings.length > 0) {
    severity = 'warning';
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    severity
  };
}

/**
 * Check if prospect has been previously contacted
 * @param supabase - Supabase client
 * @param linkedinUrl - LinkedIn profile URL
 * @param email - Email address
 * @returns Object with previous contact info
 */
export async function checkPreviousContact(
  supabase: any,
  linkedinUrl?: string | null,
  email?: string | null
): Promise<{
  hasPreviousContact: boolean;
  previousStatus?: string;
  previousCampaign?: string;
  reason?: string;
}> {
  try {
    // Check LinkedIn URL
    if (linkedinUrl) {
      const normalizedUrl = normalizeLinkedInUrl(linkedinUrl);

      const { data: linkedinProspects } = await supabase
        .from('campaign_prospects')
        .select('status, error_message, campaigns(campaign_name)')
        .ilike('contact_linkedin_url', `%${normalizedUrl}%`)
        .not('status', 'eq', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (linkedinProspects && linkedinProspects.length > 0) {
        const prev = linkedinProspects[0];
        return {
          hasPreviousContact: true,
          previousStatus: prev.status,
          previousCampaign: prev.campaigns?.campaign_name,
          reason: `Previously contacted on LinkedIn (status: ${prev.status})`
        };
      }
    }

    // Check email
    if (email) {
      const { data: emailProspects } = await supabase
        .from('campaign_prospects')
        .select('status, error_message, campaigns(campaign_name)')
        .eq('contact_email', email.toLowerCase().trim())
        .not('status', 'eq', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (emailProspects && emailProspects.length > 0) {
        const prev = emailProspects[0];
        return {
          hasPreviousContact: true,
          previousStatus: prev.status,
          previousCampaign: prev.campaigns?.campaign_name,
          reason: `Previously contacted via email (status: ${prev.status})`
        };
      }
    }

    return { hasPreviousContact: false };
  } catch (error) {
    console.error('Error checking previous contact:', error);
    return { hasPreviousContact: false };
  }
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate LinkedIn URL format
 * Checks for:
 * 1. Must contain linkedin.com/in/ or linkedin.com/company/
 * 2. Must NOT contain URL-encoded Unicode (fancy characters like 𝗕𝗼𝗹𝗱)
 * 3. Must use ASCII characters only in the vanity/slug
 */
function isValidLinkedInUrl(url: string): boolean {
  const trimmed = url.trim();

  // Must be a LinkedIn profile or company URL
  if (!trimmed.includes('linkedin.com/in/') && !trimmed.includes('linkedin.com/company/')) {
    return false;
  }

  // Check for URL-encoded Unicode characters (fancy fonts like 𝗕𝗼𝗹𝗱 𝗧𝗲𝘅𝘁)
  // These encode as %F0%9D%97%XX patterns (Mathematical Bold, etc.)
  const hasEncodedUnicode = /%F0%9D|%E2%80|%C2%A0|%E2%9C/i.test(trimmed);
  if (hasEncodedUnicode) {
    return false;
  }

  // Check for actual Unicode characters (non-ASCII) in the vanity
  // Extract the vanity slug from the URL
  const vanityMatch = trimmed.match(/linkedin\.com\/in\/([^\/\?#]+)/);
  if (vanityMatch) {
    const vanity = vanityMatch[1];
    // Vanity should only contain: letters, numbers, hyphens
    // LinkedIn vanities are ASCII-only
    const hasNonAscii = /[^\x00-\x7F]/.test(decodeURIComponent(vanity));
    if (hasNonAscii) {
      return false;
    }
  }

  return true;
}

/**
 * Normalize LinkedIn URL for comparison
 */
function normalizeLinkedInUrl(url: string): string {
  // Remove protocol, trailing slashes, query params
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .split('?')[0]
    .toLowerCase();
}

/**
 * Get validation summary for UI display
 */
export function getValidationSummary(result: ProspectValidationResult): string {
  if (result.isValid && result.warnings.length === 0) {
    return 'Valid';
  }
  if (result.errors.length > 0) {
    return result.errors[0]; // Show first error
  }
  if (result.warnings.length > 0) {
    return result.warnings[0]; // Show first warning
  }
  return 'Valid';
}

/**
 * Bulk validate prospects
 */
export function validateProspects(prospects: ProspectToValidate[]): {
  valid: ProspectToValidate[];
  invalid: Array<ProspectToValidate & { validation: ProspectValidationResult }>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
  };
} {
  const valid: ProspectToValidate[] = [];
  const invalid: Array<ProspectToValidate & { validation: ProspectValidationResult }> = [];

  for (const prospect of prospects) {
    const validation = validateProspect(prospect);

    if (validation.isValid) {
      valid.push(prospect);
    } else {
      invalid.push({ ...prospect, validation });
    }
  }

  return {
    valid,
    invalid,
    summary: {
      total: prospects.length,
      valid: valid.length,
      invalid: invalid.length,
      warnings: prospects.filter(p => {
        const v = validateProspect(p);
        return v.warnings.length > 0 && v.errors.length === 0;
      }).length
    }
  };
}
