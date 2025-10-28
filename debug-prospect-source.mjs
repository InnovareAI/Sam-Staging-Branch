import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get the latest campaign
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name')
  .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
  .order('created_at', { ascending: false })
  .limit(1);

const campaign = campaigns[0];
console.log(`Campaign: ${campaign.name}\n`);

// Get ONE prospect with full data
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', campaign.id)
  .limit(1);

const p = prospects[0];
console.log('FULL PROSPECT DATA:');
console.log(JSON.stringify(p, null, 2));
