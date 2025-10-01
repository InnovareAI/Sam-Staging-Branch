#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testProxyAssignment() {
  console.log('🔍 Checking LinkedIn proxy assignments...\n');
  
  try {
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .limit(5);
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError.message);
      return;
    }
    
    if (!users || users.length === 0) {
      console.log('⚠️  No users found in database');
      return;
    }
    
    console.log(`📊 Found ${users.length} user(s)\n`);
    
    // Check proxy assignments for each user
    for (const user of users) {
      console.log(`👤 User: ${user.email} (${user.id})`);
      
      const { data: assignments, error: assignError } = await supabase
        .from('linkedin_proxy_assignments')
        .select('*')
        .eq('user_id', user.id);
      
      if (assignError) {
        console.error(`  ❌ Error: ${assignError.message}`);
        continue;
      }
      
      if (!assignments || assignments.length === 0) {
        console.log(`  ⚠️  No proxy assignments found`);
        console.log(`  💡 Tip: Open the Proxy Management modal or POST to /api/linkedin/assign-proxy-ips\n`);
        continue;
      }
      
      console.log(`  ✅ Found ${assignments.length} proxy assignment(s):\n`);
      
      assignments.forEach((assignment, index) => {
        console.log(`  ${index + 1}. ${assignment.linkedin_account_name}`);
        console.log(`     📍 Detected Country: ${assignment.detected_country}`);
        console.log(`     🌐 Proxy: ${assignment.proxy_country}${assignment.proxy_state ? '/' + assignment.proxy_state : ''}`);
        console.log(`     📊 Confidence: ${Math.round((assignment.confidence_score || 0) * 100)}%`);
        console.log(`     🔌 Status: ${assignment.connectivity_status}`);
        console.log(`     🔑 Username: ${assignment.proxy_username?.substring(0, 50)}...`);
        console.log('');
      });
    }
    
    // Check if BrightData credentials are configured
    console.log('\n🔧 Checking BrightData configuration:');
    const hasBrightDataCustomerId = !!process.env.BRIGHT_DATA_CUSTOMER_ID;
    const hasBrightDataPassword = !!process.env.BRIGHT_DATA_RESIDENTIAL_PASSWORD;
    
    console.log(`  Customer ID: ${hasBrightDataCustomerId ? '✅ Set' : '❌ Missing'}`);
    console.log(`  Password: ${hasBrightDataPassword ? '✅ Set' : '❌ Missing'}`);
    
    if (hasBrightDataCustomerId && hasBrightDataPassword) {
      console.log('\n  ✅ BrightData is configured!');
      console.log(`  📝 Sample proxy format:`);
      console.log(`     Host: brd.superproxy.io`);
      console.log(`     Port: 22225`);
      console.log(`     Username: brd-customer-${process.env.BRIGHT_DATA_CUSTOMER_ID}-zone-residential-country-XX`);
    } else {
      console.log('\n  ⚠️  BrightData credentials not configured in .env.local');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testProxyAssignment().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
});
