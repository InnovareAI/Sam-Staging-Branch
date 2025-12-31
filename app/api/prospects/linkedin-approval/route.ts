import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Firebase auth + workspace context
    const { userId, workspaceId } = await verifyAuth(request)

    const body = await request.json()
    const { action, session_id, prospect_data, linkedin_data } = body

    switch (action) {
      case 'create_session':
        return await createApprovalSession(userId, workspaceId, linkedin_data)

      case 'approve_prospects':
        return await approveProspects(session_id, prospect_data)

      case 'reject_prospects':
        return await rejectProspects(session_id, prospect_data)

      case 'get_session':
        return await getApprovalSession(session_id)

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error: any) {
    if (error?.statusCode === 401 || error?.statusCode === 403) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('LinkedIn approval error:', error)
    return NextResponse.json({
      error: 'Failed to process LinkedIn approval request'
    }, { status: 500 })
  }
}

async function createApprovalSession(userId: string, workspaceId: string, linkedinData: any) {
  try {
    // Check quota availability
    let quotaCheck = { has_quota: true }
    try {
      const quotaResult = await pool.query(
        `SELECT check_approval_quota($1, $2, $3, $4) as quota_result`,
        [userId, workspaceId, 'campaign_data', linkedinData.prospects?.length || 0]
      )
      if (quotaResult.rows[0]?.quota_result) {
        quotaCheck = quotaResult.rows[0].quota_result
      }
    } catch (quotaError) {
      console.warn('Quota check skipped:', quotaError)
    }

    if (!quotaCheck?.has_quota) {
      return NextResponse.json({
        error: 'Quota exceeded',
        quota_info: quotaCheck
      }, { status: 429 })
    }

    // Create approval session
    const sessionId = `linkedin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const sessionResult = await pool.query(
      `INSERT INTO data_approval_sessions
        (session_id, user_id, workspace_id, dataset_name, dataset_type, dataset_source, raw_data, processed_data, data_preview, total_count, quota_limit, data_quality_score, completeness_score)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        sessionId,
        userId,
        workspaceId,
        linkedinData.campaign_name || 'LinkedIn Prospects',
        'prospect_list',
        'unipile_linkedin',
        JSON.stringify(linkedinData),
        JSON.stringify(processLinkedInData(linkedinData)),
        JSON.stringify(linkedinData.prospects?.slice(0, 10) || []),
        linkedinData.prospects?.length || 0,
        2500, // LinkedIn Premium allows exporting up to 2,500 connections
        calculateDataQuality(linkedinData.prospects),
        calculateCompleteness(linkedinData.prospects)
      ]
    )

    const session = sessionResult.rows[0]

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      session: session,
      quota_info: quotaCheck
    })

  } catch (error) {
    console.error('Create session error:', error)
    return NextResponse.json({ error: 'Failed to create approval session' }, { status: 500 })
  }
}

