import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { searchParams } = new URL(request.url);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getWorkspaceId(supabase, user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const days = parseInt(searchParams.get('days') || '30', 10);
    const type = searchParams.get('type') || 'documents'; // 'documents' or 'sections'

    if (type === 'sections') {
      // Get section-level analytics
      const { data: sectionStats, error: sectionError } = await supabase
        .rpc('get_section_usage_summary', {
          p_workspace_id: workspaceId,
          p_days: days
        });

      if (sectionError) {
        console.error('Failed to fetch section analytics:', sectionError);
        return NextResponse.json({ error: 'Failed to fetch section analytics' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        type: 'sections',
        days,
        data: sectionStats || []
      });
    } else {
      // Get document-level analytics
      const { data: docStats, error: docError } = await supabase
        .rpc('get_document_usage_analytics', {
          p_workspace_id: workspaceId,
          p_days: days
        });

      if (docError) {
        console.error('Failed to fetch document analytics:', docError);
        return NextResponse.json({ error: 'Failed to fetch document analytics' }, { status: 500 });
      }

      // Categorize documents by usage
      const now = new Date();
      const categorized = {
        mostUsed: (docStats || []).slice(0, 10),
        leastUsed: (docStats || [])
          .filter((d: any) => d.total_uses > 0)
          .sort((a: any, b: any) => a.total_uses - b.total_uses)
          .slice(0, 10),
        neverUsed: (docStats || []).filter((d: any) => d.total_uses === 0 || !d.total_uses),
        stale: (docStats || []).filter((d: any) => {
          if (!d.last_used_at) return true;
          const daysSince = d.days_since_last_use || 0;
          return daysSince > 90;
        }),
        trending: (docStats || [])
          .filter((d: any) => d.usage_trend === 'increasing')
          .slice(0, 10)
      };

      return NextResponse.json({
        success: true,
        type: 'documents',
        days,
        summary: {
          totalDocuments: docStats?.length || 0,
          documentsUsed: (docStats || []).filter((d: any) => d.total_uses > 0).length,
          totalUses: (docStats || []).reduce((sum: number, d: any) => sum + (d.total_uses || 0), 0),
          avgUsesPerDoc: docStats?.length ?
            ((docStats || []).reduce((sum: number, d: any) => sum + (d.total_uses || 0), 0) / docStats.length).toFixed(2) : 0,
          usageRate: docStats?.length ?
            (((docStats || []).filter((d: any) => d.total_uses > 0).length / docStats.length) * 100).toFixed(1) + '%' : '0%'
        },
        categorized,
        all: docStats || []
      });
    }
  } catch (error) {
    console.error('Knowledge base analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Record usage endpoint (called by SAM)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const body = await request.json();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getWorkspaceId(supabase, user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const {
      documentId,
      threadId,
      messageId,
      chunksUsed = 1,
      relevanceScore,
      queryContext
    } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Call the database function to record usage
    const { error: usageError } = await supabase.rpc('record_document_usage', {
      p_workspace_id: workspaceId,
      p_document_id: documentId,
      p_thread_id: threadId || null,
      p_message_id: messageId || null,
      p_chunks_used: chunksUsed,
      p_relevance_score: relevanceScore || null,
      p_query_context: queryContext || null
    });

    if (usageError) {
      console.error('Failed to record document usage:', usageError);
      return NextResponse.json({ error: 'Failed to record usage' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Usage recorded' });
  } catch (error) {
    console.error('Knowledge base usage tracking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
