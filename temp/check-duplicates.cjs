const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function checkActivity() {
  const campaignId = 'c243c82d-12fc-4b49-b5b2-c52a77708bf1';

  // Check linkedin_messages
  const { data: messages } = await supabase
    .from('linkedin_messages')
    .select('id, prospect_id, content, sent_at, created_at')
    .eq('campaign_id', campaignId)
    .eq('direction', 'outgoing')
    .order('created_at', { ascending: true });

  console.log('=== LINKEDIN_MESSAGES TABLE ===');
  console.log('Total outgoing messages:', messages?.length || 0);

  if (messages && messages.length > 0) {
    const byProspect = {};
    messages.forEach(msg => {
      const key = msg.prospect_id;
      if (!byProspect[key]) {
        byProspect[key] = [];
      }
      byProspect[key].push(msg);
    });

    console.log('\n=== DUPLICATES IN linkedin_messages ===');
    let duplicatesFound = false;
    Object.entries(byProspect).forEach(([prospectId, msgs]) => {
      if (msgs.length > 1) {
        duplicatesFound = true;
        console.log(`\nProspect ${prospectId}: ${msgs.length} messages`);
        msgs.forEach(m => {
          console.log(`  - ID: ${m.id} | Sent: ${m.sent_at} | Created: ${m.created_at}`);
          console.log(`    Content: ${m.content.substring(0, 80)}...`);
        });
      }
    });

    if (!duplicatesFound) {
      console.log('No duplicates found');
    }
  }

  // Check campaign_messages
  const { data: campaignMessages } = await supabase
    .from('campaign_messages')
    .select('id, prospect_id, message_content, sent_at, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true });

  console.log('\n=== CAMPAIGN_MESSAGES TABLE ===');
  console.log('Total messages:', campaignMessages?.length || 0);

  if (campaignMessages && campaignMessages.length > 0) {
    const byProspect2 = {};
    campaignMessages.forEach(msg => {
      const key = msg.prospect_id;
      if (!byProspect2[key]) {
        byProspect2[key] = [];
      }
      byProspect2[key].push(msg);
    });

    console.log('\n=== DUPLICATES IN campaign_messages ===');
    let duplicatesFound2 = false;
    Object.entries(byProspect2).forEach(([prospectId, msgs]) => {
      if (msgs.length > 1) {
        duplicatesFound2 = true;
        console.log(`\nProspect ${prospectId}: ${msgs.length} messages`);
        msgs.forEach(m => {
          console.log(`  - ID: ${m.id} | Sent: ${m.sent_at} | Created: ${m.created_at}`);
        });
      }
    });

    if (!duplicatesFound2) {
      console.log('No duplicates found');
    }
  }
}

checkActivity();
