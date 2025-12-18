import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://latxadqrvrrrcvkktrog.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ');

async function checkRemaining() {
  console.log('REMAINING FAILED ITEMS ANALYSIS\n');

  // Group by error message
  const { data: failed } = await supabase
    .from('send_queue')
    .select('id, campaign_id, error_message, linkedin_user_id')
    .eq('status', 'failed');

  console.log('Total failed:', failed?.length || 0);

  // Group by error type
  const byError = {};
  const byCampaign = {};

  for (const item of (failed || [])) {
    const error = item.error_message || 'No error message';
    byError[error] = (byError[error] || 0) + 1;
    byCampaign[item.campaign_id] = (byCampaign[item.campaign_id] || 0) + 1;
  }

  console.log('\nBy error type:');
  for (const [err, count] of Object.entries(byError).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count}x: ${err.substring(0, 100)}`);
  }

  console.log('\nBy campaign:');
  const campaignIds = Object.keys(byCampaign);
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, campaign_name, name')
    .in('id', campaignIds);

  for (const [cid, count] of Object.entries(byCampaign).sort((a, b) => b[1] - a[1])) {
    const camp = campaigns?.find(c => c.id === cid);
    console.log(`  ${count}x: ${camp?.campaign_name || camp?.name || cid}`);
  }

  // Show first 5 errors with full details
  console.log('\n\nSAMPLE ERRORS:');
  const sample = (failed || []).slice(0, 5);
  for (const item of sample) {
    console.log('\n---');
    console.log('Error:', item.error_message);
    console.log('LinkedIn User ID:', item.linkedin_user_id);
  }
}

checkRemaining().catch(console.error);
