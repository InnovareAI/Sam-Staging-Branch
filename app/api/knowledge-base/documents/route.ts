import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Firebase auth verification
    let userId: string;
    let workspaceId: string;

    try {
      const auth = await verifyAuth(request);
      userId = auth.userId;
      workspaceId = auth.workspaceId;
    } catch (error) {
      const authError = error as AuthError;
      console.error('[KB Documents API] Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: authError.statusCode || 401 });
    }

    const { searchParams } = new URL(request.url);
    const icpId = searchParams.get('icp_id'); // Optional ICP filter

    console.log('[KB Documents API] GET request started, icp_id:', icpId);
    console.log('[KB Documents API] User authenticated:', userId);
    console.log('[KB Documents API] Fetching documents for workspace:', workspaceId);

    // Build query with ICP filtering
    // icp_id = null means global content (visible to all ICPs)
    // icp_id = UUID means ICP-specific content
    let query = `
      SELECT id, category, title, tags, source_metadata, created_at, updated_at, icp_id
      FROM knowledge_base
      WHERE workspace_id = $1 AND is_active = true
    `;
    const params: any[] = [workspaceId];

    // Filter by ICP: show ICP-specific content + global content (icp_id is null)
    if (icpId) {
      query += ` AND (icp_id = $2 OR icp_id IS NULL)`;
      params.push(icpId);
    }

    query += ` ORDER BY updated_at DESC LIMIT 20`;

    const docsResult = await pool.query(query, params);
    const documents = docsResult.rows;

    console.log('[KB Documents API] Found', documents?.length || 0, 'documents');

    // Fetch summaries
    const summariesResult = await pool.query(
      `SELECT document_id, quick_summary, tags, updated_at
       FROM sam_knowledge_summaries
       WHERE workspace_id = $1`,
      [workspaceId]
    );

    const summaryMap = new Map((summariesResult.rows || []).map((item: any) => [item.document_id, item]));

    console.log('[KB Documents API] Processing documents...');

    const merged = (documents || []).map((doc: any) => {
      try {
        const sourceMetadata = typeof doc.source_metadata === 'string' ? JSON.parse(doc.source_metadata) : (doc.source_metadata || {});
        const aiAnalysis = sourceMetadata.ai_analysis || {};
        const vectorization = sourceMetadata.vectorization || {};

        const cleanedTitle = doc.title
          .replace(/_/g, ' ')
          .replace(/-/g, ' ')
          .replace(/\.[^/.]+$/, '')
          .replace(/\s+/g, ' ')
          .trim()
          .replace(/\b\w/g, (char: string) => char.toUpperCase());

        const summary = summaryMap.get(doc.id);

        return {
          id: doc.id,
          category: doc.category,
          section: doc.category, // Map category to section for frontend compatibility
          title: cleanedTitle,
          summary: summary?.quick_summary || aiAnalysis.summary || '',
          tags: summary?.tags || doc.tags || [],
          vectorChunks: vectorization.vector_chunks || 0,
          updatedAt: doc.updated_at,
          metadata: sourceMetadata,
          icpId: doc.icp_id // null = global, UUID = ICP-specific
        };
      } catch (err) {
        console.error('[KB Documents API] Error processing document:', doc.id, err);
        return {
          id: doc.id,
          category: doc.category,
          section: doc.category,
          title: doc.title || 'Untitled Document',
          summary: '',
          tags: doc.tags || [],
          vectorChunks: 0,
          updatedAt: doc.updated_at,
          metadata: {},
          icpId: doc.icp_id // null = global, UUID = ICP-specific
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
    // Firebase auth verification
    let workspaceId: string;

    try {
      const auth = await verifyAuth(request);
      workspaceId = auth.workspaceId;
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: 'Unauthorized' }, { status: authError.statusCode || 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Soft delete using is_active column
    const result = await pool.query(
      `UPDATE knowledge_base SET is_active = false WHERE id = $1 AND workspace_id = $2`,
      [id, workspaceId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in documents DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
