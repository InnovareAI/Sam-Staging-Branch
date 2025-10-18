#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkStatus() {
  const { data: user } = await supabase
    .from('users')
    .select('id, current_workspace_id')
    .eq('email', 'tl@innovareai.com')
    .single();
  
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('workspace_id', user.current_workspace_id)
    .eq('account_type', 'linkedin');
  
  console.log('\nLinkedIn accounts:');
  accounts?.forEach(acc => {
    console.log(`- ${acc.unipile_account_id}`);
    console.log(`  Name: ${acc.account_name}`);
    console.log(`  Email: ${acc.account_identifier}`);
    console.log(`  Status: "${acc.connection_status}"`);
    console.log(`  Workspace: ${acc.workspace_id}`);
    console.log('');
  });
}

checkStatus().catch(console.error);
