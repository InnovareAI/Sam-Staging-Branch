#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteWorkspaces() {
  const workspacesToDelete = [
    'ffed2d0f-a5a7-4d46-b221-b673a412bf44', // #8 tl@innovareai.com's Workspace
    'c50b7f04-65ac-464f-a1c2-822ea7feea29'  // #2 Chillmine (duplicate)
  ];

  console.log('🗑️  Deleting workspaces...\n');

  for (const workspaceId of workspacesToDelete) {
    // Get workspace info first
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single();

    if (!workspace) {
      console.log(`❌ Workspace ${workspaceId} not found\n`);
      continue;
    }

    console.log(`📁 Deleting: ${workspace.name} (${workspaceId})`);

    // Delete workspace (cascade should handle related records)
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspaceId);

    if (error) {
      console.error(`   ❌ Failed: ${error.message}\n`);
    } else {
      console.log(`   ✅ Deleted successfully\n`);
    }
  }

  console.log('✅ Cleanup complete!');
}

deleteWorkspaces().catch(console.error);
