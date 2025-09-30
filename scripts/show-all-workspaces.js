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

async function showWorkspaces() {
  console.log('🏢 ALL WORKSPACES\n')
  console.log('='.repeat(80) + '\n')
  
  try {
    // Get all workspaces
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('*')
      .order('name')
    
    if (!workspaces || workspaces.length === 0) {
      console.log('❌ No workspaces found!\n')
      return
    }
    
    console.log(`📊 Total Workspaces: ${workspaces.length}\n`)
    console.log('='.repeat(80) + '\n')
    
    // Get all memberships
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id, user_id, role, status, joined_at')
    
    // Get all users
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
    
    for (const workspace of workspaces) {
      const wsMembers = memberships?.filter(m => m.workspace_id === workspace.id) || []
      
      console.log(`🏢 ${workspace.name}`)
      console.log(`   Slug: ${workspace.slug}`)
      console.log(`   ID: ${workspace.id}`)
      console.log(`   Created: ${workspace.created_at ? new Date(workspace.created_at).toLocaleDateString() : 'Unknown'}`)
      console.log(`   Owner ID: ${workspace.owner_id || workspace.created_by || 'N/A'}`)
      console.log(`   Members: ${wsMembers.length}`)
      
      if (workspace.settings) {
        console.log(`   Settings: ${JSON.stringify(workspace.settings)}`)
      }
      
      if (wsMembers.length > 0) {
        console.log(`\n   👥 Members:`)
        wsMembers.forEach((member, i) => {
          const user = users?.find(u => u.id === member.user_id)
          console.log(`      ${i + 1}. ${user?.email || member.user_id.substring(0, 16) + '...'}`)
          console.log(`         Role: ${member.role}`)
          console.log(`         Status: ${member.status}`)
          console.log(`         Joined: ${new Date(member.joined_at).toLocaleDateString()}`)
        })
      } else {
        console.log(`\n   ⚠️  No members`)
      }
      
      console.log('\n' + '-'.repeat(80) + '\n')
    }
    
    // Summary
    console.log('='.repeat(80))
    console.log('📊 SUMMARY\n')
    console.log(`Total Workspaces: ${workspaces.length}`)
    console.log(`Total Members: ${memberships?.length || 0}`)
    console.log(`Total Users: ${users?.length || 0}`)
    
    // Workspaces with no members
    const emptyWorkspaces = workspaces.filter(w => {
      const members = memberships?.filter(m => m.workspace_id === w.id) || []
      return members.length === 0
    })
    
    if (emptyWorkspaces.length > 0) {
      console.log(`\n⚠️  Empty Workspaces (no members): ${emptyWorkspaces.length}`)
      emptyWorkspaces.forEach(w => {
        console.log(`   - ${w.name} (${w.slug})`)
      })
    }
    
    console.log('='.repeat(80))
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

showWorkspaces()
