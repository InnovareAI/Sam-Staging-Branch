import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, webhook_url, channel_name } = body;

    if (!workspace_id || !webhook_url) {
      return NextResponse.json(
        { success: false, error: 'workspace_id and webhook_url required' },
        { status: 400 }
      );
    }

    // Validate webhook URL format
    if (!webhook_url.includes('hooks.slack.com')) {
      return NextResponse.json(
        { success: false, error: 'Invalid Slack webhook URL' },
        { status: 400 }
      );
    }

    // Test the webhook by sending a verification message
    try {
      const testResponse = await fetch(webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '🎉 SAM AI Connected!',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*🎉 SAM AI Connected Successfully!*\n\nYou will now receive notifications for:\n• New prospect replies\n• Campaign status updates\n• Connection request acceptances\n• Daily campaign summaries'
              }
            }
          ]
        })
      });

      if (!testResponse.ok) {
        return NextResponse.json(
          { success: false, error: 'Failed to verify webhook - please check the URL' },
          { status: 400 }
        );
      }
    } catch (webhookError) {
      return NextResponse.json(
        { success: false, error: 'Could not reach Slack webhook - please check the URL' },
        { status: 400 }
      );
    }

    // Upsert integration record
    const { data, error } = await supabase
      .from('workspace_integrations')
      .upsert({
        workspace_id,
        integration_type: 'slack',
        status: 'active',
        config: {
          webhook_url,
          channel_name: channel_name || '#general'
        },
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id,integration_type'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving Slack integration:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Slack connected successfully',
      integration: data
    });

  } catch (error) {
    console.error('Slack connect error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
