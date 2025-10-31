#!/usr/bin/env node
/**
 * Debug Unipile Profile Structure
 * Check what fields Unipile actually returns for a LinkedIn profile
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

// Test with one of the bad prospects
const TEST_LINKEDIN_URL = 'https://www.linkedin.com/in/sidneepinho';
const UNIPILE_ACCOUNT_ID = 'lN6tdIWOStK_dEaxhygCEQ'; // Michelle's account

console.log('🔍 Debugging Unipile Profile Structure\n');
console.log(`Test profile: ${TEST_LINKEDIN_URL}`);
console.log(`Account: ${UNIPILE_ACCOUNT_ID}\n`);

async function debugProfile() {
  const linkedinUsername = TEST_LINKEDIN_URL.split('/in/')[1]?.split('?')[0]?.replace('/', '');

  // Test 1: Basic profile endpoint
  const profileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/${linkedinUsername}?account_id=${UNIPILE_ACCOUNT_ID}`;

  console.log(`TEST 1: Basic profile endpoint`);
  console.log(`Fetching: ${profileUrl}\n`);

  const profileResponse = await fetch(profileUrl, {
    method: 'GET',
    headers: {
      'X-API-KEY': process.env.UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!profileResponse.ok) {
    console.error(`❌ API Error: ${profileResponse.status} ${profileResponse.statusText}`);
    process.exit(1);
  }

  const profileData = await profileResponse.json();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 BASIC PROFILE RESPONSE:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(JSON.stringify(profileData, null, 2));

  // Test 2: Company endpoint
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`TEST 2: Company endpoint (if provider_id available)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (profileData.provider_id) {
    const companyUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/${profileData.provider_id}/company?account_id=${UNIPILE_ACCOUNT_ID}`;
    console.log(`Fetching: ${companyUrl}\n`);

    const companyResponse = await fetch(companyUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    console.log(`Status: ${companyResponse.status} ${companyResponse.statusText}\n`);

    if (companyResponse.ok) {
      const companyData = await companyResponse.json();
      console.log('📋 COMPANY ENDPOINT RESPONSE:');
      console.log(JSON.stringify(companyData, null, 2));
    } else {
      const errorText = await companyResponse.text();
      console.log(`❌ Company endpoint error: ${errorText}`);
    }
  } else {
    console.log('⚠️  No provider_id available to test company endpoint');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔑 KEY FIELDS FROM BASIC PROFILE:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`first_name: ${profileData.first_name}`);
  console.log(`last_name: ${profileData.last_name}`);
  console.log(`headline: ${profileData.headline}`);
  console.log(`provider_id: ${profileData.provider_id}`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 AVAILABLE TOP-LEVEL KEYS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(Object.keys(profileData).join(', '));
}

debugProfile().catch(console.error);
