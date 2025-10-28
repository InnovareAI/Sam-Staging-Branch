import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Resetting failed prospects...');

const { data: failed } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name')
  .eq('status', 'failed')
  .not('first_name', 'is', null)
  .not('last_name', 'is', null);

console.log('Found', failed?.length || 0, 'failed prospects with names');

for (const p of failed || []) {
  await supabase
    .from('campaign_prospects')
    .update({ status: 'pending', error_message: null })
    .eq('id', p.id);
  console.log('Reset:', p.first_name, p.last_name);
}

console.log('Done');
