import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Authenticate with Firebase
    const { userId, workspaceId } = await verifyAuth(request)

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

    // Create campaign approval session
    const sessionId = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const { rows } = await pool.query(
      `INSERT INTO campaign_approval_sessions (
        session_id, user_id, workspace_id, campaign_id, campaign_name,
        campaign_type, prospect_count, messaging_template, execution_preferences,
        session_status, approval_stage, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        sessionId,
        userId,
        workspaceId,
        campaign_id,
        campaign_name,
        campaign_type,
        prospect_count || 0,
        JSON.stringify(messaging_template || {}),
        JSON.stringify(execution_preferences || {}),
        'pending_approval',
        'campaign_content',
        new Date().toISOString()
      ]
    )

    const approvalSession = rows[0]

    if (!approvalSession) {
      console.error('Failed to create approval session')
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