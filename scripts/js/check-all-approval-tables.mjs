#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking ALL approval-related tables\n');

// Get workspace from latest campaign
const { data: campaign } = await supabase
  .from('campaigns')
  .select('workspace_id')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

const workspaceId = campaign.workspace_id;

// Check prospect_approval_data
console.log('📊 Table: prospect_approval_data');
const { data: approvalData, count: count1 } = await supabase
  .from('prospect_approval_data')
  .select('id, name, created_at', { count: 'exact' })
  .eq('workspace_id', workspaceId)
  .order('created_at', { ascending: false })
  .limit(3);

console.log(`   Count: ${count1 || 0}`);
approvalData?.forEach(p => console.log(`   - ${p.name} (${p.created_at})`));

// Check prospect_approval_sessions
console.log('\n📊 Table: prospect_approval_sessions');
const { data: sessions, count: count2 } = await supabase
  .from('prospect_approval_sessions')
  .select('id, campaign_name, status, created_at', { count: 'exact' })
  .eq('workspace_id', workspaceId)
  .order('created_at', { ascending: false })
  .limit(3);

console.log(`   Count: ${count2 || 0}`);
sessions?.forEach(s => console.log(`   - ${s.campaign_name} [${s.status}] (${s.created_at})`));

// Check campaign_prospects with pending status
console.log('\n📊 Table: campaign_prospects (pending/approved)');
const { data: pendingProspects, count: count3 } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, campaign_id', { count: 'exact' })
  .eq('workspace_id', workspaceId)
  .in('status', ['pending', 'approved'])
  .order('created_at', { ascending: false })
  .limit(3);

console.log(`   Count: ${count3 || 0}`);
pendingProspects?.forEach(p => console.log(`   - ${p.first_name} ${p.last_name} [${p.status}]`));

console.log('\n💡 Where did you approve them?');
console.log('   - In SAM approval flow?');
console.log('   - In Campaign Hub?');
console.log('   - Via LinkedIn search results?');
