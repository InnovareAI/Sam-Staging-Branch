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

async function testWorkspaceCheck() {
  console.log('🧪 Testing API workspace check logic...\n')
  
  const userId = '2197f460-2078-44b5-9bf8-bbfb2dd5d23c'
  
  try {
    // Simulate what the API does
    console.log('Step 1: Fetching user profile with current_workspace_id...')
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', userId)
      .single()
    
    console.log('Result:', { userProfile, error })
    
    if (error) {
      console.error('\n❌ ERROR:', error.message)
      console.error('Code:', error.code)
      console.error('Details:', error.details)
      
      if (error.code === 'PGRST116') {
        console.log('\n💡 This might be a schema cache issue.')
        console.log('Try restarting your dev server or wait a few minutes.')
      }
    } else if (!userProfile) {
      console.log('\n❌ No user profile found')
    } else if (!userProfile.current_workspace_id) {
      console.log('\n❌ current_workspace_id is NULL')
    } else {
      console.log('\n✅ SUCCESS!')
      console.log('current_workspace_id:', userProfile.current_workspace_id)
      
      // Verify workspace exists
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('name')
        .eq('id', userProfile.current_workspace_id)
        .single()
      
      console.log('Workspace name:', workspace?.name)
    }
    
  } catch (error) {
    console.error('\n❌ Exception:', error)
  }
}

testWorkspaceCheck()
