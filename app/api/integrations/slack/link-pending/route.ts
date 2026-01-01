import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { pool } from '@/lib/db';

/**
 * POST /api/integrations/slack/link-pending
 *
 * Links a pending Slack installation (from App Directory) to a SAM workspace.
 * Called after user logs in and selects which workspace to connect.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { slack_team_id, workspace_id } = body;

    if (!slack_team_id || !workspace_id) {
      return NextResponse.json(
        { success: false, error: 'Missing slack_team_id or workspace_id' },
        { status: 400 }
      );
    }

    // Verify user has access to this workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this workspace' },
        { status: 403 }
      );
    }

    // Get the pending installation
    const { data: pending, error: pendingError } = await pool
      .from('slack_pending_installations')
      .select('*')
      .eq('slack_team_id', slack_team_id)
      .eq('status', 'pending')
      .single();

    if (pendingError || !pending) {
      console.error('[Link Pending] Pending installation not found:', pendingError);
      return NextResponse.json(
        { success: false, error: 'Pending Slack installation not found or expired. Please reinstall the Slack app.' },
        { status: 404 }
      );
    }

    // Check if expired
    if (pending.expires_at && new Date(pending.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Pending installation has expired. Please reinstall the Slack app.' },
        { status: 410 }
      );
    }

    // Move the installation to slack_app_config
    const { error: configError } = await pool
      .from('slack_app_config')
      .upsert({
        workspace_id,
        slack_team_id: pending.slack_team_id,
        slack_team_name: pending.slack_team_name,
        bot_token: pending.bot_token,
        bot_user_id: pending.bot_user_id,
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
      console.error('[Link Pending] Failed to create slack_app_config:', configError);
      return NextResponse.json(
        { success: false, error: 'Failed to save Slack configuration' },
        { status: 500 }
      );
    }

    // Also update workspace_integrations for backward compatibility
    await pool
      .from('workspace_integrations')
      .upsert({
        workspace_id,
        integration_type: 'slack',
        status: 'active',
        config: {
          mode: 'app',
          team_id: pending.slack_team_id,
          team_name: pending.slack_team_name,
          bot_user_id: pending.bot_user_id,
          has_bot_token: true,
        },
        connected_at: new Date().toISOString(),
      }, {
        onConflict: 'workspace_id,integration_type',
      });

    // Mark the pending installation as linked
    await pool
      .from('slack_pending_installations')
      .update({
        status: 'linked',
        linked_workspace_id: workspace_id,
        linked_at: new Date().toISOString(),
      })
      .eq('id', pending.id);

    console.log('[Link Pending] Successfully linked Slack to workspace:', {
      slack_team_id: pending.slack_team_id,
      slack_team_name: pending.slack_team_name,
      workspace_id,
    });

    return NextResponse.json({
      success: true,
      message: 'Slack workspace connected successfully',
      team_name: pending.slack_team_name,
    });

  } catch (error) {
    console.error('[Link Pending] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
