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

const workspaceTeams = [
  {
    workspace_id: 'ecb08e55-2b7e-4d49-8f50-d38e39ce2482',
    workspace_name: '3cubed Workspace',
    members: [
      { email: 'tl@3cubed.ai', role: 'owner', first_name: 'TL', last_name: '3cubed' },
      { email: 'ny@3cubed.ai', role: 'member', first_name: 'NY', last_name: '3cubed' }
    ]
  },
  {
    workspace_id: 'edea7143-6987-458d-8dfe-7e3a6c7a4e6e',
    workspace_name: 'WT Matchmaker Workspace',
    members: [
      { email: 'laura@wtmatchmaker.com', role: 'admin', first_name: 'Laura', last_name: 'WT Matchmaker' }
    ]
  }
]

async function addAllTeams() {
  console.log('👥 Adding Remaining Workspace Teams\n')
  console.log('='.repeat(70) + '\n')
  
  try {
    // Get all existing auth users
    const { data: { users: authUsers }, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) throw listError
    
    for (const workspace of workspaceTeams) {
      console.log(`🏢 ${workspace.workspace_name}\n`)
      
      for (const member of workspace.members) {
        console.log(`   📧 ${member.email}...`)
        
        // Check if user exists in auth
        let authUser = authUsers.find(u => u.email === member.email)
        
        if (!authUser) {
          // Create new auth user
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: member.email,
            email_confirm: true,
            user_metadata: {
              first_name: member.first_name,
              last_name: member.last_name
            }
          })
          
          if (authError) {
            console.log(`      ❌ Auth error: ${authError.message}`)
            continue
          }
          
          authUser = authData.user
          console.log(`      ✅ Auth user created`)
        } else {
          console.log(`      ℹ️  Found in auth`)
        }
        
        const userId = authUser.id
        
        // Add to users table
        const { error: userError } = await supabase
          .from('users')
          .upsert({
            id: userId,
            email: member.email,
            first_name: member.first_name,
            last_name: member.last_name,
            current_workspace_id: workspace.workspace_id
          }, {
            onConflict: 'id'
          })
        
        if (userError) {
          console.log(`      ❌ Users table: ${userError.message}`)
          continue
        }
        console.log(`      ✅ Users table updated`)
        
        // Add workspace membership
        const { error: memberError } = await supabase
          .from('workspace_members')
          .upsert({
            user_id: userId,
            workspace_id: workspace.workspace_id,
            role: member.role,
            status: 'active'
          }, {
            onConflict: 'user_id,workspace_id'
          })
        
        if (memberError) {
          console.log(`      ❌ Membership: ${memberError.message}`)
          continue
        }
        console.log(`      ✅ Added as ${member.role}`)
      }
      
      console.log()
    }
    
    // Final verification for all workspaces
    console.log('='.repeat(70))
    console.log('📊 COMPLETE SYSTEM STATUS\n')
    
    const { data: allWorkspaces } = await supabase
      .from('workspaces')
      .select('id, name, slug')
      .order('name')
    
    const { data: allMembers } = await supabase
      .from('workspace_members')
      .select('workspace_id, user_id, role, status')
    
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
    
    for (const ws of allWorkspaces || []) {
      const members = allMembers?.filter(m => m.workspace_id === ws.id) || []
      
      console.log(`🏢 ${ws.name}`)
      console.log(`   Members: ${members.length}`)
      
      if (members.length > 0) {
        const sortedMembers = members.sort((a, b) => {
          if (a.role === 'owner') return -1
          if (b.role === 'owner') return 1
          if (a.role === 'admin') return -1
          if (b.role === 'admin') return 1
          return 0
        })
        
        sortedMembers.forEach(m => {
          const user = allUsers?.find(u => u.id === m.user_id)
          const hasWorkspace = user?.current_workspace_id === ws.id
          const roleEmoji = m.role === 'owner' ? '👑' : m.role === 'admin' ? '🔑' : '👤'
          console.log(`      ${roleEmoji} ${user?.email} (${m.role}) ${hasWorkspace ? '✅' : ''}`)
        })
      } else {
        console.log(`      ⚠️  No members`)
      }
      console.log()
    }
    
    console.log('='.repeat(70))
    console.log(`📊 Total Users: ${allUsers?.length || 0}`)
    console.log(`📊 Total Workspaces: ${allWorkspaces?.length || 0}`)
    console.log(`📊 Total Memberships: ${allMembers?.length || 0}`)
    console.log('='.repeat(70))
    console.log('\n🎉 All workspaces are now fully configured!\n')
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

addAllTeams()
