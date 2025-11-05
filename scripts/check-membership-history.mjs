// Check when membership was created (to see if it was recently deleted and recreated)
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkHistory() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';

  // Check all memberships with timestamps
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, joined_at, created_at, updated_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });

  console.log('📊 Workspace membership history:\n');
  memberships?.forEach((m, i) => {
    console.log(`${i + 1}. Workspace: ${m.workspace_id}`);
    console.log(`   Role: ${m.role}`);
    console.log(`   Joined: ${m.joined_at}`);
    console.log(`   Created: ${m.created_at || 'N/A'}`);
    console.log(`   Updated: ${m.updated_at || 'N/A'}`);

    // Check if recently created (within last hour)
    const joinedDate = new Date(m.joined_at);
    const now = new Date();
    const minutesAgo = Math.floor((now - joinedDate) / 1000 / 60);

    if (minutesAgo < 60) {
      console.log(`   ⚠️  RECENTLY ADDED: ${minutesAgo} minutes ago`);
    }
    console.log('');
  });

  // Check the campaign to see when it was created
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, created_at, created_by')
    .eq('id', 'c23e2c23-254a-4ce7-a474-82048b34f385')
    .single();

  if (campaign) {
    console.log('📋 Campaign details:');
    console.log('   Name:', campaign.name);
    console.log('   Created:', campaign.created_at);
    console.log('   Created by:', campaign.created_by);

    const createdDate = new Date(campaign.created_at);
    const firstMembershipDate = new Date(memberships[0]?.joined_at);

    if (createdDate < firstMembershipDate) {
      console.log('\n⚠️  ISSUE: Campaign was created BEFORE user became workspace member!');
      console.log('   This explains why upload-prospects failed - you weren\'t a member when the campaign was created.');
    }
  }
}

checkHistory().catch(console.error);
