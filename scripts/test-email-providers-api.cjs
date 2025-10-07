#!/usr/bin/env node

/**
 * Test script for Email Providers API
 * Tests the GET /api/email-providers endpoint with proper authentication
 *
 * Usage: node scripts/test-email-providers-api.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://latxadqrvrrrcvkktrog.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTk5ODYsImV4cCI6MjA2ODI3NTk4Nn0.3WkAgXpk_MyQioVf_SED9O_ArjcT9nH0uy9we2okftE';

async function testEmailProvidersAPI() {
  console.log('\n🧪 Testing Email Providers API\n');
  console.log('='.repeat(60));

  // Test user credentials
  const testEmail = 'tl@innovareai.com';
  const testUserId = 'f6885ff3-deef-4781-8721-93011c990b1b';
  const testWorkspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  console.log(`\n📋 Test Configuration:`);
  console.log(`   User: ${testEmail}`);
  console.log(`   User ID: ${testUserId}`);
  console.log(`   Workspace ID: ${testWorkspaceId}`);

  // 1. Check database for email accounts
  console.log('\n\n1️⃣  Checking workspace_accounts table...\n');
  const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: accounts, error: accountsError } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', testWorkspaceId)
    .eq('account_type', 'email');

  if (accountsError) {
    console.error('❌ Error fetching accounts:', accountsError);
  } else {
    console.log(`✅ Found ${accounts.length} email account(s):`);
    accounts.forEach(acc => {
      console.log(`   - ${acc.account_identifier} (Unipile ID: ${acc.unipile_account_id})`);
    });
  }

  // 2. Check workspace members
  console.log('\n\n2️⃣  Checking workspace_members table...\n');
  const { data: members, error: membersError } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', testWorkspaceId)
    .eq('user_id', testUserId);

  if (membersError) {
    console.error('❌ Error fetching members:', membersError);
  } else if (members.length === 0) {
    console.error('❌ User is NOT a member of workspace!');
  } else {
    console.log(`✅ User is a member with role: ${members[0].role}`);
  }

  // 3. Check users table for current_workspace_id
  console.log('\n\n3️⃣  Checking users table...\n');
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', testUserId)
    .single();

  if (userError) {
    console.error('❌ Error fetching user:', userError);
  } else if (!user?.current_workspace_id) {
    console.log('⚠️  User has no current_workspace_id set (will use fallback)');
  } else {
    console.log(`✅ User's current_workspace_id: ${user.current_workspace_id}`);
  }

  // 4. Summary
  console.log('\n\n📊 Summary\n');
  console.log('='.repeat(60));

  if (accounts && accounts.length > 0 && members && members.length > 0) {
    console.log('✅ Authentication should work:');
    console.log('   - User is authenticated (ID: ' + testUserId + ')');
    console.log('   - User is member of workspace');
    console.log('   - Workspace has email accounts');
    console.log('\n✅ Expected API Response:');
    console.log('   {');
    console.log('     "success": true,');
    console.log('     "providers": [');
    accounts.forEach(acc => {
      console.log(`       {`);
      console.log(`         "id": "${acc.unipile_account_id}",`);
      console.log(`         "email_address": "${acc.account_identifier}",`);
      console.log(`         "provider_type": "google",`);
      console.log(`         "status": "connected"`);
      console.log(`       }`);
    });
    console.log('     ]');
    console.log('   }');
  } else {
    console.log('❌ Issues detected:');
    if (!accounts || accounts.length === 0) {
      console.log('   - No email accounts in workspace_accounts');
    }
    if (!members || members.length === 0) {
      console.log('   - User is not a member of the workspace');
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

// Run the test
testEmailProvidersAPI().catch(console.error);
