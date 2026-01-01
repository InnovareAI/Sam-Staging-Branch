import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

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

    // Update slack_app_config status to inactive (this is the main table used for status checks)
    const { error: appConfigError } = await pool
      .from('slack_app_config')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('workspace_id', workspace_id);

    if (appConfigError) {
      console.error('Error disconnecting Slack app config:', appConfigError);
    }

    // Also update workspace_integrations for backward compatibility
    const { error: integrationError } = await pool
      .from('workspace_integrations')
      .update({
        status: 'inactive',
        config: {},
        updated_at: new Date().toISOString()
      })
      .eq('workspace_id', workspace_id)
      .eq('integration_type', 'slack');

    if (integrationError) {
      console.error('Error disconnecting workspace integration:', integrationError);
    }

    return NextResponse.json({
      success: true,
      message: 'Slack disconnected'
    });

  } catch (error) {
    console.error('Slack disconnect error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
