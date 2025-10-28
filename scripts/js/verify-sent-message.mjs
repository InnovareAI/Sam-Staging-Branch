import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Verifying most recently sent message...\n');

// Get the most recent connection request
const { data: recent } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_url, status, contacted_at, campaigns(name)')
  .eq('status', 'connection_requested')
  .order('contacted_at', { ascending: false })
  .limit(3);

console.log('Most recent connection requests:\n');

for (const p of recent || []) {
  console.log('Campaign:', p.campaigns?.name);
  console.log('  Prospect:', p.first_name, p.last_name);
  console.log('  LinkedIn:', p.linkedin_url);
  console.log('  Sent at:', p.contacted_at);
  console.log('  Status:', p.status);
  console.log('');
}

if (recent && recent.length > 0) {
  const latest = recent[0];
  if (latest.first_name && latest.last_name) {
    console.log('✅ SUCCESS: Message sent with proper name!');
    console.log('✅ Name used:', latest.first_name, latest.last_name);
  } else {
    console.log('⚠️  WARNING: Message sent but missing name!');
  }
}
