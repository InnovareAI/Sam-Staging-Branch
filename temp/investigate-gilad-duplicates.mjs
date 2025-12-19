import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function investigate() {
  // Find messenger campaigns with Gilad
  const { data: gilad } = await supabase
    .from('campaign_prospects')
    .select('id, campaign_id, first_name, last_name, linkedin_url, status, created_at')
    .ilike('first_name', '%gilad%')
    .order('created_at', { ascending: false });

  console.log('=== GILAD PROSPECTS ===');
  console.log(JSON.stringify(gilad, null, 2));

  if (gilad && gilad.length > 0) {
    // Check send_queue for these prospects
    const prospectIds = gilad.map(g => g.id);
    const { data: queueEntries } = await supabase
      .from('send_queue')
      .select('*')
      .in('prospect_id', prospectIds)
      .order('created_at', { ascending: false })
      .limit(30);

    console.log('\n=== SEND_QUEUE FOR GILAD (LAST 30) ===');
    console.log(JSON.stringify(queueEntries, null, 2));

    // Check for duplicates with same message content
    if (queueEntries && queueEntries.length > 1) {
      const grouped = {};
      queueEntries.forEach(e => {
        const key = `${e.campaign_id}|${e.prospect_id}|${e.message_type}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(e);
      });

      console.log('\n=== GROUPED BY CAMPAIGN/PROSPECT/TYPE ===');
      Object.entries(grouped).forEach(([key, entries]) => {
        if (entries.length > 1) {
          console.log('\nDUPLICATE:', key);
          console.log('Count:', entries.length);
          entries.forEach(e => {
            console.log(`  - ID: ${e.id}, Status: ${e.status}, Created: ${e.created_at}, Sent: ${e.sent_at}`);
          });
        }
      });
    }

    // Also check for the TechStars message
    const techstarsMessages = queueEntries?.filter(e =>
      e.message && e.message.toLowerCase().includes('techstars')
    );

    if (techstarsMessages && techstarsMessages.length > 0) {
      console.log('\n=== TECHSTARS MESSAGES ===');
      console.log(`Found ${techstarsMessages.length} messages containing "techstars"`);
      techstarsMessages.forEach(m => {
        console.log(`\nID: ${m.id}`);
        console.log(`Campaign: ${m.campaign_id}`);
        console.log(`Status: ${m.status}`);
        console.log(`Created: ${m.created_at}`);
        console.log(`Sent: ${m.sent_at}`);
        console.log(`Message preview: ${m.message.substring(0, 100)}...`);
      });
    }
  }
}

investigate().catch(console.error);
