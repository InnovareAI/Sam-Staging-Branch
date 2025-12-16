#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// InnovareAI workspace ID (Thorsten Linz)
const INNOVARE_WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

console.log('🔧 DISABLING REPLY AGENT FOR NON-INNOVARE WORKSPACES');
console.log('='.repeat(70));

// 1. Check current Reply Agent config
const { data: allConfigs } = await supabase
  .from('workspace_reply_agent_config')
  .select('*, workspaces!inner(name)')
  .order('created_at', { ascending: false });

console.log('\n1️⃣ CURRENT REPLY AGENT CONFIGS:');
if (allConfigs && allConfigs.length > 0) {
  for (const config of allConfigs) {
    const isInnovare = config.workspace_id === INNOVARE_WORKSPACE_ID;
    console.log(`   ${config.workspaces?.name || config.workspace_id}`);
    console.log(`      Enabled: ${config.enabled} ${isInnovare ? '(INNOVARE - KEEP)' : ''}`);
  }
} else {
  console.log('   No configs found');
}

// 2. Disable Reply Agent for all non-InnovareAI workspaces
console.log('\n2️⃣ DISABLING FOR NON-INNOVARE WORKSPACES...');

const { data: updated, error: updateError } = await supabase
  .from('workspace_reply_agent_config')
  .update({
    enabled: false,
    updated_at: new Date().toISOString()
  })
  .neq('workspace_id', INNOVARE_WORKSPACE_ID)
  .select('workspace_id');

if (updateError) {
  console.error('   ❌ Error:', updateError);
} else {
  console.log(`   ✅ Disabled Reply Agent for ${updated?.length || 0} workspaces`);
}

// 3. Verify final state
const { data: finalConfigs } = await supabase
  .from('workspace_reply_agent_config')
  .select('workspace_id, enabled, workspaces!inner(name)')
  .order('created_at', { ascending: false });

console.log('\n3️⃣ FINAL REPLY AGENT STATUS:');
for (const config of finalConfigs || []) {
  const status = config.enabled ? '✅ ENABLED' : '❌ DISABLED';
  const isInnovare = config.workspace_id === INNOVARE_WORKSPACE_ID;
  console.log(`   ${status} - ${config.workspaces?.name} ${isInnovare ? '(INNOVARE)' : ''}`);
}

console.log('\n' + '='.repeat(70));
console.log('✅ Done! Reply Agent now only enabled for InnovareAI workspace');
