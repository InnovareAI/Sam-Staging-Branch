/**
 * Feature Announcement API
 * Sends feature announcements to all connected Slack workspaces
 *
 * POST /api/admin/announce-feature
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { slackService } from '@/lib/slack';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Simple auth check - require admin secret
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET;

    if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { announcement_type } = body;

    // Get all workspaces with active Slack connections
    const { data: slackConfigs, error } = await supabase
      .from('slack_app_config')
      .select('workspace_id, slack_team_name')
      .eq('status', 'active');

    if (error) {
      console.error('Failed to fetch Slack configs:', error);
      return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
    }

    if (!slackConfigs || slackConfigs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No workspaces with active Slack connections',
        sent: 0
      });
    }

    // Build the announcement message based on type
    let message;

    if (announcement_type === 'calendar_integrations') {
      message = {
        text: 'New Feature: Calendar Integrations are here!',
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '🗓️ New Feature: Calendar Integrations', emoji: true }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'SAM now supports *4 calendar integrations* to automatically detect and book meetings with your prospects!'
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Supported Platforms:*\n\n' +
                '📅 *Calendly* - Auto-detect booking links and scrape available slots\n' +
                '📆 *Cal.com* - Full integration with slot availability\n' +
                '🔵 *Google Calendar* - Sync meetings and check conflicts\n' +
                '🟦 *Microsoft Bookings* - Enterprise calendar support'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*How it works:*\n' +
                '1. When a prospect shares their booking link, SAM detects it automatically\n' +
                '2. SAM scrapes available time slots from their calendar\n' +
                '3. SAM checks your calendar for conflicts\n' +
                '4. Books the first available slot (or lets you choose)\n' +
                '5. Sends automated reminders (24h, 1h, 15m before)'
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '✨ *Bonus Features:*\n' +
                '• No-show detection with AI-generated follow-ups\n' +
                '• Post-meeting follow-up suggestions\n' +
                '• All follow-ups require your approval (HITL)'
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Connect Your Calendar', emoji: true },
                url: 'https://app.meet-sam.com/settings/integrations',
                style: 'primary'
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Learn More', emoji: true },
                url: 'https://app.meet-sam.com/help/calendar-integrations'
              }
            ]
          }
        ]
      };
    } else {
      return NextResponse.json({ error: 'Unknown announcement_type' }, { status: 400 });
    }

    // Send to all connected workspaces
    const results = [];
    for (const config of slackConfigs) {
      try {
        const channel = await slackService.getDefaultChannel(config.workspace_id);
        const result = await slackService.sendBotMessage(config.workspace_id, channel, message);

        results.push({
          workspace_id: config.workspace_id,
          team_name: config.slack_team_name,
          success: result.success,
          error: result.error
        });

        console.log(`📢 Announcement sent to ${config.slack_team_name}: ${result.success ? 'OK' : result.error}`);
      } catch (err) {
        results.push({
          workspace_id: config.workspace_id,
          team_name: config.slack_team_name,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Announcement sent to ${successCount}/${slackConfigs.length} workspaces`,
      sent: successCount,
      total: slackConfigs.length,
      results
    });

  } catch (error) {
    console.error('Announcement error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
