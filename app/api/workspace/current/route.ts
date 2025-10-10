import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Get user's current workspace from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.current_workspace_id) {
      return NextResponse.json({
        success: false,
        error: 'No workspace found'
      }, { status: 404 })
    }

    // CRITICAL: Verify user is actually a member of this workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', userData.current_workspace_id)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({
        success: false,
        error: 'Access denied - not a workspace member'
      }, { status: 403 })
    }

    // Get workspace details (RLS policies will also enforce access)
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, company_name')
      .eq('id', userData.current_workspace_id)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({
        success: false,
        error: 'Workspace not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      workspace: {
        id: workspace.id,
        name: workspace.name || workspace.company_name || 'Unknown'
      }
    })

  } catch (error) {
    console.error('Current workspace API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
