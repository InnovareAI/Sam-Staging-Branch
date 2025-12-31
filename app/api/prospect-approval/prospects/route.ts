import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

/**
 * GET /api/prospect-approval/prospects?session_id=xxx
 * Returns all prospects for a specific approval session
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId, userEmail } = await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    // Pagination parameters
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(10000, Math.max(1, Number(searchParams.get('limit')) || 1000));
    const sortBy = searchParams.get('sort_by') || 'enrichment_score';
    const sortOrder = searchParams.get('sort_order') || 'desc';
    const status = searchParams.get('status'); // 'all' | 'pending' | 'approved' | 'rejected'

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session ID required'
      }, { status: 400 });
    }

    // Get session details including metadata
    console.log(`🔍 [PROSPECTS] Looking up session: ${sessionId}`);
    const sessionResult = await pool.query(
      'SELECT user_id, workspace_id, metadata FROM prospect_approval_sessions WHERE id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      console.error(`❌ [PROSPECTS] Session not found: ${sessionId}`);
      return NextResponse.json({
        success: false,
        error: 'Session not found',
        debug: { sessionId }
      }, { status: 404 });
    }

    const session = sessionResult.rows[0];

    // Security check: session must belong to user's workspace
    const isSuperAdmin = ['tl@innovareai.com', 'cl@innovareai.com'].includes(userEmail.toLowerCase());

    console.log(`🔐 [PROSPECTS] Auth check: user=${userEmail}, workspaceId=${workspaceId}, session.workspace_id=${session.workspace_id}, isSuperAdmin=${isSuperAdmin}`);

    if (!isSuperAdmin && session.workspace_id !== workspaceId) {
      console.log(`❌ [PROSPECTS] Access denied - workspace mismatch`);
      return NextResponse.json({
        success: false,
        error: 'Access denied - session belongs to different workspace'
      }, { status: 403 });
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Check if session uses new architecture (workspace_prospects table)
    const sessionMetadata = session.metadata as { new_architecture?: boolean; batch_id?: string } | null;
    const isNewArchitecture = sessionMetadata?.new_architecture === true;
    const batchId = sessionMetadata?.batch_id;

    console.log(`🔍 [PROSPECTS] Session ${sessionId}: new_architecture=${isNewArchitecture}, batch_id=${batchId}`);

    let prospects: any[] = [];

    if (isNewArchitecture && batchId) {
      // NEW ARCHITECTURE: Query from workspace_prospects table using batch_id
      console.log(`🔍 [PROSPECTS] Querying workspace_prospects for batch_id: ${batchId}`);

      let query = `SELECT * FROM workspace_prospects WHERE workspace_id = $1 AND batch_id = $2`;
      const params: any[] = [session.workspace_id, batchId];

      // Apply status filter if specified
      if (status && status !== 'all') {
        query += ' AND approval_status = $3';
        params.push(status);
      }

      // Apply sorting
      const sortColumn = sortBy === 'enrichment_score' ? 'created_at' : sortBy;
      query += ` ORDER BY ${sortColumn} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;

      const prospectsResult = await pool.query(query, params);

      console.log(`📊 [PROSPECTS] workspace_prospects result: ${prospectsResult.rows.length} prospects`);

      // Map workspace_prospects format to expected format
      prospects = (prospectsResult.rows || []).map((p: any) => ({
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
      }));
    } else {
      // LEGACY ARCHITECTURE: Query from prospect_approval_data table
      // Get all decisions for this session first
      const decisionsResult = await pool.query(
        'SELECT prospect_id, decision, reason, decided_by, decided_at FROM prospect_approval_decisions WHERE session_id = $1',
        [sessionId]
      );

      // Create a map of decisions by prospect_id for fast lookup
      const decisionsMap = new Map(
        (decisionsResult.rows || []).map(d => [d.prospect_id, d])
      );

      console.log(`🔍 [PROSPECTS] Querying prospect_approval_data for session: ${sessionId}`);

      // Apply sorting
      const query = `SELECT * FROM prospect_approval_data WHERE session_id = $1 ORDER BY ${sortBy} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
      const prospectsResult = await pool.query(query, [sessionId]);

      console.log(`📊 [PROSPECTS] Query result: ${prospectsResult.rows.length} prospects`);

      // Merge prospects with their decision metadata
      prospects = (prospectsResult.rows || []).map((p: any) => {
        const decision = decisionsMap.get(p.prospect_id);
        return {
          ...p,
          approval_status: decision?.decision || 'pending',
          decision_reason: decision?.reason || null,
          decided_by: decision?.decided_by || null,
          decided_at: decision?.decided_at || null
        };
      });
    }

    // For LEGACY architecture, apply status filter after merging
    if (!isNewArchitecture && status && status !== 'all') {
      prospects = prospects.filter(p => p.approval_status === status);
    }

    // Apply pagination AFTER filtering
    const totalCount = prospects.length;
    prospects = prospects.slice(offset, offset + limit);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    console.log(`✅ Loaded ${prospects.length} prospects (page ${page}/${totalPages}, ${totalCount} total after filtering) for session ${sessionId}`);

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
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Prospects fetch error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);

    const body = await request.json();
    const { session_id, prospects_data } = body;

    if (!session_id || !prospects_data || !Array.isArray(prospects_data)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data'
      }, { status: 400 });
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
    }));

    let insertedCount = 0;
    for (const record of prospectRecords) {
      try {
        await pool.query(
          `INSERT INTO prospect_approval_data
           (session_id, prospect_id, name, title, company, contact, location, profile_image, recent_activity, connection_degree, enrichment_score, source, enriched_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [record.session_id, record.prospect_id, record.name, record.title, JSON.stringify(record.company),
           JSON.stringify(record.contact), record.location, record.profile_image, JSON.stringify(record.recent_activity),
           record.connection_degree, record.enrichment_score, record.source, record.enriched_at, record.created_at]
        );
        insertedCount++;
      } catch (insertError) {
        console.error('Error inserting prospect:', insertError);
      }
    }

    // Update session with prospect count
    await pool.query(
      'UPDATE prospect_approval_sessions SET total_prospects = $1, pending_count = $2 WHERE id = $3',
      [prospects_data.length, prospects_data.length, session_id]
    );

    // Schedule email notification for inactive users (2-3 hour randomized delay)
    const randomMinutes = 120 + Math.floor(Math.random() * 60);
    const notificationScheduledFor = new Date(Date.now() + randomMinutes * 60 * 1000);

    await pool.query(
      `UPDATE prospect_approval_sessions SET notification_scheduled_at = $1, user_last_active_at = $2 WHERE id = $3`,
      [notificationScheduledFor.toISOString(), new Date().toISOString(), session_id]
    );

    console.log(`📧 Email notification scheduled for ${notificationScheduledFor.toISOString()} (${randomMinutes} min delay) if user remains inactive`);

    return NextResponse.json({
      success: true,
      prospects: insertedCount,
      message: `Added ${insertedCount} prospects to approval session`
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Prospects insert error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
