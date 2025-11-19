#!/usr/bin/env node

/**
 * Send connection requests DIRECTLY to Unipile (bypass N8N timeout)
 * This sends CRs immediately, N8N will handle follow-ups when accepted
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861'; // IA4
const UNIPILE_ACCOUNT_ID = '4nt1J-blSnGUPBjH2Nfjpg'; // Charissa

const CAMPAIGNS = [
  { name: '20251117-IA4-Outreach Campaign', id: '683f9214-8a3f-4015-98fe-aa3ae76a9ebe' },
  { name: 'Cha Canada Campaign', id: '35415fff-a230-48c6-ae91-e8f170cd3232' },
  { name: 'SAM Startup Canada', id: '3326aa89-9220-4bef-a1db-9c54f14fc536' }
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendCR(prospect, message) {
  // Extract LinkedIn username from URL
  const linkedinUsername = prospect.linkedin_url
    ? prospect.linkedin_url.split('/in/')[1]?.replace(/\/$/, '')
    : null;

  if (!linkedinUsername) {
    throw new Error(`Invalid LinkedIn URL: ${prospect.linkedin_url}`);
  }

  // Personalize message
  const personalizedMessage = message
    .replace(/\{\{first_name\}\}/g, prospect.first_name)
    .replace(/\{\{last_name\}\}/g, prospect.last_name)
    .replace(/\{\{company_name\}\}/g, prospect.company_name || '')
    .replace(/\{\{title\}\}/g, prospect.title || '');

  // Send directly to Unipile
  const response = await fetch(`https://${process.env.UNIPILE_DSN}/api/v1/users/invite`, {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.UNIPILE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      account_id: UNIPILE_ACCOUNT_ID,
      identifier: linkedinUsername,
      message: personalizedMessage
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Unipile error (${response.status}): ${error}`);
  }

  return await response.json();
}

async function executeCampaign(campaign) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Campaign: ${campaign.name}`);
  console.log(`${'='.repeat(60)}\n`);

  // Get campaign message
  const { data: campaignData, error: campaignError } = await supabase
    .from('campaigns')
    .select('message_templates')
    .eq('id', campaign.id)
    .single();

  if (campaignError) {
    console.error(`❌ Failed to fetch campaign:`, campaignError.message);
    return;
  }

  const message = campaignData.message_templates?.connection_request;
  if (!message) {
    console.error(`❌ No connection_request message`);
    return;
  }

  console.log(`📝 Message template: ${message.substring(0, 60)}...\n`);

  // Get pending prospects
  const { data: prospects, error: prospectsError } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url, company_name, title')
    .eq('campaign_id', campaign.id)
    .eq('status', 'pending')
    .order('created_at');

  if (prospectsError) {
    console.error(`❌ Failed to fetch prospects:`, prospectsError.message);
    return;
  }

  if (!prospects || prospects.length === 0) {
    console.log(`⚠️  No pending prospects\n`);
    return;
  }

  console.log(`📊 Found ${prospects.length} pending prospects\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < prospects.length; i++) {
    const prospect = prospects[i];
    console.log(`[${i + 1}/${prospects.length}] ${prospect.first_name} ${prospect.last_name}`);

    try {
      const result = await sendCR(prospect, message);
      console.log(`   ✅ Sent (invitation_id: ${result.invitation_id || 'N/A'})`);

      // Update status to connection_request_sent
      await supabase
        .from('campaign_prospects')
        .update({
          status: 'connection_request_sent',
          contacted_at: new Date().toISOString()
        })
        .eq('id', prospect.id);

      successCount++;

      // Wait 3-5 seconds between requests (human-like)
      if (i < prospects.length - 1) {
        const delay = 3000 + Math.random() * 2000; // 3-5 seconds
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      failCount++;

      // Wait 10 seconds on error before retrying next
      if (i < prospects.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Campaign Complete`);
  console.log(`   Success: ${successCount}/${prospects.length}`);
  console.log(`   Failed: ${failCount}/${prospects.length}`);
  console.log(`${'='.repeat(60)}\n`);

  // Update campaign status
  await supabase
    .from('campaigns')
    .update({
      status: 'active',
      last_executed_at: new Date().toISOString()
    })
    .eq('id', campaign.id);
}

console.log('🎯 Sending Connection Requests via Direct Unipile\n');
console.log(`   Workspace: IA4`);
console.log(`   Account: Charissa Saniel (${UNIPILE_ACCOUNT_ID})`);
console.log(`   Campaigns: ${CAMPAIGNS.length}\n`);

for (const campaign of CAMPAIGNS) {
  await executeCampaign(campaign);
}

console.log('\n🎉 All campaigns executed!');
console.log('Follow-ups will be handled by N8N when prospects accept.\n');
