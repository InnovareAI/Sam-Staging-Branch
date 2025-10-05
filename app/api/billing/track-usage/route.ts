import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/billing/track-usage
 *
 * Records usage events for billing purposes
 *
 * Body: {
 *   workspaceId: string
 *   usageType: 'message' | 'campaign' | 'prospect' | 'ai_credits'
 *   quantity: number (default: 1)
 *   metadata?: object (optional additional data)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId, usageType, quantity = 1, metadata = null } = await request.json()

    if (!workspaceId || !usageType) {
      return NextResponse.json({
        error: 'Missing required fields: workspaceId, usageType'
      }, { status: 400 })
    }

    // Validate usage type
    const validTypes = ['message', 'campaign', 'prospect', 'ai_credits']
    if (!validTypes.includes(usageType)) {
      return NextResponse.json({
        error: `Invalid usage type. Must be one of: ${validTypes.join(', ')}`
      }, { status: 400 })
    }

    // Get workspace and organization info
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, organization_id, trial_ends_at, billing_starts_at')
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({
        error: 'Workspace not found'
      }, { status: 404 })
    }

    // Check if workspace is in trial period
    const now = new Date()
    const trialEndsAt = workspace.trial_ends_at ? new Date(workspace.trial_ends_at) : null
    const isInTrial = trialEndsAt && now < trialEndsAt

    // Only track usage if NOT in trial period (billing has started)
    if (!isInTrial) {
      // Insert usage record
      const { error: usageError } = await supabase
        .from('workspace_usage')
        .insert({
          workspace_id: workspaceId,
          organization_id: workspace.organization_id,
          usage_type: usageType,
          quantity,
          metadata
        })

      if (usageError) {
        console.error('Usage tracking error:', usageError)
        return NextResponse.json({
          error: 'Failed to track usage'
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        tracked: true,
        message: 'Usage tracked successfully',
        isInTrial: false
      })
    } else {
      // In trial period - don't track usage for billing
      return NextResponse.json({
        success: true,
        tracked: false,
        message: 'Workspace is in trial period - usage not tracked for billing',
        isInTrial: true,
        trialEndsAt: trialEndsAt?.toISOString()
      })
    }

  } catch (error) {
    console.error('Usage tracking error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to track usage' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/billing/track-usage?workspaceId={id}&startDate={date}&endDate={date}
 *
 * Retrieves usage data for a workspace within a date range
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!workspaceId) {
      return NextResponse.json({
        error: 'Missing required parameter: workspaceId'
      }, { status: 400 })
    }

    // Build query
    let query = supabase
      .from('workspace_usage')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    // Add date filters if provided
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: usage, error: usageError } = await query

    if (usageError) {
      console.error('Usage retrieval error:', usageError)
      return NextResponse.json({
        error: 'Failed to retrieve usage data'
      }, { status: 500 })
    }

    // Aggregate usage by type
    const aggregated = usage.reduce((acc: any, record: any) => {
      const type = record.usage_type
      if (!acc[type]) {
        acc[type] = 0
      }
      acc[type] += record.quantity
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      workspaceId,
      period: {
        start: startDate || 'all time',
        end: endDate || 'now'
      },
      usage: aggregated,
      details: usage
    })

  } catch (error) {
    console.error('Usage retrieval error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve usage' },
      { status: 500 }
    )
  }
}
