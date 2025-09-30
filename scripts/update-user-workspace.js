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

async function updateWorkspace() {
  console.log('🔄 Updating user workspace assignment...\n')
  
  try {
    // Get all workspaces
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id, name, slug')
      .order('name')
    
    console.log('Available workspaces:')
    workspaces.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.name} (${w.slug})`)
    })
    
    // Find InnovareAI workspace
    const innovareWorkspace = workspaces.find(w => 
      w.slug === 'innovareai-workspace' || w.name.toLowerCase().includes('innovareai')
    )
    
    if (!innovareWorkspace) {
      console.error('\n❌ InnovareAI Workspace not found!')
      console.log('\nPlease specify which workspace ID to use.')
      return
    }
    
    console.log(`\n✅ Found InnovareAI Workspace: ${innovareWorkspace.name}`)
    console.log(`   ID: ${innovareWorkspace.id}\n`)
    
    // Update user
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', 'tl@innovareai.com')
    
    if (!users || users.length === 0) {
      console.error('❌ User tl@innovareai.com not found!')
      return
    }
    
    const user = users[0]
    
    console.log(`Updating ${user.email} to ${innovareWorkspace.name}...`)
    
    const { error } = await supabase
      .from('users')
      .update({ current_workspace_id: innovareWorkspace.id })
      .eq('id', user.id)
    
    if (error) {
      console.error('❌ Update failed:', error)
    } else {
      console.log('✅ Successfully updated!')
      
      // Verify
      const { data: verification } = await supabase
        .from('users')
        .select('email, current_workspace_id')
        .eq('id', user.id)
        .single()
      
      const verifyWorkspace = workspaces.find(w => w.id === verification.current_workspace_id)
      console.log(`\n📊 Verification:`)
      console.log(`   User: ${verification.email}`)
      console.log(`   Current Workspace: ${verifyWorkspace?.name}`)
      console.log(`   Workspace ID: ${verification.current_workspace_id}`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

updateWorkspace()
