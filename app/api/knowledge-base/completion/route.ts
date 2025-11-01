import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import {
  calculateKBCompleteness,
  getOnboardingGaps,
  trackCompletionProgress,
  getSAMPromptForGaps
} from '@/lib/kb-completion-tracker';

async function getWorkspaceId(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', userId)
    .single();

  if (profile?.current_workspace_id) {
    return profile.current_workspace_id;
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  return membership?.workspace_id ?? null;
}

/**
 * GET /api/knowledge-base/completion
 *
 * Returns KB completion score and gaps for onboarding
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getWorkspaceId(supabase, user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    console.log('[KB Completion] Calculating for workspace:', workspaceId);

    // Calculate completion score
    const completion = await calculateKBCompleteness(supabase, workspaceId);

    // Get onboarding gaps and suggestions
    const gaps = await getOnboardingGaps(supabase, workspaceId);

    // Get SAM prompt suggestion
    const samPrompt = getSAMPromptForGaps(gaps.missing_categories);

    // Track progress
    await trackCompletionProgress(supabase, workspaceId);

    return NextResponse.json({
      success: true,
      workspaceId,
      completion,
      gaps,
      sam_prompt: samPrompt,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[KB Completion] Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/knowledge-base/completion/refresh
 *
 * Manually triggers completion recalculation
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId: providedWorkspaceId } = await request.json();
    const workspaceId = providedWorkspaceId || await getWorkspaceId(supabase, user.id);

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    // Verify workspace access
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    console.log('[KB Completion] Refreshing for workspace:', workspaceId);

    const completion = await calculateKBCompleteness(supabase, workspaceId);
    await trackCompletionProgress(supabase, workspaceId);

    return NextResponse.json({
      success: true,
      completion,
      refreshed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('[KB Completion] Refresh error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
