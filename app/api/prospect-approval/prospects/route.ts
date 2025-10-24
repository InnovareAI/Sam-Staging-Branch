import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/app/lib/supabase'

/**
 * GET /api/prospect-approval/prospects?session_id=xxx
 * Returns all prospects for a specific approval session
 * FIXED: Use createServerClient (@supabase/ssr) for consistent auth with browser
 * FIXED: Use workspace_members table instead of non-existent user_organizations
 * FIXED: Use workspace_id column instead of non-existent organization_id
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    // Pagination parameters
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))
    const sortBy = searchParams.get('sort_by') || 'enrichment_score'
    const sortOrder = searchParams.get('sort_order') || 'desc'
    const status = searchParams.get('status') // 'all' | 'pending' | 'approved' | 'rejected'

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session ID required'
      }, { status: 400 })
    }

    // Use @supabase/ssr createServerClient (matches browser client)
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

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // CRITICAL FIX: Use admin client to bypass RLS when querying users table
    const adminClient = supabaseAdmin()
    const { data: userProfile } = await adminClient
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    let workspaceId = userProfile?.current_workspace_id

    // Fallback: get first workspace from memberships
    if (!workspaceId) {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      workspaceId = membership?.workspace_id
    }

    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'No workspace found'
      }, { status: 404 })
    }

    // FIXED: Verify session belongs to user's workspace using workspace_id not organization_id
    const { data: session, error: sessionError } = await supabase
      .from('prospect_approval_sessions')
      .select('user_id, workspace_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({
        success: false,
        error: 'Session not found'
      }, { status: 404 })
    }

    // Security check: session must belong to user's workspace
    const userEmail = user.email?.toLowerCase() || ''
    const isSuperAdmin = ['tl@innovareai.com', 'cl@innovareai.com'].includes(userEmail)

    if (!isSuperAdmin && session.workspace_id !== workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'Access denied - session belongs to different workspace'
      }, { status: 403 })
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit

    // Build query with pagination and filters
    let query = supabase
      .from('prospect_approval_data')
      .select('*', { count: 'exact' })
      .eq('session_id', sessionId)

    // Apply status filter if specified
    if (status && status !== 'all') {
      query = query.eq('approval_status', status)
    }

    // Apply sorting and pagination
    const { data: prospectsRaw, error, count } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    if (error) throw error

    // Get all decisions for this session to get decision metadata
    const { data: decisions } = await supabase
      .from('prospect_approval_decisions')
      .select('prospect_id, reason, decided_by, decided_at')
      .eq('session_id', sessionId)

    // Create a map of decisions by prospect_id for fast lookup
    const decisionsMap = new Map(
      (decisions || []).map(d => [d.prospect_id, d])
    )

    // Merge prospects with their decision metadata (approval_status comes from prospect_approval_data)
    const prospects = (prospectsRaw || []).map((p: any) => {
      const decision = decisionsMap.get(p.prospect_id)
      return {
        ...p,
        approval_status: p.approval_status || 'pending', // Use status from prospect_approval_data table
        decision_reason: decision?.reason || null,
        decided_by: decision?.decided_by || null,
        decided_at: decision?.decided_at || null
      }
    })

    const totalPages = Math.ceil((count || 0) / limit)
    const hasNext = page < totalPages
    const hasPrev = page > 1

    console.log(`✅ Loaded ${prospects.length} prospects (page ${page}/${totalPages}) for session ${sessionId}`)

    return NextResponse.json({
      success: true,
      prospects,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext,
        hasPrev,
        showing: prospects.length
      }
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

    // Use admin client for POST operations (bypasses RLS)
    const supabase = supabaseAdmin()

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

    // Schedule email notification for inactive users (2-3 hour randomized delay)
    // Randomize between 2-3 hours to avoid all emails sending at same time
    const randomMinutes = 120 + Math.floor(Math.random() * 60) // 120-180 minutes
    const notificationScheduledFor = new Date(Date.now() + randomMinutes * 60 * 1000)

    await supabase
      .from('prospect_approval_sessions')
      .update({
        notification_scheduled_at: notificationScheduledFor.toISOString(),
        user_last_active_at: new Date().toISOString()
      })
      .eq('id', session_id)

    console.log(`📧 Email notification scheduled for ${notificationScheduledFor.toISOString()} (${randomMinutes} min delay) if user remains inactive`)

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