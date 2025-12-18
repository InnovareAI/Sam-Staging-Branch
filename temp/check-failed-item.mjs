import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function check() {
  // Get one failed item and check if prospect has linkedin_user_id
  const { data: failed } = await supabase
    .from('send_queue')
    .select('id, prospect_id, linkedin_user_id, error_message, updated_at')
    .eq('status', 'failed')
    .ilike('linkedin_user_id', '%linkedin.com%')
    .limit(3);

  if (!failed || failed.length === 0) {
    console.log('No URL failures found');
    return;
  }

  for (const f of failed) {
    console.log('Queue item:');
    console.log('  ID:', f.id);
    console.log('  LinkedIn ID:', f.linkedin_user_id);
    console.log('  Error:', f.error_message?.substring(0, 80));
    console.log('  Updated:', f.updated_at);

    const { data: prospect } = await supabase
      .from('campaign_prospects')
      .select('linkedin_user_id, linkedin_url, first_name, last_name')
      .eq('id', f.prospect_id)
      .single();

    console.log('  Prospect:', prospect?.first_name, prospect?.last_name);
    console.log('    linkedin_user_id:', prospect?.linkedin_user_id);
    console.log('    linkedin_url:', prospect?.linkedin_url);
    console.log('');
  }
}

check().catch(console.error);
