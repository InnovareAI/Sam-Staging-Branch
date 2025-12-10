import { NextRequest, NextResponse } from 'next/server';

/**
 * Slack Webhook Endpoint
 * Receives slash commands and interactive components from Slack
 */

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let body: any;
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      body = Object.fromEntries(formData);
      // Handle Slack interactive payloads
      if (body.payload) {
        body = JSON.parse(body.payload);
      }
    } else {
      body = await request.json();
    }

    // Slack URL verification challenge
    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge });
    }

    // Handle slash commands
    if (body.command) {
      const command = body.command;
      const text = body.text || '';
      const userId = body.user_id;

      switch (command) {
        case '/sam-status':
          return NextResponse.json({
            response_type: 'ephemeral',
            text: '✅ SAM is running! Check dashboard at https://app.meet-sam.com',
          });

        case '/sam-campaigns':
          return NextResponse.json({
            response_type: 'ephemeral',
            text: '📊 View campaigns: https://app.meet-sam.com/workspace/campaigns',
          });

        default:
          return NextResponse.json({
            response_type: 'ephemeral',
            text: `Unknown command: ${command}`,
          });
      }
    }

    // Handle interactive components (button clicks, etc.)
    if (body.type === 'block_actions') {
      const action = body.actions?.[0];
      if (action) {
        console.log('Slack action:', action.action_id, action.value);
        // Handle specific actions here
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Slack webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Slack webhook active' });
}
