import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

/**
 * GET /api/integrations/slack/oauth-callback
 *
 * Handles the OAuth callback from Slack after user approves the app installation.
 * Exchanges the authorization code for access tokens and stores them.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This is the workspace_id we passed
    const error = searchParams.get('error');

    // Handle user cancellation
    if (error) {
      console.error('[Slack OAuth] User cancelled or error:', error);
      return NextResponse.redirect(
        new URL(`/workspace/${state}/settings?slack_error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code || !state) {
      console.error('[Slack OAuth] Missing code or state');
      return NextResponse.redirect(
        new URL(`/workspace/${state || ''}/settings?slack_error=missing_params`, request.url)
      );
    }

    const workspaceId = state;

    // Exchange the code for tokens
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = `https://app.meet-sam.com/api/integrations/slack/oauth-callback`;

    if (!clientId || !clientSecret) {
      console.error('[Slack OAuth] Missing SLACK_CLIENT_ID or SLACK_CLIENT_SECRET env vars');
      return NextResponse.redirect(
        new URL(`/workspace/${workspaceId}/settings?slack_error=server_config`, request.url)
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.ok) {
      console.error('[Slack OAuth] Token exchange failed:', tokenData.error);
      return NextResponse.redirect(
        new URL(`/workspace/${workspaceId}/settings?slack_error=${encodeURIComponent(tokenData.error)}`, request.url)
      );
    }

    // Extract the tokens and team info
    const {
      access_token,
      team,
      bot_user_id,
      authed_user,
    } = tokenData;

    // The bot token is in access_token for bot-only apps
    const botToken = access_token;

    console.log('[Slack OAuth] Successfully authenticated:', {
      team_id: team?.id,
      team_name: team?.name,
      bot_user_id,
    });

    // Store the app config
    const { error: configError } = await supabaseAdmin()
      .from('slack_app_config')
      .upsert({
        workspace_id: workspaceId,
        slack_team_id: team?.id,
        slack_team_name: team?.name,
        bot_token: botToken,
        bot_user_id,
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
      console.error('[Slack OAuth] Failed to save config:', configError);
      return NextResponse.redirect(
        new URL(`/workspace/${workspaceId}/settings?slack_error=save_failed`, request.url)
      );
    }

    // Also update workspace_integrations for backward compatibility
    await supabaseAdmin()
      .from('workspace_integrations')
      .upsert({
        workspace_id: workspaceId,
        integration_type: 'slack',
        status: 'active',
        config: {
          mode: 'app',
          team_id: team?.id,
          team_name: team?.name,
          bot_user_id,
          has_bot_token: true,
        },
        connected_at: new Date().toISOString(),
      }, {
        onConflict: 'workspace_id,integration_type',
      });

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}/settings?slack_success=true&team_name=${encodeURIComponent(team?.name || '')}`, request.url)
    );

  } catch (error) {
    console.error('[Slack OAuth] Unexpected error:', error);
    return NextResponse.redirect(
      new URL('/settings?slack_error=unexpected', request.url)
    );
  }
}
