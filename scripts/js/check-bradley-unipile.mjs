import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_BASE_URL = `https://${UNIPILE_DSN}`;
const ACCOUNT_ID = 'ymtTx4xVQ6OVUFk83ctwtA';

console.log('=== CHECKING BRADLEY BRETON VIA UNIPILE ===\n');
console.log('Irish Account ID:', ACCOUNT_ID);
console.log('Bradley LinkedIn URL: http://www.linkedin.com/in/bradleybreton');
console.log('Unipile Base URL:', UNIPILE_BASE_URL);
console.log();

async function checkBradleyBreton() {
  try {
    // Step 1: Get Bradley's profile
    console.log('STEP 1: Fetching Bradley Breton\'s LinkedIn profile...\n');

    const profileUrl = `${UNIPILE_BASE_URL}/api/v1/users/bradleybreton?account_id=${ACCOUNT_ID}&provider=LINKEDIN`;

    console.log('Profile URL:', profileUrl);

    const profileResponse = await fetch(profileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    console.log('Status Code:', profileResponse.status);

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error('Error Response:', errorText);
      process.exit(1);
    }

    const profile = await profileResponse.json();

    console.log('\nBRADLEY BRETON PROFILE:');
    console.log('- Provider ID:', profile.id);
    console.log('- Full Name:', profile.display_name);
    console.log('- Network Distance:', profile.network_distance);
    console.log('- Profile URL:', profile.profile_url);
    console.log();

    // Step 2: Check for pending invitations
    console.log('STEP 2: Checking for pending invitations to Bradley...\n');

    // Try to get messages to/from Bradley to check if connection request was sent
    const messagesUrl = `${UNIPILE_BASE_URL}/api/v1/messages?account_id=${ACCOUNT_ID}&limit=100`;

    const messagesResponse = await fetch(messagesUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    let hasPendingInvitation = false;
    let hasMessages = false;

    if (messagesResponse.ok) {
      const messages = await messagesResponse.json();

      // Check if any messages involve Bradley
      const bradleyMessages = messages.items?.filter(msg =>
        msg.attendees?.some(att =>
          att.id === profile.id ||
          att.display_name?.toLowerCase().includes('bradley breton')
        )
      );

      hasMessages = bradleyMessages && bradleyMessages.length > 0;

      if (hasMessages) {
        console.log(`Found ${bradleyMessages.length} message(s) with Bradley Breton`);
        console.log('Latest message date:', bradleyMessages[0]?.date);
      } else {
        console.log('No messages found with Bradley Breton');
      }
    } else {
      console.log('Unable to fetch messages (endpoint may not be available)');
    }

    console.log();
    console.log('=== RESULTS ===');
    console.log();
    console.log('Bradley\'s Network Distance:', profile.network_distance);
    console.log('Is 1st Degree Connection:', profile.network_distance === 'FIRST_DEGREE' ? 'YES' : 'NO');
    console.log('Is 2nd Degree Connection:', profile.network_distance === 'SECOND_DEGREE' ? 'YES' : 'NO');
    console.log('Is 3rd+ Degree:', profile.network_distance === 'THIRD_DEGREE_OR_MORE' ? 'YES' : 'NO');
    console.log('Has Message History:', hasMessages ? 'YES' : 'NO');
    console.log();

    if (profile.network_distance === 'FIRST_DEGREE') {
      console.log('STATUS: Bradley is ALREADY CONNECTED to Irish');
      console.log('Safe to send connection request: NO (already connected)');
    } else if (hasMessages) {
      console.log('STATUS: Bradley is NOT connected, but has message history');
      console.log('Safe to send connection request: MAYBE (pending invitation likely exists)');
    } else {
      console.log('STATUS: Bradley is NOT connected to Irish');
      console.log('Safe to send connection request: YES');
      console.log();
      console.log('No pending invitation detected');
      console.log('No message history found');
      console.log('Network distance is', profile.network_distance);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkBradleyBreton();
