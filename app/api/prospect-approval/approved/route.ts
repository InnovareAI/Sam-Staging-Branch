import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * GET /api/prospect-approval/approved?workspace_id=xxx
 * Get all approved prospects ready for campaign creation
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
            cookiesToSet.forEach(({ name, value, options}) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')
    const sessionId = searchParams.get('session_id') // Optional: filter by specific session

    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'workspace_id required'
      }, { status: 400 })
    }

    // Verify workspace access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({
        success: false,
        error: 'Not a member of this workspace'
      }, { status: 403 })
    }

    // Get approved prospects from prospect_approval_data (join with sessions for workspace_id)
    // If session_id is provided, only get prospects from that specific session
    let sessionIds: string[] = []

    if (sessionId) {
      // Filter by specific session - verify it belongs to this workspace
      const { data: session, error: sessionError } = await supabase
        .from('prospect_approval_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('workspace_id', workspaceId)
        .single()

      if (sessionError || !session) {
        return NextResponse.json({
          success: true,
          prospects: [],
          total: 0
        })
      }
      sessionIds = [session.id]
    } else {
      // Get all sessions for workspace
      const { data: sessions, error: sessionsError } = await supabase
        .from('prospect_approval_sessions')
        .select('id')
        .eq('workspace_id', workspaceId)

      if (sessionsError) {
        console.error('Error fetching sessions:', sessionsError)
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch approval sessions'
        }, { status: 500 })
      }
      sessionIds = (sessions || []).map(s => s.id)
    }

    if (sessionIds.length === 0) {
      return NextResponse.json({
        success: true,
        prospects: [],
        total: 0
      })
    }

    const { data: approvedData, error: dataError } = await supabase
      .from('prospect_approval_data')
      .select(`
        *,
        prospect_approval_sessions(
          workspace_id,
          campaign_id,
          campaign_name,
          campaign_tag,
          prospect_source,
          campaigns(campaign_type)
        )
      `)
      .in('session_id', sessionIds)
      .eq('approval_status', 'approved')
      .order('created_at', { ascending: false })

    if (dataError) {
      console.error('Error fetching approved prospects:', dataError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch approved prospects'
      }, { status: 500 })
    }

    // Filter out prospects that are already in campaigns
    const prospectsWithCampaignStatus = await Promise.all(
      (approvedData || []).map(async (prospect) => {
        // CRITICAL FIX: Extract LinkedIn URL from contact JSONB object
        const linkedinUrl = prospect.contact?.linkedin_url || prospect.linkedin_url || null;

        // Check if this prospect is already in ANY campaign
        // CRITICAL FIX: Use .limit(1) instead of .single() to avoid errors when prospect is in multiple campaigns
        const { data: campaignProspects } = await supabase
          .from('campaign_prospects')
          .select('campaign_id, campaigns(name, status)')
          .eq('linkedin_url', linkedinUrl)
          .limit(1)

        const campaignProspect = campaignProspects?.[0] || null;

        return {
          ...prospect,
          // CRITICAL FIX: Flatten linkedin_url to top level for campaign creation
          linkedin_url: linkedinUrl,
          // CRITICAL FIX (Dec 7): Flatten campaign_name from session to top level for CampaignHub
          campaignName: prospect.prospect_approval_sessions?.campaign_name || 'Approved Prospects',
          campaignTag: prospect.prospect_approval_sessions?.campaign_tag || 'approved',
          sessionId: prospect.session_id,
          in_campaign: !!campaignProspect,
          campaign_id: campaignProspect?.campaign_id,
          campaign_name: campaignProspect?.campaigns?.name
        }
      })
    )

    // Only return prospects NOT in campaigns AND with valid LinkedIn URLs
    // Prospects without LinkedIn URLs cannot be used for LinkedIn campaigns
    const availableProspects = prospectsWithCampaignStatus.filter(p =>
      !p.in_campaign && p.linkedin_url && p.linkedin_url.trim() !== ''
    )

    return NextResponse.json({
      success: true,
      prospects: availableProspects,
      total: availableProspects.length
    })

  } catch (error) {
    console.error('Approved prospects fetch error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
