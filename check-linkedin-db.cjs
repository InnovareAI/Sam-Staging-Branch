const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLinkedInAccounts() {
  console.log('🔍 Checking LinkedIn accounts in database...\n');
  
  // Get your user ID first
  const { data: users } = await supabase.auth.admin.listUsers();
  const tlUser = users.users.find(u => u.email === 'tl@innovareai.com');
  
  if (!tlUser) {
    console.log('❌ User not found');
    return;
  }
  
  console.log(`✅ Found user: ${tlUser.email} (${tlUser.id})\n`);
  
  // Check integrations table
  const { data: integrations, error: intError } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', tlUser.id)
    .eq('provider', 'linkedin');
  
  console.log('📋 Integrations table:');
  if (intError) {
    console.log('❌ Error:', intError.message);
  } else if (!integrations || integrations.length === 0) {
    console.log('⚠️  No LinkedIn accounts found in integrations table');
  } else {
    console.log(`✅ Found ${integrations.length} LinkedIn account(s):`);
    integrations.forEach((int, i) => {
      console.log(`  ${i+1}. ID: ${int.id}`);
      console.log(`     Unipile ID: ${int.credentials?.unipile_account_id}`);
      console.log(`     Name: ${int.credentials?.account_name}`);
      console.log(`     Status: ${int.status}`);
      console.log('');
    });
  }
  
  // Check user_unipile_accounts table
  const { data: unipileAccs, error: unipileError } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('user_id', tlUser.id)
    .eq('platform', 'LINKEDIN');
  
  console.log('\n📋 User_unipile_accounts table:');
  if (unipileError) {
    console.log('❌ Error:', unipileError.message);
  } else if (!unipileAccs || unipileAccs.length === 0) {
    console.log('⚠️  No LinkedIn accounts found in user_unipile_accounts table');
  } else {
    console.log(`✅ Found ${unipileAccs.length} LinkedIn account(s):`);
    unipileAccs.forEach((acc, i) => {
      console.log(`  ${i+1}. Unipile ID: ${acc.unipile_account_id}`);
      console.log(`     Name: ${acc.account_name}`);
      console.log(`     Email: ${acc.account_email}`);
      console.log(`     Status: ${acc.connection_status}`);
      console.log('');
    });
  }
}

checkLinkedInAccounts().catch(console.error);
