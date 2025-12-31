/**
 * SAM AI Threaded Conversations API
 *
 * Handles creation and listing of conversation threads
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

// Helper to resolve workspace ID using PG pool
async function resolveWorkspaceId(
  userId: string,
  providedWorkspaceId?: string | null
): Promise<string> {
  if (providedWorkspaceId && providedWorkspaceId.trim().length > 0) {
    return providedWorkspaceId;
  }

  // 1. Check user profile for current_workspace_id
  const { rows: profileRows } = await pool.query(
    'SELECT current_workspace_id FROM users WHERE id = $1',
    [userId]
  );

  if (profileRows[0]?.current_workspace_id) {
    return profileRows[0].current_workspace_id;
  }

  // 2. Check for any workspace membership
  const { rows: memberRows } = await pool.query(
    'SELECT workspace_id FROM workspace_members WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
    [userId]
  );

  if (memberRows[0]?.workspace_id) {
    // Auto-update user's current workspace
    await pool.query('UPDATE users SET current_workspace_id = $1 WHERE id = $2', [memberRows[0].workspace_id, userId]);
    return memberRows[0].workspace_id;
  }

  // 3. Fallback: Find *any* workspace (if user is owner but not member? rare)
  // Or just pick the oldest workspace in system? No, that's dangerous.
  // If no membership, we can't do much.

  throw new Error('No workspace found for user');
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);

    // Get query parameters for filtering
    const url = new URL(request.url)
    const threadType = url.searchParams.get('type')
    const status = url.searchParams.get('status') || 'active'
    const priority = url.searchParams.get('priority')
    const search = url.searchParams.get('search')
    const tags = url.searchParams.get('tags')?.split(',')

    // Build query
    let sql = `
      SELECT * FROM sam_conversation_threads
      WHERE user_id = $1
      AND status = $2
    `;
    const params: any[] = [userId, status];

    if (threadType) {
      params.push(threadType);
      sql += ` AND thread_type = $${params.length}`;
    }

    if (priority) {
      params.push(priority);
      sql += ` AND priority = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (title ILIKE $${params.length} OR prospect_name ILIKE $${params.length} OR prospect_company ILIKE $${params.length})`;
    }

    if (tags && tags.length > 0) {
      params.push(tags);
      sql += ` AND tags && $${params.length}::text[]`; // PG array overlap operator
    }

    sql += ` ORDER BY last_active_at DESC`;

    const { rows } = await pool.query(sql, params);

    return NextResponse.json({
      success: true,
      threads: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('Threads API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, userEmail } = await verifyAuth(request);

    const body = await request.json();
    const {
      title,
      thread_type,
      prospect_name,
      prospect_company,
      prospect_linkedin_url,
      campaign_name,
      tags,
      priority = 'medium',
      sales_methodology = 'meddic',
      workspace_id: providedWorkspaceId
    } = body;

    if (!title || !thread_type) {
      return NextResponse.json({
        success: false,
        error: 'Title and thread type are required'
      }, { status: 400 });
    }

    // Resolve workspace
    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(userId, providedWorkspaceId);
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        error: `Unable to resolve workspace: ${error.message}`
      }, { status: 400 });
    }

    // Get user's organization (if any)
    let organizationId = null;
    try {
      const { rows } = await pool.query(
        'SELECT organization_id FROM user_organizations WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      if (rows[0]) organizationId = rows[0].organization_id;
    } catch { }

    // Create thread
    const { rows: threadRows } = await pool.query(`
      INSERT INTO sam_conversation_threads (
        user_id, organization_id, workspace_id, title, thread_type,
        prospect_name, prospect_company, prospect_linkedin_url, campaign_name,
        tags, priority, sales_methodology, created_at, updated_at, last_active_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW(), NOW()
      )
      RETURNING *
    `, [
      userId, organizationId, workspaceId, title, thread_type,
      prospect_name, prospect_company, prospect_linkedin_url, campaign_name,
      tags, priority, sales_methodology
    ]);

    return NextResponse.json({
      success: true,
      thread: threadRows[0],
      message: 'Thread created successfully'
    });

  } catch (error) {
    console.error('Create thread API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
