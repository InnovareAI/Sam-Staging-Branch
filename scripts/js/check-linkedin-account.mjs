#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 CHECKING LINKEDIN ACCOUNT CONNECTION\n');

// Get user
const { data: user } = await supabase
  .from('users')
  .select('id, current_workspace_id, email')
  .eq('email', 'tl@innovareai.com')
  .single();

console.log(`User: ${user.email}`);
console.log(`ID: ${user.id}`);
console.log(`Workspace: ${user.current_workspace_id}\n`);

// Get ALL workspace accounts
const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', user.current_workspace_id);

console.log(`📊 Found ${accounts?.length || 0} workspace accounts:\n`);

accounts?.forEach((acc, i) => {
  console.log(`${i + 1}. ${acc.account_name || 'Unnamed'}`);
  console.log(`   Type: ${acc.account_type}`);
  console.log(`   User ID: ${acc.user_id}`);
  console.log(`   Status: ${acc.connection_status}`);
  console.log(`   Unipile ID: ${acc.unipile_account_id || 'N/A'}`);
  console.log(`   Is yours: ${acc.user_id === user.id ? '✅ YES' : '❌ NO'}\n`);
});

// Check specifically for LinkedIn
const { data: linkedInAccounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', user.current_workspace_id)
  .eq('account_type', 'linkedin');

console.log(`\n🔗 LinkedIn accounts: ${linkedInAccounts?.length || 0}`);
linkedInAccounts?.forEach((acc) => {
  console.log(`   - ${acc.account_name}: ${acc.connection_status}`);
  console.log(`     User: ${acc.user_id === user.id ? 'YOU' : acc.user_id}`);
  console.log(`     Unipile: ${acc.unipile_account_id || 'MISSING'}`);
});

// Check latest campaign
const { data: campaign } = await supabase
  .from('campaigns')
  .select('id, name, created_by, workspace_id')
  .eq('workspace_id', user.current_workspace_id)
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

console.log(`\n📋 Latest campaign: ${campaign.name}`);
console.log(`   Created by: ${campaign.created_by}`);
console.log(`   Is yours: ${campaign.created_by === user.id ? '✅ YES' : '❌ NO'}\n`);

// Check if campaign creator has LinkedIn
const { data: creatorLinkedIn } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', campaign.workspace_id)
  .eq('user_id', campaign.created_by)
  .eq('account_type', 'linkedin')
  .eq('connection_status', 'connected')
  .single();

if (creatorLinkedIn) {
  console.log('✅ Campaign creator HAS connected LinkedIn:');
  console.log(`   Account: ${creatorLinkedIn.account_name}`);
  console.log(`   Unipile: ${creatorLinkedIn.unipile_account_id}`);
} else {
  console.log('❌ Campaign creator does NOT have connected LinkedIn');
  console.log('   → This is why execute-live fails!');
}
