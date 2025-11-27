/**
 * Reply Agent Settings API
 * GET/PUT settings for workspace reply agent configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { supabaseAdmin } from '@/app/lib/supabase';
import { getDefaultSettings } from '@/lib/services/reply-draft-generator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authClient = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
    }

    // Verify membership
    const { data: membership } = await authClient
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const supabase = supabaseAdmin();

    // Get settings or return defaults
    const { data: settings, error } = await supabase
      .from('reply_agent_settings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found, which is ok
      console.error('Error fetching settings:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    // Merge with defaults
    const defaults = getDefaultSettings();
    const mergedSettings = {
      ...defaults,
      ...settings,
      workspace_id: workspaceId
    };

    return NextResponse.json({
      success: true,
      settings: mergedSettings,
      isDefault: !settings
    });

  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authClient = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspace_id, ...settingsData } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
    }

    // Verify admin/owner role
    const { data: membership } = await authClient
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = supabaseAdmin();

    // Upsert settings
    const { data: settings, error } = await supabase
      .from('reply_agent_settings')
      .upsert({
        workspace_id,
        ...settingsData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving settings:', error);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      settings
    });

  } catch (error) {
    console.error('Settings PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
