import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function showWorkspaceMembers() {
  console.log('👥 WORKSPACE MEMBER ASSOCIATIONS\n')
  console.log('='.repeat(80) + '\n')
  
  try {
    // Get all workspaces
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id, name, slug')
      .order('name')
    
    // Get all workspace members
    const { data: allMembers } = await supabase
      .from('workspace_members')
      .select('workspace_id, user_id, role, status, joined_at')
    
    // Get all users
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
    
    console.log(`📊 System Overview:`)
    console.log(`   - Total Workspaces: ${workspaces?.length || 0}`)
    console.log(`   - Total Users: ${allUsers?.length || 0}`)
    console.log(`   - Total Memberships: ${allMembers?.length || 0}\n`)
    console.log('='.repeat(80) + '\n')
    
    for (const workspace of workspaces || []) {
      const members = allMembers?.filter(m => m.workspace_id === workspace.id) || []
      
      console.log(`🏢 ${workspace.name}`)
      console.log(`   Slug: ${workspace.slug}`)
      console.log(`   ID: ${workspace.id}`)
      console.log(`   Members: ${members.length}\n`)
      
      if (members.length === 0) {
        console.log(`   ⚠️  No members in this workspace\n`)
      } else {
        members.forEach((member, index) => {
          const user = allUsers?.find(u => u.id === member.user_id)
          const isCurrentWorkspace = user?.current_workspace_id === workspace.id
          
          console.log(`   ${index + 1}. ${user?.email || member.user_id}`)
          console.log(`      Role: ${member.role}`)
          console.log(`      Status: ${member.status}`)
          console.log(`      Joined: ${new Date(member.joined_at).toLocaleDateString()}`)
          console.log(`      Current Workspace: ${isCurrentWorkspace ? '✅ YES' : '❌ NO'}`)
          
          if (user && !user.current_workspace_id) {
            console.log(`      ⚠️  User has NO current_workspace_id set!`)
          }
          console.log()
        })
      }
      
      console.log('-'.repeat(80) + '\n')
    }
    
    // Show users without any workspace
    const usersWithoutWorkspace = allUsers?.filter(u => 
      !allMembers?.some(m => m.user_id === u.id)
    ) || []
    
    if (usersWithoutWorkspace.length > 0) {
      console.log('⚠️  USERS WITHOUT ANY WORKSPACE MEMBERSHIP:\n')
      usersWithoutWorkspace.forEach(u => {
        console.log(`   - ${u.email}`)
        console.log(`     ID: ${u.id}`)
        console.log(`     current_workspace_id: ${u.current_workspace_id || 'NULL'}`)
        console.log()
      })
    }
    
    // Show summary by user
    console.log('='.repeat(80))
    console.log('📋 USER SUMMARY\n')
    
    for (const user of allUsers || []) {
      const userMemberships = allMembers?.filter(m => m.user_id === user.id) || []
      const currentWorkspace = workspaces?.find(w => w.id === user.current_workspace_id)
      
      console.log(`👤 ${user.email}`)
      console.log(`   User ID: ${user.id}`)
      console.log(`   Current Workspace: ${currentWorkspace?.name || 'NONE'} ${currentWorkspace ? '✅' : '❌'}`)
      console.log(`   Total Memberships: ${userMemberships.length}`)
      
      if (userMemberships.length > 0) {
        console.log(`   Member of:`)
        userMemberships.forEach(m => {
          const ws = workspaces?.find(w => w.id === m.workspace_id)
          const isCurrent = m.workspace_id === user.current_workspace_id
          console.log(`      - ${ws?.name || m.workspace_id} (${m.role}) ${isCurrent ? '← CURRENT' : ''}`)
        })
      }
      console.log()
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

showWorkspaceMembers()
