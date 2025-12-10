import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspace_id required' }, { status: 400 });
    }

    // Check workspace_integrations table for Slack
    const { data: integration, error } = await supabase
      .from('workspace_integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('integration_type', 'slack')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking Slack status:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (integration && integration.status === 'active') {
      return NextResponse.json({
        success: true,
        connected: true,
        webhook_url: integration.config?.webhook_url || '',
        channel_name: integration.config?.channel_name || ''
      });
    }

    return NextResponse.json({
      success: true,
      connected: false
    });

  } catch (error) {
    console.error('Slack status error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
