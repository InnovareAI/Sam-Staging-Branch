#!/usr/bin/env node

/**
 * Direct Unipile API Test
 * Tests LinkedIn search directly against Unipile API
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN;
// UNIPILE_DSN format: "api6.unipile.com:13670"
const UNIPILE_BASE_URL = `https://${UNIPILE_DSN}`;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testUnipileDirect() {
  console.log('🔍 Testing Unipile LinkedIn Search API (Direct)...\n');
  
  // Check credentials
  if (!UNIPILE_API_KEY || !UNIPILE_DSN) {
    console.error('❌ Missing Unipile credentials');
    console.error('Required in .env.local:');
    console.error('  UNIPILE_API_KEY');
    console.error('  UNIPILE_DSN');
    process.exit(1);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials');
    console.error('Required in .env.local:');
    console.error('  NEXT_PUBLIC_SUPABASE_URL');
    console.error('  SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('✅ Credentials loaded');
  console.log(`   Unipile DSN: ${UNIPILE_DSN}`);
  console.log(`   Supabase URL: ${SUPABASE_URL}`);
  console.log('');

  try {
    // Get LinkedIn account from database
    console.log('📊 Fetching LinkedIn accounts from database...');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    const { data: accounts, error } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('platform', 'LINKEDIN')
      .eq('connection_status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('❌ Database error:', error);
      process.exit(1);
    }

    if (!accounts || accounts.length === 0) {
      console.error('❌ No active LinkedIn accounts found in database');
      console.error('💡 Connect a LinkedIn account first at: /linkedin-integration');
      process.exit(1);
    }

    const linkedInAccount = accounts[0];
    console.log('✅ Found LinkedIn account:');
    console.log(`   Email: ${linkedInAccount.email}`);
    console.log(`   Unipile ID: ${linkedInAccount.unipile_account_id}`);
    console.log(`   Status: ${linkedInAccount.status}`);
    console.log('');

    // Perform LinkedIn search
    console.log('🔎 Performing LinkedIn search...');
    
    const searchParams = {
      api: 'classic',
      category: 'people',
      network_distance: [1, 2], // 1st and 2nd connections
      profile_language: ['en']
    };

    console.log('Search parameters:', JSON.stringify(searchParams, null, 2));
    console.log('');

    const searchUrl = new URL(`${UNIPILE_BASE_URL}/api/v1/linkedin/search`);
    searchUrl.searchParams.append('account_id', linkedInAccount.unipile_account_id);
    searchUrl.searchParams.append('limit', '20');

    console.log('📤 Request URL:', searchUrl.toString());
    console.log('');

    const response = await fetch(searchUrl.toString(), {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(searchParams)
    });

    console.log(`📥 Response status: ${response.status} ${response.statusText}`);
    console.log('');

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Unipile API error:');
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log('✅ Search successful!\n');
    console.log('📊 Results:');
    console.log(`   Total items: ${data.items?.length || 0}`);
    console.log(`   Total count: ${data.paging?.total_count || 'N/A'}`);
    console.log(`   Page count: ${data.paging?.page_count || 'N/A'}`);
    console.log(`   Has cursor: ${!!data.paging?.cursor}`);
    console.log('');

    if (data.items && data.items.length > 0) {
      console.log('👥 First 10 Results:\n');
      
      data.items.slice(0, 10).forEach((item, index) => {
        console.log(`${index + 1}. ${item.name || item.first_name + ' ' + item.last_name}`);
        console.log(`   Title: ${item.headline || item.title || 'N/A'}`);
        console.log(`   Company: ${item.company_name || item.current_company || 'N/A'}`);
        console.log(`   Location: ${item.location || 'N/A'}`);
        console.log(`   Connection: ${item.network_distance || item.connection_degree}${getDegreeLabel(item.network_distance)}`);
        console.log(`   LinkedIn: ${item.profile_url || 'N/A'}`);
        console.log('');
      });

      // Save full results
      const fs = await import('fs');
      const exportPath = './unipile-search-results.json';
      fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
      console.log(`💾 Full results saved to: ${exportPath}`);
      console.log('');

      // Stats
      const firstDegree = data.items.filter(i => i.network_distance === 1 || i.connection_degree === 1);
      const secondDegree = data.items.filter(i => i.network_distance === 2 || i.connection_degree === 2);
      
      console.log('📈 Connection Stats:');
      console.log(`   1st degree: ${firstDegree.length}`);
      console.log(`   2nd degree: ${secondDegree.length}`);
      console.log('');
      
    } else {
      console.log('⚠️  No results found');
    }

    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

function getDegreeLabel(degree) {
  switch (degree) {
    case 1: return 'st (direct connection)';
    case 2: return 'nd (friend of friend)';
    case 3: return 'rd';
    default: return 'th';
  }
}

// Run test
testUnipileDirect();
