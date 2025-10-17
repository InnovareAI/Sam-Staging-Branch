#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setPrimaryLinkedIn() {
  const accountId = 'lN6tdIWOStK_dEaxhygCEQ';
  const userId = '567ba664-812c-4bed-8c2f-96113b99f899'; // ny@3cubed.ai
  
  console.log('🔧 Setting primary LinkedIn account for Noriko...\n');

  // Get workspace membership
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (memberError || !membership) {
    console.error('❌ Could not find workspace membership:', memberError);
    return;
  }

  console.log('✅ Found workspace membership:');
  console.log('   Workspace ID:', membership.workspace_id);
  console.log('   Current primary LinkedIn:', membership.linkedin_unipile_account_id || 'None');

  // Update to set new primary LinkedIn
  const { error: updateError } = await supabase
    .from('workspace_members')
    .update({
      linkedin_unipile_account_id: accountId
    })
    .eq('user_id', userId)
    .eq('workspace_id', membership.workspace_id);

  if (updateError) {
    console.error('\n❌ Failed to update:', updateError);
    return;
  }

  console.log('\n✅ Primary LinkedIn account updated successfully!');
  console.log('   Account ID:', accountId);
  console.log('\n🎉 Noriko can now use LinkedIn search!');
}

setPrimaryLinkedIn().catch(console.error);
