#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get campaign (most recent)
const { data: campaigns, error: campError } = await supabase
  .from('campaigns')
  .select('id, name, workspace_id, created_at')
  .eq('name', '20251029-IAI-test 12')
  .order('created_at', { ascending: false })
  .limit(1);

const campaign = campaigns?.[0];

if (campError) {
  console.error('❌ Campaign error:', campError.message);
  process.exit(1);
}

console.log('✅ Campaign found:', campaign);

// Check for LinkedIn account
const { data: accounts, error: accError } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', campaign.workspace_id)
  .eq('provider', 'linkedin');

console.log('\n📊 All LinkedIn accounts for workspace:', accounts);

const activeAccounts = accounts?.filter(a => a.is_active);
console.log('\n✅ Active LinkedIn accounts:', activeAccounts?.length || 0);

if (!activeAccounts || activeAccounts.length === 0) {
  console.log('\n❌ NO ACTIVE LINKEDIN ACCOUNT FOUND');
  console.log('This is why the polling endpoint returns no prospects!');
  console.log('\nThe campaign needs an active LinkedIn account to send messages.');
} else {
  console.log('\n✅ LinkedIn account available:', activeAccounts[0].unipile_account_id);
}
