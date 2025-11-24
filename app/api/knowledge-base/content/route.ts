import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: await cookies() });
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const sectionId = searchParams.get('section_id');
    const contentType = searchParams.get('content_type');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build query
    let query = supabase
      .from('knowledge_base_content')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true);

    if (sectionId) {
      query = query.eq('section_id', sectionId);
    }

    if (contentType) {
      query = query.eq('content_type', contentType);
    }

    const { data: content, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching KB content:', error);
      return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Unexpected error in KB content API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: await cookies() });
    const body = await request.json();
    const { workspace_id, section_id, content_type, title, content, metadata, tags } = body;

    if (!workspace_id || !section_id || !content_type || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create new content
    const { data: newContent, error } = await supabase
      .from('knowledge_base_content')
      .insert({
        workspace_id,
        section_id,
        content_type,
        title,
        content,
        metadata: metadata || {},
        tags: tags || [],
        created_by: session.user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating KB content:', error);
      return NextResponse.json({ error: 'Failed to create content' }, { status: 500 });
    }

    return NextResponse.json({ content: newContent }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in KB content POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: await cookies() });
    const body = await request.json();
    const { id, title, content, metadata, tags, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Content ID is required' }, { status: 400 });
    }

    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update content
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (tags !== undefined) updateData.tags = tags;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: updatedContent, error } = await supabase
      .from('knowledge_base_content')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating KB content:', error);
      return NextResponse.json({ error: 'Failed to update content' }, { status: 500 });
    }

    return NextResponse.json({ content: updatedContent });
  } catch (error) {
    console.error('Unexpected error in KB content PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: await cookies() });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Content ID is required' }, { status: 400 });
    }

    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Soft delete by setting is_active to false
    const { data: deletedContent, error } = await supabase
      .from('knowledge_base_content')
      .update({ 
        is_active: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error deleting KB content:', error);
      return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Content deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in KB content DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}