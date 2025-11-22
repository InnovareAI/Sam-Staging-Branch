#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '../../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const UNIPILE_DSN = envContent.match(/UNIPILE_DSN=(.*)/)?.[1]?.trim() || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = envContent.match(/UNIPILE_API_KEY=(.*)/)?.[1]?.trim() || 'POcBmCSV.b/t0gstHvY5alDsy/BmKQmUBt4FmNXRF7fdOYqywJSM=';

const accountId = 'ymtTx4xVQ6OVUFk83ctwtA'; // Irish's account

console.log('🔍 Testing Noah Ottmar Profile Lookup\n');
console.log('='.repeat(80));
console.log('\nLinkedIn URL: https://www.linkedin.com/in/noah-ottmar-b59478295');
console.log('miniProfileUrn: urn:li:fs_miniProfile:ACoAAEdwM3UB1tC2xflIFaffnR4qqdvQRaZ3V4w');
console.log('\n' + '='.repeat(80) + '\n');

// Extract vanity identifier from URL
const linkedinUrl = 'https://www.linkedin.com/in/noah-ottmar-b59478295';
const vanityMatch = linkedinUrl.match(/linkedin\.com\/in\/([^\/\?#]+)/);
const vanityId = vanityMatch ? vanityMatch[1] : null;

console.log(`📝 Extracted vanity identifier: ${vanityId}\n`);

// Test different lookup methods
const testLookup = async (method, url) => {
  console.log(`\n🧪 Testing ${method}:`);
  console.log(`URL: https://${UNIPILE_DSN}${url}\n`);

  try {
    const response = await fetch(`https://${UNIPILE_DSN}${url}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS - Profile found!');
      console.log(`Name: ${data.first_name} ${data.last_name}`);
      console.log(`Provider ID: ${data.provider_id}`);
      console.log(`Public Identifier: ${data.public_identifier}`);
      console.log(`Network Distance: ${data.network_distance}`);
      console.log(`Invitation Status: ${data.invitation?.status || 'N/A'}`);
      return data;
    } else {
      const errorText = await response.text();
      console.log(`❌ FAILED (${response.status}): ${errorText.substring(0, 200)}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return null;
  }
};

// Try different lookup methods
console.log('METHOD 1: Using vanity identifier only');
await testLookup('Vanity identifier', `/api/v1/users/profile?account_id=${accountId}&identifier=${encodeURIComponent(vanityId)}`);

console.log('\n' + '='.repeat(80));
console.log('\nMETHOD 2: Using full LinkedIn URL (NOT RECOMMENDED - often unreliable)');
await testLookup('Full URL', `/api/v1/users/profile?account_id=${accountId}&identifier=${encodeURIComponent(linkedinUrl)}`);

console.log('\n' + '='.repeat(80));
console.log('\nMETHOD 3: Using /users/{vanity} endpoint (deprecated pattern)');
await testLookup('Legacy pattern', `/api/v1/users/${vanityId}?account_id=${accountId}`);

// Now test if we can search for this person
console.log('\n' + '='.repeat(80));
console.log('\n🔍 Testing if we can find Noah via search:\n');

const searchPayload = {
  account_id: accountId,
  query: "Noah Ottmar San Diego State University",
  limit: 10
};

try {
  const searchResponse = await fetch(`https://${UNIPILE_DSN}/api/v1/users/search`, {
    method: 'POST',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(searchPayload)
  });

  if (searchResponse.ok) {
    const searchData = await searchResponse.json();
    console.log(`Found ${searchData.items?.length || 0} results\n`);

    const noah = searchData.items?.find(item =>
      item.first_name === 'Noah' && item.last_name === 'Ottmar'
    );

    if (noah) {
      console.log('✅ Found Noah in search results!');
      console.log(`Provider ID: ${noah.id}`);
      console.log(`Public Identifier: ${noah.public_identifier}`);
      console.log(`LinkedIn URL: ${noah.linkedin_url}`);
      console.log(`Network Distance: ${noah.network_distance}`);

      // Now try to look up using the provider_id from search
      console.log('\n' + '='.repeat(80));
      console.log('\nMETHOD 4: Using provider_id from search results (MOST RELIABLE)');
      await testLookup('Provider ID', `/api/v1/users/profile?account_id=${accountId}&provider_id=${encodeURIComponent(noah.id)}`);
    } else {
      console.log('❌ Noah not found in search results');
      console.log('\nSearch results:');
      searchData.items?.forEach((item, index) => {
        console.log(`${index + 1}. ${item.first_name} ${item.last_name} - ${item.headline || 'No headline'}`);
      });
    }
  } else {
    const errorText = await searchResponse.text();
    console.log(`❌ Search failed (${searchResponse.status}): ${errorText.substring(0, 200)}`);
  }
} catch (error) {
  console.log(`❌ Search error: ${error.message}`);
}

console.log('\n' + '='.repeat(80));
console.log('\n📊 DIAGNOSIS:\n');
console.log('If the profile lookup is failing, it could be because:');
console.log('1. Noah\'s profile is not accessible (privacy settings)');
console.log('2. The account doesn\'t have visibility to 2nd-degree connections');
console.log('3. The vanity URL contains special characters or numbers that need proper handling');
console.log('4. LinkedIn has restricted access to this profile');
console.log('5. The miniProfileUrn parameter in the URL is confusing the lookup');
console.log('\nRecommendation: Always store provider_id from search results and use that for lookups');