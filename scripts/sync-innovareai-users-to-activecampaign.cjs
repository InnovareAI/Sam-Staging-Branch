#!/usr/bin/env node

/**
 * Sync InnovareAI Users to ActiveCampaign
 * Only syncs users from workspaces with tenant = 'innovareai'
 */

require('dotenv').config({ path: '.env.local', override: true });
const { createClient } = require('@supabase/supabase-js');

async function syncInnovareAIUsers() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  console.log('🔄 Syncing InnovareAI users to ActiveCampaign...\n');

  // Get all InnovareAI workspaces
  const { data: innovareWorkspaces, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, name, tenant')
    .eq('tenant', 'innovareai');

  if (workspaceError || !innovareWorkspaces) {
    console.error('❌ Error fetching workspaces:', workspaceError);
    return;
  }

  console.log(`📋 Found ${innovareWorkspaces.length} InnovareAI workspaces:\n`);
  innovareWorkspaces.forEach(ws => {
    console.log(`   - ${ws.name} (${ws.id})`);
  });
  console.log('');

  const workspaceIds = innovareWorkspaces.map(w => w.id);

  // Get all users in InnovareAI workspaces
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, current_workspace_id')
    .in('current_workspace_id', workspaceIds);

  if (usersError || !users) {
    console.error('❌ Error fetching users:', usersError);
    return;
  }

  console.log(`👥 Found ${users.length} InnovareAI users to sync:\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const user of users) {
    console.log(`📧 Syncing: ${user.email}`);

    try {
      const response = await fetch('http://localhost:3000/api/activecampaign/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      const result = await response.json();

      if (result.success) {
        console.log(`   ✅ Synced to ActiveCampaign`);
        successCount++;
      } else if (result.skipped) {
        console.log(`   ⚠️  Skipped: ${result.reason}`);
        skipCount++;
      } else {
        console.log(`   ❌ Error: ${result.error}`);
        errorCount++;
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
      errorCount++;
    }

    console.log('');
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('📊 SYNC SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  console.log(`✅ Successfully synced: ${successCount}`);
  console.log(`⚠️  Skipped: ${skipCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📧 Total users processed: ${users.length}`);
  console.log('');
}

syncInnovareAIUsers().then(() => process.exit(0));
