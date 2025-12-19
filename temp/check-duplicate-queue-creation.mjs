import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function investigate() {
  // 1. Check campaign c243c82d-12fc-4b49-b5b2-c52a77708bf1 details
  const campaignId = 'c243c82d-12fc-4b49-b5b2-c52a77708bf1';

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  console.log('=== CAMPAIGN DETAILS ===');
  console.log(JSON.stringify(campaign, null, 2));

  // 2. Get ALL prospects for this campaign
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  console.log('\n=== CAMPAIGN PROSPECTS ===');
  console.log(`Total: ${prospects?.length || 0}`);
  prospects?.slice(0, 10).forEach(p => {
    console.log(`  - ${p.first_name} ${p.last_name}: ${p.status} (${p.created_at})`);
  });

  // 3. Get ALL send_queue entries for this campaign
  const { data: queueEntries } = await supabase
    .from('send_queue')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  console.log('\n=== SEND_QUEUE ENTRIES ===');
  console.log(`Total: ${queueEntries?.length || 0}`);

  // Group by prospect_id to find duplicates
  const byProspect = {};
  queueEntries?.forEach(e => {
    const key = e.prospect_id;
    if (!byProspect[key]) byProspect[key] = [];
    byProspect[key].push(e);
  });

  console.log('\n=== DUPLICATES BY PROSPECT ===');
  let duplicateCount = 0;
  Object.entries(byProspect).forEach(([prospectId, entries]) => {
    // Group by message_type within each prospect
    const byMessageType = {};
    entries.forEach(e => {
      const msgType = e.message_type || 'null';
      if (!byMessageType[msgType]) byMessageType[msgType] = [];
      byMessageType[msgType].push(e);
    });

    // Check for duplicates of same message type
    Object.entries(byMessageType).forEach(([msgType, msgs]) => {
      if (msgs.length > 1) {
        duplicateCount++;
        const prospect = prospects?.find(p => p.id === prospectId);
        console.log(`\nDUPLICATE: ${prospect?.first_name} ${prospect?.last_name} (${prospectId})`);
        console.log(`Message Type: ${msgType}`);
        console.log(`Count: ${msgs.length}`);
        msgs.forEach(m => {
          console.log(`  - ID: ${m.id.substring(0, 8)}, Status: ${m.status}, Created: ${m.created_at}, Sent: ${m.sent_at}`);
        });
      }
    });
  });

  if (duplicateCount === 0) {
    console.log('No duplicates found in send_queue for this campaign');
  }

  // 4. Check for specific issue: same prospect_id + message_type with different IDs
  console.log('\n=== CHECKING FOR QUEUE CREATION RACE CONDITIONS ===');
  const duplicateKeys = new Set();
  const seen = new Set();

  queueEntries?.forEach(e => {
    const key = `${e.prospect_id}|${e.message_type || 'null'}`;
    if (seen.has(key)) {
      duplicateKeys.add(key);
    }
    seen.add(key);
  });

  if (duplicateKeys.size > 0) {
    console.log(`Found ${duplicateKeys.size} prospect+message_type combinations with duplicates`);
    duplicateKeys.forEach(key => console.log(`  - ${key}`));
  } else {
    console.log('No duplicate prospect+message_type combinations found');
  }
}

investigate().catch(console.error);
