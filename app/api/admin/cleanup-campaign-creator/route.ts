import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * CLEANUP: Remove all old test campaigns from Campaign Creator
 * This deletes prospect_approval_sessions and prospect_approval_data for a workspace
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { workspaceId } = await request.json()

    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'workspace_id required'
      }, { status: 400 })
    }

    // Get all approval sessions for this workspace
    const { data: sessions, error: sessionsError } = await supabase
      .from('prospect_approval_sessions')
      .select('id')
      .eq('workspace_id', workspaceId)

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch approval sessions'
      }, { status: 500 })
    }

    const sessionIds = (sessions || []).map(s => s.id)

    if (sessionIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No sessions to delete',
        deleted: {
          sessions: 0,
          prospects: 0
        }
      })
    }

    // Delete prospect_approval_data for these sessions
    const { error: dataDeleteError, count: dataDeleted } = await supabase
      .from('prospect_approval_data')
      .delete({ count: 'exact' })
      .in('session_id', sessionIds)

    if (dataDeleteError) {
      console.error('Error deleting prospect data:', dataDeleteError)
      return NextResponse.json({
        success: false,
        error: 'Failed to delete prospect data'
      }, { status: 500 })
    }

    // Delete the approval sessions
    const { error: sessionsDeleteError, count: sessionsDeleted } = await supabase
      .from('prospect_approval_sessions')
      .delete({ count: 'exact' })
      .eq('workspace_id', workspaceId)

    if (sessionsDeleteError) {
      console.error('Error deleting sessions:', sessionsDeleteError)
      return NextResponse.json({
        success: false,
        error: 'Failed to delete sessions'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully cleaned up Campaign Creator',
      deleted: {
        sessions: sessionsDeleted || 0,
        prospects: dataDeleted || 0
      }
    })

  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
