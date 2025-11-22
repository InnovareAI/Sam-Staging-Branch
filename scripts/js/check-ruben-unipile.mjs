/**
 * Check Ruben Mayer's status in Unipile
 * Verify if there's a pending invitation or connection
 */

const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const UNIPILE_BASE_URL = `https://${UNIPILE_DSN}`;

// Irish's account ID (from campaign data)
const IRISH_ACCOUNT_ID = 'ymtTx4xVQ6OVUFk83ctwtA';
const RUBEN_LINKEDIN_URL = 'https://www.linkedin.com/in/rubenmayer?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAABeQoWMBkLV9L4lY6dFY-wYg1E_9Upnj2II';

async function checkRubenStatus() {
  console.log('🔍 Checking Ruben Mayer in Unipile...\n');

  try {
    // 1. Get Ruben's profile to check connection status
    console.log('📝 Fetching profile...');
    const profileResponse = await fetch(
      `${UNIPILE_BASE_URL}/api/v1/users/profile?account_id=${IRISH_ACCOUNT_ID}&identifier=${encodeURIComponent(RUBEN_LINKEDIN_URL)}`,
      {
        headers: {
          'X-Api-Key': UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    if (!profileResponse.ok) {
      const error = await profileResponse.json().catch(() => ({ message: 'Unknown error' }));
      console.error('❌ Profile fetch failed:', error);
      process.exit(1);
    }

    const profile = await profileResponse.json();

    console.log('\n✅ Profile Data:');
    console.log('  Name:', profile.name);
    console.log('  Provider ID:', profile.provider_id);
    console.log('  Network Distance:', profile.network_distance);
    console.log('  Title:', profile.headline);

    // 2. Check for pending invitations
    console.log('\n📋 Checking pending invitations...');
    const invitationsResponse = await fetch(
      `${UNIPILE_BASE_URL}/api/v1/users/invitations?account_id=${IRISH_ACCOUNT_ID}&type=SENT`,
      {
        headers: {
          'X-Api-Key': UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    if (invitationsResponse.ok) {
      const invitations = await invitationsResponse.json();
      const rubenInvite = invitations.items?.find(inv =>
        inv.provider_id === profile.provider_id ||
        inv.name?.toLowerCase().includes('ruben')
      );

      if (rubenInvite) {
        console.log('⚠️  PENDING INVITATION FOUND:');
        console.log('  Status:', rubenInvite.status);
        console.log('  Sent:', rubenInvite.created_at);
        console.log('  Message:', rubenInvite.message);
      } else {
        console.log('✅ No pending invitation to Ruben');
      }
    }

    // Summary
    console.log('\n📊 SUMMARY:');
    if (profile.network_distance === 'FIRST_DEGREE') {
      console.log('❌ Already connected - DO NOT send CR');
    } else if (profile.network_distance === 'SECOND_DEGREE') {
      console.log('✅ 2nd degree connection - SAFE to send CR');
    } else {
      console.log('✅ 3rd+ degree connection - SAFE to send CR');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRubenStatus();
