import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabase-route-client'

/**
 * POST /api/campaigns/add-approved-prospects
 * Add approved prospects to a campaign
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient()

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const { campaign_id, workspace_id, prospect_ids } = body

    if (!campaign_id || !workspace_id || !prospect_ids || !Array.isArray(prospect_ids)) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: campaign_id, workspace_id, prospect_ids'
      }, { status: 400 })
    }

    // Verify workspace access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({
        success: false,
        error: 'Not a member of this workspace'
      }, { status: 403 })
    }

    // Get approved prospect data (with session info for workspace validation)
    const { data: prospects, error: prospectError } = await supabase
      .from('prospect_approval_data')
      .select(`
        *,
        prospect_approval_sessions(
          workspace_id,
          campaign_name,
          campaign_tag
        )
      `)
      .in('prospect_id', prospect_ids)
      .eq('approval_status', 'approved')

    // Filter prospects that match workspace_id
    const validProspects = (prospects || []).filter(
      p => p.prospect_approval_sessions?.workspace_id === workspace_id
    )

    if (prospectError) {
      console.error('Error fetching approved prospects:', prospectError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch approved prospects'
      }, { status: 500 })
    }

    if (!validProspects || validProspects.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No approved prospects found with provided IDs for this workspace'
      }, { status: 404 })
    }

    // Transform prospects to campaign_prospects format
    const campaignProspects = validProspects.map(prospect => {
      // Extract name parts
      const nameParts = (prospect.name || '').split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      return {
        campaign_id,
        workspace_id,
        first_name: firstName,
        last_name: lastName,
        email: prospect.contact?.email || null,
        company_name: prospect.company?.name || '',
        linkedin_url: prospect.contact?.linkedin_url || null,
        title: prospect.title || '',
        location: prospect.location || null,
        industry: prospect.company?.industry?.[0] || 'Not specified',
        status: 'approved',
        notes: null,
        personalization_data: {
          source: 'approved_prospects',
          campaign_name: prospect.prospect_approval_sessions?.campaign_name,
          campaign_tag: prospect.prospect_approval_sessions?.campaign_tag,
          approved_at: new Date().toISOString(),
          connection_degree: prospect.connection_degree
        }
      }
    })

    // Insert into campaign_prospects
    const { data: insertedProspects, error: insertError } = await supabase
      .from('campaign_prospects')
      .insert(campaignProspects)
      .select()

    if (insertError) {
      console.error('Error inserting campaign prospects:', insertError)
      return NextResponse.json({
        success: false,
        error: 'Failed to add prospects to campaign',
        details: insertError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Added ${insertedProspects.length} prospects to campaign`,
      added_count: insertedProspects.length,
      prospects: insertedProspects
    })

  } catch (error) {
    console.error('Add approved prospects error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
