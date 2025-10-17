import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspace_id = searchParams.get('workspace_id');

    if (!workspace_id) {
      return NextResponse.json(
        { error: 'workspace_id required' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check workspace membership
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get templates
    const { data: templates, error } = await supabase
      .from('messaging_templates')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('List templates error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: templates || [] });
  } catch (error: any) {
    console.error('List templates error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
