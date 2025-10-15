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

    console.log('[KB Documents API] GET request started');

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      console.error('[KB Documents API] Auth error:', error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[KB Documents API] User authenticated:', user.id);

    const workspaceId = await getWorkspaceId(supabase, user.id);
    if (!workspaceId) {
      console.error('[KB Documents API] No workspace found for user');
      return NextResponse.json({ error: 'Workspace not found for user' }, { status: 400 });
    }

    console.log('[KB Documents API] Fetching documents for workspace:', workspaceId);

    const { data: documents, error: docsError } = await supabase
      .from('knowledge_base_documents')
      .select('id, section_id, filename, summary, tags, vector_chunks, vectorized_at, processed_at, updated_at, metadata')
      .eq('workspace_id', workspaceId)
      // TODO: Add is_active column to knowledge_base_documents table, then uncomment:
      // .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (docsError) {
      console.error('[KB Documents API] Documents query error:', docsError);
      return NextResponse.json({
        error: 'Failed to fetch documents',
        details: docsError.message
      }, { status: 500 });
    }

    console.log('[KB Documents API] Found', documents?.length || 0, 'documents');

    const { data: summaries, error: summaryError } = await supabase
      .from('sam_knowledge_summaries')
      .select('document_id, quick_summary, tags, updated_at')
      .eq('workspace_id', workspaceId);

    if (summaryError) {
      console.error('Failed to fetch knowledge summaries:', summaryError);
    }

    const summaryMap = new Map((summaries || []).map((item) => [item.document_id, item]));

    console.log('[KB Documents API] Processing documents...');

    const merged = (documents || []).map((doc) => {
      try {
        const metadata = typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : (doc.metadata || {});
        const baseTitle = metadata?.displayTitle || doc.filename || 'Untitled Document';
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
          metadata: metadata
        };
      } catch (err) {
        console.error('[KB Documents API] Error processing document:', doc.id, err);
        return {
          id: doc.id,
          section: doc.section_id,
          title: doc.filename || 'Untitled Document',
          summary: doc.summary || '',
          tags: doc.tags || [],
          vectorChunks: doc.vector_chunks || 0,
          updatedAt: doc.updated_at || doc.processed_at || doc.vectorized_at,
          metadata: {}
        };
      }
    });

    console.log('[KB Documents API] Successfully processed', merged.length, 'documents');

    return NextResponse.json({
      success: true,
      workspaceId,
      documents: merged
    });
  } catch (error) {
    console.error('[KB Documents API] Unhandled error:', error);
    console.error('[KB Documents API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
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

    // Hard delete for now (TODO: implement soft delete with is_active column)
    const { error } = await supabase
      .from('knowledge_base_documents')
      .delete()
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
