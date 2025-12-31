import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import {
  calculateKBCompleteness,
  getOnboardingGaps,
  trackCompletionProgress,
  getSAMPromptForGaps
} from '@/lib/kb-completion-tracker';

// Create a supabase-like interface for the kb-completion-tracker
// This wraps pool.query to match the expected interface
const createSupabaseAdapter = () => ({
  from: (table: string) => ({
    select: (columns: string = '*') => ({
      eq: (column: string, value: any) => ({
        maybeSingle: async () => {
          const result = await pool.query(
            `SELECT ${columns} FROM ${table} WHERE ${column} = $1 LIMIT 1`,
            [value]
          );
          return { data: result.rows[0] || null, error: null };
        },
        single: async () => {
          const result = await pool.query(
            `SELECT ${columns} FROM ${table} WHERE ${column} = $1 LIMIT 1`,
            [value]
          );
          return { data: result.rows[0] || null, error: result.rows.length === 0 ? { message: 'Not found' } : null };
        },
        execute: async () => {
          const result = await pool.query(
            `SELECT ${columns} FROM ${table} WHERE ${column} = $1`,
            [value]
          );
          return { data: result.rows, error: null };
        }
      }),
      execute: async () => {
        const result = await pool.query(`SELECT ${columns} FROM ${table}`);
        return { data: result.rows, error: null };
      }
    })
  }),
  rpc: async (fn: string, params: Record<string, any>) => {
    // Convert params to array in expected order
    const paramValues = Object.values(params);
    const result = await pool.query(
      `SELECT * FROM ${fn}(${paramValues.map((_, i) => `$${i + 1}`).join(', ')})`,
      paramValues
    );
    return { data: result.rows, error: null };
  }
});

/**
 * GET /api/knowledge-base/completion
 *
 * Returns KB completion score and gaps for onboarding
 */
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

    console.log('[KB Completion] Calculating for workspace:', workspaceId);

    const supabaseAdapter = createSupabaseAdapter();

    // Calculate completion score
    const completion = await calculateKBCompleteness(supabaseAdapter, workspaceId);

    // Get onboarding gaps and suggestions
    const gaps = await getOnboardingGaps(supabaseAdapter, workspaceId);

    // Get SAM prompt suggestion
    const samPrompt = getSAMPromptForGaps(gaps.missing_categories);

    // Track progress
    await trackCompletionProgress(supabaseAdapter, workspaceId);

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
    // Firebase auth verification
    let userId: string;
    let authWorkspaceId: string;

    try {
      const auth = await verifyAuth(request);
      userId = auth.userId;
      authWorkspaceId = auth.workspaceId;
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: 'Unauthorized' }, { status: authError.statusCode || 401 });
    }

    const { workspaceId: providedWorkspaceId } = await request.json();
    const workspaceId = providedWorkspaceId || authWorkspaceId;

    // Verify workspace access if different workspace provided
    if (providedWorkspaceId && providedWorkspaceId !== authWorkspaceId) {
      const memberResult = await pool.query(
        'SELECT workspace_id FROM workspace_members WHERE user_id = $1 AND workspace_id = $2',
        [userId, providedWorkspaceId]
      );

      if (memberResult.rows.length === 0) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    console.log('[KB Completion] Refreshing for workspace:', workspaceId);

    const supabaseAdapter = createSupabaseAdapter();
    const completion = await calculateKBCompleteness(supabaseAdapter, workspaceId);
    await trackCompletionProgress(supabaseAdapter, workspaceId);

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
