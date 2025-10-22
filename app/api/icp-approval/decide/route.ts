import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import { apiError, handleApiError, apiSuccess } from '@/lib/api-error-handler'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, decision, prospectIndexes, notes } = await request.json()

    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      throw apiError.unauthorized()
    }

    const supabase = supabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      throw apiError.unauthorized()
    }

    // ULTRAFAST: Bulk operations for speed
    if (decision === 'approve_all' || decision === 'reject_all') {
      const status = decision === 'approve_all' ? 'approved' : 'rejected'
      const count = decision === 'approve_all' ? 'approved_count' : 'rejected_count'
      
      // Get session data
      const { data: session } = await supabase
        .from('icp_approval_sessions')
        .select('total_count, icp_data')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .single()

      if (!session) {
        throw apiError.notFound('ICP approval session')
      }

      // Bulk update session
      await supabase
        .from('icp_approval_sessions')
        .update({
          status,
          [count]: session.total_count,
          approved_at: status === 'approved' ? new Date().toISOString() : null,
          completed_at: new Date().toISOString(),
          approval_notes: notes
        })
        .eq('session_id', sessionId)

      // Create bulk prospect decisions
      const prospects = session.icp_data.prospects || []
      const decisions = prospects.map((prospect: any, index: number) => ({
        session_id: sessionId,
        prospect_index: index,
        prospect_data: prospect,
        decision: status === 'approved' ? 'approved' : 'rejected',
        decision_reason: notes || `Bulk ${status}`,
        auto_decision: false
      }))

      await supabase.from('icp_prospect_decisions').insert(decisions)

      // Consume quota if approved
      if (status === 'approved') {
        await supabase.rpc('consume_approval_quota', {
          p_user_id: user.id,
          p_workspace_id: user.id, // TODO: Get actual workspace
          p_quota_type: 'icp_building',
          p_amount: session.total_count
        })
      }

      return apiSuccess({
        decision: status,
        count: session.total_count
      }, `${session.total_count} prospects ${status}`)
    }

    // Individual prospect decisions
    if (prospectIndexes && Array.isArray(prospectIndexes)) {
      const decisions = prospectIndexes.map((index: number) => ({
        session_id: sessionId,
        prospect_index: index,
        decision,
        decision_reason: notes
      }))

      await supabase.from('icp_prospect_decisions').upsert(decisions)

      // Update session counts
      const approved = prospectIndexes.length * (decision === 'approved' ? 1 : 0)
      const rejected = prospectIndexes.length * (decision === 'rejected' ? 1 : 0)

      await supabase
        .from('icp_approval_sessions')
        .update({
          approved_count: supabase.sql`approved_count + ${approved}`,
          rejected_count: supabase.sql`rejected_count + ${rejected}`
        })
        .eq('session_id', sessionId)

      return apiSuccess({
        processed: prospectIndexes.length,
        decision
      })
    }

    throw apiError.validation('Invalid request', 'Either provide prospectIndexes or use approve_all/reject_all')

  } catch (error) {
    return handleApiError(error, 'icp_approval_decision')
  }
}