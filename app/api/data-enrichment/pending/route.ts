import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspace')
    const status = searchParams.get('status') || 'pending'

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing required parameter: workspace' },
        { status: 400 }
      )
    }

    // Get prospects pending approval
    const { data: prospects, error } = await supabase
      .from('enriched_prospects')
      .select(`
        *,
        prospect_approvals (
          approved_at,
          approved_by,
          rejection_reason
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('enrichment_status', status)
      .eq('manual_review_required', true)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      throw new Error(error.message)
    }

    // Transform data for frontend consumption
    const transformedProspects = prospects?.map(prospect => ({
      ...prospect.enriched_data,
      prospect_id: prospect.prospect_id,
      created_at: prospect.created_at,
      confidence_score: prospect.confidence_score,
      icp_score: prospect.icp_score,
      estimated_cost: prospect.estimated_cost,
      approval_data: prospect.prospect_approvals?.[0] || null
    })) || []

    return NextResponse.json({
      success: true,
      prospects: transformedProspects,
      total_pending: transformedProspects.length
    })

  } catch (error) {
    console.error('Get pending prospects API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get pending prospects' },
      { status: 500 }
    )
  }
}