/**
 * Enriches prospect names from LinkedIn via Unipile
 * Used when SAM AI doesn't provide names in the prospect data
 */

interface EnrichNameResult {
  firstName: string;
  lastName: string;
  enriched: boolean;
}

export async function enrichProspectName(
  linkedinUrl: string | null,
  currentFirstName: string,
  currentLastName: string,
  unipileAccountId: string | null
): Promise<EnrichNameResult> {
  // If we already have valid names, don't enrich
  if (currentFirstName && currentLastName) {
    return {
      firstName: currentFirstName,
      lastName: currentLastName,
      enriched: false
    };
  }

  // If no LinkedIn URL or Unipile account, can't enrich
  if (!linkedinUrl || !unipileAccountId) {
    console.warn('⚠️ Cannot enrich name: missing LinkedIn URL or Unipile account');
    return {
      firstName: currentFirstName || '',
      lastName: currentLastName || '',
      enriched: false
    };
  }

  try {
    // Extract LinkedIn username from URL
    const urlPart = linkedinUrl.split('/in/')[1]?.replace('/', '');
    const linkedinUsername = urlPart?.split('?')[0]; // Strip query params

    if (!linkedinUsername) {
      console.warn('⚠️ Invalid LinkedIn URL:', linkedinUrl);
      return {
        firstName: currentFirstName || '',
        lastName: currentLastName || '',
        enriched: false
      };
    }

    console.log(`🔍 Enriching name for LinkedIn user: ${linkedinUsername}`);

    // Fetch from Unipile
    const profileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/${linkedinUsername}?account_id=${unipileAccountId}`;
    const response = await fetch(profileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY!,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`⚠️ Unipile API failed (${response.status}): ${linkedinUsername}`);
      return {
        firstName: currentFirstName || '',
        lastName: currentLastName || '',
        enriched: false
      };
    }

    const profileData = await response.json();
    const displayName = profileData.display_name || '';
    const nameParts = displayName.trim().split(/\s+/);

    let firstName = currentFirstName || '';
    let lastName = currentLastName || '';

    if (nameParts.length >= 2) {
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(' ');
    } else if (nameParts.length === 1) {
      firstName = nameParts[0];
    }

    console.log(`✅ Enriched name: ${firstName} ${lastName}`);

    return {
      firstName,
      lastName,
      enriched: true
    };
  } catch (error) {
    console.error(`❌ Name enrichment error for ${linkedinUrl}:`, error);
    return {
      firstName: currentFirstName || '',
      lastName: currentLastName || '',
      enriched: false
    };
  }
}
