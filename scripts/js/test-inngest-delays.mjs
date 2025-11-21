#!/usr/bin/env node
/**
 * TEST: Verify Inngest delay fix works correctly
 * Tests with 2 prospects before full rollout
 */

import { Inngest } from 'inngest';
import { createClient } from '@supabase/supabase-js';

const inngest = new Inngest({
  id: "sam-ai",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧪 TESTING INNGEST DELAY FIX...\n');

// Get 2 test prospects
const { data: testProspects } = await supabase
  .from('campaign_prospects')
  .select('*, campaigns!inner(id, workspace_id, linkedin_account_id, message_templates)')
  .eq('status', 'pending')
  .limit(2);

if (!testProspects || testProspects.length === 0) {
  console.log('❌ No test prospects found');
  process.exit(1);
}

const campaign = testProspects[0].campaigns;

console.log(`✅ Found ${testProspects.length} test prospects`);
console.log(`📋 Campaign: ${campaign.id}`);
console.log('\n🚀 Triggering test campaign...\n');

const result = await inngest.send({
  name: 'campaign/connector/execute',
  data: {
    campaignId: campaign.id,
    workspaceId: campaign.workspace_id,
    accountId: campaign.linkedin_account_id,
    prospects: testProspects.map(p => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      company_name: p.company_name,
      title: p.title,
      linkedin_url: p.linkedin_url
    })),
    messages: campaign.message_templates,
    settings: {
      timezone: 'America/Los_Angeles',
      working_hours_start: 5,
      working_hours_end: 18,
      skip_weekends: true,
      skip_holidays: true
    }
  }
});

console.log(`✅ Test triggered: ${result.ids[0]}`);
console.log('\n⏱️  Expected behavior:');
console.log('- Delay 1: 30-180 seconds');
console.log('- Delay 2: 30-180 seconds');
console.log('- Total: ~1-6 minutes for 2 prospects');
console.log('\n📊 Check Inngest dashboard:');
console.log(`https://app.inngest.com/env/production/runs/${result.ids[0]}`);
console.log('\n⏰ Check back in 5 minutes - both CRs should be sent');
