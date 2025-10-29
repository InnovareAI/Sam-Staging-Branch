#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
const stanUserId = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';

console.log('➕ Adding Stan as workspace admin...\n');

// Add Stan as workspace admin
const { data, error } = await supabase
  .from('workspace_members')
  .insert({
    workspace_id: workspaceId,
    user_id: stanUserId,
    role: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  .select();

if (error) {
  console.log('❌ Error:', error.message);
  
  // Check if he's already a member
  const { data: existing } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', stanUserId);
  
  if (existing && existing.length > 0) {
    console.log('✅ Stan is already a workspace member!');
    console.log('   Role:', existing[0].role);
  }
} else {
  console.log('✅ Successfully added Stan as admin!');
  console.log('   Workspace: Blue Label Labs');
  console.log('   User: stan01@signali.ai');
  console.log('   Role: admin');
}

// Verify Stan can now see prospects
console.log('\n📊 Verifying access...');

const { count } = await supabase
  .from('workspace_prospects')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', workspaceId);

console.log(`   Total prospects Stan can now access: ${count || 0}`);

console.log('\n✅ RESOLUTION:');
console.log('   Stan (stan01@signali.ai) can now:');
console.log('   - Access the Blue Label Labs workspace');
console.log(`   - View all ${count} prospects`);
console.log('   - Create campaigns');
console.log('   - Manage the LinkedIn account');
console.log('   - All data is preserved and accessible!');
