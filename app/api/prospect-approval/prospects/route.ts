import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session ID required'
      }, { status: 400 })
    }

    // 🚨 SECURITY: Get user authentication for workspace filtering
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Create user client to get authenticated user
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: authHeader } }
      }
    )

    const { data: { user }, error: authError } = await userSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Invalid authentication'
      }, { status: 401 })
    }

    // Get user's organization/workspace
    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!userOrg) {
      return NextResponse.json({
        success: false,
        error: 'User not associated with any workspace'
      }, { status: 403 })
    }

    // 🛡️ SECURITY: First verify the session belongs to the user's workspace
    const { data: session, error: sessionError } = await supabase
      .from('prospect_approval_sessions')
      .select('user_id, organization_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({
        success: false,
        error: 'Session not found'
      }, { status: 404 })
    }

    // Only allow access if session belongs to user's workspace OR user is super admin
    const userEmail = user.email?.toLowerCase() || ''
    const isSuperAdmin = ['tl@innovareai.com', 'cl@innovareai.com'].includes(userEmail)
    
    if (!isSuperAdmin && session.organization_id !== userOrg.organization_id) {
      return NextResponse.json({
        success: false,
        error: 'Access denied - session belongs to different workspace'
      }, { status: 403 })
    }

    // Get prospects for this session (now workspace-validated)
    const { data: prospects, error } = await supabase
      .from('prospect_approval_data')
      .select('*')
      .eq('session_id', sessionId)
      .order('enrichment_score', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      prospects: prospects || []
    })

  } catch (error) {
    console.error('Prospects fetch error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id, prospects_data } = body

    if (!session_id || !prospects_data || !Array.isArray(prospects_data)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data'
      }, { status: 400 })
    }

    // Insert prospects data
    const prospectRecords = prospects_data.map(prospect => ({
      session_id,
      prospect_id: prospect.id,
      name: prospect.name,
      title: prospect.title,
      company: prospect.company,
      contact: prospect.contact,
      location: prospect.location,
      profile_image: prospect.profile_image,
      recent_activity: prospect.recent_activity,
      connection_degree: prospect.connection_degree,
      enrichment_score: prospect.enrichment_score,
      source: prospect.source || 'unipile_linkedin_search',
      enriched_at: prospect.enriched_at || new Date().toISOString(),
      created_at: new Date().toISOString()
    }))

    const { data: insertedProspects, error } = await supabase
      .from('prospect_approval_data')
      .insert(prospectRecords)
      .select()

    if (error) throw error

    // Update session with prospect count
    const { error: updateError } = await supabase
      .from('prospect_approval_sessions')
      .update({
        total_prospects: prospects_data.length,
        pending_count: prospects_data.length
      })
      .eq('id', session_id)

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      prospects: insertedProspects,
      message: `Added ${prospects_data.length} prospects to approval session`
    })

  } catch (error) {
    console.error('Prospects insert error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}