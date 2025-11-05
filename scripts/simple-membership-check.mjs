// Simple membership check without foreign key joins
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMembership() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';

  // Check workspace membership (no foreign key join)
  const { data: memberships, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  if (error) {
    console.error('❌ Query error:', error);
    return;
  }

  console.log('📊 Membership query result:');
  console.log('   Found:', memberships?.length || 0, 'membership(s)');

  if (memberships && memberships.length > 0) {
    console.log('✅ User IS a member of the workspace!');
    console.log('   Role:', memberships[0].role);
    console.log('   Joined:', memberships[0].joined_at);
    console.log('   Status:', memberships[0].status);
  } else {
    console.log('❌ User is NOT a member of the workspace');
  }

  // Show all memberships
  const { data: allMemberships } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', userId);

  console.log('\n📋 Total workspace memberships:', allMemberships?.length || 0);
  allMemberships?.forEach((m, i) => {
    console.log(`   ${i + 1}. Workspace: ${m.workspace_id}, Role: ${m.role}`);
  });
}

checkMembership().catch(console.error);
