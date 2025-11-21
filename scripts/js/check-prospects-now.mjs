import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', '02c9d97e-ae70-4be1-bc1a-9b086a767d56');

if (error) {
  console.log('Error:', error.message);
} else if (!data || data.length === 0) {
  console.log('NO PROSPECTS FOUND');
} else {
  console.log('Found', data.length, 'prospects:');
  data.forEach(p => {
    console.log('  ', p.first_name, p.last_name, ':', p.status);
  });
}
