#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking all campaigns...\n');

// Get the workspace ID for 3cubed (where Noriko is)
const { data: workspace } = await supabase
  .from('workspaces')
  .select('id, name')
  .ilike('name', '%3cubed%')
  .single();

console.log(`Workspace: ${workspace?.name || 'Not found'}`);
console.log(`ID: ${workspace?.id}\n`);

if (workspace) {
  // Get all campaigns in this workspace
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', workspace.id);
  
  console.log(`📋 Campaigns in workspace: ${campaigns?.length || 0}\n`);
  
  campaigns?.forEach(c => {
    console.log(`${c.name}`);
    console.log(`  ID: ${c.id}`);
    console.log(`  Status: ${c.status}`);
    console.log(`  Created: ${c.created_at}`);
    console.log();
  });
  
  // Reactivate all non-active campaigns
  const inactiveCampaigns = campaigns?.filter(c => c.status !== 'active');
  
  if (inactiveCampaigns && inactiveCampaigns.length > 0) {
    console.log(`🔄 Reactivating ${inactiveCampaigns.length} campaigns...\n`);
    
    for (const c of inactiveCampaigns) {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', c.id);
      
      if (error) {
        console.log(`❌ Failed: ${c.name} - ${error.message}`);
      } else {
        console.log(`✅ ${c.name} → active`);
      }
    }
    
    console.log('\n✅ Done!');
  } else {
    console.log('✅ All campaigns already active');
  }
}
