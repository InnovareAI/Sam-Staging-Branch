#!/usr/bin/env node

/**
 * FORCE REAL UNIPILE SEARCH - NO MOCK DATA
 * This bypasses all fallbacks and forces actual Unipile API calls
 */

import fetch from 'node-fetch';

const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

console.log(`
╔══════════════════════════════════════════════════════════════╗
║           FORCE REAL UNIPILE DATA - NO FAKE SHIT             ║
╚══════════════════════════════════════════════════════════════╝
`);

if (!UNIPILE_API_KEY) {
  console.error('❌ UNIPILE_API_KEY not found in environment!');
  console.log('\nSet it with:');
  console.log('export UNIPILE_API_KEY="your_key_here"');
  process.exit(1);
}

async function getRealUnipileData() {
  try {
    // Step 1: Get ALL Unipile accounts
    console.log('1️⃣  Fetching Unipile accounts...\n');

    const accountsUrl = UNIPILE_DSN.includes('.')
      ? `https://${UNIPILE_DSN}/api/v1/accounts`
      : `https://${UNIPILE_DSN}.unipile.com:13443/api/v1/accounts`;
    console.log('URL:', accountsUrl);

    const accountsResponse = await fetch(accountsUrl, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!accountsResponse.ok) {
      console.error('❌ Failed to fetch accounts:', accountsResponse.status);
      const errorText = await accountsResponse.text();
      console.error(errorText);
      return;
    }

    const accountsData = await accountsResponse.json();
    const allAccounts = Array.isArray(accountsData) ? accountsData : (accountsData.items || accountsData.accounts || []);
    const linkedinAccounts = allAccounts.filter(acc => acc.type === 'LINKEDIN');

    console.log(`✅ Found ${linkedinAccounts.length} LinkedIn accounts in Unipile\n`);

    if (linkedinAccounts.length === 0) {
      console.error('❌ NO LINKEDIN ACCOUNTS CONNECTED!');
      console.log('\nYou need to:');
      console.log('1. Go to Settings → Integrations');
      console.log('2. Click "Connect LinkedIn"');
      console.log('3. Follow the Unipile OAuth flow');
      return;
    }

    // Use first LinkedIn account
    const linkedinAccount = linkedinAccounts[0];
    console.log('Using LinkedIn account:', linkedinAccount.name || linkedinAccount.id);
    console.log('Account email:', linkedinAccount.connection_params?.im?.email || 'N/A');

    const premiumFeatures = linkedinAccount.connection_params?.im?.premiumFeatures || [];
    const api = premiumFeatures.includes('sales_navigator') ? 'sales_navigator'
              : premiumFeatures.includes('recruiter') ? 'recruiter'
              : 'classic';

    console.log('LinkedIn type:', api);
    console.log('');

    // Step 2: Search for REAL CEOs in Seattle
    console.log('2️⃣  Searching LinkedIn for REAL Seattle CEOs...\n');

    const searchUrl = UNIPILE_DSN.includes('.')
      ? `https://${UNIPILE_DSN}/api/v1/linkedin/search`
      : `https://${UNIPILE_DSN}.unipile.com:13443/api/v1/linkedin/search`;
    const params = new URLSearchParams({
      account_id: linkedinAccount.id,
      limit: '20'
    });

    const searchPayload = {
      api: api,
      category: 'people',
      title: 'CEO',
      keywords: 'startup technology',
      // Network distance: 1=1st, 2=2nd, 3=3rd
      ...(api === 'sales_navigator' || api === 'recruiter'
        ? { network_distance: [2] }
        : { network: ['S'] } // S = 2nd degree for classic
      )
    };

    console.log('Search URL:', `${searchUrl}?${params}`);
    console.log('Payload:', JSON.stringify(searchPayload, null, 2));
    console.log('');

    const searchResponse = await fetch(`${searchUrl}?${params}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(searchPayload)
    });

    if (!searchResponse.ok) {
      console.error('❌ Search failed:', searchResponse.status);
      const errorText = await searchResponse.text();
      console.error(errorText);
      return;
    }

    const searchData = await searchResponse.json();
    const prospects = searchData.items || [];

    console.log(`✅ SUCCESS! Found ${prospects.length} REAL prospects from LinkedIn\n`);
    console.log('━'.repeat(70));
    console.log('REAL LINKEDIN PROFILES:');
    console.log('━'.repeat(70));

    prospects.slice(0, 10).forEach((item, i) => {
      const firstName = item.first_name || '';
      const lastName = item.last_name || '';
      const fullName = item.name || `${firstName} ${lastName}`;

      const title = item.headline || item.current_positions?.[0]?.role || '';
      const company = item.current_positions?.[0]?.company || '';
      const location = item.location || item.geo_region || '';
      const linkedinUrl = item.profile_url || item.public_profile_url || '';

      console.log(`\n${i + 1}. ${fullName}`);
      console.log(`   Title: ${title}`);
      console.log(`   Company: ${company}`);
      console.log(`   Location: ${location}`);
      console.log(`   LinkedIn: ${linkedinUrl}`);
    });

    console.log('\n━'.repeat(70));
    console.log(`\n✅ These are REAL people from LinkedIn!`);
    console.log(`✅ Total found: ${prospects.length}`);
    console.log(`\nNow save these to your database...`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

getRealUnipileData();
