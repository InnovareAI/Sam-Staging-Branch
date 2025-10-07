import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

type RouteSupabaseClient = ReturnType<typeof createRouteHandlerClient>;

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item).trim()))
      .filter((item) => item.length > 0);
  }
  return [];
};

const toRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
};

async function resolveWorkspaceId(
  supabase: RouteSupabaseClient,
  userId: string,
  providedWorkspaceId?: string | null
): Promise<string> {
  if (providedWorkspaceId && providedWorkspaceId.trim().length > 0) {
    return providedWorkspaceId;
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', userId)
    .single();

  if (!profileError && profile?.current_workspace_id) {
    return profile.current_workspace_id;
  }

  const { data: membership, error: membershipError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (!membershipError && membership?.workspace_id) {
    return membership.workspace_id;
  }

  throw new Error('Workspace not found for user');
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { searchParams } = new URL(request.url);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(supabase, user.id, searchParams.get('workspace_id'));
    } catch (error) {
      console.error('Workspace resolution failed in personas GET', error);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const icpFilter = searchParams.get('icp_id');
    const includeInactive = searchParams.get('include_inactive') === 'true';

    let query = supabase
      .from('knowledge_base_personas')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (icpFilter) {
      query = query.eq('icp_id', icpFilter);
    }

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: personas, error } = await query;

    if (error) {
      console.error('Error fetching personas:', error);
      return NextResponse.json({ error: 'Failed to fetch personas' }, { status: 500 });
    }

    return NextResponse.json({ personas: personas ?? [] });
  } catch (error) {
    console.error('Unexpected error in personas GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const body = await request.json();
    const {
      icp_id,
      name,
      job_title,
      department,
      seniority_level,
      decision_making_role,
      pain_points,
      goals,
      communication_preferences,
      objections,
      messaging_approach
    } = body;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(supabase, user.id, body.workspace_id);
    } catch (error) {
      console.error('Workspace resolution failed in personas POST', error);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const payload = {
      workspace_id: workspaceId,
      icp_id: typeof icp_id === 'string' && icp_id.trim().length > 0 ? icp_id : null,
      name: name.trim(),
      job_title: typeof job_title === 'string' ? job_title : null,
      department: typeof department === 'string' ? department : null,
      seniority_level: typeof seniority_level === 'string' ? seniority_level : null,
      decision_making_role: typeof decision_making_role === 'string' ? decision_making_role : null,
      pain_points: toStringArray(pain_points),
      goals: toStringArray(goals),
      communication_preferences: toRecord(communication_preferences),
      objections: toStringArray(objections),
      messaging_approach: toRecord(messaging_approach),
      is_active: true,
      created_by: user.id
    };

    const { data: persona, error } = await supabase
      .from('knowledge_base_personas')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error creating persona:', error);
      return NextResponse.json({ error: 'Failed to create persona' }, { status: 500 });
    }

    return NextResponse.json({ persona }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in personas POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const body = await request.json();
    const {
      id,
      icp_id,
      name,
      job_title,
      department,
      seniority_level,
      decision_making_role,
      pain_points,
      goals,
      communication_preferences,
      objections,
      messaging_approach,
      is_active
    } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Persona ID is required' }, { status: 400 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(supabase, user.id, body.workspace_id);
    } catch (error) {
      console.error('Workspace resolution failed in personas PUT', error);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (typeof icp_id === 'string') updateData.icp_id = icp_id;
    if (typeof name === 'string') updateData.name = name.trim();
    if (job_title !== undefined) updateData.job_title = typeof job_title === 'string' ? job_title : null;
    if (department !== undefined) updateData.department = typeof department === 'string' ? department : null;
    if (seniority_level !== undefined) updateData.seniority_level = typeof seniority_level === 'string' ? seniority_level : null;
    if (decision_making_role !== undefined) updateData.decision_making_role = typeof decision_making_role === 'string' ? decision_making_role : null;
    if (pain_points !== undefined) updateData.pain_points = toStringArray(pain_points);
    if (goals !== undefined) updateData.goals = toStringArray(goals);
    if (communication_preferences !== undefined) updateData.communication_preferences = toRecord(communication_preferences);
    if (objections !== undefined) updateData.objections = toStringArray(objections);
    if (messaging_approach !== undefined) updateData.messaging_approach = toRecord(messaging_approach);
    if (is_active !== undefined) updateData.is_active = Boolean(is_active);

    const { data: persona, error } = await supabase
      .from('knowledge_base_personas')
      .update(updateData)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) {
      console.error('Error updating persona:', error);
      return NextResponse.json({ error: 'Failed to update persona' }, { status: 500 });
    }

    return NextResponse.json({ persona });
  } catch (error) {
    console.error('Unexpected error in personas PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Persona ID is required' }, { status: 400 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(supabase, user.id, searchParams.get('workspace_id'));
    } catch (error) {
      console.error('Workspace resolution failed in personas DELETE', error);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const { error } = await supabase
      .from('knowledge_base_personas')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('Error deleting persona:', error);
      return NextResponse.json({ error: 'Failed to delete persona' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Persona deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in personas DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
