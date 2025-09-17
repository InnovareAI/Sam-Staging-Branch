import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const query = searchParams.get('q');
    const sectionFilter = searchParams.get('section');

    if (!workspaceId || !query) {
      return NextResponse.json({ error: 'Workspace ID and search query are required' }, { status: 400 });
    }

    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Search using the database function
    const { data: results, error } = await supabase.rpc(
      'search_knowledge_base_sections',
      {
        p_workspace_id: workspaceId,
        p_search_query: query,
        p_section_filter: sectionFilter
      }
    );

    if (error) {
      console.error('Error searching KB:', error);
      return NextResponse.json({ error: 'Failed to search knowledge base' }, { status: 500 });
    }

    return NextResponse.json({ results: results || [] });
  } catch (error) {
    console.error('Unexpected error in KB search API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}