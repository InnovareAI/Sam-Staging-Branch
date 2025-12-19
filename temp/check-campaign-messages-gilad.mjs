import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function checkCampaignMessages() {
  // Check campaign_messages table for Gilad
  const { data: messages } = await supabase
    .from('campaign_messages')
    .select('*')
    .ilike('recipient_name', '%gilad%')
    .order('sent_at', { ascending: false });

  console.log('=== CAMPAIGN_MESSAGES FOR GILAD ===');
  console.log('Total:', messages?.length || 0);

  messages?.forEach(m => {
    console.log('\nMessage:');
    console.log('  ID:', m.id);
    console.log('  Campaign:', m.campaign_id);
    console.log('  Sent:', m.sent_at);
    console.log('  Content:', m.message_content.substring(0, 80) + '...');
    console.log('  Variant:', m.message_template_variant);
    console.log('  Platform Message ID:', m.platform_message_id);
  });

  // Check for duplicates by content
  if (messages && messages.length > 1) {
    console.log('\n=== CHECKING FOR DUPLICATE CONTENT ===');
    const grouped = {};
    messages.forEach(m => {
      const key = m.message_content;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    });

    Object.values(grouped).forEach(group => {
      if (group.length > 1) {
        console.log('\nDUPLICATE CONTENT FOUND:');
        console.log('Count:', group.length);
        group.forEach(m => console.log('  -', m.sent_at, m.platform_message_id));
      }
    });
  }
}

checkCampaignMessages().catch(console.error);
