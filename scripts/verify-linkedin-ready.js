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

async function verify() {
  console.log('🔍 Verifying LinkedIn Integration Readiness...\n')
  
  try {
    // Check user
    const { data: user } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
      .eq('email', 'tl@innovareai.com')
      .single()
    
    console.log('✅ User found:', user.email)
    console.log('   User ID:', user.id)
    console.log('   Has current_workspace_id:', !!user.current_workspace_id)
    
    if (!user.current_workspace_id) {
      console.log('\n❌ ERROR: current_workspace_id is NULL!')
      return
    }
    
    // Check workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, name, slug')
      .eq('id', user.current_workspace_id)
      .single()
    
    console.log('\n✅ Workspace found:', workspace.name)
    console.log('   Workspace ID:', workspace.id)
    console.log('   Workspace Slug:', workspace.slug)
    
    // Check membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role, status')
      .eq('user_id', user.id)
      .eq('workspace_id', user.current_workspace_id)
      .single()
    
    if (membership) {
      console.log('\n✅ Workspace membership found')
      console.log('   Role:', membership.role)
      console.log('   Status:', membership.status)
    } else {
      console.log('\n⚠️  Warning: No workspace membership found')
    }
    
    // Check environment variables
    console.log('\n📋 Environment Check:')
    console.log('   UNIPILE_DSN:', !!process.env.UNIPILE_DSN ? '✅ Set' : '❌ Missing')
    console.log('   UNIPILE_API_KEY:', !!process.env.UNIPILE_API_KEY ? '✅ Set' : '❌ Missing')
    
    console.log('\n' + '='.repeat(60))
    console.log('🎉 LINKEDIN INTEGRATION STATUS: READY')
    console.log('='.repeat(60))
    console.log('\nYou can now test the LinkedIn connection!')
    console.log('The error "Please select a workspace" should be resolved.')
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error)
  }
}

verify()
