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

async function cleanupOrphanedMemberships() {
  console.log('🧹 Cleaning up orphaned workspace memberships...\n')
  
  try {
    // Get all users
    const { data: users } = await supabase
      .from('users')
      .select('id')
    
    const validUserIds = new Set(users?.map(u => u.id) || [])
    console.log(`✅ Found ${validUserIds.size} valid users in database\n`)
    
    // Get all memberships
    const { data: allMemberships } = await supabase
      .from('workspace_members')
      .select('id, user_id, workspace_id')
    
    console.log(`📊 Found ${allMemberships?.length || 0} total memberships\n`)
    
    // Find orphaned memberships
    const orphanedMemberships = allMemberships?.filter(m => !validUserIds.has(m.user_id)) || []
    
    console.log(`🔍 Found ${orphanedMemberships.length} orphaned memberships (users deleted)\n`)
    
    if (orphanedMemberships.length === 0) {
      console.log('✅ No cleanup needed - all memberships are valid!\n')
      return
    }
    
    // Show what will be deleted
    console.log('🗑️  Will delete these orphaned memberships:\n')
    
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id, name')
    
    const workspacesByUser = {}
    orphanedMemberships.forEach(m => {
      const ws = workspaces?.find(w => w.id === m.workspace_id)
      if (!workspacesByUser[m.user_id]) {
        workspacesByUser[m.user_id] = []
      }
      workspacesByUser[m.user_id].push(ws?.name || m.workspace_id)
    })
    
    Object.entries(workspacesByUser).forEach(([userId, wsNames]) => {
      console.log(`   User ${userId.substring(0, 8)}...`)
      wsNames.forEach(name => console.log(`      - ${name}`))
    })
    
    console.log('\n⚠️  Do you want to proceed with deletion?')
    console.log('   This will clean up the database but is irreversible.\n')
    
    // Delete orphaned memberships
    const orphanedIds = orphanedMemberships.map(m => m.id)
    
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .in('id', orphanedIds)
    
    if (error) {
      console.error('❌ Failed to delete orphaned memberships:', error)
    } else {
      console.log(`✅ Successfully deleted ${orphanedIds.length} orphaned memberships\n`)
      
      // Verify
      const { data: remaining } = await supabase
        .from('workspace_members')
        .select('id')
      
      console.log(`📊 Remaining memberships: ${remaining?.length || 0}\n`)
      console.log('🎉 Cleanup complete!\n')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

cleanupOrphanedMemberships()
