import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

/**
 * POST /api/integrations/slack/set-channel
 * Set the default Slack channel for a workspace
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, channel_id, channel_name } = body;

    if (!workspace_id || !channel_id) {
      return NextResponse.json({
        success: false,
        error: 'workspace_id and channel_id required',
      }, { status: 400 });
    }

    // Update the slack_app_config table with the default channel
    const { error: updateError } = await supabaseAdmin()
      .from('slack_app_config')
      .update({
        default_channel: channel_id,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspace_id);

    if (updateError) {
      console.error('Error updating default channel:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Failed to update default channel',
      }, { status: 500 });
    }

    // Also update slack_channels table for backward compatibility
    await supabaseAdmin()
      .from('slack_channels')
      .update({ is_default: false })
      .eq('workspace_id', workspace_id);

    await supabaseAdmin()
      .from('slack_channels')
      .upsert({
        workspace_id,
        channel_id,
        channel_name: channel_name || channel_id,
        is_default: true,
      }, {
        onConflict: 'workspace_id,channel_id',
      });

    return NextResponse.json({
      success: true,
      message: 'Default channel updated',
    });

  } catch (error) {
    console.error('Error setting default channel:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
