#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧪 Testing /api/prospect-approval/approved logic\n');

// Get workspace
const { data: user } = await supabase
  .from('users')
  .select('id, current_workspace_id')
  .eq('email', 'tl@innovareai.com')
  .single();

const workspaceId = user.current_workspace_id;
console.log(`Workspace: ${workspaceId}\n`);

// Step 1: Get sessions for workspace
const { data: sessions } = await supabase
  .from('prospect_approval_sessions')
  .select('id, campaign_name, workspace_id')
  .eq('workspace_id', workspaceId);

console.log(`✅ Found ${sessions?.length || 0} sessions for workspace:`);
sessions?.forEach((s, i) => {
  console.log(`   ${i + 1}. ${s.campaign_name} (${s.id.substring(0, 8)}...)`);
});

const sessionIds = (sessions || []).map(s => s.id);

// Step 2: Get approved prospects in those sessions
const { data: approvedData, error } = await supabase
  .from('prospect_approval_data')
  .select(`
    *,
    prospect_approval_sessions(
      workspace_id,
      campaign_name,
      campaign_tag,
      prospect_source
    )
  `)
  .in('session_id', sessionIds)
  .eq('approval_status', 'approved')
  .order('created_at', { ascending: false });

console.log(`\n📊 Approved prospects query:`);
console.log(`   Session IDs: ${sessionIds.length}`);
console.log(`   Results: ${approvedData?.length || 0}`);
console.log(`   Error: ${error ? JSON.stringify(error) : 'none'}\n`);

if (approvedData && approvedData.length > 0) {
  console.log('✅ Found approved prospects:');
  approvedData.forEach((p, i) => {
    console.log(`\n${i + 1}. ${p.name}`);
    console.log(`   prospect_id: ${p.prospect_id}`);
    console.log(`   session: ${p.prospect_approval_sessions?.campaign_name}`);
    console.log(`   contact.linkedin_url: ${p.contact?.linkedin_url}`);
  });
} else {
  console.log('❌ NO approved prospects found\n');

  // Debug: Check without approved filter
  const { data: allProspects } = await supabase
    .from('prospect_approval_data')
    .select('name, approval_status, session_id')
    .in('session_id', sessionIds)
    .limit(10);

  console.log('🔍 All prospects (any status):');
  allProspects?.forEach((p) => {
    console.log(`   - ${p.name}: ${p.approval_status} (session: ${p.session_id.substring(0, 8)}...)`);
  });
}
