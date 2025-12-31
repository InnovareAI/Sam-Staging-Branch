import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Firebase auth verification
    let userId: string;

    try {
      const auth = await verifyAuth(request);
      userId = auth.userId;
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: 'Unauthorized' }, { status: authError.statusCode || 401 });
    }

    const icpId = params.id;
    const updates = await request.json();

    console.log('[ICP Update] Updating ICP:', icpId, 'with:', JSON.stringify(updates, null, 2));

    // Verify ICP exists and get workspace_id
    const icpResult = await pool.query(
      'SELECT workspace_id FROM icp_configurations WHERE id = $1',
      [icpId]
    );

    if (icpResult.rows.length === 0) {
      console.error('[ICP Update] ICP not found');
      return NextResponse.json({ error: 'ICP not found' }, { status: 404 });
    }

    const icp = icpResult.rows[0];

    // Verify workspace access
    const memberResult = await pool.query(
      'SELECT workspace_id FROM workspace_members WHERE user_id = $1 AND workspace_id = $2',
      [userId, icp.workspace_id]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Build dynamic update query
    const updateFields: string[] = ['updated_at = NOW()'];
    const updateParams: any[] = [];
    let paramIndex = 1;

    // Add all provided fields to update
    const allowedFields = [
      'title', 'description', 'industry', 'company_size', 'revenue_range',
      'geography', 'pain_points', 'buying_process', 'metadata', 'tags', 'is_active'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex++}`);
        updateParams.push(
          typeof updates[field] === 'object' ? JSON.stringify(updates[field]) : updates[field]
        );
      }
    }

    updateParams.push(icpId);

    const updateResult = await pool.query(
      `UPDATE icp_configurations
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      updateParams
    );

    if (updateResult.rows.length === 0) {
      console.error('[ICP Update] Update failed');
      return NextResponse.json({
        error: 'Failed to update ICP',
        details: 'No rows returned'
      }, { status: 500 });
    }

    console.log('[ICP Update] Successfully updated ICP:', icpId);

    return NextResponse.json({
      success: true,
      icp: updateResult.rows[0]
    });

  } catch (error) {
    console.error('[ICP Update] Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Firebase auth verification
    let userId: string;

    try {
      const auth = await verifyAuth(request);
      userId = auth.userId;
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: 'Unauthorized' }, { status: authError.statusCode || 401 });
    }

    const icpId = params.id;

    const icpResult = await pool.query(
      'SELECT * FROM icp_configurations WHERE id = $1',
      [icpId]
    );

    if (icpResult.rows.length === 0) {
      return NextResponse.json({ error: 'ICP not found' }, { status: 404 });
    }

    const icp = icpResult.rows[0];

    // Verify workspace access
    const memberResult = await pool.query(
      'SELECT workspace_id FROM workspace_members WHERE user_id = $1 AND workspace_id = $2',
      [userId, icp.workspace_id]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      icp
    });

  } catch (error) {
    console.error('[ICP GET] Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
