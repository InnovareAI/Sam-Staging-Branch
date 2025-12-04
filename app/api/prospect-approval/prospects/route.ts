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
    const limit = Math.min(10000, Math.max(1, Number(searchParams.get('limit')) || 1000))
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
    console.log(`🔑 [PROSPECTS] Service key prefix: ${process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) || 'NOT SET'}...`)
    const { data: userProfile } = await adminClient
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    let workspaceId = userProfile?.current_workspace_id

    // Fallback: get first workspace from memberships
    // CRITICAL FIX: Use adminClient to bypass RLS (Nov 28)
    if (!workspaceId) {
      const { data: membership } = await adminClient
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
    // CRITICAL FIX: Use adminClient to bypass RLS (Nov 28)
    // CRITICAL FIX (Dec 4): Also fetch metadata to check if using new architecture
    console.log(`🔍 [PROSPECTS] Looking up session: ${sessionId}`);
    const { data: session, error: sessionError } = await adminClient
      .from('prospect_approval_sessions')
      .select('user_id, workspace_id, metadata')
      .eq('id', sessionId)
      .single()

    console.log(`🔍 [PROSPECTS] Session lookup result:`, {
      found: !!session,
      error: sessionError?.message || 'none',
      errorCode: sessionError?.code || 'none'
    });

    if (sessionError || !session) {
      console.error(`❌ [PROSPECTS] Session not found: ${sessionId}, error: ${JSON.stringify(sessionError)}`);
      return NextResponse.json({
        success: false,
        error: 'Session not found',
        debug: { sessionId, errorMessage: sessionError?.message, errorCode: sessionError?.code }
      }, { status: 404 })
    }

    // Security check: session must belong to user's workspace
    const userEmail = user.email?.toLowerCase() || ''
    const isSuperAdmin = ['tl@innovareai.com', 'cl@innovareai.com'].includes(userEmail)

    console.log(`🔐 [PROSPECTS] Auth check: user=${userEmail}, workspaceId=${workspaceId}, session.workspace_id=${session.workspace_id}, isSuperAdmin=${isSuperAdmin}`);

    if (!isSuperAdmin && session.workspace_id !== workspaceId) {
      console.log(`❌ [PROSPECTS] Access denied - workspace mismatch`);
      return NextResponse.json({
        success: false,
        error: 'Access denied - session belongs to different workspace'
      }, { status: 403 })
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit

    // CRITICAL FIX (Dec 4): Check if session uses new architecture (workspace_prospects table)
    const sessionMetadata = session.metadata as { new_architecture?: boolean; batch_id?: string } | null
    const isNewArchitecture = sessionMetadata?.new_architecture === true
    const batchId = sessionMetadata?.batch_id

    console.log(`🔍 [PROSPECTS] Session ${sessionId}: new_architecture=${isNewArchitecture}, batch_id=${batchId}`);

    let prospects: any[] = []

    if (isNewArchitecture && batchId) {
      // NEW ARCHITECTURE: Query from workspace_prospects table using batch_id
      console.log(`🔍 [PROSPECTS] Querying workspace_prospects for batch_id: ${batchId}`);

      let query = adminClient
        .from('workspace_prospects')
        .select('*', { count: 'exact' })
        .eq('workspace_id', session.workspace_id)
        .eq('batch_id', batchId)

      // Apply status filter if specified
      if (status && status !== 'all') {
        query = query.eq('approval_status', status)
      }

      // Apply sorting - map sortBy to correct column names
      const sortColumn = sortBy === 'enrichment_score' ? 'created_at' : sortBy
      const { data: prospectsRaw, error } = await query
        .order(sortColumn, { ascending: sortOrder === 'asc' })

      console.log(`📊 [PROSPECTS] workspace_prospects result: ${prospectsRaw?.length || 0} prospects, error: ${error?.message || 'none'}`);

      if (error) throw error

      // Map workspace_prospects format to expected format
      prospects = (prospectsRaw || []).map((p: any) => ({
        prospect_id: p.id,
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown',
        title: p.title || '',
        company: { name: p.company || '', industry: p.enrichment_data?.industry || '' },
        contact: {
          email: p.email || '',
          linkedin_url: p.linkedin_url || '',
          linkedin_user_id: p.linkedin_user_id || null,
          phone: p.phone || ''
        },
        location: p.location || '',
        connection_degree: p.connection_degree,
        enrichment_score: p.enrichment_data?.enrichment_score || 70,
        source: p.source || 'csv_upload',
        approval_status: p.approval_status || 'pending',
        linkedin_user_id: p.linkedin_user_id || null,
        created_at: p.created_at,
        workspace_id: p.workspace_id
      }))
    } else {
      // LEGACY ARCHITECTURE: Query from prospect_approval_data table
      // Get all decisions for this session first
      const { data: decisions } = await adminClient
        .from('prospect_approval_decisions')
        .select('prospect_id, decision, reason, decided_by, decided_at')
        .eq('session_id', sessionId)

      // Create a map of decisions by prospect_id for fast lookup
      const decisionsMap = new Map(
        (decisions || []).map(d => [d.prospect_id, d])
      )

      // Build query - get ALL prospects first, we'll filter by status after joining decisions
      // USE ADMIN CLIENT to bypass RLS policies
      console.log(`🔍 [PROSPECTS] Querying prospect_approval_data for session: ${sessionId}`);

      let query = adminClient
        .from('prospect_approval_data')
        .select('*', { count: 'exact' })
        .eq('session_id', sessionId)

      // Apply sorting
      const { data: prospectsRaw, error } = await query
        .order(sortBy, { ascending: sortOrder === 'asc' })

      console.log(`📊 [PROSPECTS] Query result: ${prospectsRaw?.length || 0} prospects, error: ${error?.message || 'none'}`);

      if (error) throw error

      // Merge prospects with their decision metadata
      // CRITICAL: prospect_approval_data does NOT have approval_status column
      // We must get status from prospect_approval_decisions table
      prospects = (prospectsRaw || []).map((p: any) => {
        const decision = decisionsMap.get(p.prospect_id)
        return {
          ...p,
          // Get status from decision, default to 'pending' if no decision exists
          approval_status: decision?.decision || 'pending',
          decision_reason: decision?.reason || null,
          decided_by: decision?.decided_by || null,
          decided_at: decision?.decided_at || null
        }
      })
    }

    // For LEGACY architecture, apply status filter after merging (can't filter on non-existent column before)
    // For NEW architecture, status filter was already applied in the query above
    if (!isNewArchitecture && status && status !== 'all') {
      prospects = prospects.filter(p => p.approval_status === status)
    }

    // Apply pagination AFTER filtering
    const totalCount = prospects.length
    prospects = prospects.slice(offset, offset + limit)

    const totalPages = Math.ceil(totalCount / limit)
    const hasNext = page < totalPages
    const hasPrev = page > 1

    console.log(`✅ Loaded ${prospects.length} prospects (page ${page}/${totalPages}, ${totalCount} total after filtering) for session ${sessionId}`)

    return NextResponse.json({
      success: true,
      prospects,
      pagination: {
        page,
        limit,
        total: totalCount,
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