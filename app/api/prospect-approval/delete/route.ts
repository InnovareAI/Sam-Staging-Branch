import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

/**
 * DELETE /api/prospect-approval/delete?prospect_id=xxx
 * Permanently deletes a prospect from prospect_approval_data OR workspace_prospects
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId, workspaceId, userEmail } = await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const prospectId = searchParams.get('prospect_id');

    if (!prospectId) {
      return NextResponse.json({
        success: false,
        error: 'Prospect ID required'
      }, { status: 400 });
    }

    const isSuperAdmin = ['tl@innovareai.com', 'cl@innovareai.com'].includes(userEmail.toLowerCase());

    // Try prospect_approval_data first (DataCollectionHub uses this table)
    // CRITICAL FIX (Nov 29): Frontend sends UUID `id`, but we also support legacy `prospect_id` (csv_xxx)
    // Try both columns - first by UUID `id`, then by text `prospect_id`
    let approvalProspect = null;

    // Try 1: Search by UUID `id` column (frontend sends this)
    const byIdResult = await pool.query(
      'SELECT id, prospect_id, workspace_id FROM prospect_approval_data WHERE id = $1',
      [prospectId]
    );

    if (byIdResult.rows.length > 0) {
      approvalProspect = byIdResult.rows[0];
    } else {
      // Try 2: Search by text `prospect_id` column (legacy csv_xxx format)
      const byProspectIdResult = await pool.query(
        'SELECT id, prospect_id, workspace_id FROM prospect_approval_data WHERE prospect_id = $1',
        [prospectId]
      );
      approvalProspect = byProspectIdResult.rows[0] || null;
    }

    if (approvalProspect) {
      // Security check
      if (!isSuperAdmin && approvalProspect.workspace_id !== workspaceId) {
        return NextResponse.json({
          success: false,
          error: 'Access denied - prospect belongs to different workspace'
        }, { status: 403 });
      }

      // Delete by the actual UUID `id`, not the text `prospect_id`
      await pool.query(
        'DELETE FROM prospect_approval_data WHERE id = $1',
        [approvalProspect.id]
      );

      console.log(`✅ Prospect ${approvalProspect.prospect_id} (UUID: ${approvalProspect.id}) deleted from prospect_approval_data by ${userEmail}`);
      return NextResponse.json({
        success: true,
        message: 'Prospect deleted successfully'
      });
    }

    // Fallback: try workspace_prospects
    const workspaceProspectResult = await pool.query(
      'SELECT id, workspace_id FROM workspace_prospects WHERE id = $1',
      [prospectId]
    );

    if (workspaceProspectResult.rows.length > 0) {
      const workspaceProspect = workspaceProspectResult.rows[0];

      // Security check
      if (!isSuperAdmin && workspaceProspect.workspace_id !== workspaceId) {
        return NextResponse.json({
          success: false,
          error: 'Access denied - prospect belongs to different workspace'
        }, { status: 403 });
      }

      await pool.query(
        'DELETE FROM workspace_prospects WHERE id = $1',
        [prospectId]
      );

      console.log(`✅ Prospect ${prospectId} deleted from workspace_prospects by ${userEmail}`);
      return NextResponse.json({
        success: true,
        message: 'Prospect deleted successfully'
      });
    }

    // Not found in either table
    return NextResponse.json({
      success: false,
      error: 'Prospect not found'
    }, { status: 404 });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Prospect delete error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
