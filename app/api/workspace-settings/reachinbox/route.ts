/**
 * Workspace ReachInbox Settings API
 *
 * GET - Check if ReachInbox is configured for workspace
 * POST - Save ReachInbox API key for workspace
 * DELETE - Remove ReachInbox configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

// GET - Check ReachInbox configuration status
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace from user
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (!workspaceMember) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Check if ReachInbox is configured in workspace_tiers integration_config
    const { data: tierConfig } = await supabase
      .from('workspace_tiers')
      .select('integration_config')
      .eq('workspace_id', workspaceMember.workspace_id)
      .single();

    const integrationConfig = tierConfig?.integration_config || {};
    const hasReachInbox = !!integrationConfig.reachinbox_api_key;

    return NextResponse.json({
      success: true,
      configured: hasReachInbox,
      // Don't expose the actual API key, just show if it's set
      api_key_preview: hasReachInbox
        ? `${integrationConfig.reachinbox_api_key.substring(0, 8)}...`
        : null,
    });
  } catch (error: any) {
    console.error('ReachInbox settings GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get ReachInbox settings', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Save ReachInbox API key
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { api_key } = await req.json();

    if (!api_key || typeof api_key !== 'string') {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Get workspace from user
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single();

    if (!workspaceMember) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Only admins/owners can configure integrations
    if (!['admin', 'owner'].includes(workspaceMember.role)) {
      return NextResponse.json(
        { error: 'Only admins can configure integrations' },
        { status: 403 }
      );
    }

    const workspaceId = workspaceMember.workspace_id;

    // Get current integration config
    const { data: tierConfig } = await supabase
      .from('workspace_tiers')
      .select('integration_config')
      .eq('workspace_id', workspaceId)
      .single();

    const currentConfig = tierConfig?.integration_config || {};

    // Update integration config with new ReachInbox key
    const newConfig = {
      ...currentConfig,
      reachinbox_api_key: api_key,
    };

    // Update or insert workspace_tiers record
    const { error: upsertError } = await supabase
      .from('workspace_tiers')
      .upsert(
        {
          workspace_id: workspaceId,
          integration_config: newConfig,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id' }
      );

    if (upsertError) {
      console.error('Failed to save ReachInbox config:', upsertError);
      return NextResponse.json(
        { error: 'Failed to save configuration', details: upsertError.message },
        { status: 500 }
      );
    }

    // Test the API key by listing campaigns
    try {
      const testResponse = await fetch('https://api.reachinbox.ai/api/v1/campaigns', {
        headers: {
          Authorization: `Bearer ${api_key}`,
        },
      });

      if (!testResponse.ok) {
        // Still save the key but warn about invalid
        return NextResponse.json({
          success: true,
          warning: 'API key saved but could not verify connection. Please check the key.',
          configured: true,
        });
      }
    } catch {
      // Connection test failed but key is saved
      return NextResponse.json({
        success: true,
        warning: 'API key saved but connection test failed.',
        configured: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'ReachInbox API key configured successfully',
      configured: true,
    });
  } catch (error: any) {
    console.error('ReachInbox settings POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save ReachInbox settings', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove ReachInbox configuration
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace from user
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single();

    if (!workspaceMember) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Only admins/owners can configure integrations
    if (!['admin', 'owner'].includes(workspaceMember.role)) {
      return NextResponse.json(
        { error: 'Only admins can configure integrations' },
        { status: 403 }
      );
    }

    const workspaceId = workspaceMember.workspace_id;

    // Get current integration config
    const { data: tierConfig } = await supabase
      .from('workspace_tiers')
      .select('integration_config')
      .eq('workspace_id', workspaceId)
      .single();

    if (!tierConfig) {
      return NextResponse.json({ success: true, message: 'No configuration to remove' });
    }

    const currentConfig = tierConfig.integration_config || {};

    // Remove reachinbox_api_key from config
    const { reachinbox_api_key, ...newConfig } = currentConfig;

    // Update workspace_tiers
    await supabase
      .from('workspace_tiers')
      .update({
        integration_config: newConfig,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId);

    return NextResponse.json({
      success: true,
      message: 'ReachInbox configuration removed',
      configured: false,
    });
  } catch (error: any) {
    console.error('ReachInbox settings DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to remove ReachInbox settings', details: error.message },
      { status: 500 }
    );
  }
}
