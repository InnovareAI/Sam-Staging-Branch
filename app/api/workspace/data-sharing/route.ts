import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';

// GET /api/workspace/data-sharing?workspaceId=xxx - Get user's sharing preferences and available data
export async function GET(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const dataSource = searchParams.get('dataSource');
    const dataType = searchParams.get('dataType');
    const minQualityScore = parseFloat(searchParams.get('minQualityScore') || '0.5');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const supabase = createClient();

    // Get current user ID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify workspace access
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userData.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this workspace' }, { status: 403 });
    }

    // Get user's sharing preferences
    const { data: preferences } = await supabase
      .from('workspace_data_sharing_preferences')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userData.id)
      .single();

    // Get available shared data
    const { data: sharedData, error: sharedDataError } = await supabase
      .rpc('get_shared_data_for_user', {
        p_workspace_id: workspaceId,
        p_user_id: userData.id,
        p_data_source: dataSource,
        p_data_type: dataType,
        p_min_quality_score: minQualityScore,
        p_limit: limit
      });

    if (sharedDataError) {
      console.error('Error fetching shared data:', sharedDataError);
    }

    // Get workspace sharing dashboard stats
    const { data: dashboardStats } = await supabase
      .from('workspace_data_sharing_dashboard')
      .select('*')
      .eq('workspace_id', workspaceId);

    return NextResponse.json({
      preferences: preferences || {
        auto_share_unipile: true,
        auto_share_brightdata: true,
        auto_share_apollo: false,
        auto_share_manual: false,
        default_sharing_level: 'workspace',
        can_access_others_unipile: true,
        can_access_others_brightdata: true,
        can_access_others_apollo: true,
        can_access_others_manual: false,
        notify_on_new_shared_data: true,
        notify_on_data_quality_issues: true
      },
      shared_data: sharedData || [],
      dashboard_stats: dashboardStats || [],
      total_available: sharedData?.length || 0
    });

  } catch (error) {
    console.error('Data sharing GET error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/workspace/data-sharing - Update user's sharing preferences
export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId, preferences } = body;

    if (!workspaceId || !preferences) {
      return NextResponse.json({ 
        error: 'Missing required fields: workspaceId, preferences' 
      }, { status: 400 });
    }

    const supabase = createClient();

    // Get current user ID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify workspace access
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userData.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this workspace' }, { status: 403 });
    }

    // Update or insert sharing preferences
    const { data: updatedPreferences, error } = await supabase
      .from('workspace_data_sharing_preferences')
      .upsert({
        workspace_id: workspaceId,
        user_id: userData.id,
        ...preferences,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id,user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating sharing preferences:', error);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      preferences: updatedPreferences,
      message: 'Data sharing preferences updated successfully'
    });

  } catch (error) {
    console.error('Data sharing POST error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT /api/workspace/data-sharing - Track data usage
export async function PUT(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sharedDataId, usageContext, usageDescription, valueGenerated } = body;

    if (!sharedDataId || !usageContext) {
      return NextResponse.json({ 
        error: 'Missing required fields: sharedDataId, usageContext' 
      }, { status: 400 });
    }

    const supabase = createClient();

    // Get current user ID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Track data usage
    const { error } = await supabase.rpc('track_data_usage', {
      p_shared_data_id: sharedDataId,
      p_user_id: userData.id,
      p_usage_context: usageContext,
      p_usage_description: usageDescription
    });

    if (error) {
      console.error('Error tracking data usage:', error);
      return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 });
    }

    // If value was generated, update the usage record
    if (valueGenerated) {
      await supabase
        .from('workspace_data_usage')
        .update({ value_generated: valueGenerated })
        .eq('shared_data_id', sharedDataId)
        .eq('used_by', userData.id)
        .order('used_at', { ascending: false })
        .limit(1);
    }

    return NextResponse.json({
      success: true,
      message: 'Data usage tracked successfully'
    });

  } catch (error) {
    console.error('Data sharing PUT error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}