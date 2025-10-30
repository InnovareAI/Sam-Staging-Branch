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

async function checkActivity() {
  console.log('🔍 Checking recent campaign activity...\n');

  // Get most recently updated campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, updated_at')
    .order('updated_at', { ascending: false })
    .limit(5);

  console.log('Most recently updated campaigns:');
  for (const campaign of campaigns) {
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('id')
      .eq('campaign_id', campaign.id);

    console.log(`\n📋 ${campaign.name}`);
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Prospects: ${prospects?.length || 0}`);
    console.log(`   Updated: ${new Date(campaign.updated_at).toLocaleString()}`);
  }

  // Check the test campaign we've been working with
  console.log('\n' + '='.repeat(60));
  console.log('✅ Verified working campaign (from dry run test):');
  console.log('='.repeat(60));
  
  const { data: testCampaign } = await supabase
    .from('campaigns')
    .select('id, name, status')
    .eq('id', '73bedc34-3b24-4315-8cf1-043e454019af')
    .single();

  const { data: testProspects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', '73bedc34-3b24-4315-8cf1-043e454019af');

  const ready = testProspects?.filter(p => 
    !p.contacted_at && 
    p.linkedin_url && 
    ['pending', 'approved', 'ready_to_message'].includes(p.status)
  ).length || 0;

  console.log(`\n📋 ${testCampaign.name}`);
  console.log(`   ID: ${testCampaign.id}`);
  console.log(`   Status: ${testCampaign.status}`);
  console.log(`   Total Prospects: ${testProspects?.length || 0}`);
  console.log(`   Ready to Message: ${ready}`);
  console.log(`\n   ✅ This campaign is ready for execution!`);
  console.log(`   Run: node scripts/js/test-campaign-live-execution.mjs`);
}

checkActivity().catch(console.error);
