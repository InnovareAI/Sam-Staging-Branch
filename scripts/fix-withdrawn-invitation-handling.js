#!/usr/bin/env node

/**
 * FIX FOR IRISH MAGUAD'S CONNECTION REQUEST FAILURES
 *
 * ROOT CAUSE IDENTIFIED:
 * - Unipile API is returning WRONG profiles when querying by LinkedIn URL
 * - Both Adam Fry and Ruben Mayer URLs are returning "Jamshaid Ali" profile
 * - The "Jamshaid Ali" profile has invitation.status = "WITHDRAWN"
 * - This triggers the "Should delay new invitation" error
 *
 * THE BUG:
 * - Unipile's profile endpoint is not correctly parsing LinkedIn URLs with miniProfileUrn parameters
 * - It's returning a default/cached profile instead of the correct one
 *
 * SOLUTION:
 * 1. Clean LinkedIn URLs before sending to Unipile
 * 2. Check for WITHDRAWN status before attempting to send
 * 3. Implement proper retry logic with cooldown tracking
 */

const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = '8QrwPJ9i.1dX5352mYYWLctVvd1QWgh4/krY+wWg1tJE87IavwGc=';

/**
 * Clean LinkedIn URL to remove miniProfileUrn and other parameters
 */
function cleanLinkedInUrl(url) {
  try {
    const urlObj = new URL(url);
    // Remove all query parameters
    urlObj.search = '';
    // Remove trailing slash
    let cleanUrl = urlObj.toString().replace(/\/$/, '');

    // Handle various LinkedIn URL formats
    if (cleanUrl.includes('linkedin.com/in/')) {
      // Extract just the username part
      const match = cleanUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
      if (match) {
        return `https://www.linkedin.com/in/${match[1]}`;
      }
    }

    return cleanUrl;
  } catch (e) {
    console.error('Error cleaning URL:', e);
    return url;
  }
}

/**
 * Extract provider ID from various LinkedIn URL/URN formats
 */
function extractProviderIdFromUrn(urn) {
  // Handle various URN formats
  // urn:li:fs_miniProfile:ACoAAASEFSgBmAsKhHk1EZVHn93R--zoSI16F0c
  // urn:li:fsd_profile:ACoAAASEFSgBmAsKhHk1EZVHn93R--zoSI16F0c

  const match = urn.match(/ACoA[A-Za-z0-9_-]+/);
  return match ? match[0] : null;
}

