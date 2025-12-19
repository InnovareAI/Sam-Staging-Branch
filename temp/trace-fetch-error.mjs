#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://latxadqrvrrrcvkktrog.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(supabaseUrl, supabaseKey);

// Get one failed item with full details
const { data: failedItems } = await supabase
  .from('send_queue')
  .select('*, campaigns!inner(linkedin_account_id)')
  .eq('status', 'failed')
  .eq('error_message', 'fetch failed')
  .order('updated_at', { ascending: false })
  .limit(1);

if (!failedItems || failedItems.length === 0) {
  console.log('No failed items with "fetch failed" error');
  process.exit(0);
}

const item = failedItems[0];
console.log('Failed item details:');
console.log(JSON.stringify(item, null, 2));

// Get the campaign's account details
const { data: account } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('id', item.campaigns.linkedin_account_id)
  .single();

console.log('\nAccount details:');
console.log(JSON.stringify(account, null, 2));

// Try to reproduce the error by making the same Unipile API call
const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_BASE_URL = `https://${UNIPILE_DSN}`;

if (!account) {
  console.log('\n❌ Account not found in workspace_accounts');
  
  // Try user_unipile_accounts
  const { data: unipileAccount } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('id', item.campaigns.linkedin_account_id)
    .single();
  
  console.log('\nTrying user_unipile_accounts:');
  console.log(JSON.stringify(unipileAccount, null, 2));
}

