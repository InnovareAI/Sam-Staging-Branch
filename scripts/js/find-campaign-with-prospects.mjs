#!/usr/bin/env node
/**
 * Find campaigns with prospects ready for messaging
 */

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

async function findCampaigns() {
  console.log('🔍 Scanning all campaigns for prospects...\n');

  // Get all campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id, status')
    .order('created_at', { ascending: false })
    .limit(20);

  for (const campaign of campaigns) {
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, status, linkedin_url, contacted_at')
      .eq('campaign_id', campaign.id);

    if (!prospects || prospects.length === 0) continue;

    const ready = prospects.filter(p =>
      !p.contacted_at &&
      p.linkedin_url &&
      ['pending', 'approved', 'ready_to_message'].includes(p.status)
    );

    console.log(`📋 ${campaign.name}`);
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Prospects: ${prospects.length} total, ${ready.length} ready`);

    if (ready.length > 0) {
      console.log(`   ✅ READY FOR EXECUTION`);
      console.log(`\n   Test command:`);
      console.log(`   curl -X POST http://localhost:3000/api/campaigns/linkedin/execute-live \\`);
      console.log(`     -H "Content-Type: application/json" \\`);
      console.log(`     -H "Cookie: $(cat .test-cookie)" \\`);
      console.log(`     -d '{"campaignId": "${campaign.id}", "maxProspects": 1, "dryRun": true}'`);
      console.log();
    } else {
      console.log(`   ⚠️  No prospects ready`);
    }
    console.log();
  }
}

findCampaigns().catch(console.error);
