/**
 * SAM AI Approved Prospects API
 * 
 * Handles storage and management of user-approved prospect data
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const user = auth.user;
    const body = await request.json()
    const { threadId, prospects } = body

    if (!threadId || !prospects || !Array.isArray(prospects)) {
      return NextResponse.json({
        success: false,
        error: 'Thread ID and prospects array are required'
      }, { status: 400 })
    }

    // Verify thread ownership
    const threadRes = await pool.query(
      'SELECT id, user_id FROM sam_conversation_threads WHERE id = $1 AND user_id = $2',
      [threadId, user.uid]
    );

    if (threadRes.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Thread not found'
      }, { status: 404 })
    }

    const insertedProspects = [];

    // Prepared prospect data for database insertion
    // Using a loop to handle multiple prospects - in production, a bulk insert would be better
    // but we'll stick to a simple loop for clarity or use a multi-row insert if needed.
    // Let's use a multi-row insert for efficiency.

    for (const prospect of prospects) {
      const query = `
        INSERT INTO sam_approved_prospects 
        (user_id, thread_id, prospect_id, name, title, company, email, phone, linkedin_url, source_platform, confidence_score, compliance_flags, approval_status, approved_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        RETURNING *
      `;

      const values = [
        user.uid,
        threadId,
        prospect.id,
        prospect.name,
        prospect.title,
        prospect.company,
        prospect.email || null,
        prospect.phone || null,
        prospect.linkedinUrl || null,
        prospect.source,
        prospect.confidence,
        JSON.stringify(prospect.complianceFlags || []),
        'approved'
      ];

      const res = await pool.query(query, values);
      insertedProspects.push(res.rows[0]);
    }

    // Update thread metadata
    await pool.query(
      'UPDATE sam_conversation_threads SET updated_at = NOW() WHERE id = $1',
      [threadId]
    );

    return NextResponse.json({
      success: true,
      message: `Successfully saved ${prospects.length} approved prospects`,
      data: {
        saved_count: insertedProspects.length,
        prospects: insertedProspects
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Approved prospects API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const user = auth.user;
    const { searchParams } = new URL(request.url)
    const threadId = searchParams.get('threadId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = `
      SELECT p.*, t.title as thread_title, t.thread_type
      FROM sam_approved_prospects p
      LEFT JOIN sam_conversation_threads t ON p.thread_id = t.id
      WHERE p.user_id = $1
    `;

    const params: any[] = [user.uid];

    if (threadId) {
      query += ` AND p.thread_id = $2`;
      params.push(threadId);
    }

    query += ` ORDER BY p.approved_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const prospectsRes = await pool.query(query, params);

    // Transform to match original Supabase structure if nested objects were expected
    const prospects = prospectsRes.rows.map(row => ({
      ...row,
      sam_conversation_threads: {
        title: row.thread_title,
        thread_type: row.thread_type
      }
    }));

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM sam_approved_prospects WHERE user_id = $1`;
    const countParams: any[] = [user.uid];

    if (threadId) {
      countQuery += ` AND thread_id = $2`;
      countParams.push(threadId);
    }

    const countRes = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countRes.rows[0].total);

    return NextResponse.json({
      success: true,
      data: {
        prospects: prospects || [],
        pagination: {
          total: totalCount || 0,
          limit,
          offset,
          hasMore: (totalCount || 0) > (offset + limit)
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Get approved prospects API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}