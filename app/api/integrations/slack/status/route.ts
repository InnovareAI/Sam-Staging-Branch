import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspace_id required' }, { status: 400 });
    }

    // Check workspace_integrations table for basic Slack status
    const { data: integration, error } = await supabaseAdmin()
      .from('workspace_integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('integration_type', 'slack')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking Slack status:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Check for full app config (two-way messaging)
    const { data: appConfig } = await supabaseAdmin()
      .from('slack_app_config')
      .select('slack_team_id, slack_team_name, bot_user_id, status, features_enabled')
      .eq('workspace_id', workspaceId)
      .single();

    // Determine connection mode
    const hasAppConfig = appConfig && appConfig.status === 'active';
    const hasWebhook = integration && integration.status === 'active' && integration.config?.webhook_url;

    if (hasAppConfig) {
      // Full app mode (two-way)
      return NextResponse.json({
        success: true,
        connected: true,
        mode: 'app',
        team_id: appConfig.slack_team_id,
        team_name: appConfig.slack_team_name,
        has_bot_token: true,
        features_enabled: appConfig.features_enabled,
        // Also include webhook info if available
        webhook_url: integration?.config?.webhook_url || '',
        channel_name: integration?.config?.channel_name || '',
      });
    } else if (hasWebhook) {
      // Webhook only mode (one-way)
      return NextResponse.json({
        success: true,
        connected: true,
        mode: 'webhook',
        webhook_url: integration.config?.webhook_url || '',
        channel_name: integration.config?.channel_name || '',
        has_bot_token: false,
        features_enabled: {
          notifications: true,
          two_way_chat: false,
          slash_commands: true,
          interactive_buttons: false,
        },
      });
    }

    // Not connected
    return NextResponse.json({
      success: true,
      connected: false,
    });

  } catch (error) {
    console.error('Slack status error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
