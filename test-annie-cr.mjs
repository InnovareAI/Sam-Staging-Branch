import 'dotenv/config';

const DSN = 'api6.unipile.com:13670';
const API_KEY = '/kdLciOD.5b8LbZkgBTK60Dubiv8ER49imjSwJV1cBCyZotKj70I=';
const IRISH_ACCOUNT_ID = 'ymtTx4xVQ6OVUFk83ctwtA';
const ANNIE_LINKEDIN_URL = 'https://www.linkedin.com/in/annie-meyer-422ab';

async function testAnnieMeyer() {
  console.log('Testing CR to Annie Meyer with Irish account...\n');
  console.log('Step 1: Fetch Annie profile from Unipile...\n');

  try {
    const profileResponse = await fetch(`https://${DSN}/api/v1/users/profile?account_id=${IRISH_ACCOUNT_ID}&identifier=${encodeURIComponent(ANNIE_LINKEDIN_URL)}`, {
      headers: {
        'X-API-KEY': API_KEY,
        'accept': 'application/json'
      }
    });

    console.log('Profile fetch status:', profileResponse.status);
    const profileData = await profileResponse.json();

    if (profileData.error || !profileData.provider_id) {
      console.log('❌ PROFILE FETCH FAILED');
      console.log('Response:', JSON.stringify(profileData, null, 2));
      return;
    }

    const profile = profileData;
    console.log('✅ Profile found:', profile.name);
    console.log('Provider ID:', profile.provider_id);
    console.log('\n📋 FULL PROFILE DATA:');
    console.log(JSON.stringify(profile, null, 2));
    console.log();

    // Check invitation status
    if (profile.invitation) {
      console.log('\n🔍 INVITATION DETAILS:');
      console.log('Status:', profile.invitation.status);
      console.log('Sent at:', profile.invitation.sent_at);
      console.log('Withdrawn at:', profile.invitation.withdrawn_at);
      console.log('Full invitation object:', JSON.stringify(profile.invitation, null, 2));

      if (profile.invitation.status === 'WITHDRAWN') {
        console.log('\n❌ WITHDRAWN - LinkedIn enforces 3-4 week cooldown');
        return;
      }

      if (profile.invitation.status === 'PENDING') {
        console.log('❌ ALREADY PENDING - CR already sent previously');
        return;
      }
    }

    console.log('\nStep 2: Send CR...\n');

    const inviteResponse = await fetch(`https://${DSN}/api/v1/users/invite`, {
      method: 'POST',
      headers: {
        'X-API-KEY': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        account_id: IRISH_ACCOUNT_ID,
        provider_id: profile.provider_id,
        text: 'Hi Annie, I would love to connect with you!'
      })
    });

    console.log('Invite status:', inviteResponse.status);
    const inviteData = await inviteResponse.json();
    console.log('Response:', JSON.stringify(inviteData, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAnnieMeyer();
