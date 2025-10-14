

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
  supabase: any,
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
      console.error('Workspace resolution failed in products GET', error);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const includeInactive = searchParams.get('include_inactive') === 'true';

    let query = supabase
      .from('knowledge_base_products')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: products, error } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    return NextResponse.json({ products: products ?? [] });
  } catch (error) {
    console.error('Unexpected error in products GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const body = await request.json();
    const {
      name,
      description,
      category,
      pricing,
      features,
      benefits,
      use_cases,
      competitive_advantages,
      target_segments
    } = body;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(supabase, user.id, body.workspace_id);
    } catch (error) {
      console.error('Workspace resolution failed in products POST', error);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const payload = {
      workspace_id: workspaceId,
      name: name.trim(),
      description: typeof description === 'string' ? description : null,
      category: typeof category === 'string' ? category : null,
      pricing: toRecord(pricing),
      features: toStringArray(features),
      benefits: toStringArray(benefits),
      use_cases: toStringArray(use_cases),
      competitive_advantages: toStringArray(competitive_advantages),
      target_segments: toStringArray(target_segments),
      is_active: true,
      created_by: user.id
    };

    const { data: product, error } = await supabase
      .from('knowledge_base_products')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error creating product:', error);
      return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
    }

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in products POST:', error);
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
      description,
      category,
      pricing,
      features,
      benefits,
      use_cases,
      competitive_advantages,
      target_segments,
      is_active
    } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(supabase, user.id, body.workspace_id);
    } catch (error) {
      console.error('Workspace resolution failed in products PUT', error);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (typeof name === 'string') updateData.name = name.trim();
    if (description !== undefined) updateData.description = typeof description === 'string' ? description : null;
    if (category !== undefined) updateData.category = typeof category === 'string' ? category : null;
    if (pricing !== undefined) updateData.pricing = toRecord(pricing);
    if (features !== undefined) updateData.features = toStringArray(features);
    if (benefits !== undefined) updateData.benefits = toStringArray(benefits);
    if (use_cases !== undefined) updateData.use_cases = toStringArray(use_cases);
    if (competitive_advantages !== undefined) updateData.competitive_advantages = toStringArray(competitive_advantages);
    if (target_segments !== undefined) updateData.target_segments = toStringArray(target_segments);
    if (is_active !== undefined) updateData.is_active = Boolean(is_active);

    const { data: product, error } = await supabase
      .from('knowledge_base_products')
      .update(updateData)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) {
      console.error('Error updating product:', error);
      return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Unexpected error in products PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(supabase, user.id, searchParams.get('workspace_id'));
    } catch (error) {
      console.error('Workspace resolution failed in products DELETE', error);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const { error } = await supabase
      .from('knowledge_base_products')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('Error deleting product:', error);
      return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in products DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
