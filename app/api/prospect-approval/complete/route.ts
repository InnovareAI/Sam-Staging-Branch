import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id } = body

    if (!session_id) {
      return NextResponse.json({
        success: false,
        error: 'Session ID required'
      }, { status: 400 })
    }

    const userId = request.headers.get('x-user-id') || 'default-user'

    // Get session data
    const { data: session, error: sessionError } = await supabase
      .from('prospect_approval_sessions')
      .select('*')
      .eq('id', session_id)
      .single()

    if (sessionError) throw sessionError

    if (session.pending_count > 0) {
      return NextResponse.json({
        success: false,
        error: `Cannot complete session with ${session.pending_count} pending prospects`
      }, { status: 400 })
    }

    // Calculate learning insights
    const learningInsights = await calculateLearningInsights(session_id)

    // Mark session as completed
    const { error: updateError } = await supabase
      .from('prospect_approval_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        learning_insights: learningInsights
      })
      .eq('id', session_id)

    if (updateError) throw updateError

    // Generate final approved prospects list
    const { data: approvedProspects } = await supabase
      .from('prospect_approval_data')
      .select(`
        *,
        prospect_approval_decisions!inner(decision)
      `)
      .eq('session_id', session_id)
      .eq('prospect_approval_decisions.decision', 'approved')

    // Create final prospect export record
    const { data: exportRecord, error: exportError } = await supabase
      .from('prospect_exports')
      .insert({
        session_id,
        user_id: userId,
        workspace_id: session.workspace_id,
        prospect_count: approvedProspects?.length || 0,
        export_data: approvedProspects,
        export_format: 'json',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (exportError) throw exportError

    return NextResponse.json({
      success: true,
      session_completed: true,
      approved_prospects: approvedProspects?.length || 0,
      learning_insights: learningInsights,
      export_id: exportRecord.id,
      message: `Session completed with ${approvedProspects?.length || 0} approved prospects`
    })

  } catch (error) {
    console.error('Session completion error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function calculateLearningInsights(sessionId: string) {
  try {
    // Get all decisions for this session
    const { data: decisions } = await supabase
      .from('prospect_learning_logs')
      .select('*')
      .eq('session_id', sessionId)

    if (!decisions || decisions.length === 0) {
      return {
        approval_rate: 0,
        common_reject_reasons: [],
        preferred_criteria: {}
      }
    }

    const totalDecisions = decisions.length
    const approvedCount = decisions.filter(d => d.decision === 'approved').length
    const approvalRate = (approvedCount / totalDecisions) * 100

    // Analyze rejection reasons
    const rejectedDecisions = decisions.filter(d => d.decision === 'rejected' && d.reason)
    const reasonCounts = rejectedDecisions.reduce((acc: Record<string, number>, decision) => {
      const reason = decision.reason
      acc[reason] = (acc[reason] || 0) + 1
      return acc
    }, {})

    const commonRejectReasons = Object.entries(reasonCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([reason]) => reason)

    // Analyze preferred criteria from approved prospects
    const approvedDecisions = decisions.filter(d => d.decision === 'approved')
    const preferredCriteria: Record<string, any> = {}

    if (approvedDecisions.length > 0) {
      // Company sizes
      const companySizes = approvedDecisions.map(d => d.company_size).filter(Boolean)
      if (companySizes.length > 0) {
        preferredCriteria.company_sizes = [...new Set(companySizes)]
      }

      // Industries
      const industries = approvedDecisions.map(d => d.company_industry).filter(Boolean)
      if (industries.length > 0) {
        preferredCriteria.industries = [...new Set(industries)]
      }

      // Connection preferences
      const connectionDegrees = approvedDecisions.map(d => d.connection_degree).filter(d => d !== null)
      if (connectionDegrees.length > 0) {
        const avgConnectionDegree = connectionDegrees.reduce((sum, degree) => sum + degree, 0) / connectionDegrees.length
        preferredCriteria.preferred_connection_degree = Math.round(avgConnectionDegree)
      }

      // Contact info preferences
      const withEmail = approvedDecisions.filter(d => d.has_email).length
      const withPhone = approvedDecisions.filter(d => d.has_phone).length
      
      preferredCriteria.contact_preferences = {
        email_required: (withEmail / approvedDecisions.length) > 0.8,
        phone_preferred: (withPhone / approvedDecisions.length) > 0.5
      }

      // Score thresholds
      const scores = approvedDecisions.map(d => d.enrichment_score).filter(s => s !== null)
      if (scores.length > 0) {
        const minScore = Math.min(...scores)
        preferredCriteria.min_enrichment_score = minScore
      }
    }

    return {
      approval_rate: Math.round(approvalRate * 100) / 100,
      common_reject_reasons: commonRejectReasons,
      preferred_criteria: preferredCriteria
    }

  } catch (error) {
    console.error('Learning insights calculation error:', error)
    return {
      approval_rate: 0,
      common_reject_reasons: [],
      preferred_criteria: {}
    }
  }
}