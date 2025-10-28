import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Finding Noriko\'s workspace and campaign...\\n');

// Find Noriko's user account
const { data: users } = await supabase
  .from('users')
  .select('id, email, full_name')
  .or('email.ilike.%noriko%,full_name.ilike.%noriko%');

console.log(`Found ${users?.length || 0} users matching "Noriko":\\n`);
for (const u of users || []) {
  console.log(`  - ${u.full_name || 'No name'} (${u.email})`);
}

if (!users || users.length === 0) {
  console.log('\\n⚠️  No users found with name "Noriko"');
  console.log('\\nSearching 3cubed workspace directly (ny@3cubed.ai)...\\n');

  // Get 3cubed workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .ilike('name', '%3cubed%')
    .single();

  if (workspace) {
    console.log(`Found workspace: ${workspace.name} (${workspace.id})\\n`);

    // Get most recent campaigns
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, name, status, created_at, updated_at')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(5);

    console.log(`Recent campaigns (last 5):\\n`);
    for (const c of campaigns || []) {
      console.log(`📊 ${c.name}`);
      console.log(`   ID: ${c.id}`);
      console.log(`   Status: ${c.status}`);
      console.log(`   Created: ${new Date(c.created_at).toLocaleString()}`);
      console.log(`   Updated: ${new Date(c.updated_at).toLocaleString()}\\n`);

      // Get prospect counts for this campaign
      const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('status, contacted_at, linkedin_url')
        .eq('campaign_id', c.id);

      if (prospects && prospects.length > 0) {
        const statusCounts = {};
        let withLinkedIn = 0;
        let sent = 0;

        for (const p of prospects) {
          statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
          if (p.linkedin_url) withLinkedIn++;
          if (p.contacted_at) sent++;
        }

        console.log(`   📈 Prospect Stats:`);
        console.log(`      Total: ${prospects.length}`);
        console.log(`      With LinkedIn URL: ${withLinkedIn}`);
        console.log(`      Already sent: ${sent}`);
        console.log(`      Status breakdown:`);
        for (const [status, count] of Object.entries(statusCounts)) {
          console.log(`        - ${status}: ${count}`);
        }
        console.log('');
      } else {
        console.log(`   ⚠️  No prospects found\\n`);
      }
    }
  } else {
    console.log('\\n❌ Could not find 3cubed workspace');
  }

  process.exit(0);
}

// If we found Noriko user(s), check their workspaces
const userId = users[0].id;
console.log(`\\n🔍 Checking workspaces for ${users[0].email}...\\n`);

const { data: memberships } = await supabase
  .from('workspace_members')
  .select(`
    workspace_id,
    role,
    workspaces (
      id,
      name
    )
  `)
  .eq('user_id', userId);

console.log(`Member of ${memberships?.length || 0} workspaces:\\n`);
for (const m of memberships || []) {
  console.log(`  - ${m.workspaces.name} (${m.role})`);
}

if (!memberships || memberships.length === 0) {
  console.log('\\n❌ Noriko has no workspace memberships');
  process.exit(1);
}

// Get campaigns from all their workspaces
console.log('\\n🔍 Checking campaigns across all workspaces...\\n');

for (const membership of memberships) {
  const workspaceId = membership.workspace_id;
  const workspaceName = membership.workspaces.name;

  console.log(`\\n📂 Workspace: ${workspaceName}\\n`);

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(3);

  if (!campaigns || campaigns.length === 0) {
    console.log('  No campaigns found\\n');
    continue;
  }

  for (const c of campaigns) {
    console.log(`📊 ${c.name}`);
    console.log(`   ID: ${c.id}`);
    console.log(`   Status: ${c.status}`);
    console.log(`   Created: ${new Date(c.created_at).toLocaleString()}\\n`);

    // Get prospect status breakdown
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('status, contacted_at, linkedin_url, first_name, last_name')
      .eq('campaign_id', c.id);

    if (prospects && prospects.length > 0) {
      const statusCounts = {};
      let withLinkedIn = 0;
      let sent = 0;

      for (const p of prospects) {
        statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
        if (p.linkedin_url) withLinkedIn++;
        if (p.contacted_at) sent++;
      }

      console.log(`   📈 Delivery Stats:`);
      console.log(`      Total prospects: ${prospects.length}`);
      console.log(`      With LinkedIn URL: ${withLinkedIn}`);
      console.log(`      Connection requests sent: ${sent}`);
      console.log(`      Status breakdown:`);
      for (const [status, count] of Object.entries(statusCounts)) {
        console.log(`        - ${status}: ${count}`);
      }

      // Show recent sent
      const recentSent = prospects
        .filter(p => p.contacted_at)
        .sort((a, b) => new Date(b.contacted_at) - new Date(a.contacted_at))
        .slice(0, 3);

      if (recentSent.length > 0) {
        console.log(`\\n      Recent sends:`);
        for (const p of recentSent) {
          console.log(`        ✅ ${p.first_name} ${p.last_name} - ${new Date(p.contacted_at).toLocaleString()}`);
        }
      }

      // Show pending
      const pending = prospects.filter(p =>
        ['pending', 'approved', 'ready_to_message'].includes(p.status) &&
        p.linkedin_url &&
        !p.contacted_at
      );

      if (pending.length > 0) {
        console.log(`\\n      ⏳ Pending (ready to send): ${pending.length}`);
        for (const p of pending.slice(0, 3)) {
          console.log(`        - ${p.first_name} ${p.last_name}`);
        }
        if (pending.length > 3) {
          console.log(`        ... and ${pending.length - 3} more`);
        }
      }

      console.log('');
    } else {
      console.log(`   ⚠️  No prospects found\\n`);
    }
  }
}

console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Campaign delivery check complete');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');
