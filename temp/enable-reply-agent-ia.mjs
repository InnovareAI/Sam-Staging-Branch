#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 ENABLING REPLY AGENT FOR IA TEAM');
console.log('='.repeat(70));

// Get workspace IDs for these users
const targetNames = ['Irish Maguad', 'Charissa Saniel', 'Michelle Gestuveo', 'Jennifer Fleming'];

const { data: workspaces } = await supabase
  .from('workspaces')
  .select('id, name')
  .in('name', targetNames);

console.log('\nWorkspaces to enable:');
for (const ws of workspaces || []) {
  console.log(`   - ${ws.name} (${ws.id})`);
}

const workspaceIds = workspaces?.map(w => w.id) || [];

// Enable Reply Agent for these workspaces
const { data: updated, error } = await supabase
  .from('workspace_reply_agent_config')
  .update({
    enabled: true,
    updated_at: new Date().toISOString()
  })
  .in('workspace_id', workspaceIds)
  .select('workspace_id');

if (error) {
  console.error('❌ Error:', error);
} else {
  console.log(`\n✅ Enabled Reply Agent for ${updated?.length || 0} workspaces`);
}

// Verify final state
const { data: finalConfigs } = await supabase
  .from('workspace_reply_agent_config')
  .select('workspace_id, enabled, workspaces!inner(name)')
  .order('enabled', { ascending: false });

console.log('\n📊 FINAL REPLY AGENT STATUS:');
for (const config of finalConfigs || []) {
  const status = config.enabled ? '✅ ENABLED' : '❌ DISABLED';
  console.log(`   ${status} - ${config.workspaces?.name}`);
}

console.log('\n' + '='.repeat(70));
