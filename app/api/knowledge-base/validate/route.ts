import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

/**
 * POST /api/knowledge-base/validate
 * Mark KB entry as validated by user or update with corrected data
 *
 * Body:
 * {
 *   "entry_id": "uuid",
 *   "validated": true,
 *   "corrected_content"?: "...", // If user corrected the data
 *   "validation_note"?: "User confirmed via chat"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Firebase auth verification
    let userId: string;

    try {
      const auth = await verifyAuth(request);
      userId = auth.userId;
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: authError.statusCode || 401 }
      );
    }

    const body = await request.json();
    const { entry_id, validated, corrected_content, validation_note } = body;

    if (!entry_id) {
      return NextResponse.json(
        { success: false, error: 'entry_id required' },
        { status: 400 }
      );
    }

    // Get the entry first to check workspace access
    const entryResult = await pool.query(
      'SELECT *, workspace_id FROM knowledge_base WHERE id = $1',
      [entry_id]
    );

    if (entryResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Entry not found' },
        { status: 404 }
      );
    }

    const entry = entryResult.rows[0];

    // Verify user has access to workspace
    const memberResult = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [entry.workspace_id, userId]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Parse existing source_metadata
    const existingMetadata = typeof entry.source_metadata === 'string'
      ? JSON.parse(entry.source_metadata)
      : (entry.source_metadata || {});

    // Build updated metadata
    const updatedMetadata = {
      ...existingMetadata,
      validated: validated !== false, // Default to true
      validation_required: false,
      validated_by: userId,
      validated_at: new Date().toISOString(),
      validation_note: validation_note || 'User confirmed via conversation'
    };

    // Parse existing tags
    const existingTags = entry.tags || [];

    let newTags: string[];
    let newContent = entry.content;

    // If content was corrected, update it and add tags
    if (corrected_content) {
      newContent = corrected_content;
      newTags = [...existingTags.filter((t: string) => t !== 'unvalidated'), 'user_corrected', 'validated'];
      updatedMetadata.correction_applied = true;
      updatedMetadata.original_content = entry.content; // Keep original for reference
    } else {
      // Just mark as validated (data was correct)
      newTags = [...existingTags.filter((t: string) => !['unvalidated', 'needs_review'].includes(t)), 'validated'];
    }

    // Update the entry
    const updateResult = await pool.query(
      `UPDATE knowledge_base
       SET content = $1, tags = $2, source_metadata = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [newContent, newTags, JSON.stringify(updatedMetadata), entry_id]
    );

    if (updateResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to update entry' },
        { status: 500 }
      );
    }

    console.log(`Validated KB entry ${entry_id} - ${corrected_content ? 'with corrections' : 'as-is'}`);

    return NextResponse.json({
      success: true,
      entry: updateResult.rows[0],
      message: corrected_content
        ? 'Entry validated and updated with corrections'
        : 'Entry validated as accurate',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('KB validation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate entry'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/knowledge-base/validate?workspace_id={uuid}
 * Get all unvalidated KB entries for a workspace
 */
export async function GET(request: NextRequest) {
  try {
    // Firebase auth verification
    let userId: string;
    let authWorkspaceId: string;

    try {
      const auth = await verifyAuth(request);
      userId = auth.userId;
      authWorkspaceId = auth.workspaceId;
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: authError.statusCode || 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id') || authWorkspaceId;

    // Verify access if different workspace provided
    if (workspaceId !== authWorkspaceId) {
      const memberResult = await pool.query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
      );

      if (memberResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    // Get unvalidated entries
    const result = await pool.query(
      `SELECT * FROM knowledge_base
       WHERE workspace_id = $1 AND 'unvalidated' = ANY(tags) AND is_active = true
       ORDER BY created_at DESC`,
      [workspaceId]
    );

    const unvalidatedEntries = result.rows;

    return NextResponse.json({
      success: true,
      unvalidated_count: unvalidatedEntries?.length || 0,
      entries: unvalidatedEntries || [],
      message: unvalidatedEntries?.length
        ? `Found ${unvalidatedEntries.length} entries needing validation`
        : 'All entries validated'
    });

  } catch (error) {
    console.error('Get unvalidated entries error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch unvalidated entries'
      },
      { status: 500 }
    );
  }
}
