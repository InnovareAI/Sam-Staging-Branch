import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's workspace
    const { data: workspaceUser, error: workspaceError } = await supabase
      .from('workspace_users')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (workspaceError || !workspaceUser) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 });
    }

    // Fetch ICP profiles for this workspace
    const { data: icpProfiles, error: icpError } = await supabase
      .from('icp_configurations')
      .select('*')
      .eq('workspace_id', workspaceUser.workspace_id);

    if (icpError) {
      console.error('Error fetching ICP profiles:', icpError);
      return NextResponse.json({ error: 'Failed to fetch ICP profiles' }, { status: 500 });
    }

    // Convert array to object with id as key
    const profilesObject = icpProfiles?.reduce((acc, profile) => {
      acc[profile.id] = profile;
      return acc;
    }, {} as Record<string, any>) || {};

    return NextResponse.json(profilesObject);
  } catch (error) {
    console.error('Error in ICP profiles GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's workspace
    const { data: workspaceUser, error: workspaceError } = await supabase
      .from('workspace_users')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (workspaceError || !workspaceUser) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 });
    }

    // Parse request body
    const body = await request.json();
    const { 
      name, 
      overview = {}, 
      target_profile = {}, 
      decision_makers = {}, 
      pain_points = {}, 
      buying_process = {}, 
      messaging = {}, 
      success_metrics = {}, 
      advanced = {} 
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'ICP name is required' }, { status: 400 });
    }

    // Create new ICP profile
    const { data: newProfile, error: createError } = await supabase
      .from('icp_configurations')
      .insert({
        workspace_id: workspaceUser.workspace_id,
        icp_name: name.trim(),
        overview,
        target_profile,
        decision_makers,
        pain_points,
        buying_process,
        messaging,
        success_metrics,
        advanced
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating ICP profile:', createError);
      return NextResponse.json({ error: 'Failed to create ICP profile' }, { status: 500 });
    }

    return NextResponse.json(newProfile);
  } catch (error) {
    console.error('Error in ICP profiles POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}