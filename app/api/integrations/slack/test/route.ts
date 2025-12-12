import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id } = body;

    if (!workspace_id) {
      return NextResponse.json(
        { success: false, error: 'workspace_id required' },
        { status: 400 }
      );
    }

    // First check for App mode (slack_app_config with bot token)
    const { data: appConfig } = await supabaseAdmin()
      .from('slack_app_config')
      .select('bot_token, default_channel, slack_team_name')
      .eq('workspace_id', workspace_id)
      .eq('status', 'active')
      .single();

    if (appConfig?.bot_token) {
      // Use Bot API to send test message
      const channelId = appConfig.default_channel;

      if (!channelId) {
        return NextResponse.json(
          { success: false, error: 'No default channel set. Go to Channels tab and select a channel first.' },
          { status: 400 }
        );
      }

      const testResponse = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${appConfig.bot_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: channelId,
          text: '🧪 Test Message from SAM AI',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*🧪 Test Message from SAM AI*\n\nIf you can see this message, your Slack integration is working correctly!'
              }
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `Sent at ${new Date().toLocaleString()} • Team: ${appConfig.slack_team_name || 'Unknown'}`
                }
              ]
            }
          ]
        })
      });

      const result = await testResponse.json();

      if (!result.ok) {
        console.error('[Slack Test] Bot API error:', result.error);
        return NextResponse.json(
          { success: false, error: `Slack error: ${result.error}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Test message sent successfully via Bot API'
      });
    }

    // Fall back to webhook mode
    const { data: integration, error } = await supabaseAdmin()
      .from('workspace_integrations')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('integration_type', 'slack')
      .eq('status', 'active')
      .single();

    if (error || !integration) {
      return NextResponse.json(
        { success: false, error: 'Slack not connected' },
        { status: 400 }
      );
    }

    const webhookUrl = integration.config?.webhook_url;
    if (!webhookUrl) {
      return NextResponse.json(
        { success: false, error: 'No webhook URL configured' },
        { status: 400 }
      );
    }

    // Send test message via webhook
    const testResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '🧪 Test Message from SAM AI',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*🧪 Test Message from SAM AI*\n\nIf you can see this message, your Slack integration is working correctly!'
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Sent at ${new Date().toLocaleString()}`
              }
            ]
          }
        ]
      })
    });

    if (!testResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to send test message' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Test message sent successfully'
    });

  } catch (error) {
    console.error('Slack test error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
