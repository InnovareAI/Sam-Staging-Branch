

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

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
    const supabase = await createSupabaseRouteClient();
    const { searchParams } = new URL(request.url);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(supabase, user.id, searchParams.get('workspace_id'));
    } catch (error) {
      console.error('Workspace resolution failed in ICP GET', error);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const includeInactive = searchParams.get('include_inactive') === 'true';

    let query = supabase
      .from('knowledge_base_icps')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: icps, error } = await query;

    if (error) {
      console.error('Error fetching ICPs:', error);
      return NextResponse.json({ error: 'Failed to fetch ICPs' }, { status: 500 });
    }

    return NextResponse.json({ icps: icps ?? [] });
  } catch (error) {
    console.error('Unexpected error in ICPs API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const body = await request.json();
    const {
      name,
      company_size_min,
      company_size_max,
      industries,
      job_titles,
      locations,
      technologies,
      pain_points,
      qualification_criteria,
      messaging_framework
    } = body;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(supabase, user.id, body.workspace_id);
    } catch (error) {
      console.error('Workspace resolution failed in ICP POST', error);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const payload = {
      workspace_id: workspaceId,
      name: name.trim(),
      company_size_min: company_size_min ?? null,
      company_size_max: company_size_max ?? null,
      industries: toStringArray(industries),
      job_titles: toStringArray(job_titles),
      locations: toStringArray(locations),
      technologies: toStringArray(technologies),
      pain_points: toStringArray(pain_points),
      qualification_criteria: toRecord(qualification_criteria),
      messaging_framework: toRecord(messaging_framework),
      is_active: true,
      created_by: user.id
    };

    const { data: icp, error } = await supabase
      .from('knowledge_base_icps')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error creating ICP:', error);
      return NextResponse.json({ error: 'Failed to create ICP' }, { status: 500 });
    }

    return NextResponse.json({ icp }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in ICPs POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const body = await request.json();
    const {
      id,
      name,
      company_size_min,
      company_size_max,
      industries,
      job_titles,
      locations,
      technologies,
      pain_points,
      qualification_criteria,
      messaging_framework,
      is_active
    } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ICP ID is required' }, { status: 400 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(supabase, user.id, body.workspace_id);
    } catch (error) {
      console.error('Workspace resolution failed in ICP PUT', error);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (typeof name === 'string') updateData.name = name.trim();
    if (company_size_min !== undefined) updateData.company_size_min = company_size_min;
    if (company_size_max !== undefined) updateData.company_size_max = company_size_max;
    if (industries !== undefined) updateData.industries = toStringArray(industries);
    if (job_titles !== undefined) updateData.job_titles = toStringArray(job_titles);
    if (locations !== undefined) updateData.locations = toStringArray(locations);
    if (technologies !== undefined) updateData.technologies = toStringArray(technologies);
    if (pain_points !== undefined) updateData.pain_points = toStringArray(pain_points);
    if (qualification_criteria !== undefined) updateData.qualification_criteria = toRecord(qualification_criteria);
    if (messaging_framework !== undefined) updateData.messaging_framework = toRecord(messaging_framework);
    if (is_active !== undefined) updateData.is_active = Boolean(is_active);

    const { data: icp, error } = await supabase
      .from('knowledge_base_icps')
      .update(updateData)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) {
      console.error('Error updating ICP:', error);
      return NextResponse.json({ error: 'Failed to update ICP' }, { status: 500 });
    }

    return NextResponse.json({ icp });
  } catch (error) {
    console.error('Unexpected error in ICPs PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ICP ID is required' }, { status: 400 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(supabase, user.id, searchParams.get('workspace_id'));
    } catch (error) {
      console.error('Workspace resolution failed in ICP DELETE', error);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const { error } = await supabase
      .from('knowledge_base_icps')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('Error deleting ICP:', error);
      return NextResponse.json({ error: 'Failed to delete ICP' }, { status: 500 });
    }

    return NextResponse.json({ message: 'ICP deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in ICPs DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
