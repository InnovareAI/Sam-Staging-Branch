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

const SENDINGCELL_WORKSPACE_ID = 'b070d94f-11e2-41d4-a913-cc5a8c017208'

async function fixSendingcellOwner() {
  console.log('🔧 Fixing Sendingcell Workspace ownership...\n')
  
  try {
    // Get tl@3cubed.ai user
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .in('email', ['tl@3cubed.ai', 'tl@innovareai.com'])
    
    const tl3cubed = users?.find(u => u.email === 'tl@3cubed.ai')
    const tlInnovare = users?.find(u => u.email === 'tl@innovareai.com')
    
    if (!tl3cubed) {
      console.log('❌ tl@3cubed.ai not found!')
      return
    }
    
    // Add tl@3cubed.ai as owner of Sendingcell
    console.log(`Adding ${tl3cubed.email} as owner of Sendingcell Workspace...`)
    
    const { error: memberError } = await supabase
      .from('workspace_members')
      .upsert({
        user_id: tl3cubed.id,
        workspace_id: SENDINGCELL_WORKSPACE_ID,
        role: 'owner',
        status: 'active'
      }, {
        onConflict: 'user_id,workspace_id'
      })
    
    if (memberError) {
      console.log(`❌ Error: ${memberError.message}`)
      return
    }
    
    console.log('✅ Added tl@3cubed.ai as owner\n')
    
    // Remove tl@innovareai.com if they shouldn't be in this workspace
    if (tlInnovare) {
      console.log(`Removing ${tlInnovare.email} from Sendingcell Workspace...`)
      
      const { error: removeError } = await supabase
        .from('workspace_members')
        .delete()
        .eq('user_id', tlInnovare.id)
        .eq('workspace_id', SENDINGCELL_WORKSPACE_ID)
      
      if (removeError) {
        console.log(`❌ Error removing: ${removeError.message}`)
      } else {
        console.log('✅ Removed tl@innovareai.com from Sendingcell\n')
      }
    }
    
    // Verify
    console.log('='.repeat(70))
    console.log('📊 SENDINGCELL WORKSPACE - UPDATED\n')
    
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, role, status')
      .eq('workspace_id', SENDINGCELL_WORKSPACE_ID)
    
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
      .in('id', members?.map(m => m.user_id) || [])
    
    console.log(`Total Members: ${members?.length || 0}\n`)
    
    const sortedMembers = members?.sort((a, b) => {
      if (a.role === 'owner') return -1
      if (b.role === 'owner') return 1
      if (a.role === 'admin') return -1
      if (b.role === 'admin') return 1
      return 0
    }) || []
    
    sortedMembers.forEach(m => {
      const user = allUsers?.find(u => u.id === m.user_id)
      const roleEmoji = m.role === 'owner' ? '👑' : m.role === 'admin' ? '🔑' : '👤'
      console.log(`${roleEmoji} ${user?.email} (${m.role})`)
    })
    
    console.log('\n' + '='.repeat(70))
    console.log('✅ Sendingcell Workspace ownership fixed!\n')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

fixSendingcellOwner()
