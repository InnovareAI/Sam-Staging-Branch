import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
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
    const supabase = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    let workspaceId = searchParams.get('workspace_id');

    // If no workspace_id provided, get user's active workspace
    if (!workspaceId) {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!membership?.workspace_id) {
        return NextResponse.json(
          { success: false, error: 'No active workspace found' },
          { status: 404 }
        );
      }

      workspaceId = membership.workspace_id;
    }

    // Verify user has access to this workspace
    const { data: access } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!access) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this workspace' },
        { status: 403 }
      );
    }

    // Check KB completeness
    const completeness = await supabaseKnowledge.checkKBCompleteness(workspaceId);

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
      workspace_id: workspaceId,
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
    console.error('❌ KB completeness check error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to check KB completeness' 
      },
      { status: 500 }
    );
  }
}
