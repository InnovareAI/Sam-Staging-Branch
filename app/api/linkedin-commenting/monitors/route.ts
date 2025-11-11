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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    console.log('📥 Creating monitor:', body);

    const { data, error } = await supabase.from('linkedin_post_monitors').insert(body).select().single();

    if (error) {
      console.error('❌ Database error:', error);
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    console.log('✅ Monitor created:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
