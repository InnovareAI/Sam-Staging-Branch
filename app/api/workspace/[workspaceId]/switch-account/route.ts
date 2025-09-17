import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const supabase = supabaseAdmin()
    const { workspaceId } = await params
    const body = await request.json()

    const { account_type, account_id } = body

    if (!account_type || !account_id) {
      return NextResponse.json({
        success: false,
        error: 'account_type and account_id are required'
      }, { status: 400 })
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Verify user has access to this workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({
        success: false,
        error: 'Access denied to this workspace'
      }, { status: 403 })
    }

    // Use the switch_workspace_account function
    const { data: success, error } = await supabase.rpc('switch_workspace_account', {
      p_workspace_id: workspaceId,
      p_user_id: user.id,
      p_account_type: account_type,
      p_account_id: account_id
    })

    if (error) {
      throw error
    }

    if (!success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to switch account - account may not exist or belong to you'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Successfully switched to ${account_type} account`,
      account_type,
      account_id
    })

  } catch (error) {
    console.error('Failed to switch workspace account:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}