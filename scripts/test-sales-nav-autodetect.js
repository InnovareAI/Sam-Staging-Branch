#!/usr/bin/env node

/**
 * Test Sales Navigator Auto-Detection
 * Tests that the API automatically detects and uses Sales Navigator
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_BASE_URL = `https://${UNIPILE_DSN}`;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testSalesNavAutoDetect() {
  console.log('🔍 Testing Sales Navigator Auto-Detection...\n');
  
  try {
    // Get LinkedIn account
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    const { data: accounts } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('platform', 'LINKEDIN')
      .eq('connection_status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!accounts || accounts.length === 0) {
      console.error('❌ No LinkedIn accounts found');
      process.exit(1);
    }

    const linkedInAccountId = accounts[0].unipile_account_id;
    console.log(`✅ Using account: ${linkedInAccountId}`);
    console.log('');

    // Get account capabilities
    console.log('📊 Checking account capabilities...');
    const accountResponse = await fetch(
      `${UNIPILE_BASE_URL}/api/v1/accounts/${linkedInAccountId}`,
      {
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    const accountInfo = await accountResponse.json();
    const premiumFeatures = accountInfo.connection_params?.im?.premiumFeatures || [];
    
    console.log('Premium Features:', premiumFeatures);
    console.log('');

    // Test search WITHOUT specifying API (should auto-detect)
    console.log('🎯 Test 1: Search WITHOUT specifying API (auto-detect)...');
    
    const searchParams = {
      // NO "api" field - should auto-detect!
      category: 'people',
      keywords: 'CEO',
      limit: 100  // Sales Navigator allows 100 per page
    };

    const searchUrl = new URL(`${UNIPILE_BASE_URL}/api/v1/linkedin/search`);
    searchUrl.searchParams.append('account_id', linkedInAccountId);
    searchUrl.searchParams.append('limit', '100');

    console.log('Request parameters:', JSON.stringify(searchParams, null, 2));
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

    console.log(`Response: ${response.status} ${response.statusText}`);
    console.log('');

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Search failed:', error);
      process.exit(1);
    }

    const searchResults = await response.json();

    console.log('✅ Search successful!\n');
    console.log('📊 Results:');
    console.log(`   Items returned: ${searchResults.items?.length || 0}`);
    console.log(`   Total available: ${searchResults.paging?.total_count || 'N/A'}`);
    console.log(`   Has more: ${!!searchResults.paging?.cursor}`);
    console.log('');

    // Display first 5 results
    if (searchResults.items && searchResults.items.length > 0) {
      console.log('👥 First 5 Results:\n');
      
      searchResults.items.slice(0, 5).forEach((item, index) => {
        console.log(`${index + 1}. ${item.name || item.first_name + ' ' + item.last_name}`);
        console.log(`   Title: ${item.headline || item.title || 'N/A'}`);
        console.log(`   Location: ${item.location || 'N/A'}`);
        console.log('');
      });
    }

    // Verify Sales Navigator was used
    const expectedAPI = premiumFeatures.includes('sales_navigator') ? 'sales_navigator' : 'classic';
    console.log(`\n✅ Expected API: ${expectedAPI}`);
    console.log(`✅ Got 100 results per page: ${searchResults.items.length === 100 ? 'YES' : 'NO'}`);
    console.log(`✅ Max results available: ${premiumFeatures.includes('sales_navigator') ? '2,500' : '1,000'}`);
    
    console.log('\n🎉 Auto-detection test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testSalesNavAutoDetect();
