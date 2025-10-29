#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Searching for Noriko...\n');

// Search workspace_members
const { data: members } = await supabase
  .from('workspace_members')
  .select('*, users(*), workspaces(*)')
  .ilike('users.email', '%noriko%');

console.log(`Found ${members?.length || 0} matches\n`);

members?.forEach(m => {
  console.log(`User: ${m.users.email}`);
  console.log(`Workspace: ${m.workspaces.name}`);
  console.log(`User ID: ${m.user_id}`);
  console.log();
});

// Find campaigns by this user
if (members && members.length > 0) {
  const userId = members[0].user_id;
  
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('created_by', userId);
  
  console.log(`\n📋 Campaigns: ${campaigns?.length || 0}\n`);
  
  campaigns?.forEach(c => {
    console.log(`${c.name}`);
    console.log(`  ID: ${c.id}`);
    console.log(`  Status: ${c.status}`);
    console.log();
  });
  
  // Reactivate all
  if (campaigns && campaigns.length > 0) {
    console.log('🔄 Reactivating...\n');
    
    for (const c of campaigns) {
      await supabase
        .from('campaigns')
        .update({ status: 'active' })
        .eq('id', c.id);
      
      console.log(`✅ ${c.name} → active`);
    }
  }
}
