// Check Stan Bounev's campaigns
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStanCampaigns() {
  console.log('🔍 Looking for Stan Bounev...\n');

  // Find Stan's user account
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const stan = users.find(u => u.email && (
    u.email.toLowerCase().includes('stan') ||
    u.email.toLowerCase().includes('bounev')
  ));

  if (!stan) {
    console.log('❌ Stan Bounev not found');
    return;
  }

  console.log('✅ Found user:', stan.email);
  console.log('   User ID:', stan.id);

  // Get Stan's workspace memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', stan.id);

  console.log('\n📊 Workspace memberships:', memberships?.length || 0);

  if (!memberships || memberships.length === 0) {
    console.log('❌ No workspace memberships found');
    return;
  }

  // Check campaigns in each workspace
  for (const membership of memberships) {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name, id')
      .eq('id', membership.workspace_id)
      .single();

    console.log('\n📁 Workspace:', workspace?.name || membership.workspace_id);
    console.log('   ID:', membership.workspace_id);
    console.log('   Role:', membership.role);

    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, name, status, created_at, created_by')
      .eq('workspace_id', membership.workspace_id)
      .order('created_at', { ascending: false })
      .limit(20);

    console.log('   Total campaigns:', campaigns?.length || 0);

    if (campaigns && campaigns.length > 0) {
      // Group by status
      const byStatus = {};
      campaigns.forEach(c => {
        if (!byStatus[c.status]) byStatus[c.status] = [];
        byStatus[c.status].push(c);
      });

      console.log('\n   By status:');
      Object.keys(byStatus).forEach(status => {
        console.log('     -', status + ':', byStatus[status].length);
      });

      console.log('\n   Recent campaigns:');
      campaigns.slice(0, 10).forEach((c, i) => {
        console.log('     ' + (i + 1) + '.', c.name);
        console.log('        Status:', c.status);
        console.log('        Created:', new Date(c.created_at).toLocaleString());
        console.log('        ID:', c.id);
      });

      if (campaigns.length > 10) {
        console.log('     ... and', campaigns.length - 10, 'more');
      }
    }
  }
}

checkStanCampaigns().catch(console.error);
