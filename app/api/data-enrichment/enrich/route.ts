import { NextRequest, NextResponse } from 'next/server'
import { dataEnrichmentPipeline } from '@/lib/data-enrichment/enrichment-pipeline'
import { pool } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      prospect_data,
      user_id,
      workspace_id,
      enrichment_depth = 'standard'
    } = body

    // Validate required fields
    if (!prospect_data || !user_id || !workspace_id) {
      return NextResponse.json(
        { error: 'Missing required fields: prospect_data, user_id, workspace_id' },
        { status: 400 }
      )
    }

    // Start enrichment pipeline
    const result = await dataEnrichmentPipeline.enrichProspectData(
      prospect_data,
      user_id,
      workspace_id,
      enrichment_depth
    )

    // Store enriched data in database
    if (result.enriched_data) {
      const { error: dbError } = await supabase
        .from('enriched_prospects')
        .insert({
          workspace_id,
          user_id,
          prospect_id: `${prospect_data.first_name}-${prospect_data.last_name}-${prospect_data.company_name}`,
          base_data: prospect_data,
          enriched_data: result.enriched_data,
          enrichment_status: result.enriched_data.enrichment_status,
          confidence_score: result.enriched_data.confidence_score,
          icp_score: result.enriched_data.service_fit_analysis?.icp_score || 0,
          manual_review_required: result.approval_required,
          estimated_cost: result.estimated_cost,
          created_at: new Date().toISOString()
        })

      if (dbError) {
        console.error('Database storage error:', dbError)
        // Continue with response even if storage fails
      }
    }

    return NextResponse.json({
      success: true,
      enriched_data: result.enriched_data,
      quota_status: result.quota_status,
      approval_required: result.approval_required,
      estimated_cost: result.estimated_cost,
      error: result.error
    })

  } catch (error) {
    console.error('Enrichment API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Enrichment failed' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspace')
    const userId = searchParams.get('user')
    const prospectId = searchParams.get('prospect_id')

    if (!workspaceId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters: workspace, user' },
        { status: 400 }
      )
    }

    // Get specific prospect or all prospects for workspace
    let query = supabase
      .from('enriched_prospects')
      .select('*')
      .eq('workspace_id', workspaceId)

    if (prospectId) {
      query = query.eq('prospect_id', prospectId)
    }

    const { data: prospects, error } = await query
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({
      success: true,
      prospects: prospects || []
    })

  } catch (error) {
    console.error('Get prospects API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get prospects' },
      { status: 500 }
    )
  }
}