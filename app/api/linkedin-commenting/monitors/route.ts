import { createClient } from '@/app/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workspaceId = request.nextUrl.searchParams.get('workspace_id');
    if (!workspaceId) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });

    const { data, error } = await supabase.from('linkedin_post_monitors').select('*').eq('workspace_id', workspaceId);

    if (error) {
      console.error('❌ Error fetching monitors:', error);
      // If table doesn't exist, return empty array instead of error
      if (error.code === '42P01') {
        console.log('⚠️ linkedin_post_monitors table does not exist yet');
        return NextResponse.json({ monitors: [], error: 'Table not found - please run migrations' });
      }
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    console.log('✅ Fetched monitors:', data?.length || 0);
    return NextResponse.json({ monitors: data || [] });
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
    const supabase = await createClient();

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

    console.log('💾 Step 3: Inserting into database...');
    const { data, error } = await supabase
      .from('linkedin_post_monitors')
      .insert(body)
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
