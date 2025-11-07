/**
 * Enriches prospect names from LinkedIn via Unipile
 * Used when SAM AI doesn't provide names in the prospect data
 */

interface EnrichNameResult {
  firstName: string;
  lastName: string;
  enriched: boolean;
}

/**
 * Normalizes a full name by removing titles, credentials, and descriptions
 * Examples:
 * - "Stephen T King CIO, Startups 7x, strategy..." → "Stephen T King"
 * - "John Doe PhD, MBA" → "John Doe"
 * - "Jane Smith, CEO at Company" → "Jane Smith"
 */
export function normalizeFullName(fullName: string): { firstName: string; lastName: string; fullName: string } {
  if (!fullName || fullName.trim() === '') {
    return { firstName: '', lastName: '', fullName: '' };
  }

  let cleanedName = fullName.trim();

  // Remove everything after first comma (usually contains titles/descriptions)
  if (cleanedName.includes(',')) {
    cleanedName = cleanedName.split(',')[0].trim();
  }

  // Common titles and credentials to remove
  const titlesAndCredentials = [
    'CEO', 'CTO', 'CFO', 'COO', 'CIO', 'CMO', 'CDO', 'CPO', 'CISO',
    'President', 'VP', 'SVP', 'EVP', 'AVP',
    'Director', 'Manager', 'Head', 'Lead', 'Principal', 'Senior', 'Junior',
    'PhD', 'Ph.D', 'MBA', 'MD', 'JD', 'MSc', 'BSc', 'MA', 'BA',
    'Founder', 'Co-Founder', 'Owner', 'Partner',
    'Engineer', 'Developer', 'Designer', 'Analyst', 'Architect', 'Consultant',
    'Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Professor'
  ];

  // Remove titles that appear as standalone words (case insensitive)
  const words = cleanedName.split(/\s+/);
  const nameWords = words.filter(word => {
    const wordClean = word.replace(/[.,;:]/g, '').trim();
    return !titlesAndCredentials.some(title =>
      wordClean.toLowerCase() === title.toLowerCase()
    );
  });

  cleanedName = nameWords.join(' ').trim();

  // Split into first and last name
  const nameParts = cleanedName.split(/\s+/).filter(part => part.length > 0);

  let firstName = '';
  let lastName = '';

  if (nameParts.length >= 2) {
    // First word is first name, rest is last name
    firstName = nameParts[0];
    lastName = nameParts.slice(1).join(' ');
  } else if (nameParts.length === 1) {
    // Only one name part
    firstName = nameParts[0];
    lastName = '';
  }

  return {
    firstName,
    lastName,
    fullName: cleanedName
  };
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

    // Unipile returns first_name and last_name directly (not display_name!)
    const firstName = profileData.first_name || currentFirstName || '';
    const lastName = profileData.last_name || currentLastName || '';

    if (!firstName && !lastName) {
      console.warn(`⚠️ No name data in Unipile profile for ${linkedinUsername}`);
      return {
        firstName: currentFirstName || '',
        lastName: currentLastName || '',
        enriched: false
      };
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
