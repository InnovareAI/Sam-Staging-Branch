import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Checking campaign progress...\n');

// Get test campaign
const { data: campaign } = await supabase
  .from('campaigns')
  .select('id, name, status')
  .ilike('name', '%test 11%')
  .single();

if (!campaign) {
  console.log('Campaign not found');
  process.exit(1);
}

console.log('Campaign:', campaign.name);
console.log('Status:', campaign.status);
console.log('');

// Get all prospects
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, contacted_at')
  .eq('campaign_id', campaign.id)
  .order('contacted_at', { ascending: false });

console.log('Prospects:');
for (const p of prospects || []) {
  const name = p.first_name + ' ' + p.last_name;
  const time = p.contacted_at ? new Date(p.contacted_at).toLocaleTimeString() : 'Not sent yet';
  console.log('  -', name, '-', p.status, '(' + time + ')');
}

// Count by status
const pending = prospects?.filter(p => p.status === 'pending' || p.status === 'approved').length || 0;
const sent = prospects?.filter(p => p.status === 'connection_requested').length || 0;

console.log('');
console.log('Summary:');
console.log('  Total:', prospects?.length || 0);
console.log('  Sent:', sent);
console.log('  Pending:', pending);

if (pending > 0) {
  console.log('');
  console.log('Next message will be sent within 2 minutes (automatic cron)');
}
