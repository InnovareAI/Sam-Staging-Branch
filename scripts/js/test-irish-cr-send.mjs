import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

console.log('🧪 Testing Irish CR send with corrected API key\n');
console.log('API Key (first 20 chars):', UNIPILE_API_KEY.substring(0, 20) + '...');
console.log('Base URL:', UNIPILE_BASE_URL);
console.log('');

async function testSendCR() {
  const irishAccountId = 'ymtTx4xVQ6OVUFk83ctwtA';
  const adamLinkedIn = 'https://www.linkedin.com/in/adam-h-fry';

  try {
    // Step 1: Get profile
    console.log('📝 Step 1: Fetching Adam Fry profile...');
    const profileUrl = `${UNIPILE_BASE_URL}/api/v1/users/profile?account_id=${irishAccountId}&identifier=${encodeURIComponent(adamLinkedIn)}`;

    const profileResponse = await fetch(profileUrl, {
      headers: {
        'X-Api-Key': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!profileResponse.ok) {
      const error = await profileResponse.json();
      console.error('❌ Profile fetch failed:', error);
      return;
    }

    const profile = await profileResponse.json();
    console.log('✅ Profile retrieved');
    console.log('   Provider ID:', profile.provider_id);
    console.log('   Name:', profile.display_name);
    console.log('   Network distance:', profile.network_distance);
    console.log('   Invitation status:', profile.invitation?.status || 'None');
    console.log('');

    // Check if already connected
    if (profile.network_distance === 'FIRST_DEGREE') {
      console.log('⚠️  Already connected - skipping invite');
      return;
    }

    // Check for withdrawn
    if (profile.invitation?.status === 'WITHDRAWN') {
      console.log('⚠️  Withdrawn invitation - need to wait for cooldown');
      return;
    }

    // Step 2: Send connection request
    console.log('📤 Step 2: Sending connection request...');
    const message = `Hi Adam, noticed your product work at OpenAI. I'd love to connect!`;

    const inviteResponse = await fetch(`${UNIPILE_BASE_URL}/api/v1/users/invite`, {
      method: 'POST',
      headers: {
        'X-Api-Key': UNIPILE_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        account_id: irishAccountId,
        provider_id: profile.provider_id,
        message: message
      })
    });

    if (!inviteResponse.ok) {
      const error = await inviteResponse.json();
      console.error('❌ Invite failed:', error);
      return;
    }

    const inviteResult = await inviteResponse.json();
    console.log('✅ Connection request sent successfully!');
    console.log('   Result:', JSON.stringify(inviteResult, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSendCR();
