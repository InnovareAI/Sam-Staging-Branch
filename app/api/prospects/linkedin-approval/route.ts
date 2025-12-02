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
    const { action, session_id, prospect_data, linkedin_data } = body

    switch (action) {
      case 'create_session':
        return await createApprovalSession(supabase, session.user.id, linkedin_data)
      
      case 'approve_prospects':
        return await approveProspects(supabase, session_id, prospect_data)
      
      case 'reject_prospects':
        return await rejectProspects(supabase, session_id, prospect_data)
      
      case 'get_session':
        return await getApprovalSession(supabase, session_id)
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('LinkedIn approval error:', error)
    return NextResponse.json({ 
      error: 'Failed to process LinkedIn approval request' 
    }, { status: 500 })
  }
}

async function createApprovalSession(supabase: any, userId: string, linkedinData: any) {
  try {
    // Get user's workspace
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (!workspaces) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Check quota availability
    const { data: quotaCheck } = await supabase.rpc('check_approval_quota', {
      p_user_id: userId,
      p_workspace_id: workspaces.id,
      p_quota_type: 'campaign_data',
      p_requested_amount: linkedinData.prospects?.length || 0
    })

    if (!quotaCheck?.has_quota) {
      return NextResponse.json({ 
        error: 'Quota exceeded',
        quota_info: quotaCheck
      }, { status: 429 })
    }

    // Create approval session
    const sessionId = `linkedin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const { data: session, error } = await supabase
      .from('data_approval_sessions')
      .insert({
        session_id: sessionId,
        user_id: userId,
        workspace_id: workspaces.id,
        dataset_name: linkedinData.campaign_name || 'LinkedIn Prospects',
        dataset_type: 'prospect_list',
        dataset_source: 'unipile_linkedin',
        raw_data: linkedinData,
        processed_data: processLinkedInData(linkedinData),
        data_preview: linkedinData.prospects?.slice(0, 10) || [],
        total_count: linkedinData.prospects?.length || 0,
        quota_limit: 2500, // LinkedIn Premium allows exporting up to 2,500 connections
        data_quality_score: calculateDataQuality(linkedinData.prospects),
        completeness_score: calculateCompleteness(linkedinData.prospects)
      })
      .select()
      .single()

    if (error) throw error

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

async function approveProspects(supabase: any, sessionId: string, prospectData: any[]) {
  try {
    // Get session
    const { data: session } = await supabase
      .from('data_approval_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Create approval decisions
    const decisions = prospectData.map((prospect, index) => ({
      session_id: sessionId,
      record_index: index,
      record_data: prospect,
      decision: 'approved',
      decision_reason: 'User approved',
      confidence_score: prospect.confidence || 0.8,
      data_quality_score: calculateProspectQuality(prospect)
    }))

    const { error: decisionsError } = await supabase
      .from('data_record_decisions')
      .upsert(decisions)

    if (decisionsError) throw decisionsError

    // Update session counts
    const { error: updateError } = await supabase
      .from('data_approval_sessions')
      .update({
        approved_count: (session.approved_count || 0) + prospectData.length,
        status: prospectData.length === session.total_count ? 'approved' : 'partial',
        approved_at: prospectData.length === session.total_count ? new Date().toISOString() : null
      })
      .eq('session_id', sessionId)

    if (updateError) throw updateError

    // Consume quota
    await supabase.rpc('consume_approval_quota', {
      p_user_id: session.user_id,
      p_workspace_id: session.workspace_id,
      p_quota_type: 'campaign_data',
      p_amount: prospectData.length
    })

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

async function rejectProspects(supabase: any, sessionId: string, prospectData: any[]) {
  try {
    const decisions = prospectData.map((prospect, index) => ({
      session_id: sessionId,
      record_index: index,
      record_data: prospect,
      decision: 'rejected',
      decision_reason: 'User rejected',
      confidence_score: prospect.confidence || 0.5
    }))

    const { error } = await supabase
      .from('data_record_decisions')
      .upsert(decisions)

    if (error) throw error

    // Update session
    const { data: session } = await supabase
      .from('data_approval_sessions')
      .select('rejected_count, total_count')
      .eq('session_id', sessionId)
      .single()

    await supabase
      .from('data_approval_sessions')
      .update({
        rejected_count: (session.rejected_count || 0) + prospectData.length
      })
      .eq('session_id', sessionId)

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

async function getApprovalSession(supabase: any, sessionId: string) {
  try {
    const { data: session, error } = await supabase
      .from('data_approval_sessions')
      .select(`
        *,
        data_record_decisions (*)
      `)
      .eq('session_id', sessionId)
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      session: session
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