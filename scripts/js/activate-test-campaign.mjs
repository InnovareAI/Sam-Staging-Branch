import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Activating test campaign...\n');

const { data: campaign } = await supabase
  .from('campaigns')
  .select('id, name, status')
  .ilike('name', '%test 11%')
  .single();

console.log('Campaign:', campaign.name);
console.log('Current status:', campaign.status);

const { error } = await supabase
  .from('campaigns')
  .update({ status: 'active' })
  .eq('id', campaign.id);

if (error) {
  console.log('ERROR:', error.message);
} else {
  console.log('New status: active');
  console.log('');
  console.log('Remaining 2 prospects will be sent automatically within 2 minutes');
}
