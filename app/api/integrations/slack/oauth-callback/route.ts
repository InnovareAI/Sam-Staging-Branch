import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

/**
 * GET /api/integrations/slack/oauth-callback
 *
 * Handles the OAuth callback from Slack after user approves the app installation.
 * Supports two installation flows:
 *
 * 1. FROM SAM SETTINGS: state contains workspace_id
 *    - Links Slack team to existing SAM workspace
 *    - Redirects back to workspace settings
 *
 * 2. FROM SLACK APP DIRECTORY: state is 'slack_direct' or empty
 *    - Stores pending Slack installation
 *    - Redirects to /slack/connect page to link SAM account
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // workspace_id OR 'slack_direct' for Slack Directory installs
    const error = searchParams.get('error');

    // Determine if this is a direct install from Slack App Directory
    const isDirectInstall = !state || state === 'slack_direct';

    // Handle user cancellation
    if (error) {
      console.error('[Slack OAuth] User cancelled or error:', error);
      if (isDirectInstall) {
        return NextResponse.redirect(
          new URL(`/slack/connect?error=${encodeURIComponent(error)}`, request.url)
        );
      }
      return NextResponse.redirect(
        new URL(`/workspace/${state}/settings?slack_error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      console.error('[Slack OAuth] Missing code');
      if (isDirectInstall) {
        return NextResponse.redirect(
          new URL('/slack/connect?error=missing_code', request.url)
        );
      }
      return NextResponse.redirect(
        new URL(`/workspace/${state}/settings?slack_error=missing_params`, request.url)
      );
    }

    // Exchange the code for tokens
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = `https://app.meet-sam.com/api/integrations/slack/oauth-callback`;

    if (!clientId || !clientSecret) {
      console.error('[Slack OAuth] Missing SLACK_CLIENT_ID or SLACK_CLIENT_SECRET env vars');
      if (isDirectInstall) {
        return NextResponse.redirect(
          new URL('/slack/connect?error=server_config', request.url)
        );
      }
      return NextResponse.redirect(
        new URL(`/workspace/${state}/settings?slack_error=server_config`, request.url)
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
      if (isDirectInstall) {
        return NextResponse.redirect(
          new URL(`/slack/connect?error=${encodeURIComponent(tokenData.error)}`, request.url)
        );
      }
      return NextResponse.redirect(
        new URL(`/workspace/${state}/settings?slack_error=${encodeURIComponent(tokenData.error)}`, request.url)
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
      authed_user_id: authed_user?.id,
      isDirectInstall,
    });

    // FLOW 2: Direct install from Slack App Directory
    if (isDirectInstall) {
      // Store the pending Slack installation (not yet linked to a SAM workspace)
      // Use slack_team_id as the unique identifier
      const { error: pendingError } = await supabaseAdmin()
        .from('slack_pending_installations')
        .upsert({
          slack_team_id: team?.id,
          slack_team_name: team?.name,
          bot_token: botToken,
          bot_user_id,
          authed_user_id: authed_user?.id,
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        }, {
          onConflict: 'slack_team_id',
        });

      if (pendingError) {
        console.error('[Slack OAuth] Failed to save pending installation:', pendingError);
        // Continue anyway - we'll pass the data via URL params
      }

      // Redirect to connection page with Slack team info
      const connectUrl = new URL('/slack/connect', request.url);
      connectUrl.searchParams.set('team_id', team?.id || '');
      connectUrl.searchParams.set('team_name', team?.name || '');
      connectUrl.searchParams.set('success', 'true');

      return NextResponse.redirect(connectUrl);
    }

    // FLOW 1: Install from SAM Settings (state = workspace_id)
    const workspaceId = state;

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
      new URL('/slack/connect?error=unexpected', request.url)
    );
  }
}
