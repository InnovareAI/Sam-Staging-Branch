import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function investigate() {
  // 1. Find ALL Gilad prospects across all campaigns
  const { data: giladProspects } = await supabase
    .from('campaign_prospects')
    .select('id, campaign_id, first_name, last_name, linkedin_url, status, created_at')
    .ilike('last_name', '%mor%hayim%')
    .order('created_at', { ascending: false });

  console.log('=== ALL GILAD PROSPECTS ===');
  console.log(JSON.stringify(giladProspects, null, 2));

  if (!giladProspects || giladProspects.length === 0) return;

  // 2. Get campaigns for these prospects
  const campaignIds = [...new Set(giladProspects.map(p => p.campaign_id))];
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, campaign_name, campaign_type, status, created_at')
    .in('id', campaignIds);

  console.log('\n=== CAMPAIGNS WITH GILAD ===');
  console.log(JSON.stringify(campaigns, null, 2));

  // 3. Get ALL send_queue entries for Gilad (across all campaigns)
  const prospectIds = giladProspects.map(p => p.id);
  const { data: allQueueEntries } = await supabase
    .from('send_queue')
    .select('*')
    .in('prospect_id', prospectIds)
    .order('created_at', { ascending: false });

  console.log('\n=== ALL SEND_QUEUE ENTRIES FOR GILAD ===');
  console.log(`Total: ${allQueueEntries?.length || 0}`);
  allQueueEntries?.forEach(e => {
    const campaign = campaigns?.find(c => c.id === e.campaign_id);
    console.log(`\nCampaign: ${campaign?.name || campaign?.campaign_name || e.campaign_id}`);
    console.log(`  Queue ID: ${e.id.substring(0, 8)}`);
    console.log(`  Type: ${e.message_type}`);
    console.log(`  Status: ${e.status}`);
    console.log(`  Created: ${e.created_at}`);
    console.log(`  Scheduled: ${e.scheduled_for}`);
    console.log(`  Sent: ${e.sent_at}`);
    console.log(`  Message: ${e.message.substring(0, 80)}...`);
  });

  // 4. Check for Friday sends (Dec 13 = last Friday)
  const fridayStart = new Date('2025-12-13T00:00:00Z');
  const fridayEnd = new Date('2025-12-14T00:00:00Z');

  const fridaySends = allQueueEntries?.filter(e => {
    if (!e.sent_at) return false;
    const sentDate = new Date(e.sent_at);
    return sentDate >= fridayStart && sentDate < fridayEnd;
  });

  console.log('\n=== FRIDAY SENDS (Dec 13) ===');
  console.log(`Count: ${fridaySends?.length || 0}`);
  fridaySends?.forEach(e => {
    console.log(`  - Queue ID: ${e.id}, Campaign: ${e.campaign_id}, Sent: ${e.sent_at}`);
  });

  // 5. Check for this Friday (Dec 20)
  const thisFridayStart = new Date('2025-12-20T00:00:00Z');
  const thisFridayEnd = new Date('2025-12-21T00:00:00Z');

  const thisFridaySends = allQueueEntries?.filter(e => {
    if (!e.sent_at) return false;
    const sentDate = new Date(e.sent_at);
    return sentDate >= thisFridayStart && sentDate < thisFridayEnd;
  });

  console.log('\n=== THIS FRIDAY SENDS (Dec 20) ===');
  console.log(`Count: ${thisFridaySends?.length || 0}`);

  // 6. Check for RECENT sends (last 3 days)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const recentSends = allQueueEntries?.filter(e => {
    if (!e.sent_at) return false;
    const sentDate = new Date(e.sent_at);
    return sentDate >= threeDaysAgo;
  });

  console.log('\n=== RECENT SENDS (LAST 3 DAYS) ===');
  console.log(`Count: ${recentSends?.length || 0}`);
  recentSends?.forEach(e => {
    const campaign = campaigns?.find(c => c.id === e.campaign_id);
    console.log(`  - Sent: ${e.sent_at}`);
    console.log(`    Campaign: ${campaign?.name || campaign?.campaign_name}`);
    console.log(`    Message: ${e.message.substring(0, 60)}...`);
  });
}

investigate().catch(console.error);
