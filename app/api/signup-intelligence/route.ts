import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { runSignupIntelligence, Industry } from '@/lib/signup-intelligence';

/**
 * POST /api/signup-intelligence
 * Run intelligence gathering at user signup
 *
 * Body:
 * {
 *   "user_id": "uuid",
 *   "company_name": "Acme Corp",
 *   "website_url": "https://acme.com" (optional),
 *   "industry": "saas",
 *   "company_size": "10-50" (optional)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Firebase auth - workspace comes from header
    let authContext;
    try {
      authContext = await verifyAuth(request);
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }

    const { userId, workspaceId } = authContext;

    const body = await request.json();
    const {
      user_id,
      company_name,
      website_url,
      industry,
      company_size
    } = body;

    // Validation
    if (!company_name || !industry) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: company_name, industry' },
        { status: 400 }
      );
    }

    console.log(`Starting signup intelligence for workspace: ${workspaceId}`);

    // Run intelligence gathering (async, non-blocking)
    const result = await runSignupIntelligence({
      userId: user_id || userId,
      workspaceId: workspaceId,
      companyName: company_name,
      websiteUrl: website_url,
      industry: industry as Industry,
      companySize: company_size
    });

    return NextResponse.json({
      success: result.success,
      kb_completeness: result.kb_completeness,
      intelligence_summary: result.intelligence_summary,
      message: result.success
        ? 'Intelligence gathering completed successfully'
        : 'Intelligence gathering failed, but workspace is ready',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Signup intelligence endpoint error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run signup intelligence'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/signup-intelligence
 * Check if signup intelligence has been run for the current workspace
 */
export async function GET(request: NextRequest) {
  try {
    // Firebase auth - workspace comes from header
    let authContext;
    try {
      authContext = await verifyAuth(request);
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }

    const { workspaceId } = authContext;

    // Check if workspace has signup_intelligence entries in KB
    const { rows: intelligenceEntries } = await pool.query(
      `SELECT id, created_at, category, title
       FROM knowledge_base
       WHERE workspace_id = $1 AND source_type = 'signup_intelligence'
       ORDER BY created_at DESC
       LIMIT 10`,
      [workspaceId]
    );

    const hasIntelligence = (intelligenceEntries?.length || 0) > 0;

    return NextResponse.json({
      success: true,
      has_intelligence: hasIntelligence,
      entries_count: intelligenceEntries?.length || 0,
      last_run: intelligenceEntries?.[0]?.created_at || null,
      entries: intelligenceEntries || []
    });

  } catch (error) {
    console.error('Check signup intelligence error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check intelligence status'
      },
      { status: 500 }
    );
  }
}
