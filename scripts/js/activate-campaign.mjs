import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Activating most recent campaign...\n');

// Get most recent campaign
const { data: recent } = await supabase
  .from('campaigns')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

console.log('Campaign:', recent.name);
console.log('Current status:', recent.status);

// Check if has message template
if (!recent.connection_message && !recent.alternative_message) {
  console.log('\nWARNING: This campaign has NO message template!');
  console.log('Cannot activate without a message.\n');
  process.exit(1);
}

// Check if has prospects
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id')
  .eq('campaign_id', recent.id)
  .in('status', ['pending', 'approved'])
  .limit(1);

if (!prospects || prospects.length === 0) {
  console.log('\nWARNING: This campaign has NO pending prospects!');
  console.log('Nothing to send.\n');
}

// Activate it
const { error } = await supabase
  .from('campaigns')
  .update({ status: 'active' })
  .eq('id', recent.id);

if (error) {
  console.log('ERROR:', error.message);
} else {
  console.log('\nActivated:', recent.name);
  console.log('Status: active');
}