async function approveProspects(sessionId: string, prospectData: any[]) {
  try {
    // Get session
    const sessionResult = await pool.query(
      `SELECT * FROM data_approval_sessions WHERE session_id = $1`,
      [sessionId]
    )

    if (sessionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const session = sessionResult.rows[0]

    // Create approval decisions
    for (let i = 0; i < prospectData.length; i++) {
      const prospect = prospectData[i]
      await pool.query(
        `INSERT INTO data_record_decisions
          (session_id, record_index, record_data, decision, decision_reason, confidence_score, data_quality_score)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (session_id, record_index) DO UPDATE SET
          decision = $4,
          decision_reason = $5,
          confidence_score = $6,
          data_quality_score = $7`,
        [
          sessionId,
          i,
          JSON.stringify(prospect),
          'approved',
          'User approved',
          prospect.confidence || 0.8,
          calculateProspectQuality(prospect)
        ]
      )
    }

    // Update session counts
    const newApprovedCount = (session.approved_count || 0) + prospectData.length
    const newStatus = prospectData.length === session.total_count ? 'approved' : 'partial'
    const approvedAt = prospectData.length === session.total_count ? new Date().toISOString() : null

    await pool.query(
      `UPDATE data_approval_sessions
       SET approved_count = $1, status = $2, approved_at = $3
       WHERE session_id = $4`,
      [newApprovedCount, newStatus, approvedAt, sessionId]
    )

    // Consume quota
    try {
      await pool.query(
        `SELECT consume_approval_quota($1, $2, $3, $4)`,
        [session.user_id, session.workspace_id, 'campaign_data', prospectData.length]
      )
    } catch (quotaError) {
      console.warn('Quota consumption skipped:', quotaError)
    }

    return NextResponse.json({
      success: true,
      approved_count: prospectData.length,
      message: 'Prospects approved successfully'
    })

  } catch (error) {
    console.error('Approve prospects error:', error)
    return NextResponse.json({ error: 'Failed to approve prospects' }, { status: 500 })
  }
}

async function rejectProspects(sessionId: string, prospectData: any[]) {
  try {
    // Create rejection decisions
    for (let i = 0; i < prospectData.length; i++) {
      const prospect = prospectData[i]
      await pool.query(
        `INSERT INTO data_record_decisions
          (session_id, record_index, record_data, decision, decision_reason, confidence_score)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (session_id, record_index) DO UPDATE SET
          decision = $4,
          decision_reason = $5,
          confidence_score = $6`,
        [
          sessionId,
          i,
          JSON.stringify(prospect),
          'rejected',
          'User rejected',
          prospect.confidence || 0.5
        ]
      )
    }

    // Update session
    const sessionResult = await pool.query(
      `SELECT rejected_count, total_count FROM data_approval_sessions WHERE session_id = $1`,
      [sessionId]
    )

    if (sessionResult.rows.length > 0) {
      const session = sessionResult.rows[0]
      await pool.query(
        `UPDATE data_approval_sessions
         SET rejected_count = $1
         WHERE session_id = $2`,
        [(session.rejected_count || 0) + prospectData.length, sessionId]
      )
    }

    return NextResponse.json({
      success: true,
      rejected_count: prospectData.length,
      message: 'Prospects rejected'
    })

  } catch (error) {
    console.error('Reject prospects error:', error)
    return NextResponse.json({ error: 'Failed to reject prospects' }, { status: 500 })
  }
}

async function getApprovalSession(sessionId: string) {
  try {
    const sessionResult = await pool.query(
      `SELECT * FROM data_approval_sessions WHERE session_id = $1`,
      [sessionId]
    )

    if (sessionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const session = sessionResult.rows[0]

    // Get associated decisions
    const decisionsResult = await pool.query(
      `SELECT * FROM data_record_decisions WHERE session_id = $1 ORDER BY record_index`,
      [sessionId]
    )

    return NextResponse.json({
      success: true,
      session: {
        ...session,
        data_record_decisions: decisionsResult.rows
      }
    })

  } catch (error) {
    console.error('Get session error:', error)
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 })
  }
}

// Helper functions
function processLinkedInData(data: any) {
  // Clean and structure LinkedIn data
  return {
    ...data,
    processed_at: new Date().toISOString(),
    source_platform: 'linkedin',
    data_version: '1.0'
  }
}

function calculateDataQuality(prospects: any[] = []) {
  if (!prospects.length) return 0

  let totalScore = 0
  prospects.forEach(prospect => {
    let score = 0
    if (prospect.name) score += 0.2
    if (prospect.title) score += 0.2
    if (prospect.company) score += 0.2
    if (prospect.email) score += 0.2
    if (prospect.linkedinUrl) score += 0.2
    totalScore += score
  })

  return Math.round((totalScore / prospects.length) * 100) / 100
}

function calculateCompleteness(prospects: any[] = []) {
  if (!prospects.length) return 0

  const requiredFields = ['name', 'title', 'company']
  let totalCompleteness = 0

  prospects.forEach(prospect => {
    const filledFields = requiredFields.filter(field => prospect[field]).length
    totalCompleteness += filledFields / requiredFields.length
  })

  return Math.round((totalCompleteness / prospects.length) * 100) / 100
}

function calculateProspectQuality(prospect: any) {
  let score = 0
  if (prospect.name) score += 0.25
  if (prospect.title) score += 0.25
  if (prospect.company) score += 0.25
  if (prospect.email || prospect.linkedinUrl) score += 0.25
  return score
}
