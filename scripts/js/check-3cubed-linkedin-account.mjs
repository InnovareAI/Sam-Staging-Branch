import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const workspaceId = 'ecb08e55-2b7e-4d49-8f50-d38e39ce2482'; // 3cubed

console.log('🔍 Checking LinkedIn accounts for 3cubed workspace...\n');

const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', workspaceId)
  .eq('account_type', 'linkedin');

console.log(`LinkedIn accounts found: ${accounts?.length || 0}\n`);

if (!accounts || accounts.length === 0) {
  console.log('❌ NO LINKEDIN ACCOUNTS FOUND');
  console.log('\nThis workspace has no LinkedIn accounts configured.');
  console.log('User needs to connect a LinkedIn account via Unipile.\n');
  process.exit(1);
}

for (const acc of accounts) {
  console.log('Account Details:');
  console.log(`  ID: ${acc.id}`);
  console.log(`  User ID: ${acc.user_id}`);
  console.log(`  Connection Status: ${acc.connection_status}`);
  console.log(`  Unipile Account ID: ${acc.unipile_account_id || 'NOT SET'}`);
  console.log(`  Is Active: ${acc.is_active}`);
  console.log(`  Last Synced: ${acc.last_synced || 'Never'}`);
  console.log(`  Created: ${new Date(acc.created_at).toLocaleString()}`);
  console.log('');
}

// Check for active connected accounts
const { data: connected } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', workspaceId)
  .eq('account_type', 'linkedin')
  .eq('connection_status', 'connected')
  .eq('is_active', true);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (!connected || connected.length === 0) {
  console.log('❌ NO ACTIVE CONNECTED LINKEDIN ACCOUNT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('This is why the cron job is failing/timing out!');
  console.log('\nThe execute-live route requires an active LinkedIn account.');
  console.log('When no account is found, it likely hangs or times out.\n');
  console.log('📋 Required Actions:');
  console.log('  1. User (ny@3cubed.ai) needs to log into app.meet-sam.com');
  console.log('  2. Go to Workspace Settings → Integrations');
  console.log('  3. Connect LinkedIn account via Unipile');
  console.log('  4. Verify connection_status becomes "connected"\n');
} else {
  console.log('✅ ACTIVE LINKEDIN ACCOUNT FOUND');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('LinkedIn account is connected and active.');
  console.log('The cron timeout issue must be caused by something else.\n');
}
