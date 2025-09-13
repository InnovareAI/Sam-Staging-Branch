import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Get current user and workspace (you'll need to implement proper auth)
    const userId = request.headers.get('x-user-id') || 'default-user'
    const workspaceId = request.headers.get('x-workspace-id') || 'default-workspace'

    // Check for active approval session
    const { data: session, error } = await supabase
      .from('prospect_approval_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return NextResponse.json({
      success: true,
      session: session || null
    })

  } catch (error) {
    console.error('Session fetch error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { icp_criteria, prospect_source = 'unipile_linkedin_search' } = body
    
    // Get current user and workspace
    const userId = request.headers.get('x-user-id') || 'default-user'
    const workspaceId = request.headers.get('x-workspace-id') || 'default-workspace'

    // Get next batch number
    const { data: lastSession } = await supabase
      .from('prospect_approval_sessions')
      .select('batch_number')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .order('batch_number', { ascending: false })
      .limit(1)
      .single()

    const nextBatchNumber = (lastSession?.batch_number || 0) + 1

    // Create new approval session
    const { data: newSession, error } = await supabase
      .from('prospect_approval_sessions')
      .insert({
        batch_number: nextBatchNumber,
        user_id: userId,
        workspace_id: workspaceId,
        status: 'active',
        total_prospects: 0, // Will be updated when prospects are added
        approved_count: 0,
        rejected_count: 0,
        pending_count: 0,
        icp_criteria,
        prospect_source,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      session: newSession
    })

  } catch (error) {
    console.error('Session creation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}