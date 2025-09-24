const { createClient } = require('@supabase/supabase-js');

// Simple direct query to list workspace members
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listMembers() {
  console.log('📋 Workspace Members Cross-Check Report\n');

  try {
    // Direct query joining workspace_members with auth.users and workspaces
    const { data: members, error } = await supabase
      .from('workspace_members')
      .select(`
        role,
        linkedin_unipile_account_id,
        workspaces!inner(name),
        auth.users!inner(email, raw_user_meta_data)
      `);

    if (error) {
      console.error('❌ Direct query error:', error.message);
      
      // Fallback: Try without auth.users join
      console.log('🔄 Trying fallback query...');
      const { data: fallbackMembers, error: fallbackError } = await supabase
        .rpc('exec_sql', {
          query: `
            SELECT 
              w.name as workspace_name,
              wm.role,
              wm.user_id,
              wm.linkedin_unipile_account_id,
              u.email,
              u.raw_user_meta_data->>'full_name' as full_name
            FROM workspace_members wm
            JOIN workspaces w ON wm.workspace_id = w.id
            JOIN auth.users u ON wm.user_id = u.id
            ORDER BY w.name, wm.role, u.email;
          `
        });

      if (fallbackError) {
        console.error('❌ Fallback query also failed:', fallbackError.message);
        
        // Ultimate fallback: Simple count per workspace
        console.log('🔄 Getting simple counts...');
        const { data: workspaces, error: wsError } = await supabase
          .from('workspaces')
          .select('id, name');

        if (!wsError) {
          for (const workspace of workspaces) {
            const { data: memberCount, error: countError } = await supabase
              .from('workspace_members')
              .select('user_id, role, linkedin_unipile_account_id', { count: 'exact' })
              .eq('workspace_id', workspace.id);

            console.log(`🏢 **${workspace.name}**: ${memberCount?.length || 0} members`);
            
            if (memberCount?.length > 0) {
              memberCount.forEach((member, index) => {
                console.log(`   ${index + 1}. User ID: ${member.user_id}`);
                console.log(`      Role: ${member.role}`);
                console.log(`      LinkedIn: ${member.linkedin_unipile_account_id ? '🔗 Associated' : '❌ Not associated'}`);
              });
            }
            console.log();
          }
        }
        return;
      }

      // Process fallback results if available
      if (fallbackMembers && fallbackMembers.length > 0) {
        console.log('✅ Using fallback query results:\n');
        
        const workspaceGroups = {};
        fallbackMembers.forEach(member => {
          if (!workspaceGroups[member.workspace_name]) {
            workspaceGroups[member.workspace_name] = [];
          }
          workspaceGroups[member.workspace_name].push(member);
        });

        Object.keys(workspaceGroups).forEach(workspaceName => {
          const members = workspaceGroups[workspaceName];
          console.log(`🏢 **${workspaceName}**`);
          console.log(`   Members: ${members.length}`);
          console.log('   ──────────────────────────────────');
          
          members.forEach((member, index) => {
            console.log(`   ${index + 1}. ${member.email || 'No email'}`);
            console.log(`      Name: ${member.full_name || 'No name'}`);
            console.log(`      Role: ${member.role}`);
            console.log(`      LinkedIn: ${member.linkedin_unipile_account_id ? '🔗 ' + member.linkedin_unipile_account_id : '❌ Not associated'}`);
            console.log('');
          });
        });

        // Summary
        console.log('📊 **SUMMARY**');
        Object.keys(workspaceGroups).forEach(workspaceName => {
          const members = workspaceGroups[workspaceName];
          const linkedInCount = members.filter(m => m.linkedin_unipile_account_id).length;
          console.log(`${workspaceName}: ${members.length} members, ${linkedInCount} with LinkedIn`);
        });
      }
      return;
    }

    // Process successful results
    console.log('✅ Direct query successful');
    console.log(`Found ${members.length} total workspace members`);

    // Group by workspace
    const workspaceGroups = {};
    members.forEach(member => {
      const workspaceName = member.workspaces.name;
      if (!workspaceGroups[workspaceName]) {
        workspaceGroups[workspaceName] = [];
      }
      workspaceGroups[workspaceName].push(member);
    });

    // Display by workspace
    Object.keys(workspaceGroups).forEach(workspaceName => {
      const workspaceMembers = workspaceGroups[workspaceName];
      console.log(`\n🏢 **${workspaceName}**`);
      console.log(`   Members: ${workspaceMembers.length}`);
      console.log('   ──────────────────────────────────');
      
      workspaceMembers.forEach((member, index) => {
        const user = member.auth.users;
        const email = user?.email || 'No email';
        const fullName = user?.raw_user_meta_data?.full_name || 'No name';
        const hasLinkedIn = member.linkedin_unipile_account_id ? '🔗' : '❌';
        
        console.log(`   ${index + 1}. ${email}`);
        console.log(`      Name: ${fullName}`);
        console.log(`      Role: ${member.role}`);
        console.log(`      LinkedIn: ${hasLinkedIn} ${member.linkedin_unipile_account_id || 'Not associated'}`);
        console.log('');
      });
    });

  } catch (error) {
    console.error('💥 Query failed:', error.message);
  }
}

listMembers();