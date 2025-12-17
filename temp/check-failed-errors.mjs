import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function check() {
  const { data: failed } = await supabase
    .from('send_queue')
    .select('id, linkedin_user_id, error_message, campaign_id')
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(5);

  console.log('=== FAILED ITEMS WITH FULL ERROR ===');
  if (failed && failed.length > 0) {
    for (const f of failed) {
      console.log('---');
      console.log('ID:', f.id.substring(0,8));
      console.log('linkedin_user_id:', f.linkedin_user_id);
      console.log('Full error:', f.error_message);
    }
  } else {
    console.log('No failed items found');
  }
}

check().catch(console.error);
