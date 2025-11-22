#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local with override to use production credentials
dotenv.config({ path: join(__dirname, '../../.env.local'), override: true });

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const UNIPILE_BASE_URL = `https://${UNIPILE_DSN}`;
const IRISH_ACCOUNT_ID = 'ymtTx4xVQ6OVUFk83ctwtA';
const BRADLEY_LINKEDIN_URL = 'http://www.linkedin.com/in/bradleybreton';

console.log('\n🔍 Investigating Irish\'s LinkedIn account for Bradley Breton...\n');
console.log('Unipile Base URL:', UNIPILE_BASE_URL);
console.log('Account ID:', IRISH_ACCOUNT_ID);
console.log('Target:', BRADLEY_LINKEDIN_URL);
console.log('---\n');

async function makeUnipileRequest(endpoint, method = 'GET', body = null) {
  const url = `${UNIPILE_BASE_URL}${endpoint}`;

  const options = {
    method,
    headers: {
      'X-Api-Key': UNIPILE_API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  console.log(`\n📡 ${method} ${endpoint}`);

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      console.error(`❌ Failed: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error('Error:', text);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ Fetch error: ${error.message}`);
    if (error.cause) {
      console.error(`   Cause: ${error.cause.message || JSON.stringify(error.cause)}`);
    }
    // Wait a bit and try to continue with other requests
    await new Promise(resolve => setTimeout(resolve, 2000));
    return null;
  }
}

// 1. Check account connection status
console.log('1️⃣ CHECKING ACCOUNT CONNECTION STATUS\n');
const accountData = await makeUnipileRequest(`/api/v1/accounts/${IRISH_ACCOUNT_ID}`);
if (accountData) {
  console.log('Account Status:', JSON.stringify({
    id: accountData.id,
    type: accountData.type,
    connection_status: accountData.connection_status,
    username: accountData.username,
    name: accountData.name
  }, null, 2));
}

// 2. Try to get Bradley's profile (this will show if he's already connected or pending)
console.log('\n\n2️⃣ CHECKING BRADLEY\'S PROFILE STATUS\n');

const bradleyProfileUrl = `/api/v1/users/profile?account_id=${IRISH_ACCOUNT_ID}&identifier=${encodeURIComponent(BRADLEY_LINKEDIN_URL)}`;
const bradleyProfile = await makeUnipileRequest(bradleyProfileUrl);

if (bradleyProfile) {
  console.log('\n✅ BRADLEY PROFILE FOUND:');
  console.log('\n📋 FULL PROFILE DATA:');
  console.log(JSON.stringify(bradleyProfile, null, 2));

  console.log('\n🔍 KEY FIELDS:');
  console.log('  provider_id:', bradleyProfile.provider_id);
  console.log('  display_name:', bradleyProfile.display_name || bradleyProfile.first_name + ' ' + bradleyProfile.last_name);
  console.log('  network_distance:', bradleyProfile.network_distance);
  console.log('  is_connection:', bradleyProfile.is_connection);
  console.log('  connection_status:', bradleyProfile.connection_status);
  console.log('  pending_invitation:', bradleyProfile.pending_invitation);
  console.log('  can_invite:', bradleyProfile.can_invite);

  if (bradleyProfile.network_distance === 'FIRST_DEGREE') {
    console.log('\n✅ ALREADY CONNECTED!');
    console.log('Bradley is already a 1st degree connection. No CR needed.');
  }

  if (bradleyProfile.pending_invitation || bradleyProfile.connection_status === 'pending') {
    console.log('\n🎯 PENDING INVITATION DETECTED!');
    console.log('This explains the "Should delay new invitation" error.');
    console.log('There is already a pending invitation to Bradley from Irish.');
  }
} else {
  console.log('\n⚠️ Could not fetch Bradley\'s profile');
  console.log('This might mean:');
  console.log('  - LinkedIn URL is incorrect');
  console.log('  - Profile is private/restricted');
  console.log('  - Account has no access to this profile');
}

// 3. Try to search for Bradley's profile
console.log('\n\n3️⃣ SEARCHING FOR BRADLEY\'S PROFILE\n');

// Method 2: Try to get user by LinkedIn URL/identifier
// Extract username from URL: bradleybreton
const linkedinUsername = BRADLEY_LINKEDIN_URL.split('/in/')[1]?.replace('/', '');
console.log('LinkedIn username:', linkedinUsername);

const searchResults = await makeUnipileRequest(
  `/api/v1/users/search?account_id=${IRISH_ACCOUNT_ID}&q=${encodeURIComponent('Bradley Breton')}&limit=10`
);

if (searchResults) {
  console.log('\n✅ Search Results:');
  console.log(JSON.stringify(searchResults, null, 2));
}

// 4. Try to get messages (might show invitation message if sent)
console.log('\n\n4️⃣ CHECKING RECENT MESSAGES\n');

const messages = await makeUnipileRequest(
  `/api/v1/messages?account_id=${IRISH_ACCOUNT_ID}&limit=50`
);

if (messages) {
  console.log(`\n✅ Found ${messages.items?.length || 0} messages`);

  // Look for messages to/from Bradley
  const bradleyMessages = messages.items?.filter(msg =>
    msg.text?.includes('Bradley') ||
    msg.attendees?.some(a => a.identifier?.includes('bradleybreton'))
  );

  if (bradleyMessages && bradleyMessages.length > 0) {
    console.log('\n🎯 MESSAGES WITH BRADLEY:');
    bradleyMessages.forEach(msg => {
      console.log('\n---');
      console.log(JSON.stringify(msg, null, 2));
    });
  } else {
    console.log('\n⚠️ No messages found with Bradley Breton');
  }
}

// 5. Summary
console.log('\n\n' + '='.repeat(80));
console.log('📊 INVESTIGATION SUMMARY');
console.log('='.repeat(80));
console.log('\n');
console.log('Based on the Unipile API responses above:');
console.log('\n1. Account Status: Check if Irish\'s account is connected and active');
console.log('2. Pending Invitations: Look for Bradley in the relations/users list');
console.log('3. Profile Search: See if Bradley\'s profile is visible to Irish');
console.log('4. Message History: Check if there\'s any message thread with Bradley');
console.log('\n');
console.log('🔍 ERROR ANALYSIS: "Should delay new invitation to this recipient"');
console.log('\nThis error means ONE of these scenarios:');
console.log('\n  a) LinkedIn cooldown period (24-48h after withdrawn/declined invitation)');
console.log('  b) Pending invitation already exists (not yet accepted/declined)');
console.log('  c) LinkedIn rate limit on Irish\'s account (too many CRs recently)');
console.log('  d) Bradley has blocked invitations from non-connections');
console.log('\n');
console.log('💡 NEXT STEPS:');
console.log('\n  1. If Bradley appears in relations list → Check connection_status');
console.log('  2. If pending invitation exists → Wait for acceptance/decline');
console.log('  3. If cooldown period → Wait 24-48 hours before retry');
console.log('  4. If rate limit → Check Irish\'s daily/weekly CR count');
console.log('\n');
