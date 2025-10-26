import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/app/lib/supabase'

/**
 * GET /api/prospect-approval/decisions?session_id=xxx
 * Get all decisions for a session
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session ID required'
      }, { status: 400 })
    }

    // Get decisions for this session
    const { data: decisions, error } = await supabase
      .from('prospect_approval_decisions')
      .select('*')
      .eq('session_id', sessionId)
      .order('decided_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      decisions: decisions || []
    })

  } catch (error) {
    console.error('Decisions fetch error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST /api/prospect-approval/decisions
 * Save approval/rejection decision for a prospect
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const { session_id, prospect_id, decision, reason } = body

    if (!session_id || !prospect_id || !decision) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: session_id, prospect_id, decision'
      }, { status: 400 })
    }

    if (!['approved', 'rejected', 'pending'].includes(decision)) {
      return NextResponse.json({
        success: false,
        error: 'Decision must be "approved", "rejected", or "pending"'
      }, { status: 400 })
    }

    // Insert or update decision (upsert to handle changing mind)
    // Use admin client to bypass RLS policies
    const adminClient = supabaseAdmin()
    const { data, error } = await adminClient
      .from('prospect_approval_decisions')
      .upsert({
        session_id,
        prospect_id,
        decision,
        reason: reason || null,
        decided_by: user.id,
        decided_at: new Date().toISOString()
      }, {
        onConflict: 'session_id,prospect_id',
        ignoreDuplicates: false
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving decision:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to save decision',
        details: error.message
      }, { status: 500 })
    }

    // Update approval_status in prospect_approval_data table
    // Already have adminClient from above
    const { error: updateError } = await adminClient
      .from('prospect_approval_data')
      .update({
        approval_status: decision,
        updated_at: new Date().toISOString()
      })
      .eq('session_id', session_id)
      .eq('prospect_id', prospect_id)

    if (updateError) {
      console.error('Failed to update approval_status in prospect_approval_data:', updateError)
      return NextResponse.json({
        success: false,
        error: 'Failed to update prospect approval status',
        details: updateError.message
      }, { status: 500 })
    }

    // Update session counts in background (non-blocking)
    updateSessionCounts(supabase, session_id).catch(console.error)

    return NextResponse.json({
      success: true,
      decision: data
    })

  } catch (error) {
    console.error('Decisions API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/prospect-approval/decisions
 * Delete a prospect decision (used when deleting rejected prospects)
 */
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const { session_id, prospect_id } = body

    if (!session_id || !prospect_id) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: session_id, prospect_id'
      }, { status: 400 })
    }

    // Use admin client to bypass RLS for deletions
    const adminClient = supabaseAdmin()

    // Delete the decision record
    const { error: decisionError } = await adminClient
      .from('prospect_approval_decisions')
      .delete()
      .eq('session_id', session_id)
      .eq('prospect_id', prospect_id)

    if (decisionError) {
      console.error('Error deleting decision:', decisionError)
    }

    // Delete from prospect_approval_data
    const { error: dataError } = await adminClient
      .from('prospect_approval_data')
      .delete()
      .eq('session_id', session_id)
      .eq('prospect_id', prospect_id)

    if (dataError) {
      console.error('Error deleting prospect data:', dataError)
      return NextResponse.json({
        success: false,
        error: 'Failed to delete prospect'
      }, { status: 500 })
    }

    // Update session counts in background (non-blocking)
    updateSessionCounts(supabase, session_id).catch(console.error)

    return NextResponse.json({
      success: true,
      message: 'Prospect deleted successfully'
    })

  } catch (error) {
    console.error('Delete decision error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper function to update session counts
async function updateSessionCounts(supabase: any, sessionId: string) {
  // Count decisions by type
  const { count: approvedCount } = await supabase
    .from('prospect_approval_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('decision', 'approved')

  const { count: rejectedCount } = await supabase
    .from('prospect_approval_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('decision', 'rejected')

  const { count: pendingDecisionCount } = await supabase
    .from('prospect_approval_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('decision', 'pending')

  const { count: totalCount } = await supabase
    .from('prospect_approval_data')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)

  // Pending count includes: explicit pending decisions + prospects with no decision
  const totalDecisions = (approvedCount || 0) + (rejectedCount || 0) + (pendingDecisionCount || 0)
  const pendingCount = (totalCount || 0) - (approvedCount || 0) - (rejectedCount || 0)

  // Update session
  await supabase
    .from('prospect_approval_sessions')
    .update({
      approved_count: approvedCount || 0,
      rejected_count: rejectedCount || 0,
      pending_count: pendingCount
    })
    .eq('id', sessionId)
}