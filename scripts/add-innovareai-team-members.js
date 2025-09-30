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

const teamMembers = [
  { email: 'cs@innovareai.com', role: 'admin', first_name: 'CS', last_name: 'InnovareAI' },
  { email: 'cl@innovareai.com', role: 'admin', first_name: 'CL', last_name: 'InnovareAI' },
  { email: 'mg@innovareai.com', role: 'admin', first_name: 'MG', last_name: 'InnovareAI' }
]

async function addTeamMembers() {
  console.log('👥 Adding InnovareAI Workspace Team Members\n')
  console.log('='.repeat(70) + '\n')
  
  try {
    for (const member of teamMembers) {
      console.log(`📧 Processing ${member.email}...`)
      
      // Step 1: Create auth user
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
        if (authError.message.includes('already registered')) {
          console.log('   ℹ️  User already exists in auth, fetching...')
          
          // Get existing user
          const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
          if (listError) throw listError
          
          const existingUser = users.find(u => u.email === member.email)
          if (!existingUser) {
            console.log('   ❌ Could not find existing user')
            continue
          }
          
          authData.user = existingUser
          console.log('   ✅ Found existing auth user')
        } else {
          console.log(`   ❌ Auth error: ${authError.message}`)
          continue
        }
      } else {
        console.log('   ✅ Auth user created')
      }
      
      const userId = authData.user.id
      
      // Step 2: Create/update users table record
      console.log('   Step 2: Creating users table record...')
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: userId,
          email: member.email,
          first_name: member.first_name,
          last_name: member.last_name,
          current_workspace_id: INNOVAREAI_WORKSPACE_ID
        }, {
          onConflict: 'id'
        })
      
      if (userError) {
        console.log(`   ❌ Users table error: ${userError.message}`)
        continue
      }
      console.log('   ✅ Users table record created')
      
      // Step 3: Create workspace membership
      console.log('   Step 3: Adding to InnovareAI Workspace...')
      const { error: memberError } = await supabase
        .from('workspace_members')
        .upsert({
          user_id: userId,
          workspace_id: INNOVAREAI_WORKSPACE_ID,
          role: member.role,
          status: 'active'
        }, {
          onConflict: 'user_id,workspace_id'
        })
      
      if (memberError) {
        console.log(`   ❌ Membership error: ${memberError.message}`)
        continue
      }
      console.log('   ✅ Workspace membership created')
      
      console.log(`   ✨ ${member.email} successfully added!\n`)
    }
    
    // Verify
    console.log('='.repeat(70))
    console.log('📊 VERIFICATION\n')
    
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', INNOVAREAI_WORKSPACE_ID)
      .single()
    
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, role, status')
      .eq('workspace_id', INNOVAREAI_WORKSPACE_ID)
    
    const { data: users } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
      .in('id', members?.map(m => m.user_id) || [])
    
    console.log(`Workspace: ${workspace?.name}`)
    console.log(`Total Members: ${members?.length || 0}\n`)
    
    members?.forEach(m => {
      const user = users?.find(u => u.id === m.user_id)
      const hasWorkspace = user?.current_workspace_id === INNOVAREAI_WORKSPACE_ID
      console.log(`✅ ${user?.email || m.user_id}`)
      console.log(`   Role: ${m.role}`)
      console.log(`   Status: ${m.status}`)
      console.log(`   Current Workspace: ${hasWorkspace ? '✅ Set' : '❌ Not set'}`)
      console.log()
    })
    
    console.log('='.repeat(70))
    console.log('🎉 InnovareAI Workspace team is ready!\n')
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

addTeamMembers()
