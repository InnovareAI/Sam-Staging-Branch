import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// GET - Retrieve recent search history (newest first)
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current workspace
    const { data: userData } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    if (!userData?.current_workspace_id) {
      return NextResponse.json({ success: false, error: 'No workspace found' }, { status: 400 });
    }

    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10');

    // Fetch recent searches (newest first)
    const { data: searches, error } = await supabase
      .from('prospect_search_history')
      .select('*')
      .eq('workspace_id', userData.current_workspace_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching search history:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      searches: searches || []
    });
  } catch (error) {
    console.error('Search history error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Save a new search to history
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current workspace
    const { data: userData } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    if (!userData?.current_workspace_id) {
      return NextResponse.json({ success: false, error: 'No workspace found' }, { status: 400 });
    }

    const body = await request.json();
    const { search_criteria, results_count, session_id } = body;

    if (!search_criteria) {
      return NextResponse.json({ success: false, error: 'Search criteria required' }, { status: 400 });
    }

    // Save search to history
    const { data: search, error } = await supabase
      .from('prospect_search_history')
      .insert({
        workspace_id: userData.current_workspace_id,
        user_id: user.id,
        search_criteria,
        results_count: results_count || 0,
        session_id
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving search history:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      search
    });
  } catch (error) {
    console.error('Save search history error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
