import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    console.log(`🔌 Disconnecting LinkedIn accounts for user ${user.email} (${user.id})`)

    // Get user's workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    if (!userProfile?.current_workspace_id) {
      return NextResponse.json({
        success: false,
        error: 'No active workspace found'
      }, { status: 400 })
    }

    const workspaceId = userProfile.current_workspace_id
    console.log(`🏢 User workspace: ${workspaceId}`)

    // Remove all LinkedIn integrations for this user
    const { data: deletedAccounts, error: deleteError } = await supabase
      .from('integrations')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'linkedin')
      .select()

    if (deleteError) {
      console.error('❌ Error deleting workspace accounts:', deleteError)
      return NextResponse.json({
        success: false,
        error: `Failed to disconnect: ${deleteError.message}`
      }, { status: 500 })
    }

    console.log(`✅ Successfully disconnected ${deletedAccounts?.length || 0} LinkedIn accounts`)

    return NextResponse.json({
      success: true,
      message: 'LinkedIn accounts disconnected successfully',
      disconnected_accounts: deletedAccounts?.length || 0,
      workspace_id: workspaceId,
      user_email: user.email
    })

  } catch (error) {
    console.error('💥 Disconnect error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Disconnect failed'
    }, { status: 500 })
  }
}