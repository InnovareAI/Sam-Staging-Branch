import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Get authenticated user
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      campaign_id, 
      campaign_name, 
      prospect_count, 
      campaign_type, 
      messaging_template,
      execution_preferences 
    } = body

    // Validate required fields
    if (!campaign_id || !campaign_name || !campaign_type) {
      return NextResponse.json({ 
        error: 'Missing required fields: campaign_id, campaign_name, campaign_type' 
      }, { status: 400 })
    }

    // Get user's workspace
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', session.user.id)
      .single()

    if (!workspaceMember) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Create campaign approval session
    const sessionId = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const { data: approvalSession, error } = await supabase
      .from('campaign_approval_sessions')
      .insert({
        session_id: sessionId,
        user_id: session.user.id,
        workspace_id: workspaceMember.workspace_id,
        campaign_id,
        campaign_name,
        campaign_type,
        prospect_count: prospect_count || 0,
        messaging_template: messaging_template || {},
        execution_preferences: execution_preferences || {},
        session_status: 'pending_approval',
        approval_stage: 'campaign_content',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create approval session:', error)
      return NextResponse.json({ 
        error: 'Failed to create campaign approval session' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      session: approvalSession,
      message: 'Campaign approval session created',
      next_steps: {
        step1: 'Review and approve campaign content',
        step2: 'Execute via /api/campaign/execute-n8n',
        step3: 'Monitor execution via N8N workflow'
      }
    })

  } catch (error) {
    console.error('Campaign approval creation error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}