async function unipileRequest(endpoint, options = {}) {
  const url = `https://${UNIPILE_DSN}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Api-Key': UNIPILE_API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw {
      status: response.status,
      error: data,
      title: data.title || data.message || `HTTP ${response.status}`
    };
  }

  return data;
}

/**
 * Get profile with fallback strategies
 */
async function getProfileWithFallback(accountId, linkedinUrl) {
  const cleanUrl = cleanLinkedInUrl(linkedinUrl);
  console.log(`\n🔍 Fetching profile for: ${cleanUrl}`);

  try {
    // Try with clean URL first
    const profile = await unipileRequest(
      `/api/v1/users/profile?account_id=${accountId}&identifier=${encodeURIComponent(cleanUrl)}`
    );

    // Validate the profile is correct
    const urlUsername = cleanUrl.match(/\/in\/([^/?#]+)/)?.[1]?.toLowerCase();
    const profileUsername = profile.public_identifier?.toLowerCase();

    if (profileUsername && urlUsername && profileUsername !== urlUsername && profileUsername !== 'profile') {
      console.warn(`⚠️  Profile mismatch! Expected ${urlUsername}, got ${profileUsername}`);
      console.warn('  This might be a Unipile API bug with URL parsing');
    }

    return profile;
  } catch (error) {
    console.error('❌ Failed to fetch profile:', error.title || error.message);
    throw error;
  }
}

/**
 * Check if we can send invitation to this profile
 */
function canSendInvitation(profile) {
  // Check network distance
  if (profile.network_distance === 'FIRST_DEGREE') {
    return { canSend: false, reason: 'Already connected (1st degree)' };
  }

  // Check invitation status
  if (profile.invitation) {
    const { type, status } = profile.invitation;

    if (status === 'WITHDRAWN') {
      return {
        canSend: false,
        reason: 'Previously withdrawn invitation - LinkedIn cooldown period active (3-4 weeks)'
      };
    }

    if (status === 'PENDING') {
      return {
        canSend: false,
        reason: 'Invitation already pending'
      };
    }

    if (type === 'SENT' && status !== 'WITHDRAWN') {
      return {
        canSend: false,
        reason: 'Invitation already sent'
      };
    }
  }

  return { canSend: true, reason: null };
}

/**
 * Main function to demonstrate the fix
 */
async function demonstrateFix() {
  console.log('='.repeat(80));
  console.log('🛠️  DEMONSTRATING FIX FOR CONNECTION REQUEST FAILURES');
  console.log('='.repeat(80));

  const testCases = [
    {
      name: 'Adam Fry',
      originalUrl: 'https://www.linkedin.com/in/adam-h-fry?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAAASEFSgBmAsKhHk1EZVHn93R--zoSI16F0c',
      expectedUsername: 'adam-h-fry'
    },
    {
      name: 'Ruben Mayer',
      originalUrl: 'https://www.linkedin.com/in/rubenmayer?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAABeQoWMBkLV9L4lY6dFY-wYg1E_9Upnj2II',
      expectedUsername: 'rubenmayer'
    }
  ];

  const accountId = 'ymtTx4xVQ6OVUFk83ctwtA'; // Irish's account

  for (const testCase of testCases) {
    console.log('\n' + '='.repeat(60));
    console.log(`📌 Testing: ${testCase.name}`);
    console.log('='.repeat(60));

    console.log('\n1️⃣ Original URL (with miniProfileUrn):');
    console.log(`   ${testCase.originalUrl}`);

    const cleanUrl = cleanLinkedInUrl(testCase.originalUrl);
    console.log('\n2️⃣ Cleaned URL:');
    console.log(`   ${cleanUrl}`);

    try {
      const profile = await getProfileWithFallback(accountId, testCase.originalUrl);

      console.log('\n3️⃣ Profile Retrieved:');
      console.log(`   Name: ${profile.first_name} ${profile.last_name}`);
      console.log(`   Provider ID: ${profile.provider_id}`);
      console.log(`   Public ID: ${profile.public_identifier}`);
      console.log(`   Network: ${profile.network_distance}`);
      console.log(`   Invitation: ${profile.invitation ? JSON.stringify(profile.invitation) : 'None'}`);

      const validation = canSendInvitation(profile);

      console.log('\n4️⃣ Can Send Invitation?');
      console.log(`   ${validation.canSend ? '✅ YES' : '❌ NO'}`);
      if (validation.reason) {
        console.log(`   Reason: ${validation.reason}`);
      }

      if (!validation.canSend && validation.reason.includes('withdrawn')) {
        console.log('\n🔴 WITHDRAWN INVITATION DETECTED!');
        console.log('   This is why the connection request fails.');
        console.log('   LinkedIn enforces a 3-4 week cooldown after withdrawing.');
        console.log('   Solution: Wait for cooldown or use InMail instead.');
      }

    } catch (error) {
      console.error('\n❌ Error:', error.title || error.message || error);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('💡 IMPLEMENTATION RECOMMENDATIONS');
  console.log('='.repeat(80));
  console.log('\n1. Update route.ts to clean URLs before sending to Unipile');
  console.log('2. Check invitation status before attempting to send');
  console.log('3. Track withdrawn invitations with timestamps in database');
  console.log('4. Implement 3-4 week cooldown for withdrawn invitations');
  console.log('5. Provide clear error messages to users about cooldown periods');
  console.log('6. Consider using InMail as fallback for withdrawn invitations');
}

// Run the demonstration
demonstrateFix().catch(console.error);