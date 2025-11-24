import { createServerSupabaseClient } from '@/app/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    console.log('🔍 GET monitors - User:', user?.email, 'ID:', user?.id);

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workspaceId = request.nextUrl.searchParams.get('workspace_id');
    console.log('🔍 GET monitors - Workspace ID:', workspaceId);

    if (!workspaceId) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });

    // Check user's workspace membership
    const { data: membership, error: memberError } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .single();

    console.log('🔍 Workspace membership:', membership, 'Error:', memberError);

    const { data, error } = await supabase.from('linkedin_post_monitors').select('*').eq('workspace_id', workspaceId);

    console.log('🔍 Query result - Data:', data, 'Error:', error);

    if (error) {
      console.error('❌ Error fetching monitors:', error);
      // If table doesn't exist, return empty array instead of error
      if (error.code === '42P01') {
        console.log('⚠️ linkedin_post_monitors table does not exist yet');
        return NextResponse.json({ monitors: [], error: 'Table not found - please run migrations' });
      }
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    // Get post counts for each monitor
    const monitorsWithCounts = await Promise.all(
      (data || []).map(async (monitor) => {
        const { count } = await supabase
          .from('linkedin_posts_discovered')
          .select('*', { count: 'exact', head: true })
          .eq('monitor_id', monitor.id);

        return {
          ...monitor,
          posts_count: count || 0
        };
      })
    );

    console.log('✅ Fetched monitors with counts:', monitorsWithCounts.length);
    return NextResponse.json({ monitors: monitorsWithCounts });
  } catch (error) {
    console.error('❌ Unexpected error in GET:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    console.log('🔐 Step 1: Getting user...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('❌ Auth error:', userError);
      return NextResponse.json({ error: 'Auth error', details: userError }, { status: 401 });
    }
    if (!user) {
      console.error('❌ No user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ User authenticated:', user.id);

    console.log('📥 Step 2: Parsing request body...');
    const body = await request.json();
    console.log('📥 Monitor data:', JSON.stringify(body, null, 2));

    console.log('🔍 Step 3: Getting user workspace...');
    const { data: memberData, error: memberError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (memberError) {
      console.error('❌ Error getting workspace:', memberError);
      return NextResponse.json({ error: 'Database error getting workspace', details: memberError.message }, { status: 500 });
    }

    if (!memberData) {
      console.error('❌ User not in any workspace');
      return NextResponse.json({ error: 'User not in any workspace' }, { status: 403 });
    }

    const workspaceId = memberData.workspace_id;
    console.log('✅ Workspace ID:', workspaceId);

    console.log('💾 Step 4: Inserting into database...');
    const monitorData = {
      ...body,
      workspace_id: workspaceId,
      created_by: user.id
    };

    const { data, error } = await supabase
      .from('linkedin_post_monitors')
      .insert(monitorData)
      .select()
      .single();

    if (error) {
      console.error('❌ Database error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        full: error
      });
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      }, { status: 500 });
    }

    console.log('✅ Monitor created successfully:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Unexpected error in POST:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      full: error
    });
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
