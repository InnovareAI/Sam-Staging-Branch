#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listTenants() {
  console.log('🏢 Listing all tenants/workspaces...\n');

  // Get all workspaces
  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`Found ${workspaces.length} workspaces:\n`);

  for (const workspace of workspaces) {
    console.log(`📁 ${workspace.name}`);
    console.log(`   ID: ${workspace.id}`);
    console.log(`   Created: ${workspace.created_at}`);

    // Get member count
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, role, users(email)')
      .eq('workspace_id', workspace.id);

    console.log(`   Members: ${members?.length || 0}`);
    
    if (members && members.length > 0) {
      members.forEach(m => {
        console.log(`     - ${m.users?.email || 'Unknown'} (${m.role})`);
      });
    }

    // Check for custom domain
    const { data: tier } = await supabase
      .from('workspace_tiers')
      .select('tier_name')
      .eq('workspace_id', workspace.id)
      .single();

    if (tier) {
      console.log(`   Tier: ${tier.tier_name}`);
    }

    console.log('');
  }

  // Check for any known custom domains
  console.log('🌐 Known Custom Domains:');
  console.log('   - app.meet-sam.com (main)');
  console.log('   - sendingcell.com (SendingCell)');
  console.log('   - www.sendingcell.com (SendingCell)');
  console.log('   - 3cubed.ai (3cubed - if configured)');
}

listTenants().catch(console.error);
