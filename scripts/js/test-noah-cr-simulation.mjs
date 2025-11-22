#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '../../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = 'POcBmCSV.b/t0gstHvY5alDsy/BmKQmUBt4FmNXRF7fdOYqywJSM=';

const accountId = 'ymtTx4xVQ6OVUFk83ctwtA'; // Irish's account

console.log('🧪 SIMULATING CONNECTION REQUEST TO NOAH OTTMAR\n');
console.log('='.repeat(80));

// Simulate the prospect data
const prospect = {
  first_name: 'Noah',
  last_name: 'Ottmar',
  linkedin_url: 'https://www.linkedin.com/in/noah-ottmar-b59478295?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAAEdwM3UB1tC2xflIFaffnR4qqdvQRaZ3V4w',
  linkedin_user_id: null, // No provider_id stored
  public_identifier: null, // No public identifier stored
};

console.log('📋 Prospect Data:');
console.log(`  Name: ${prospect.first_name} ${prospect.last_name}`);
console.log(`  LinkedIn URL: ${prospect.linkedin_url}`);
console.log(`  Stored Provider ID: ${prospect.linkedin_user_id || 'None'}`);
console.log(`  Stored Public ID: ${prospect.public_identifier || 'None'}`);
console.log('\n' + '='.repeat(80) + '\n');

// Simulate the improved lookup logic
const unipileRequest = async (endpoint) => {
  const url = `https://${UNIPILE_DSN}${endpoint}`;
  console.log(`  → Calling: ${url}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API call failed (${response.status}): ${error.substring(0, 100)}`);
  }

  return response.json();
};

const lookupProfile = async () => {
  let providerId = prospect.linkedin_user_id;
  let profile = null;

  console.log('🔍 EXECUTING IMPROVED LOOKUP STRATEGY:\n');

  if (providerId) {
    // PRIMARY: Use stored provider_id
    console.log(`1. Using stored provider_id: ${providerId}`);
    profile = await unipileRequest(
      `/api/v1/users/profile?account_id=${accountId}&provider_id=${encodeURIComponent(providerId)}`
    );
  } else {
    // FALLBACK: Extract vanity and use legacy endpoint
    console.log('1. No stored provider_id, extracting vanity identifier...');
    const vanityMatch = prospect.linkedin_url.match(/linkedin\.com\/in\/([^\/\?#]+)/);

    if (vanityMatch) {
      const vanityId = vanityMatch[1];
      console.log(`   Extracted: ${vanityId}\n`);

      // Try legacy endpoint first
      try {
        console.log('2. Trying legacy /users/{vanity} endpoint (NEW FIX):');
        profile = await unipileRequest(`/api/v1/users/${vanityId}?account_id=${accountId}`);
        providerId = profile.provider_id;
        console.log(`   ✅ SUCCESS - Found correct profile!`);
      } catch (legacyError) {
        console.log(`   ❌ Legacy failed: ${legacyError.message}\n`);

        // Fallback to profile API
        console.log('3. Falling back to /users/profile?identifier=');
        profile = await unipileRequest(
          `/api/v1/users/profile?account_id=${accountId}&identifier=${encodeURIComponent(vanityId)}`
        );
        providerId = profile.provider_id;
        console.log(`   ⚠️  Found profile (but might be wrong person)`);
      }
    }
  }

  return { profile, providerId };
};

try {
  const { profile, providerId } = await lookupProfile();

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 PROFILE LOOKUP RESULT:\n');
  console.log(`✅ Name: ${profile.first_name} ${profile.last_name}`);
  console.log(`✅ Provider ID: ${providerId}`);
  console.log(`✅ Network Distance: ${profile.network_distance}`);
  console.log(`✅ Invitation Status: ${profile.invitation?.status || 'None'}`);

  // Check if this is the correct person
  const isCorrectPerson = profile.first_name === 'Noah' && profile.last_name === 'Ottmar';

  console.log('\n' + '='.repeat(80));
  console.log('\n🎯 VERIFICATION:\n');
  if (isCorrectPerson) {
    console.log('✅ CORRECT PERSON FOUND!');
    console.log('The improved lookup strategy successfully found Noah Ottmar.');

    if (profile.network_distance === 'SECOND_DEGREE' && !profile.invitation) {
      console.log('\n✅ CAN SEND CONNECTION REQUEST');
      console.log('Noah is a 2nd-degree connection with no pending/withdrawn invitations.');
    }
  } else {
    console.log('❌ WRONG PERSON FOUND!');
    console.log(`Expected: Noah Ottmar`);
    console.log(`Got: ${profile.first_name} ${profile.last_name}`);
    console.log('\nThis indicates the lookup strategy still needs adjustment.');
  }

  // Simulate what would happen with connection request
  if (isCorrectPerson && profile.network_distance === 'SECOND_DEGREE' && !profile.invitation) {
    console.log('\n' + '='.repeat(80));
    console.log('\n📤 SIMULATING CONNECTION REQUEST:\n');

    const message = `Hi Noah, I came across your profile at San Diego State University and would love to connect!`;
    console.log(`Message: "${message}"`);
    console.log('\nPayload that would be sent:');
    console.log(JSON.stringify({
      account_id: accountId,
      provider_id: providerId,
      message: message
    }, null, 2));

    console.log('\n✅ This connection request would likely succeed!');
  }

} catch (error) {
  console.log('\n❌ ERROR:', error.message);
}

console.log('\n' + '='.repeat(80));
console.log('\n💡 SUMMARY:\n');
console.log('The fix uses the legacy /users/{vanity} endpoint which correctly resolves');
console.log('LinkedIn vanity URLs containing numbers (like noah-ottmar-b59478295).');
console.log('This should prevent the wrong profile (Jamshaid Ali) from being returned.');