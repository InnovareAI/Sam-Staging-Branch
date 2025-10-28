import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔄 Fixing campaign names to use correct client codes...\n');

// Get 3cubed workspace campaigns
const cubed3Id = 'ecb08e55-2b7e-4d49-8f50-d38e39ce2482';

const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name')
  .eq('workspace_id', cubed3Id);

console.log(`Found ${campaigns?.length || 0} campaigns in 3cubed Workspace\n`);

for (const campaign of campaigns || []) {
  const oldName = campaign.name;
  const newName = oldName.replace('-3CU-', '-3AI-');

  if (oldName !== newName) {
    console.log('Updating:', oldName);
    console.log('      To:', newName);

    const { error } = await supabase
      .from('campaigns')
      .update({ name: newName })
      .eq('id', campaign.id);

    if (error) {
      console.log('❌ Error:', error.message);
    } else {
      console.log('✅ Updated successfully\n');
    }
  } else {
    console.log('✅ Already correct:', oldName, '\n');
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Verification - All campaigns by workspace:\n');

const { data: allWorkspaces } = await supabase
  .from('workspaces')
  .select('id, name, client_code')
  .order('name');

for (const ws of allWorkspaces || []) {
  const { data: wsCampaigns } = await supabase
    .from('campaigns')
    .select('name')
    .eq('workspace_id', ws.id);

  if (wsCampaigns && wsCampaigns.length > 0) {
    console.log(`${ws.name} (Client Code: ${ws.client_code}):`);
    for (const c of wsCampaigns) {
      const nameCode = c.name.split('-')[1];
      const isCorrect = nameCode === ws.client_code;
      console.log(`  ${isCorrect ? '✅' : '❌'} ${c.name}`);
    }
    console.log('');
  }
}
