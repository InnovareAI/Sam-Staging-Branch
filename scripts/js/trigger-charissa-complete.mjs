/**
 * Trigger Inngest Campaign with Complete Data
 *
 * This fetches all campaign data and sends it properly formatted to Inngest.
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

console.log('📤 Fetching campaign data...');

// 1. Get campaign with LinkedIn account
const { data: campaign, error: campaignError } = await supabase
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
  .eq('workspace_id', WORKSPACE_ID)
  .single();

if (campaignError || !campaign) {
  console.error('❌ Campaign not found:', campaignError);
  process.exit(1);
}

console.log('✅ Campaign found:', campaign.campaign_name);
console.log('   Account:', campaign.linkedin_account.account_name);

// 2. Get prospects
const { data: prospects, error: prospectsError } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, email, company_name, title, linkedin_url, linkedin_user_id, status')
  .eq('campaign_id', CAMPAIGN_ID);

if (prospectsError) {
  console.error('❌ Error fetching prospects:', prospectsError);
  process.exit(1);
}

// 3. Filter pending prospects
const pendingProspects = (prospects || []).filter(
  (p) => ['pending', 'approved'].includes(p.status) && p.linkedin_url
);

if (pendingProspects.length === 0) {
  console.log('⚠️  No prospects ready to contact');
  process.exit(0);
}

console.log(`📋 Found ${pendingProspects.length} prospects ready to contact`);
pendingProspects.forEach((p, i) => {
  console.log(`   ${i + 1}. ${p.first_name} ${p.last_name} (${p.status})`);
});

// 4. Update prospects to processing
const prospectIds = pendingProspects.map(p => p.id);
await supabase
  .from('campaign_prospects')
  .update({ status: 'processing' })
  .in('id', prospectIds);

console.log('✅ Updated prospects to "processing"');

// 5. Prepare event data
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
    connection_request: campaign.message_templates?.connection_request || campaign.connection_message || '',
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

console.log('\n📤 Triggering Inngest event...');
console.log('   Event name: campaign/connector/execute');

// 6. Send event to Inngest
const result = await inngest.send({
  name: 'campaign/connector/execute',
  data: eventData
});

console.log('\n✅ Event sent to Inngest:');
console.log('   Run IDs:', result.ids);
console.log('\n📊 Check Inngest dashboard for execution:');
console.log('   https://app.inngest.com/env/production/runs');
console.log('\n📈 Monitor database for status changes:');
console.log(`   PGPASSWORD='QFe75XZ2kqhy2AyH' psql -h db.latxadqrvrrrcvkktrog.supabase.co -p 5432 -U postgres -d postgres -c "SELECT first_name, last_name, status, sent_at FROM campaign_prospects WHERE campaign_id = '${CAMPAIGN_ID}' ORDER BY updated_at DESC LIMIT 10;"`);
