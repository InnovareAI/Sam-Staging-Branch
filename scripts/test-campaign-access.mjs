// Test if user can read campaigns via RLS
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Use ANON key to simulate frontend
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testCampaignAccess() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  console.log('Testing campaign access via RLS...\n');

  // This simulates what the frontend does
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, name, status, workspace_id')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Cannot read campaigns:', error);
    console.log('\nThis means RLS is blocking campaign reads.');
    console.log('The user session is not properly authenticated.');
    return;
  }

  console.log('✅ Can read campaigns:', campaigns?.length || 0);
  campaigns?.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.name} (${c.id}) - ${c.status}`);
  });

  console.log('\n⚠️  Note: This test uses ANON key without auth, so it should fail.');
  console.log('If it succeeds, RLS policies are too permissive.');
}

testCampaignAccess().catch(console.error);
