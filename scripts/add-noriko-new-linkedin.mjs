#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addNewLinkedInAccount() {
  const newAccountId = 'lN6tdIWOStK_dEaxhygCEQ';
  const oldAccountId = 'aJcX-idiQryacq2zOrDs9g';
  const userId = '567ba664-812c-4bed-8c2f-96113b99f899'; // ny@3cubed.ai
  const workspaceId = 'ecb08e55-2b7e-4d49-8f50-d38e39ce2482'; // 3cubed
  
  console.log('🔧 Adding new LinkedIn account for Noriko...\n');

  // First, delete the old account record
  const { error: deleteError } = await supabase
    .from('workspace_accounts')
    .delete()
    .eq('unipile_account_id', oldAccountId);

  if (deleteError) {
    console.log('⚠️  Could not delete old account:', deleteError.message);
  } else {
    console.log('✅ Deleted old LinkedIn account:', oldAccountId);
  }

  // Add the new account
  const { data, error } = await supabase
    .from('workspace_accounts')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      unipile_account_id: newAccountId,
      account_type: 'linkedin',
      account_name: 'Noriko Yokoi, Ph.D.',
      account_identifier: 'ny@3cubed.ai',
      connection_status: 'connected',
      connected_at: new Date().toISOString()
    })
    .select();

  if (error) {
    console.error('\n❌ Failed to add account:', error);
    return;
  }

  console.log('\n✅ New LinkedIn account added successfully!');
  console.log('   Account ID:', newAccountId);
  console.log('   User: ny@3cubed.ai');
  console.log('   Workspace: 3cubed');
  console.log('\n🎉 Noriko can now use LinkedIn search!');
}

addNewLinkedInAccount().catch(console.error);
