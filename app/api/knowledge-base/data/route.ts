import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Firebase auth verification
    let workspaceId: string;

    try {
      const auth = await verifyAuth(request);
      workspaceId = auth.workspaceId;
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: 'Unauthorized' }, { status: authError.statusCode || 401 });
    }

    const { searchParams } = new URL(request.url);
    const providedWorkspaceId = searchParams.get('workspace_id');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const icpId = searchParams.get('icp_id'); // Optional ICP filter

    // Use provided workspace_id if available, otherwise use auth workspace
    const targetWorkspaceId = providedWorkspaceId || workspaceId;

    // Build query for the correct knowledge_base table
    let query = `
      SELECT kb.*, kbi.id as icp_id, kbi.icp_name
      FROM knowledge_base kb
      LEFT JOIN knowledge_base_icps kbi ON kb.icp_id = kbi.id
      WHERE kb.is_active = true AND (kb.workspace_id = $1 OR kb.workspace_id IS NULL)
    `;
    const params: any[] = [targetWorkspaceId];
    let paramIndex = 2;

    // Filter by ICP: show ICP-specific content + global content (icp_id is null)
    if (icpId) {
      query += ` AND (kb.icp_id = $${paramIndex} OR kb.icp_id IS NULL)`;
      params.push(icpId);
      paramIndex++;
    }

    if (category) {
      query += ` AND kb.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (search) {
      query += ` AND (kb.content ILIKE $${paramIndex} OR kb.title ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY kb.created_at DESC`;

    const result = await pool.query(query, params);
    const content = result.rows;

    // Group by category for easy display
    const groupedContent = content?.reduce((acc: any, item: any) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {}) || {};

    return NextResponse.json({
      content: content || [],
      grouped: groupedContent,
      categories: Object.keys(groupedContent)
    });
  } catch (error) {
    console.error('Unexpected error in KB data API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Firebase auth verification
    let workspaceId: string;

    try {
      const auth = await verifyAuth(request);
      workspaceId = auth.workspaceId;
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: 'Unauthorized' }, { status: authError.statusCode || 401 });
    }

    const body = await request.json();
    const { workspace_id, category, subcategory, title, content, tags, icp_id } = body;

    // Use provided workspace_id if available, otherwise use auth workspace
    const targetWorkspaceId = workspace_id || workspaceId;

    if (!category || !title || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create new knowledge base entry
    // icp_id: null = global (all ICPs), UUID = specific ICP only
    const insertResult = await pool.query(
      `INSERT INTO knowledge_base (workspace_id, category, subcategory, title, content, tags, icp_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [targetWorkspaceId, category, subcategory, title, content, tags || [], icp_id || null]
    );

    if (insertResult.rows.length === 0) {
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
    }

    const newEntry = insertResult.rows[0];

    // Fetch ICP info if available
    if (newEntry.icp_id) {
      const icpResult = await pool.query(
        `SELECT id, icp_name FROM knowledge_base_icps WHERE id = $1`,
        [newEntry.icp_id]
      );
      if (icpResult.rows.length > 0) {
        newEntry.icp = icpResult.rows[0];
      }
    }

    return NextResponse.json({ entry: newEntry }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in KB data POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
