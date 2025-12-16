import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendAnnouncement() {
  // Get all workspaces with active Slack connections
  const { data: slackConfigs, error } = await supabase
    .from('slack_app_config')
    .select('workspace_id, slack_team_name, bot_token')
    .eq('status', 'active');

  if (error) {
    console.error('Failed to fetch Slack configs:', error);
    return;
  }

  const configCount = slackConfigs ? slackConfigs.length : 0;
  console.log(`Found ${configCount} active Slack configurations`);

  if (!slackConfigs || slackConfigs.length === 0) {
    console.log('No workspaces with active Slack connections');
    return;
  }

  const message = {
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
      { type: 'divider' },
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
      { type: 'divider' },
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
          }
        ]
      }
    ]
  };

  for (const config of slackConfigs) {
    if (!config.bot_token) {
      console.log(`⚠️ Skipping ${config.slack_team_name} - no bot token`);
      continue;
    }

    try {
      // Get default channel for workspace
      const { data: channelData } = await supabase
        .from('slack_channels')
        .select('channel_id')
        .eq('workspace_id', config.workspace_id)
        .eq('is_default', true)
        .single();

      const channel = channelData?.channel_id || 'general';

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.bot_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel,
          ...message,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        console.log(`✅ Sent to ${config.slack_team_name} (channel: ${channel})`);
      } else {
        console.log(`❌ Failed for ${config.slack_team_name}: ${result.error}`);
      }
    } catch (err) {
      console.log(`❌ Error for ${config.slack_team_name}:`, err.message);
    }
  }

  console.log('\n✅ Announcement complete!');
}

sendAnnouncement().catch(console.error);
