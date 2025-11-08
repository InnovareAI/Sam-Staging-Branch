const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigateStanProspects() {
  console.log('🔍 INVESTIGATING STAN\'S WORKSPACE\n');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Find Stan's user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const stan = users.find(u => u.email && u.email.toLowerCase().includes('stan'));

  if (!stan) {
    console.log('❌ Could not find Stan in the system');
    console.log('\nSearching for users with "stan" in email:');
    users.filter(u => u.email && u.email.toLowerCase().includes('stan')).forEach(u => {
      console.log(`  - ${u.email}`);
    });
    return;
  }

  console.log(`Found user: ${stan.email}`);
  console.log(`User ID: ${stan.id}\n`);

  // 2. Find Stan's workspace
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(name)')
    .eq('user_id', stan.id);

  if (!memberships || memberships.length === 0) {
    console.log('❌ Stan has no workspace memberships');
    return;
  }

  console.log('Workspace memberships:');
  memberships.forEach(m => {
    console.log(`  - ${m.workspaces.name} (${m.role})`);
  });
  console.log('');

  const workspaceId = memberships[0].workspace_id;
  const workspaceName = memberships[0].workspaces.name;

  console.log(`Using workspace: ${workspaceName}`);
  console.log(`Workspace ID: ${workspaceId}\n`);

  // 3. Check prospect_approval_data
  console.log('═══════════════════════════════════════════════════');
  console.log('PROSPECT APPROVAL DATA:\n');

  const { data: approvalData, error: approvalError } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (approvalError) {
    console.log(`❌ Error fetching approval data: ${approvalError.message}`);
  } else {
    console.log(`Total records in prospect_approval_data: ${approvalData?.length || 0}`);

    if (approvalData && approvalData.length > 0) {
      console.log('\nRecent approval data:');
      approvalData.slice(0, 5).forEach((record, i) => {
        console.log(`\n${i + 1}. Created: ${new Date(record.created_at).toLocaleString()}`);
        console.log(`   Status: ${record.status || 'pending'}`);
        console.log(`   Approved count: ${record.approved_count || 0}`);
        console.log(`   Total count: ${record.total_count || 0}`);

        // Check if this has prospect data
        if (record.data) {
          const data = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;
          if (data.prospects) {
            console.log(`   Prospects in data: ${data.prospects.length}`);
          }
        }
      });
    }
  }

  // 4. Check workspace_prospects
  console.log('\n═══════════════════════════════════════════════════');
  console.log('WORKSPACE PROSPECTS:\n');

  const { data: workspaceProspects } = await supabase
    .from('workspace_prospects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  console.log(`Total workspace_prospects: ${workspaceProspects?.length || 0}\n`);

  if (workspaceProspects && workspaceProspects.length > 0) {
    console.log('Recent prospects:');
    workspaceProspects.slice(0, 10).forEach((p, i) => {
      console.log(`${i + 1}. ${p.first_name} ${p.last_name} - ${p.company || 'No company'}`);
      console.log(`   Status: ${p.status || 'unknown'}`);
      console.log(`   Created: ${new Date(p.created_at).toLocaleString()}`);
    });
  }

  // 5. Find the 25 missing prospects
  console.log('\n═══════════════════════════════════════════════════');
  console.log('LOOKING FOR 25 MISSING PROSPECTS:\n');

  // Check the most recent approval data for unapproved prospects
  if (approvalData && approvalData.length > 0) {
    for (const record of approvalData) {
      if (record.data) {
        const data = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;

        if (data.prospects && Array.isArray(data.prospects)) {
          const unapproved = data.prospects.filter(p => p.status !== 'approved');

          if (unapproved.length > 0) {
            console.log(`\nFound ${unapproved.length} unapproved prospects in record ${record.id}`);
            console.log(`Record created: ${new Date(record.created_at).toLocaleString()}`);

            if (unapproved.length === 25 || unapproved.length >= 20) {
              console.log('\n🎯 POTENTIAL MATCH - These might be the 25 missing prospects:\n');
              unapproved.forEach((p, i) => {
                const contact = p.contact || {};
                console.log(`${i + 1}. ${contact.firstName || 'Unknown'} ${contact.lastName || 'Unknown'}`);
                console.log(`   Company: ${contact.company || 'Unknown'}`);
                console.log(`   LinkedIn: ${contact.linkedin_url || 'No URL'}`);
                console.log(`   Status: ${p.status || 'pending'}`);
                console.log('');
              });

              console.log(`\nApproval Data ID: ${record.id}`);
              console.log(`To approve these, they need to be in prospect_approval_data with status='pending'`);
              break;
            }
          }
        }
      }
    }
  }

  // 6. Summary
  console.log('\n═══════════════════════════════════════════════════');
  console.log('SUMMARY:\n');
  console.log(`Workspace: ${workspaceName}`);
  console.log(`User: ${stan.email}`);
  console.log(`Approval Data Records: ${approvalData?.length || 0}`);
  console.log(`Workspace Prospects: ${workspaceProspects?.length || 0}`);
}

investigateStanProspects().catch(console.error);
