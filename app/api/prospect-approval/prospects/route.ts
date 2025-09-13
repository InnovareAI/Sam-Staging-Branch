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

    // Get prospects for this session
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