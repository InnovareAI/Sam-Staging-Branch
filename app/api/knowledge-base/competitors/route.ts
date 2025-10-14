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
    // cookieStore removed;
    const supabase = createRouteHandlerClient({ cookies: await cookies() });
    const { searchParams } = new URL(request.url);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(supabase, user.id, searchParams.get('workspace_id'));
    } catch (error) {
      console.error('Workspace resolution failed in competitors GET', error);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const includeInactive = searchParams.get('include_inactive') === 'true';

    let query = supabase
      .from('knowledge_base_competitors')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: competitors, error } = await query;

    if (error) {
      console.error('Error fetching competitors:', error);
      return NextResponse.json({ error: 'Failed to fetch competitors' }, { status: 500 });
    }

    return NextResponse.json({ competitors: competitors ?? [] });
  } catch (error) {
    console.error('Unexpected error in competitors GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // cookieStore removed;
    const supabase = createRouteHandlerClient({ cookies: await cookies() });
    const body = await request.json();
    const {
      name,
      website,
      description,
      strengths,
      weaknesses,
      pricing_model,
      key_features,
      target_market,
      competitive_positioning
    } = body;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(supabase, user.id, body.workspace_id);
    } catch (error) {
      console.error('Workspace resolution failed in competitors POST', error);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const payload = {
      workspace_id: workspaceId,
      name: name.trim(),
      website: typeof website === 'string' ? website : null,
      description: typeof description === 'string' ? description : null,
      strengths: toStringArray(strengths),
      weaknesses: toStringArray(weaknesses),
      pricing_model: typeof pricing_model === 'string' ? pricing_model : null,
      key_features: toStringArray(key_features),
      target_market: typeof target_market === 'string' ? target_market : null,
      competitive_positioning: toRecord(competitive_positioning),
      is_active: true,
      created_by: user.id
    };

    const { data: competitor, error } = await supabase
      .from('knowledge_base_competitors')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error creating competitor:', error);
      return NextResponse.json({ error: 'Failed to create competitor' }, { status: 500 });
    }

    return NextResponse.json({ competitor }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in competitors POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // cookieStore removed;
    const supabase = createRouteHandlerClient({ cookies: await cookies() });
    const body = await request.json();
    const {
      id,
      name,
      website,
      description,
      strengths,
      weaknesses,
      pricing_model,
      key_features,
      target_market,
      competitive_positioning,
      is_active
    } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Competitor ID is required' }, { status: 400 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(supabase, user.id, body.workspace_id);
    } catch (error) {
      console.error('Workspace resolution failed in competitors PUT', error);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (typeof name === 'string') updateData.name = name.trim();
    if (website !== undefined) updateData.website = typeof website === 'string' ? website : null;
    if (description !== undefined) updateData.description = typeof description === 'string' ? description : null;
    if (strengths !== undefined) updateData.strengths = toStringArray(strengths);
    if (weaknesses !== undefined) updateData.weaknesses = toStringArray(weaknesses);
    if (pricing_model !== undefined) updateData.pricing_model = typeof pricing_model === 'string' ? pricing_model : null;
    if (key_features !== undefined) updateData.key_features = toStringArray(key_features);
    if (target_market !== undefined) updateData.target_market = typeof target_market === 'string' ? target_market : null;
    if (competitive_positioning !== undefined) updateData.competitive_positioning = toRecord(competitive_positioning);
    if (is_active !== undefined) updateData.is_active = Boolean(is_active);

    const { data: competitor, error } = await supabase
      .from('knowledge_base_competitors')
      .update(updateData)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) {
      console.error('Error updating competitor:', error);
      return NextResponse.json({ error: 'Failed to update competitor' }, { status: 500 });
    }

    return NextResponse.json({ competitor });
  } catch (error) {
    console.error('Unexpected error in competitors PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // cookieStore removed;
    const supabase = createRouteHandlerClient({ cookies: await cookies() });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Competitor ID is required' }, { status: 400 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(supabase, user.id, searchParams.get('workspace_id'));
    } catch (error) {
      console.error('Workspace resolution failed in competitors DELETE', error);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const { error } = await supabase
      .from('knowledge_base_competitors')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('Error deleting competitor:', error);
      return NextResponse.json({ error: 'Failed to delete competitor' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Competitor deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in competitors DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
