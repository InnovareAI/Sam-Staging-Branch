import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Debugging why test 11 campaign is not being processed...\n');

// Get the campaign
const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .ilike('name', '%test 11%')
  .single();

console.log('Campaign Details:');
console.log('  Name:', campaign.name);
console.log('  Status:', campaign.status);
console.log('  Workspace ID:', campaign.workspace_id);
console.log('  Has connection_message:', campaign.connection_message ? 'YES' : 'NO');
console.log('  Has alternative_message:', campaign.alternative_message ? 'YES' : 'NO');
console.log('');

// Check if has pending prospects
const { data: pending } = await supabase
  .from('campaign_prospects')
  .select('id, status')
  .eq('campaign_id', campaign.id)
  .in('status', ['pending', 'approved', 'ready_to_message']);

console.log('Prospects:');
console.log('  Pending:', pending?.length || 0);

// Check what the cron sees
console.log('\nWhy cron might not pick it up:');

if (campaign.status !== 'active') {
  console.log('  ❌ Status is', campaign.status, '(needs to be "active")');
}

if (!campaign.connection_message && !campaign.alternative_message) {
  console.log('  ❌ No message template configured');
}

if (!pending || pending.length === 0) {
  console.log('  ❌ No pending prospects to send');
}

if (campaign.status === 'active' && (campaign.connection_message || campaign.alternative_message) && pending && pending.length > 0) {
  console.log('  ✅ All conditions met - should be processed');
}
