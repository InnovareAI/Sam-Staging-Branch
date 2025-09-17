import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const workspaceId = formData.get('workspace_id') as string;
    const sectionId = formData.get('section_id') as string;
    const contentType = formData.get('content_type') as string || 'document';
    const tags = formData.get('tags') as string || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    if (!sectionId) {
      return NextResponse.json({ error: 'Section ID is required' }, { status: 400 });
    }

    // Read file content
    const text = await file.text();
    const fileName = file.name;
    const fileSize = file.size;
    
    // Parse tags
    const parsedTags = tags ? tags.split(',').map(tag => tag.trim()) : [];
    parsedTags.push('uploaded', contentType);

    // Create title from filename (remove extension)
    const title = fileName.replace(/\.[^/.]+$/, '');

    // Insert into knowledge_base_content
    const { data: content, error: insertError } = await supabase
      .from('knowledge_base_content')
      .insert({
        workspace_id: workspaceId,
        section_id: sectionId,
        content_type: contentType,
        title: title,
        content: text,
        metadata: {
          filename: fileName,
          file_size: fileSize,
          uploaded_at: new Date().toISOString(),
          uploaded_by: session.user.id,
          tags: parsedTags
        },
        tags: parsedTags,
        is_active: true,
        created_by: session.user.id
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting KB content:', insertError);
      return NextResponse.json({ error: 'Failed to save document' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: content,
      message: `Document "${title}" uploaded successfully to Knowledge Base`
    });

  } catch (error) {
    console.error('Knowledge Base upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' }, 
      { status: 500 }
    );
  }
}

// GET method to retrieve upload history for a section
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const sectionId = searchParams.get('section_id');
    const limit = parseInt(searchParams.get('limit') || '50');

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

    // Only show uploaded documents
    query = query.contains('tags', ['uploaded']);

    const { data: uploads, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching uploads:', error);
      return NextResponse.json({ error: 'Failed to fetch uploads' }, { status: 500 });
    }

    return NextResponse.json({ uploads });
  } catch (error) {
    console.error('Unexpected error in uploads API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}