import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id, prospect_id, decision, reason } = body

    if (!session_id || !prospect_id || !decision || !['approved', 'rejected'].includes(decision)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data'
      }, { status: 400 })
    }

    const userId = request.headers.get('x-user-id') || 'default-user'
    const workspaceId = request.headers.get('x-workspace-id') || 'default-workspace'

    // Check if decision already exists (immutable decisions)
    const { data: existingDecision } = await supabase
      .from('prospect_approval_decisions')
      .select('*')
      .eq('session_id', session_id)
      .eq('prospect_id', prospect_id)
      .single()

    if (existingDecision) {
      return NextResponse.json({
        success: false,
        error: 'Decision already made for this prospect. Decisions are immutable.'
      }, { status: 409 })
    }

    // Create new decision record
    const decisionRecord = {
      session_id,
      prospect_id,
      decision,
      reason: reason || null,
      decided_by: userId,
      decided_at: new Date().toISOString(),
      is_immutable: true
    }

    const { data: newDecision, error } = await supabase
      .from('prospect_approval_decisions')
      .insert(decisionRecord)
      .select()
      .single()

    if (error) throw error

    // Update session counters
    const updateField = decision === 'approved' ? 'approved_count' : 'rejected_count'
    
    const { data: sessionData, error: sessionError } = await supabase
      .from('prospect_approval_sessions')
      .select('approved_count, rejected_count, pending_count')
      .eq('id', session_id)
      .single()

    if (sessionError) throw sessionError

    const { error: updateError } = await supabase
      .from('prospect_approval_sessions')
      .update({
        [updateField]: sessionData[updateField] + 1,
        pending_count: Math.max(0, sessionData.pending_count - 1)
      })
      .eq('id', session_id)

    if (updateError) throw updateError

    // Log decision for learning algorithm
    await logDecisionForLearning(session_id, prospect_id, decision, reason)

    return NextResponse.json({
      success: true,
      decision: newDecision,
      message: `Prospect ${decision} successfully`
    })

  } catch (error) {
    console.error('Decision save error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function logDecisionForLearning(sessionId: string, prospectId: string, decision: string, reason?: string) {
  try {
    // Get prospect data for learning analysis
    const { data: prospectData } = await supabase
      .from('prospect_approval_data')
      .select('*')
      .eq('session_id', sessionId)
      .eq('prospect_id', prospectId)
      .single()

    if (!prospectData) return

    // Log learning data for SAM AI optimization
    const learningData = {
      session_id: sessionId,
      prospect_id: prospectId,
      decision,
      reason,
      prospect_title: prospectData.title,
      company_size: prospectData.company?.size,
      company_industry: prospectData.company?.industry,
      connection_degree: prospectData.connection_degree,
      enrichment_score: prospectData.enrichment_score,
      has_email: !!prospectData.contact?.email,
      has_phone: !!prospectData.contact?.phone,
      logged_at: new Date().toISOString()
    }

    await supabase
      .from('prospect_learning_logs')
      .insert(learningData)

  } catch (error) {
    console.error('Learning log error:', error)
    // Don't throw - learning failure shouldn't block decision
  }
}