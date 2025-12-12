import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

/**
 * GET /api/integrations/slack/channels
 * Fetch list of Slack channels where SAM bot is a member
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspace_id required' }, { status: 400 });
    }

    // Get the Slack app config for this workspace
    const { data: config, error: configError } = await supabaseAdmin()
      .from('slack_app_config')
      .select('bot_token')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .single();

    if (configError || !config?.bot_token) {
      console.error('[Slack Channels] Config error:', configError, 'Has token:', !!config?.bot_token);
      return NextResponse.json({
        success: false,
        error: 'Slack not configured for this workspace',
      }, { status: 404 });
    }

    // Get default channel from slack_channels table (backward compatible)
    const { data: defaultChannelData } = await supabaseAdmin()
      .from('slack_channels')
      .select('channel_id')
      .eq('workspace_id', workspaceId)
      .eq('is_default', true)
      .single();

    const defaultChannel = defaultChannelData?.channel_id;

    // Fetch channels from Slack API
    const response = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200', {
      headers: {
        'Authorization': `Bearer ${config.bot_token}`,
      },
    });

    const result = await response.json();

    if (!result.ok) {
      console.error('Slack API error:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to fetch channels',
      }, { status: 500 });
    }

    // Transform channels data - filter out archived channels
    const channels = result.channels
      ?.filter((channel: any) => !channel.is_archived)
      .map((channel: any) => ({
        id: channel.id,
        name: channel.name,
        is_private: channel.is_private,
        is_member: channel.is_member,
      })) || [];

    return NextResponse.json({
      success: true,
      channels,
      default_channel: defaultChannel,
    });

  } catch (error) {
    console.error('Error fetching Slack channels:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
