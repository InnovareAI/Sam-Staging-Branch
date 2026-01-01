import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { icpData, chatContext, userId } = body

    // Get Authorization header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const supabase = pool
    
    // Get current user from Authorization header
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Create ICP approval session
    const sessionId = `icp_${Date.now()}_${Math.random().toString(36).substring(2)}`
    
    const { data: session, error: insertError } = await supabase
      .from('icp_approval_sessions')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        icp_data: icpData,
        chat_context: chatContext,
        status: 'pending',
        data_source: 'google_api',
        dataset_count: Array.isArray(icpData.prospects) ? icpData.prospects.length : 0,
        quota_used: 0
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Failed to create ICP approval session:', insertError)
      return NextResponse.json({
        success: false,
        error: 'Failed to create approval session'
      }, { status: 500 })
    }

    // Generate approval UI data for SAM chat
    const approvalData = {
      sessionId,
      icpData,
      approvalUI: {
        title: `ICP Approval Required`,
        subtitle: `Review ${icpData.prospects?.length || 0} prospects for ICP: "${icpData.name}"`,
        prospects: icpData.prospects?.slice(0, 5) || [], // Show first 5 for preview
        totalCount: icpData.prospects?.length || 0,
        actions: [
          {
            id: 'approve_all',
            label: 'Approve All',
            type: 'success',
            endpoint: '/api/icp-approval/decide'
          },
          {
            id: 'review_individual',
            label: 'Review Individual',
            type: 'info',
            endpoint: '/api/icp-approval/review'
          },
          {
            id: 'reject_all',
            label: 'Reject All',
            type: 'danger',
            endpoint: '/api/icp-approval/decide'
          }
        ]
      }
    }

    return NextResponse.json({
      success: true,
      sessionId,
      approvalData,
      message: 'ICP approval session created successfully'
    })

  } catch (error) {
    console.error('❌ ICP approval session creation failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session ID required'
      }, { status: 400 })
    }

    // Get Authorization header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const supabase = pool
    
    // Get current user from Authorization header
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Get approval session
    const { data: session, error: fetchError } = await supabase
      .from('icp_approval_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      console.error('❌ Failed to fetch approval session:', fetchError)
      return NextResponse.json({
        success: false,
        error: 'Session not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      session
    })

  } catch (error) {
    console.error('❌ Failed to get approval session:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}