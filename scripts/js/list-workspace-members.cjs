const { createClient } = require('@supabase/supabase-js');

// List all workspace members by workspace for cross-checking
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listWorkspaceMembers() {
  console.log('📋 Listing All Workspace Members for Cross-Checking...\n');

  try {
    // Get all workspaces with their members
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .select('id, name, slug')
      .order('name');

    if (workspacesError) {
      console.error('❌ Workspaces query error:', workspacesError.message);
      return;
    }

    const workspaceMembers = [];

    // Get members for each workspace
    for (const workspace of workspaces) {
      const { data: members, error: membersError } = await supabase
        .from('workspace_members')
        .select(`
          role,
          linkedin_unipile_account_id,
          user_id,
          users!inner(email, raw_user_meta_data)
        `)
        .eq('workspace_id', workspace.id);

      if (membersError) {
        console.error(`❌ Members query error for ${workspace.name}:`, membersError.message);
        workspace.workspace_members = [];
      } else {
        workspace.workspace_members = members || [];
      }

      workspaceMembers.push(workspace);
    }


    // Display results by workspace
    workspaceMembers.forEach(workspace => {
      console.log(`🏢 **${workspace.name}**`);
      console.log(`   Slug: ${workspace.slug}`);
      console.log(`   Members: ${workspace.workspace_members.length}`);
      console.log('   ──────────────────────────────────');
      
      if (workspace.workspace_members.length === 0) {
        console.log('   (No members found)');
      } else {
        workspace.workspace_members.forEach((member, index) => {
          const user = member.users;
          const email = user?.email || 'No email';
          const fullName = user?.raw_user_meta_data?.full_name || 'No name';
          const hasLinkedIn = member.linkedin_unipile_account_id ? '🔗' : '❌';
          
          console.log(`   ${index + 1}. ${email}`);
          console.log(`      Name: ${fullName}`);
          console.log(`      Role: ${member.role}`);
          console.log(`      LinkedIn: ${hasLinkedIn} ${member.linkedin_unipile_account_id || 'Not associated'}`);
          console.log('');
        });
      }
      console.log('');
    });

    // Summary table
    console.log('📊 **SUMMARY TABLE**');
    console.log('════════════════════════════════════════════════════════════');
    console.log('| Workspace Name        | Members | LinkedIn Accounts |');
    console.log('|──────────────────────|─────────|──────────────────|');
    
    let totalMembers = 0;
    let totalLinkedInAccounts = 0;
    
    workspaceMembers.forEach(workspace => {
      const memberCount = workspace.workspace_members.length;
      const linkedInCount = workspace.workspace_members.filter(m => m.linkedin_unipile_account_id).length;
      
      totalMembers += memberCount;
      totalLinkedInAccounts += linkedInCount;
      
      const spacedName = workspace.name.padEnd(20);
      const spacedMembers = memberCount.toString().padStart(7);
      const spacedLinkedIn = linkedInCount.toString().padStart(15);
      
      console.log(`| ${spacedName} | ${spacedMembers} | ${spacedLinkedIn} |`);
    });
    
    console.log('|──────────────────────|─────────|──────────────────|');
    const spacedTotal = 'TOTAL'.padEnd(20);
    const spacedTotalMembers = totalMembers.toString().padStart(7);
    const spacedTotalLinkedIn = totalLinkedInAccounts.toString().padStart(15);
    console.log(`| ${spacedTotal} | ${spacedTotalMembers} | ${spacedTotalLinkedIn} |`);
    console.log('════════════════════════════════════════════════════════════');

    console.log(`\n✅ Cross-check complete: ${totalMembers} total members across ${workspaceMembers.length} workspaces`);

  } catch (error) {
    console.error('💥 Query failed:', error.message);
    console.error(error.stack);
  }
}

listWorkspaceMembers();