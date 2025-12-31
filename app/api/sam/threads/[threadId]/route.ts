/**
 * SAM AI Individual Thread Management API
 * 
 * Handles updates and deletion of specific conversation threads
 * Updated Dec 31, 2025: Migrated to verifyAuth and pool.query
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const resolvedParams = await params
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const { rows } = await pool.query(
      'SELECT * FROM sam_conversation_threads WHERE id = $1 AND user_id = $2',
      [resolvedParams.threadId, auth.user.uid]
    );

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Thread not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      thread: rows[0]
    })

  } catch (error) {
    console.error('Get thread API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const resolvedParams = await params
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const allowedFields = [
      'title', 'status', 'prospect_name', 'prospect_company',
      'prospect_linkedin_url', 'campaign_id', 'campaign_name',
      'tags', 'priority', 'current_discovery_stage',
      'discovery_progress', 'sales_methodology', 'deal_stage', 'deal_value'
    ]

    const setClauses: string[] = [];
    const queryParams: any[] = [resolvedParams.threadId, auth.user.uid];

    Object.keys(body).forEach(key => {
      if (allowedFields.includes(key)) {
        queryParams.push(body[key]);
        setClauses.push(`${key} = $${queryParams.length}`);
      }
    });

    if (setClauses.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid fields to update'
      }, { status: 400 })
    }

    const sql = `
      UPDATE sam_conversation_threads 
      SET ${setClauses.join(', ')}, updated_at = NOW() 
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const { rows } = await pool.query(sql, queryParams);

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Thread not found or unauthorized'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      thread: rows[0],
      message: 'Thread updated successfully'
    })

  } catch (error) {
    console.error('Update thread API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const resolvedParams = await params
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const res = await pool.query(
      'DELETE FROM sam_conversation_threads WHERE id = $1 AND user_id = $2',
      [resolvedParams.threadId, auth.user.uid]
    );

    if (res.rowCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Thread not found or unauthorized'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Thread deleted successfully'
    })

  } catch (error) {
    console.error('Delete thread API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}