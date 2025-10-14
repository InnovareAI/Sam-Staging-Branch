import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

async function getWorkspaceId(supabase: any, userId: string) {
  // Try to get workspace from user profile first
  const { data: profile } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', userId)
    .single();

  if (profile?.current_workspace_id) {
    return profile.current_workspace_id;
  }

  // If no workspace in profile, check workspace_members
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  return membership?.workspace_id ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getWorkspaceId(supabase, user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found for user' }, { status: 400 });
    }

    const { data: documents, error: docsError } = await supabase
      .from('knowledge_base_documents')
      .select('id, section_id, title:filename, summary, tags, vector_chunks, vectorized_at, processed_at, updated_at, metadata')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (docsError) {
      console.error('Failed to fetch knowledge base documents:', docsError);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    const { data: summaries, error: summaryError } = await supabase
      .from('sam_knowledge_summaries')
      .select('document_id, quick_summary, tags, updated_at')
      .eq('workspace_id', workspaceId);

    if (summaryError) {
      console.error('Failed to fetch knowledge summaries:', summaryError);
    }

    const summaryMap = new Map((summaries || []).map((item) => [item.document_id, item]));

    const merged = (documents || []).map((doc) => {
      const baseTitle = doc.metadata?.displayTitle || doc.title || 'Untitled Document';
      const cleanedTitle = baseTitle
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\.[^/.]+$/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
      const summary = summaryMap.get(doc.id);
      return {
        id: doc.id,
        section: doc.section_id,
        title: cleanedTitle,
        summary: summary?.quick_summary || doc.summary || '',
        tags: summary?.tags || doc.tags || [],
        vectorChunks: doc.vector_chunks || 0,
        updatedAt: doc.updated_at || doc.processed_at || doc.vectorized_at,
        metadata: doc.metadata || {}
      };
    });

    return NextResponse.json({
      success: true,
      workspaceId,
      documents: merged
    });
  } catch (error) {
    console.error('Knowledge base documents API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getWorkspaceId(supabase, user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const { error } = await supabase
      .from('knowledge_base_documents')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('Error deleting document:', error);
      return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in documents DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
