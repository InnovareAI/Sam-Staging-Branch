#!/usr/bin/env node

require('dotenv').config({ path: '.env.local', override: true });
const { createClient } = require('@supabase/supabase-js');

const CUBED_WORKSPACES = [
  'ecb08e55-2b7e-4d49-8f50-d38e39ce2482', // 3cubed Workspace
  'b070d94f-11e2-41d4-a913-cc5a8c017208', // Sendingcell Workspace
  'edea7143-6987-458d-8dfe-7e3a6c7a4e6e'  // WT Matchmaker Workspace
];

async function update3cubedWorkspaces() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  console.log('🔄 Updating 3cubed.ai workspaces...\n');

  for (const workspaceId of CUBED_WORKSPACES) {
    const { data, error } = await supabase
      .from('workspaces')
      .update({ tenant: '3cubed' })
      .eq('id', workspaceId)
      .select('name, client_code, tenant');

    if (error) {
      console.error(`❌ Error updating ${workspaceId}:`, error);
    } else if (data && data.length > 0) {
      console.log(`✅ Updated: ${data[0].name} (${data[0].client_code}) → tenant: ${data[0].tenant}`);
    }
  }

  console.log('\n✅ All 3cubed.ai workspaces updated!\n');

  // Show final state
  const { data: allWorkspaces } = await supabase
    .from('workspaces')
    .select('name, client_code, tenant')
    .order('tenant', { ascending: true });

  console.log('📋 All workspaces by reseller:\n');

  const byReseller = allWorkspaces?.reduce((acc, ws) => {
    const reseller = ws.tenant || 'unassigned';
    if (!acc[reseller]) acc[reseller] = [];
    acc[reseller].push(ws);
    return acc;
  }, {});

  Object.entries(byReseller || {}).forEach(([reseller, workspaces]) => {
    console.log(`\n${reseller.toUpperCase()}:`);
    workspaces.forEach(ws => {
      console.log(`  - ${ws.name} (${ws.client_code})`);
    });
  });

  console.log('');
}

update3cubedWorkspaces().then(() => process.exit(0));
