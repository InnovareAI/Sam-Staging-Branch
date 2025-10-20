import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { runSignupIntelligence, Industry } from '@/lib/signup-intelligence';

/**
 * POST /api/signup-intelligence
 * Run intelligence gathering at user signup
 * 
 * Body:
 * {
 *   "user_id": "uuid",
 *   "workspace_id": "uuid",
 *   "company_name": "Acme Corp",
 *   "website_url": "https://acme.com" (optional),
 *   "industry": "saas",
 *   "company_size": "10-50" (optional)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      user_id,
      workspace_id, 
      company_name, 
      website_url, 
      industry,
      company_size 
    } = body;

    // Validation
    if (!workspace_id || !company_name || !industry) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: workspace_id, company_name, industry' },
        { status: 400 }
      );
    }

    // Verify user has access to workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Access denied to workspace' },
        { status: 403 }
      );
    }

    console.log(`🚀 Starting signup intelligence for workspace: ${workspace_id}`);

    // Run intelligence gathering (async, non-blocking)
    const result = await runSignupIntelligence({
      userId: user_id || user.id,
      workspaceId: workspace_id,
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
    console.error('❌ Signup intelligence endpoint error:', error);
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
 * GET /api/signup-intelligence?workspace_id={uuid}
 * Check if signup intelligence has been run for a workspace
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
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: 'workspace_id required' },
        { status: 400 }
      );
    }

    // Check if workspace has signup_intelligence entries in KB
    const { data: intelligenceEntries, error } = await supabase
      .from('knowledge_base')
      .select('id, created_at, category, title')
      .eq('workspace_id', workspaceId)
      .eq('source_type', 'signup_intelligence')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    const hasIntelligence = (intelligenceEntries?.length || 0) > 0;

    return NextResponse.json({
      success: true,
      has_intelligence: hasIntelligence,
      entries_count: intelligenceEntries?.length || 0,
      last_run: intelligenceEntries?.[0]?.created_at || null,
      entries: intelligenceEntries || []
    });

  } catch (error) {
    console.error('❌ Check signup intelligence error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to check intelligence status' 
      },
      { status: 500 }
    );
  }
}
