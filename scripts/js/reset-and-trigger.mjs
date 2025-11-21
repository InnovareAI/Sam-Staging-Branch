/**
 * Reset prospects to pending and trigger campaign
 */

import { Inngest } from 'inngest';
import { createClient } from '@supabase/supabase-js';

const inngest = new Inngest({
  id: 'sam-ai',
  eventKey: process.env.INNGEST_EVENT_KEY
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CAMPAIGN_ID = '5bb3ac9c-eac3-475b-b2a5-5f939edace34';
const WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';

console.log('🔄 Resetting prospects to pending...');

// Reset all "processing" prospects back to "pending"
await supabase
  .from('campaign_prospects')
  .update({ status: 'pending' })
  .eq('campaign_id', CAMPAIGN_ID)
  .eq('status', 'processing');

console.log('✅ Prospects reset');

// Now fetch and trigger
console.log('\n📤 Fetching campaign data...');

const { data: campaign } = await supabase
  .from('campaigns')
  .select(`
    *,
    linkedin_account:workspace_accounts!linkedin_account_id (
      id,
      account_name,
      unipile_account_id,
      is_active
    )
  `)
  .eq('id', CAMPAIGN_ID)
  .single();

const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, email, company_name, title, linkedin_url, linkedin_user_id, status')
  .eq('campaign_id', CAMPAIGN_ID);

const pendingProspects = (prospects || []).filter(
  (p) => ['pending', 'approved'].includes(p.status) && p.linkedin_url
);

console.log(`📋 Found ${pendingProspects.length} prospects ready to contact`);

// Update to processing
await supabase
  .from('campaign_prospects')
  .update({ status: 'processing' })
  .in('id', pendingProspects.map(p => p.id));

const eventData = {
  campaignId: CAMPAIGN_ID,
  workspaceId: WORKSPACE_ID,
  accountId: campaign.linkedin_account.unipile_account_id,
  prospects: pendingProspects.map((p) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    company_name: p.company_name,
    title: p.title,
    linkedin_url: p.linkedin_url,
    linkedin_user_id: p.linkedin_user_id
  })),
  messages: {
    connection_request: campaign.message_templates?.connection_request || '',
    follow_up_messages: campaign.message_templates?.follow_up_messages || []
  },
  settings: campaign.schedule_settings || {
    timezone: 'America/Los_Angeles',
    working_hours_start: 5,
    working_hours_end: 18,
    skip_weekends: true,
    skip_holidays: true
  }
};

console.log('\n📤 Triggering Inngest...');

const result = await inngest.send({
  name: 'campaign/connector/execute',
  data: eventData
});

console.log('\n✅ Event sent:', result.ids);
console.log('\n📊 Dashboard: https://app.inngest.com/env/production/runs');
