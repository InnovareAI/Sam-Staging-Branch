#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listCampaigns() {
  console.log('📋 ALL CAMPAIGNS\n');
  console.log('='.repeat(80));

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, created_at, workspaces(name)')
    .order('created_at', { ascending: false })
    .limit(20);

  for (const campaign of campaigns) {
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('id, status, linkedin_url, contacted_at')
      .eq('campaign_id', campaign.id);

    const ready = prospects?.filter(p => 
      !p.contacted_at && 
      p.linkedin_url && 
      ['pending', 'approved', 'ready_to_message'].includes(p.status)
    ).length || 0;

    const queued = prospects?.filter(p => p.status === 'queued_in_n8n').length || 0;
    const contacted = prospects?.filter(p => p.contacted_at).length || 0;

    console.log(`\n📌 ${campaign.name}`);
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Workspace: ${campaign.workspaces?.name || 'Unknown'}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Created: ${new Date(campaign.created_at).toLocaleDateString()} ${new Date(campaign.created_at).toLocaleTimeString()}`);
    console.log(`   Prospects: ${prospects?.length || 0} total | ${ready} ready | ${queued} queued | ${contacted} contacted`);
    
    if (ready > 0) {
      console.log(`   ✅ READY FOR EXECUTION`);
    }
  }

  console.log('\n' + '='.repeat(80));
  
  // Show campaigns with prospects ready
  const readyCampaigns = [];
  for (const campaign of campaigns) {
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('id, status, linkedin_url, contacted_at')
      .eq('campaign_id', campaign.id);

    const ready = prospects?.filter(p => 
      !p.contacted_at && 
      p.linkedin_url && 
      ['pending', 'approved', 'ready_to_message'].includes(p.status)
    ).length || 0;

    if (ready > 0) {
      readyCampaigns.push({ name: campaign.name, id: campaign.id, ready });
    }
  }

  if (readyCampaigns.length > 0) {
    console.log('\n✅ CAMPAIGNS READY FOR EXECUTION:');
    console.log('-'.repeat(80));
    readyCampaigns.forEach(c => {
      console.log(`\n   ${c.name}`);
      console.log(`   ID: ${c.id}`);
      console.log(`   Ready prospects: ${c.ready}`);
    });
  } else {
    console.log('\n⚠️  No campaigns have prospects ready for execution');
  }

  console.log('\n' + '='.repeat(80));
}

listCampaigns().catch(console.error);
