#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fixWorkspace() {
  const { data: user } = await supabase
    .from('users')
    .select('id, email, current_workspace_id')
    .eq('email', 'tl@innovareai.com')
    .single();
  
  console.log(`\n🔧 Fixing workspace for: ${user.email}`);
  console.log(`   Target workspace: ${user.current_workspace_id}`);
  
  // Update all LinkedIn accounts to use current workspace
  const { data, error } = await supabase
    .from('workspace_accounts')
    .update({ workspace_id: user.current_workspace_id })
    .eq('user_id', user.id)
    .eq('account_type', 'linkedin')
    .select();
  
  if (error) {
    console.error('❌ Failed to update:', error);
    return;
  }
  
  console.log(`\n✅ Successfully updated ${data.length} account(s)`);
  data.forEach(acc => {
    console.log(`   - ${acc.unipile_account_id} (${acc.account_name})`);
  });
  
  console.log('\n🎉 Done! Now refresh your proxy modal and it should work!');
}

fixWorkspace().catch(console.error);
