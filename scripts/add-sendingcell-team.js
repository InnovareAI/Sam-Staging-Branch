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

const teamMembers = [
  { email: 'cathy.smith@sendingcell.com', role: 'admin', first_name: 'Cathy', last_name: 'Smith' },
  { email: 'dave.stuteville@sendingcell.com', role: 'member', first_name: 'Dave', last_name: 'Stuteville' },
  { email: 'jim.heim@sendingcell.com', role: 'member', first_name: 'Jim', last_name: 'Heim' }
]

async function addSendingcellTeam() {
  console.log('👥 Adding Sendingcell Workspace Team Members\n')
  console.log('='.repeat(70) + '\n')
  
  try {
    // Get all existing auth users first
    const { data: { users: authUsers }, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) throw listError
    
    for (const member of teamMembers) {
      console.log(`📧 Processing ${member.email}...`)
      
      // Check if user already exists in auth
      let authUser = authUsers.find(u => u.email === member.email)
      
      if (!authUser) {
        // Create new auth user
        console.log('   Step 1: Creating Supabase Auth user...')
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: member.email,
          email_confirm: true,
          user_metadata: {
            first_name: member.first_name,
            last_name: member.last_name
          }
        })
        
        if (authError) {
          console.log(`   ❌ Auth error: ${authError.message}\n`)
          continue
        }
        
        authUser = authData.user
        console.log('   ✅ Auth user created')
      } else {
        console.log('   ℹ️  User already exists in auth')
      }
      
      const userId = authUser.id
      
      // Add to users table
      console.log('   Step 2: Adding to users table...')
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: userId,
          email: member.email,
          first_name: member.first_name,
          last_name: member.last_name,
          current_workspace_id: SENDINGCELL_WORKSPACE_ID
        }, {
          onConflict: 'id'
        })
      
      if (userError) {
        console.log(`   ❌ Users table error: ${userError.message}\n`)
        continue
      }
      console.log('   ✅ Users table record created')
      
      // Add workspace membership
      console.log('   Step 3: Adding to Sendingcell Workspace...')
      const { error: memberError } = await supabase
        .from('workspace_members')
        .upsert({
          user_id: userId,
          workspace_id: SENDINGCELL_WORKSPACE_ID,
          role: member.role,
          status: 'active'
        }, {
          onConflict: 'user_id,workspace_id'
        })
      
      if (memberError) {
        console.log(`   ❌ Membership error: ${memberError.message}\n`)
        continue
      }
      console.log('   ✅ Workspace membership created')
      console.log(`   ✨ ${member.email} (${member.role}) successfully added!\n`)
    }
    
    // Verify
    console.log('='.repeat(70))
    console.log('📊 SENDINGCELL WORKSPACE - FINAL STATUS\n')
    
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name, slug')
      .eq('id', SENDINGCELL_WORKSPACE_ID)
      .single()
    
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, role, status')
      .eq('workspace_id', SENDINGCELL_WORKSPACE_ID)
    
    const { data: users } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
      .in('id', members?.map(m => m.user_id) || [])
    
    console.log(`Workspace: ${workspace?.name} (${workspace?.slug})`)
    console.log(`Total Members: ${members?.length || 0}\n`)
    
    // Sort by role (admin first, then members)
    const sortedMembers = members?.sort((a, b) => {
      if (a.role === 'admin') return -1
      if (b.role === 'admin') return 1
      return 0
    }) || []
    
    sortedMembers.forEach(m => {
      const user = users?.find(u => u.id === m.user_id)
      const hasWorkspace = user?.current_workspace_id === SENDINGCELL_WORKSPACE_ID
      const roleEmoji = m.role === 'admin' ? '👑' : '👤'
      console.log(`${roleEmoji} ${user?.email}`)
      console.log(`   Role: ${m.role}`)
      console.log(`   Status: ${m.status}`)
      console.log(`   Current Workspace: ${hasWorkspace ? '✅ Set' : '❌ Not set'}`)
      console.log()
    })
    
    console.log('='.repeat(70))
    console.log('🎉 Sendingcell Workspace team is ready!\n')
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

addSendingcellTeam()
