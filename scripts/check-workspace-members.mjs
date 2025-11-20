import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWorkspaceMembers() {
  console.log('🔍 Checking workspace members for Michelle and Charissa workspaces...\n');

  // Get Michelle's workspace
  const { data: michelleWorkspace } = await supabase
    .from('workspace_accounts')
    .select('workspace_id, account_name')
    .ilike('account_name', '%michelle%')
    .single();

  if (michelleWorkspace) {
    console.log(`📧 Michelle's Workspace: ${michelleWorkspace.workspace_id}\n`);

    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, role, users(email)')
      .eq('workspace_id', michelleWorkspace.workspace_id);

    console.log('Members:');
    members?.forEach(m => {
      console.log(`  - ${m.users?.email || 'Unknown'}`);
      console.log(`    Role: ${m.role}`);
      console.log(`    User ID: ${m.user_id}`);
    });
  }

  // Get campaigns for this workspace
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, created_by')
    .eq('workspace_id', michelleWorkspace.workspace_id);

  console.log(`\n📊 Campaigns (${campaigns?.length || 0}):`);
  campaigns?.forEach(c => {
    console.log(`  - ${c.name}`);
    console.log(`    Status: ${c.status}`);
    console.log(`    Created By: ${c.created_by}`);
  });
}

checkWorkspaceMembers().catch(console.error);
