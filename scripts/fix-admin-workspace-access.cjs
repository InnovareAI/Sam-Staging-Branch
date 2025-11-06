require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixWorkspaceAccess() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b'; // tl@innovareai.com
  const blueLabelsWorkspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const innovareAIWorkspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
  
  console.log('\n🔧 FIXING WORKSPACE ACCESS...\n');
  
  // Remove from Blue Label Labs workspace
  console.log('🗑️  Removing tl@innovareai.com from Blue Label Labs workspace...');
  const { error: deleteError } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', blueLabelsWorkspaceId)
    .eq('user_id', userId);
    
  if (deleteError) {
    console.error('❌ Error removing from Blue Label Labs:', deleteError);
  } else {
    console.log('✅ Removed from Blue Label Labs workspace');
  }
  
  // Verify user's memberships
  console.log('\n📋 Verifying user memberships...');
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(name)')
    .eq('user_id', userId);
    
  console.log('\nCurrent memberships for tl@innovareai.com:');
  console.log(JSON.stringify(memberships, null, 2));
  
  if (memberships.length === 1 && memberships[0].workspace_id === innovareAIWorkspaceId) {
    console.log('\n✅ CORRECT: tl@innovareai.com is ONLY a member of InnovareAI workspace');
  } else {
    console.log('\n⚠️  WARNING: User has unexpected memberships!');
  }
}

fixWorkspaceAccess().catch(console.error);
