const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function linkNewAccount() {
  try {
    console.log('🔗 Linking NEW LinkedIn account jOUMUaXJQsSfL0i34rLKXw...')
    
    // Find the user by email
    const { data: users, error: userError } = await supabase.auth.admin.listUsers()
    if (userError) {
      console.error('❌ Failed to list users:', userError)
      process.exit(1)
    }
    
    const user = users.users.find(u => u.email === 'tl@innovareai.com')
    if (!user) {
      console.error('❌ User not found with email: tl@innovareai.com')
      process.exit(1)
    }
    
    console.log('👤 Found user:', user.id, user.email)
    
    // Get user's workspace from users table
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()
    
    const workspaceId = userProfile?.current_workspace_id || user.id
    console.log('🏢 Using workspace:', workspaceId)
    
    // Create integrations entry
    const { data: newIntegration, error: insertError } = await supabase
      .from('integrations')
      .insert({
        user_id: user.id,
        provider: 'linkedin',
        type: 'social',
        status: 'active',
        credentials: {
          unipile_account_id: 'jOUMUaXJQsSfL0i34rLKXw',
          account_name: 'Thorsten Linz',
          linkedin_public_identifier: 'tvonlinz',
          account_email: 'tl@innovareai.com'
        },
        settings: {
          workspace_id: workspaceId,
          linkedin_experience: 'sales_navigator',
          linkedin_profile_url: 'https://linkedin.com/in/tvonlinz',
          connection_method: 'auto_linked_test'
        }
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Failed to create integration:', insertError)
      process.exit(1)
    }

    console.log('✅ Successfully created LinkedIn integration:', newIntegration.id)
    console.log('🎉 NEW LinkedIn account is now linked to workspace!')
    console.log('🚀 Test the frontend - it should now detect the connection!')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

linkNewAccount()