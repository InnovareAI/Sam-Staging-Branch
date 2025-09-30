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

const INNOVAREAI_WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'

async function syncExistingUsers() {
  console.log('🔄 Syncing existing auth users to InnovareAI Workspace\n')
  
  const emails = ['cs@innovareai.com', 'cl@innovareai.com']
  
  try {
    // Get all auth users
    const { data: { users: authUsers }, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) throw listError
    
    for (const email of emails) {
      console.log(`📧 Processing ${email}...`)
      
      const authUser = authUsers.find(u => u.email === email)
      if (!authUser) {
        console.log(`   ❌ Not found in auth.users\n`)
        continue
      }
      
      console.log(`   ✅ Found in auth (ID: ${authUser.id.substring(0, 8)}...)`)
      
      // Add to users table
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: authUser.id,
          email: authUser.email,
          first_name: authUser.user_metadata?.first_name || email.split('@')[0].toUpperCase(),
          last_name: authUser.user_metadata?.last_name || 'InnovareAI',
          current_workspace_id: INNOVAREAI_WORKSPACE_ID
        }, {
          onConflict: 'id'
        })
      
      if (userError) {
        console.log(`   ❌ Users table error: ${userError.message}\n`)
        continue
      }
      console.log(`   ✅ Added to users table`)
      
      // Add workspace membership
      const { error: memberError } = await supabase
        .from('workspace_members')
        .upsert({
          user_id: authUser.id,
          workspace_id: INNOVAREAI_WORKSPACE_ID,
          role: 'admin',
          status: 'active'
        }, {
          onConflict: 'user_id,workspace_id'
        })
      
      if (memberError) {
        console.log(`   ❌ Membership error: ${memberError.message}\n`)
        continue
      }
      console.log(`   ✅ Added to InnovareAI Workspace`)
      console.log(`   ✨ ${email} synced!\n`)
    }
    
    // Final verification
    console.log('='.repeat(70))
    console.log('📊 FINAL INNOVAREAI WORKSPACE MEMBERS\n')
    
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, role, status')
      .eq('workspace_id', INNOVAREAI_WORKSPACE_ID)
    
    const { data: users } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
      .in('id', members?.map(m => m.user_id) || [])
    
    console.log(`Total Members: ${members?.length || 0}\n`)
    
    members?.forEach(m => {
      const user = users?.find(u => u.id === m.user_id)
      console.log(`✅ ${user?.email}`)
      console.log(`   Role: ${m.role}`)
      console.log(`   Current Workspace: ${user?.current_workspace_id === INNOVAREAI_WORKSPACE_ID ? '✅ Set' : '❌ Not set'}`)
      console.log()
    })
    
    console.log('='.repeat(70))
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

syncExistingUsers()
