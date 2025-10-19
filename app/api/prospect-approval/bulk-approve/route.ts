import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/app/lib/supabase'

/**
 * POST /api/prospect-approval/bulk-approve
 * Bulk approve/reject prospects across all pages
 * Supports filtering by status for "approve all pending" scenarios
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id, operation, status_filter, prospect_ids } = body

    if (!session_id) {
      return NextResponse.json({
        success: false,
        error: 'Session ID required'
      }, { status: 400 })
    }

    if (!operation || !['approve', 'reject'].includes(operation)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid operation. Must be "approve" or "reject"'
      }, { status: 400 })
    }

    // Authenticate user
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          }
        }
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Get user workspace
    const adminClient = supabaseAdmin()
    const { data: userProfile } = await adminClient
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    const workspaceId = userProfile?.current_workspace_id

    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'No workspace found'
      }, { status: 404 })
    }

    // Verify session belongs to workspace
    const { data: session } = await supabase
      .from('prospect_approval_sessions')
      .select('workspace_id')
      .eq('id', session_id)
      .single()

    if (!session || session.workspace_id !== workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 })
    }

    const decision = operation === 'approve' ? 'approved' : 'rejected'

    // If specific prospect IDs provided, use those
    if (prospect_ids && Array.isArray(prospect_ids) && prospect_ids.length > 0) {
      // Bulk decision for specific prospects
      const decisionRecords = prospect_ids.map(prospect_id => ({
        session_id,
        prospect_id,
        decision,
        decided_by: user.id,
        decided_at: new Date().toISOString()
      }))

      // Upsert decisions (update if exists, insert if not)
      const { error: decisionError } = await supabase
        .from('prospect_approval_decisions')
        .upsert(decisionRecords, {
          onConflict: 'session_id,prospect_id',
          ignoreDuplicates: false
        })

      if (decisionError) throw decisionError

      return NextResponse.json({
        success: true,
        count: prospect_ids.length,
        operation: decision
      })
    }

    // Otherwise, bulk approve/reject all (with optional status filter)
    // First, get all prospect IDs that match the criteria
    let query = supabase
      .from('prospect_approval_data')
      .select('prospect_id')
      .eq('session_id', session_id)

    // Apply status filter if provided (e.g., only pending)
    if (status_filter && status_filter !== 'all') {
      query = query.eq('approval_status', status_filter)
    }

    const { data: prospects, error: fetchError } = await query

    if (fetchError) throw fetchError

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        operation: decision,
        message: 'No prospects found matching criteria'
      })
    }

    // Create decision records for all prospects
    const decisionRecords = prospects.map(p => ({
      session_id,
      prospect_id: p.prospect_id,
      decision,
      decided_by: user.id,
      decided_at: new Date().toISOString()
    }))

    // Upsert in batches of 100 to avoid timeout
    const BATCH_SIZE = 100
    let processedCount = 0

    for (let i = 0; i < decisionRecords.length; i += BATCH_SIZE) {
      const batch = decisionRecords.slice(i, i + BATCH_SIZE)

      const { error: batchError } = await supabase
        .from('prospect_approval_decisions')
        .upsert(batch, {
          onConflict: 'session_id,prospect_id',
          ignoreDuplicates: false
        })

      if (batchError) throw batchError
      processedCount += batch.length
    }

    // Update session counts
    const { data: updatedCounts } = await supabase
      .from('prospect_approval_decisions')
      .select('decision')
      .eq('session_id', session_id)

    const approved = updatedCounts?.filter(d => d.decision === 'approved').length || 0
    const rejected = updatedCounts?.filter(d => d.decision === 'rejected').length || 0
    const totalProspects = prospects.length
    const pending = totalProspects - approved - rejected

    await supabase
      .from('prospect_approval_sessions')
      .update({
        approved_count: approved,
        rejected_count: rejected,
        pending_count: pending
      })
      .eq('id', session_id)

    console.log(`✅ Bulk ${operation}: ${processedCount} prospects in session ${session_id}`)

    return NextResponse.json({
      success: true,
      count: processedCount,
      operation: decision,
      counts: {
        approved,
        rejected,
        pending
      }
    })

  } catch (error) {
    console.error('Bulk approve error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
