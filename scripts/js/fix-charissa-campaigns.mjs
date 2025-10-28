import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Revert 3cubed campaigns back
const threeQubedCampaigns = [
  'a656e16b-13c5-4899-814f-2bdbfa11d92a',
  'b93a0ecd-f64b-43f0-a723-316d5d45da4f',
  '51803ded-bbc9-4564-aefb-c6d11d69f17c'
];

console.log('🔄 Reverting 3cubed campaigns back to inactive...\n');
for (const id of threeQubedCampaigns) {
  await supabase.from('campaigns').update({ status: 'inactive' }).eq('id', id);
  console.log(`✅ Reverted ${id}`);
}

console.log('\n🔍 Finding Charissa/Innovare campaigns with pending prospects...\n');

// Get Innovare workspace
const { data: workspace } = await supabase
  .from('workspaces')
  .select('id, name')
  .ilike('name', '%innovare%')
  .single();

console.log(`Workspace: ${workspace.name} (${workspace.id})\n`);

// Get pending prospects in Innovare workspace
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, status, created_at')
  .eq('workspace_id', workspace.id)
  .order('created_at', { ascending: false });

console.log(`Total campaigns: ${campaigns?.length || 0}\n`);

for (const c of campaigns || []) {
  const { count } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', c.id)
    .in('status', ['pending', 'approved', 'ready_to_message'])
    .not('linkedin_url', 'is', null);

  if (count > 0) {
    console.log(`📊 ${c.name}`);
    console.log(`   ID: ${c.id}`);
    console.log(`   Status: ${c.status}`);
    console.log(`   Pending prospects: ${count}`);
    console.log(`   Created: ${new Date(c.created_at).toLocaleString()}`);
    console.log('');
  }
}
