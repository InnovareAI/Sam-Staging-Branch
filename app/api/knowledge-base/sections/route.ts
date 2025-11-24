import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: await cookies() });
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get sections for the workspace
    const { data: sections, error } = await supabase
      .from('knowledge_base_sections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error('Error fetching KB sections:', error);
      return NextResponse.json({ error: 'Failed to fetch sections' }, { status: 500 });
    }

    // If no sections exist, initialize default sections
    if (!sections || sections.length === 0) {
      const { error: initError } = await supabase.rpc(
        'initialize_knowledge_base_sections',
        { p_workspace_id: workspaceId }
      );

      if (initError) {
        console.error('Error initializing KB sections:', initError);
        return NextResponse.json({ error: 'Failed to initialize sections' }, { status: 500 });
      }

      // Fetch the newly created sections
      const { data: newSections, error: fetchError } = await supabase
        .from('knowledge_base_sections')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('sort_order');

      if (fetchError) {
        console.error('Error fetching new KB sections:', fetchError);
        return NextResponse.json({ error: 'Failed to fetch new sections' }, { status: 500 });
      }

      return NextResponse.json({ sections: newSections });
    }

    return NextResponse.json({ sections });
  } catch (error) {
    console.error('Unexpected error in KB sections API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: await cookies() });
    const body = await request.json();
    const { workspace_id, section_id, title, description, icon, sort_order } = body;

    if (!workspace_id || !section_id || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create new section
    const { data: section, error } = await supabase
      .from('knowledge_base_sections')
      .insert({
        workspace_id,
        section_id,
        title,
        description,
        icon,
        sort_order: sort_order || 0
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating KB section:', error);
      return NextResponse.json({ error: 'Failed to create section' }, { status: 500 });
    }

    return NextResponse.json({ section }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in KB sections POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: await cookies() });
    const body = await request.json();
    const { id, title, description, icon, sort_order, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Section ID is required' }, { status: 400 });
    }

    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update section
    const { data: section, error } = await supabase
      .from('knowledge_base_sections')
      .update({
        title,
        description,
        icon,
        sort_order,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating KB section:', error);
      return NextResponse.json({ error: 'Failed to update section' }, { status: 500 });
    }

    return NextResponse.json({ section });
  } catch (error) {
    console.error('Unexpected error in KB sections PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}