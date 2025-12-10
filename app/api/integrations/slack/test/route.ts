import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Get Slack integration
    const { data: integration, error } = await supabase
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

    // Send test message
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
