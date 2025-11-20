import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixWorkspaceMembers() {
  console.log('🔧 Fixing workspace members...\n');

  // Get all workspaces that have campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('workspace_id, created_by')
    .eq('status', 'active')
    .not('created_by', 'is', null);

  const workspaceUsers = new Map();
  campaigns?.forEach(c => {
    if (!workspaceUsers.has(c.workspace_id)) {
      workspaceUsers.set(c.workspace_id, c.created_by);
    }
  });

  console.log(`📊 Found ${workspaceUsers.size} workspaces with active campaigns\n`);

  // Check each workspace for missing members
  for (const [workspaceId, userId] of workspaceUsers) {
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, role')
      .eq('workspace_id', workspaceId);

    if (!members || members.length === 0) {
      console.log(`⚠️  Workspace ${workspaceId} has no members`);
      console.log(`   Adding user ${userId} as owner...`);

      const { data, error } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          role: 'owner',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error(`   ❌ Error:`, error.message);
      } else {
        console.log(`   ✅ Added successfully`);
      }
    } else {
      const hasOwner = members.some(m => m.role === 'owner');
      if (!hasOwner) {
        console.log(`⚠️  Workspace ${workspaceId} has members but no owner`);
        console.log(`   Promoting user ${userId} to owner...`);

        const { error } = await supabase
          .from('workspace_members')
          .update({ role: 'owner' })
          .eq('workspace_id', workspaceId)
          .eq('user_id', userId);

        if (error) {
          console.error(`   ❌ Error:`, error.message);
        } else {
          console.log(`   ✅ Promoted successfully`);
        }
      } else {
        console.log(`✅ Workspace ${workspaceId} has owner`);
      }
    }
  }

  console.log('\n✅ Workspace members fixed');
}

fixWorkspaceMembers().catch(console.error);
