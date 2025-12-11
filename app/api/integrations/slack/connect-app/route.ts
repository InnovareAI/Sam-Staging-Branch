import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/app/lib/supabase';

/**
 * Connect Slack App with Bot Token
 * Stores credentials in slack_app_config table for two-way communication
 */

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspace_id, bot_token, signing_secret } = body;

    if (!workspace_id || !bot_token) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Validate bot token format
    if (!bot_token.startsWith('xoxb-')) {
      return NextResponse.json({ success: false, error: 'Invalid bot token format. Must start with xoxb-' }, { status: 400 });
    }

    // Verify user has access to workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Test the bot token by fetching team info
    const testResponse = await fetch('https://slack.com/api/auth.test', {
      headers: {
        'Authorization': `Bearer ${bot_token}`,
      },
    });

    const testResult = await testResponse.json();

    if (!testResult.ok) {
      return NextResponse.json({
        success: false,
        error: `Invalid bot token: ${testResult.error}`,
      }, { status: 400 });
    }

    // Get bot user info
    const botInfoResponse = await fetch(`https://slack.com/api/users.info?user=${testResult.user_id}`, {
      headers: {
        'Authorization': `Bearer ${bot_token}`,
      },
    });

    const botInfo = await botInfoResponse.json();

    // Store the app config
    const { error: configError } = await supabaseAdmin
      .from('slack_app_config')
      .upsert({
        workspace_id,
        slack_team_id: testResult.team_id,
        slack_team_name: testResult.team,
        bot_token,
        bot_user_id: testResult.user_id,
        signing_secret: signing_secret || null,
        status: 'active',
        last_verified_at: new Date().toISOString(),
        features_enabled: {
          notifications: true,
          two_way_chat: true,
          slash_commands: true,
          interactive_buttons: true,
          thread_replies: true,
        },
      }, {
        onConflict: 'workspace_id',
      });

    if (configError) {
      console.error('Failed to save Slack app config:', configError);
      return NextResponse.json({ success: false, error: 'Failed to save configuration' }, { status: 500 });
    }

    // Also update workspace_integrations for backward compatibility
    await supabaseAdmin
      .from('workspace_integrations')
      .upsert({
        workspace_id,
        integration_type: 'slack',
        status: 'active',
        config: {
          mode: 'app',
          team_id: testResult.team_id,
          team_name: testResult.team,
          bot_user_id: testResult.user_id,
          has_bot_token: true,
        },
        connected_at: new Date().toISOString(),
      }, {
        onConflict: 'workspace_id,integration_type',
      });

    return NextResponse.json({
      success: true,
      team_id: testResult.team_id,
      team_name: testResult.team,
      bot_name: botInfo.user?.real_name || 'SAM AI',
    });

  } catch (error) {
    console.error('Slack connect-app error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
