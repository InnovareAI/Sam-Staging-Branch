#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const targetNames = ['Irish Maguad', 'Charissa Saniel', 'Michelle Gestuveo', 'Jennifer Fleming'];

console.log('📊 IA TEAM CAMPAIGN STATUS CHECK');
console.log('='.repeat(70));

for (const name of targetNames) {
  console.log('\n' + '─'.repeat(70));
  console.log(`👤 ${name}`);
  console.log('─'.repeat(70));

  // Get workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('name', name)
    .single();

  if (!workspace) {
    console.log('   ⚠️  Workspace not found');
    continue;
  }

  // Get campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false });

  if (!campaigns || campaigns.length === 0) {
    console.log('   No campaigns');
    continue;
  }

  for (const campaign of campaigns) {
    // Get prospect breakdown
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('status')
      .eq('campaign_id', campaign.id);

    const byStatus = {};
    prospects?.forEach(p => {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    });

    // Get queue status
    const { data: queue } = await supabase
      .from('send_queue')
      .select('status')
      .eq('campaign_id', campaign.id);

    const qByStatus = {};
    queue?.forEach(q => {
      qByStatus[q.status] = (qByStatus[q.status] || 0) + 1;
    });

    console.log(`\n   📋 ${campaign.name}`);
    console.log(`      Campaign Status: ${campaign.status}`);
    console.log(`      Prospects: ${prospects?.length || 0}`);

    if (Object.keys(byStatus).length > 0) {
      Object.entries(byStatus).forEach(([status, count]) => {
        const emoji = status === 'replied' ? '✅' :
                      status === 'connected' ? '🤝' :
                      status === 'connection_request_sent' ? '📤' :
                      status === 'failed' ? '❌' : '•';
        console.log(`         ${emoji} ${status}: ${count}`);
      });
    }

    if (Object.keys(qByStatus).length > 0) {
      console.log(`      Queue:`);
      Object.entries(qByStatus).forEach(([status, count]) => {
        console.log(`         • ${status}: ${count}`);
      });
    }
  }
}

console.log('\n' + '='.repeat(70));
