#!/usr/bin/env node

/**
 * Execute campaigns via Netlify API - ONE PROSPECT AT A TIME
 * Avoids N8N webhook timeout by using the API route that worked for Armin
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const API_URL = 'https://app.meet-sam.com/api/campaigns/linkedin/execute-via-n8n';

const CAMPAIGNS = [
  { name: '20251117-IA4-Outreach Campaign', id: '683f9214-8a3f-4015-98fe-aa3ae76a9ebe' },
  { name: 'Cha Canada Campaign', id: '35415fff-a230-48c6-ae91-e8f170cd3232' },
  { name: 'SAM Startup Canada', id: '3326aa89-9220-4bef-a1db-9c54f14fc536' }
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function executeCampaign(campaign) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 ${campaign.name}`);
  console.log(`${'='.repeat(60)}\n`);

  // Get pending prospects
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name')
    .eq('campaign_id', campaign.id)
    .eq('status', 'pending')
    .order('created_at');

  if (error) {
    console.error(`❌ Error:`, error.message);
    return;
  }

  if (!prospects || prospects.length === 0) {
    console.log(`⚠️  No pending prospects\n`);
    return;
  }

  console.log(`📊 Total: ${prospects.length} prospects\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < prospects.length; i++) {
    const prospect = prospects[i];
    console.log(`[${i + 1}/${prospects.length}] ${prospect.first_name} ${prospect.last_name}`);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          prospectIds: [prospect.id]  // ONE prospect at a time
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      const result = await response.json();
      console.log(`   ✅ Success`);
      successCount++;

      // Wait 10 seconds before next request
      if (i < prospects.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      failCount++;

      // Wait 15 seconds on error
      if (i < prospects.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Complete: ${successCount}/${prospects.length} sent`);
  if (failCount > 0) console.log(`⚠️  Failed: ${failCount}`);
  console.log(`${'='.repeat(60)}\n`);
}

console.log('🎯 Executing Charissa\'s Campaigns (One-by-One)\n');

for (const campaign of CAMPAIGNS) {
  await executeCampaign(campaign);
}

console.log('\n🎉 All campaigns executed!');
console.log('Monitor at: https://app.meet-sam.com\n');
