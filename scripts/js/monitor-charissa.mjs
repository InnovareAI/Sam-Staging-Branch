import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CAMPAIGN_ID = '5bb3ac9c-eac3-475b-b2a5-5f939edace34';

for (let i = 1; i <= 6; i++) {
  console.log(`\n=== Check ${i} (${i * 10} seconds) ===`);

  const { data } = await supabase
    .from('campaign_prospects')
    .select('first_name, status, sent_at')
    .eq('campaign_id', CAMPAIGN_ID)
    .order('updated_at', { ascending: false })
    .limit(5);

  console.table(data);

  if (i < 6) {
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}
