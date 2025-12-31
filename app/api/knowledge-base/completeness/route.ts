import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { supabaseKnowledge } from '@/lib/supabase-knowledge';

/**
 * GET /api/knowledge-base/completeness
 * Check KB completeness for a workspace
 *
 * Query params:
 * - workspace_id: UUID of workspace (optional, uses user's active workspace if not provided)
 */
export async function GET(request: NextRequest) {
  try {
    // Firebase auth verification
    let userId: string;
    let workspaceId: string;

    try {
      const auth = await verifyAuth(request);
      userId = auth.userId;
      workspaceId = auth.workspaceId;
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: authError.statusCode || 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const providedWorkspaceId = searchParams.get('workspace_id');

    // Use provided workspace_id if available, otherwise use auth workspace
    const targetWorkspaceId = providedWorkspaceId || workspaceId;

    // If a different workspace_id was provided, verify user has access
    if (providedWorkspaceId && providedWorkspaceId !== workspaceId) {
      const accessResult = await pool.query(
        `SELECT role FROM workspace_members
         WHERE workspace_id = $1 AND user_id = $2 AND is_active = true`,
        [providedWorkspaceId, userId]
      );

      if (accessResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Access denied to this workspace' },
          { status: 403 }
        );
      }
    }

    // Check KB completeness
    const completeness = await supabaseKnowledge.checkKBCompleteness(targetWorkspaceId);

    // Build recommendations based on completeness
    const recommendations: string[] = [];

    if (completeness.missingCritical.length > 0) {
      recommendations.push(
        `Critical sections need attention: ${completeness.missingCritical.join(', ')}`
      );
    }

    const incompleteSections = Object.entries(completeness.sections)
      .filter(([_, data]) => data.percentage < 70 && data.percentage > 0)
      .map(([name]) => name);

    if (incompleteSections.length > 0) {
      recommendations.push(
        `Incomplete sections that could use more detail: ${incompleteSections.join(', ')}`
      );
    }

    if (completeness.overallCompleteness >= 90) {
      recommendations.push('Your knowledge base is comprehensive! Great work.');
    } else if (completeness.overallCompleteness >= 70) {
      recommendations.push('Your knowledge base is in good shape. Consider filling in the gaps for optimal performance.');
    } else if (completeness.overallCompleteness >= 40) {
      recommendations.push('You have a solid foundation. Focus on critical sections to improve outreach quality.');
    } else {
      recommendations.push('Let\'s build out your knowledge base. I\'ll guide you through the essential sections.');
    }

    return NextResponse.json({
      success: true,
      workspace_id: targetWorkspaceId,
      completeness: {
        overall: completeness.overallCompleteness,
        status: completeness.overallCompleteness >= 70 ? 'complete' :
                completeness.overallCompleteness >= 40 ? 'partial' : 'minimal',
        sections: completeness.sections,
        missing_critical: completeness.missingCritical,
        recommendations
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('KB completeness check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check KB completeness'
      },
      { status: 500 }
    );
  }
}
