import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * SIMPLE LinkedIn Search - Minimal version that just works
 * No fancy features, just get results
 * Force rebuild: 2025-10-10-v2
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { search_criteria, target_count = 50 } = await request.json();

    // Get workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    const workspaceId = userProfile?.current_workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace' }, { status: 400 });
    }

    // Get LinkedIn account
    const { data: linkedinAccount } = await supabase
      .from('user_unipile_accounts')
      .select('unipile_account_id')
      .eq('user_id', user.id)
      .eq('platform', 'LINKEDIN')
      .single();

    if (!linkedinAccount) {
      return NextResponse.json({ error: 'LinkedIn not connected' }, { status: 400 });
    }

    // Call Unipile (simple version - no fancy API detection)
    const unipileUrl = `https://${process.env.UNIPILE_DSN}.unipile.com:13443/api/v1/linkedin/search`;
    const params = new URLSearchParams({
      account_id: linkedinAccount.unipile_account_id,
      limit: String(Math.min(target_count, 50))
    });

    const response = await fetch(`${unipileUrl}?${params}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...search_criteria,
        api: 'classic'
      })
    });

    const data = await response.json();
    const prospects = (data.items || []).map((item: any) => ({
      name: item.name,
      title: item.title || item.headline,
      company: item.company_name,
      linkedinUrl: item.profile_url
    }));

    // Save to workspace_prospects
    if (prospects.length > 0) {
      const toInsert = prospects.map((p: any) => ({
        workspace_id: workspaceId,
        name: p.name,
        title: p.title,
        company: p.company,
        linkedin_url: p.linkedinUrl,
        source: 'linkedin_simple_search',
        approval_status: 'pending'
      }));

      await supabase.from('workspace_prospects').insert(toInsert);
    }

    return NextResponse.json({
      success: true,
      prospects,
      count: prospects.length
    });

  } catch (error) {
    console.error('Simple search error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Search failed'
    }, { status: 500 });
  }
}
