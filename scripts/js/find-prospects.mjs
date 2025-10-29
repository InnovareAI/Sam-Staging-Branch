#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: user } = await supabase
  .from('users')
  .select('*')
  .eq('email', 'tl@innovareai.com')
  .single();

console.log('🔍 FINDING YOUR PROSPECTS\n');

// Check prospect_approval_data
const { data: allProspects } = await supabase
  .from('prospect_approval_data')
  .select('*')
  .eq('workspace_id', user.current_workspace_id)
  .order('created_at', { ascending: false })
  .limit(20);

console.log(`Total prospects in approval data: ${allProspects?.length || 0}\n`);

if (allProspects && allProspects.length > 0) {
  const byStatus = {};
  allProspects.forEach(p => {
    byStatus[p.approval_status] = (byStatus[p.approval_status] || 0) + 1;
  });
  
  console.log('Breakdown by status:');
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  
  console.log('\nLatest 8 prospects:');
  allProspects.slice(0, 8).forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} - ${p.approval_status}`);
    console.log(`   LinkedIn: ${p.contact?.linkedin_url || p.linkedin_url || 'N/A'}`);
  });
}

// Check recent approval sessions
const { data: sessions } = await supabase
  .from('prospect_approval_sessions')
  .select('*')
  .eq('workspace_id', user.current_workspace_id)
  .order('created_at', { ascending: false })
  .limit(5);

console.log(`\n📋 Recent approval sessions: ${sessions?.length || 0}`);
if (sessions && sessions.length > 0) {
  sessions.forEach(s => {
    console.log(`\nSession: ${s.campaign_name || s.campaign_tag}`);
    console.log(`  Total: ${s.total_count}, Approved: ${s.approved_count}, Rejected: ${s.rejected_count}`);
    console.log(`  Created: ${new Date(s.created_at).toLocaleString()}`);
  });
}
