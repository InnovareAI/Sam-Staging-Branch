import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      workspace_id,
      campaign_name,
      campaign_type,
      connection_message,
      alternative_message,
      follow_up_messages
    } = body;

    if (!workspace_id || !campaign_name) {
      return NextResponse.json(
        { error: 'workspace_id and campaign_name required' },
        { status: 400 }
      );
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

    const template_name = `autosave_${campaign_name}`;

    // Upsert template
    const { data: template, error } = await supabase
      .from('messaging_templates')
      .upsert({
        workspace_id,
        template_name,
        campaign_type: 'custom',
        connection_message: connection_message || '',
        alternative_message: alternative_message || '',
        follow_up_messages: follow_up_messages || [],
        created_by: user.id,
        is_active: true
      }, {
        onConflict: 'workspace_id,template_name'
      })
      .select()
      .single();

    if (error) {
      console.error('Autosave error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, template_id: template.id });
  } catch (error: any) {
    console.error('Autosave error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
