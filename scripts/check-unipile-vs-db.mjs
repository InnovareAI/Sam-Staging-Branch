import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function compareAccounts() {
  const userEmail = 'tl@innovareai.com';

  console.log(`\n🔍 Comparing Unipile accounts vs Database for ${userEmail}...\n`);

  // Get user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === userEmail);

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log(`👤 User: ${user.email} (${user.id})\n`);

  // Get accounts from Unipile
  const unipileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/accounts`;
  const unipileResponse = await fetch(unipileUrl, {
    headers: {
      'X-API-KEY': process.env.UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  });

  const unipileData = await unipileResponse.json();
  const linkedInAccounts = unipileData.items?.filter(a => a.type === 'LINKEDIN') || [];

  console.log(`📊 UNIPILE LinkedIn Accounts (${linkedInAccounts.length} total):\n`);
  linkedInAccounts.forEach(acc => {
    console.log(`   ${acc.name || 'Unknown'}`);
    console.log(`   ID: ${acc.id}`);
    console.log(`   Email: ${acc.connection_params?.im?.email || 'N/A'}`);
    console.log(`   Features: ${acc.connection_params?.im?.premiumFeatures?.join(', ') || 'none'}`);
    console.log('');
  });

  // Get accounts from database
  const { data: dbAccounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
    .eq('account_type', 'linkedin');

  console.log(`📋 DATABASE LinkedIn Accounts (${dbAccounts?.length || 0} total):\n`);
  if (dbAccounts && dbAccounts.length > 0) {
    dbAccounts.forEach(acc => {
      console.log(`   ${acc.account_name}`);
      console.log(`   Unipile ID: ${acc.unipile_account_id}`);
      console.log(`   User ID: ${acc.user_id}`);
      console.log(`   Status: ${acc.connection_status}`);
      console.log('');
    });
  } else {
    console.log('   ❌ No accounts in database');
  }

  // Compare
  console.log(`\n🔄 COMPARISON:\n`);

  const unipileIds = new Set(linkedInAccounts.map(a => a.id));
  const dbIds = new Set(dbAccounts?.map(a => a.unipile_account_id) || []);

  // In Unipile but not in DB
  const missingInDb = linkedInAccounts.filter(a => !dbIds.has(a.id));
  if (missingInDb.length > 0) {
    console.log('⚠️  Accounts in Unipile but MISSING from database:');
    missingInDb.forEach(acc => {
      console.log(`   - ${acc.name} (${acc.id})`);
    });
    console.log('');
  }

  // In DB but not in Unipile
  const missingInUnipile = dbAccounts?.filter(a => !unipileIds.has(a.unipile_account_id)) || [];
  if (missingInUnipile.length > 0) {
    console.log('⚠️  Accounts in database but MISSING from Unipile (disconnected):');
    missingInUnipile.forEach(acc => {
      console.log(`   - ${acc.account_name} (${acc.unipile_account_id})`);
    });
    console.log('');
  }

  if (missingInDb.length === 0 && missingInUnipile.length === 0) {
    console.log('✅ All accounts are in sync!');
  }
}

compareAccounts();
