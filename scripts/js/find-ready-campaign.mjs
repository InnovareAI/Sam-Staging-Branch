import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Finding campaigns ready to activate...\n');

const { data: campaigns } = await supabase
  .from('campaigns')
  .select('*')
  .order('created_at', { ascending: false });

for (const camp of campaigns || []) {
  console.log('Campaign:', camp.name);
  console.log('  Status:', camp.status);
  console.log('  Has message:', camp.connection_message ? 'YES' : 'NO');
  
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, status')
    .eq('campaign_id', camp.id)
    .in('status', ['pending', 'approved']);
  
  console.log('  Pending prospects:', prospects?.length || 0);
  
  if (camp.connection_message && prospects && prospects.length > 0) {
    console.log('  ✅ READY TO ACTIVATE');
  } else if (!camp.connection_message) {
    console.log('  ❌ Missing message template');
  } else if (!prospects || prospects.length === 0) {
    console.log('  ❌ No pending prospects');
  }
  console.log('');
}
