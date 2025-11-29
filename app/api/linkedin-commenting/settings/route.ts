import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';

export const dynamic = 'force-dynamic';

// GET - Check if commenting agent is enabled for workspace
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // Check workspace_settings for commenting_agent_enabled
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .select('commenting_agent_enabled')
      .eq('id', workspaceId)
      .single();

    if (error) {
      // If column doesn't exist, return false
      return NextResponse.json({ enabled: false });
    }

    return NextResponse.json({
      enabled: workspace?.commenting_agent_enabled || false
    });

  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ enabled: false });
  }
}
