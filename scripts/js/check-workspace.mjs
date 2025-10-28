import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const searchTerm = process.argv[2] || 'blue label lab';

// Search for workspace
const { data: workspaces } = await supabase
  .from('workspaces')
  .select('*')
  .ilike('name', `%${searchTerm}%`);

if (!workspaces || workspaces.length === 0) {
  console.log(`❌ No workspace found matching "${searchTerm}"`);

  // Show all workspaces
  const { data: allWorkspaces } = await supabase
    .from('workspaces')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n📋 Recent workspaces:');
  allWorkspaces?.forEach(w => {
    console.log(`  - ${w.name} (ID: ${w.id})`);
  });
  process.exit(0);
}

const workspace = workspaces[0];
console.log('🏢 Workspace Details');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('ID:', workspace.id);
console.log('Name:', workspace.name);
console.log('Created:', new Date(workspace.created_at).toLocaleDateString());
console.log('Client Code:', workspace.client_code || 'Not set');
console.log('');

// Get campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, status, created_at')
  .eq('workspace_id', workspace.id)
  .order('created_at', { ascending: false })
  .limit(10);

console.log(`📊 Campaigns: ${campaigns?.length || 0}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (campaigns && campaigns.length > 0) {
  campaigns.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name}`);
    console.log(`   Status: ${c.status}`);
    console.log(`   Created: ${new Date(c.created_at).toLocaleDateString()}`);
    console.log('');
  });
} else {
  console.log('No campaigns found\n');
}

// Get campaign prospects count
for (const campaign of campaigns || []) {
  const { count } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id);

  if (count && count > 0) {
    console.log(`📋 ${campaign.name}: ${count} prospects`);
  }
}
console.log('');

// Get members
const { data: members } = await supabase
  .from('workspace_members')
  .select('role, users(email)')
  .eq('workspace_id', workspace.id);

console.log(`👥 Members: ${members?.length || 0}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
members?.forEach(m => {
  console.log(`  - ${m.users?.email || 'Unknown'} (${m.role})`);
});
