import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
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
    const days = parseInt(searchParams.get('days') || '30', 10);
    const type = searchParams.get('type') || 'documents'; // 'documents' or 'sections'

    if (type === 'sections') {
      // Get section-level analytics via RPC function
      try {
        const result = await pool.query(
          'SELECT * FROM get_section_usage_summary($1, $2)',
          [workspaceId, days]
        );

        return NextResponse.json({
          success: true,
          type: 'sections',
          days,
          data: result.rows || []
        });
      } catch (sectionError) {
        console.error('Failed to fetch section analytics:', sectionError);
        return NextResponse.json({ error: 'Failed to fetch section analytics' }, { status: 500 });
      }
    } else {
      // Get document-level analytics via RPC function
      try {
        const result = await pool.query(
          'SELECT * FROM get_document_usage_analytics($1, $2)',
          [workspaceId, days]
        );

        const docStats = result.rows || [];

        // Categorize documents by usage
        const categorized = {
          mostUsed: docStats.slice(0, 10),
          leastUsed: docStats
            .filter((d: any) => d.total_uses > 0)
            .sort((a: any, b: any) => a.total_uses - b.total_uses)
            .slice(0, 10),
          neverUsed: docStats.filter((d: any) => d.total_uses === 0 || !d.total_uses),
          stale: docStats.filter((d: any) => {
            if (!d.last_used_at) return true;
            const daysSince = d.days_since_last_use || 0;
            return daysSince > 90;
          }),
          trending: docStats
            .filter((d: any) => d.usage_trend === 'increasing')
            .slice(0, 10)
        };

        return NextResponse.json({
          success: true,
          type: 'documents',
          days,
          summary: {
            totalDocuments: docStats.length || 0,
            documentsUsed: docStats.filter((d: any) => d.total_uses > 0).length,
            totalUses: docStats.reduce((sum: number, d: any) => sum + (d.total_uses || 0), 0),
            avgUsesPerDoc: docStats.length ?
              (docStats.reduce((sum: number, d: any) => sum + (d.total_uses || 0), 0) / docStats.length).toFixed(2) : 0,
            usageRate: docStats.length ?
              ((docStats.filter((d: any) => d.total_uses > 0).length / docStats.length) * 100).toFixed(1) + '%' : '0%'
          },
          categorized,
          all: docStats
        });
      } catch (docError) {
        console.error('Failed to fetch document analytics:', docError);
        return NextResponse.json({ error: 'Failed to fetch document analytics' }, { status: 500 });
      }
    }
  } catch (error) {
    console.error('Knowledge base analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Record usage endpoint (called by SAM)
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      documentId,
      threadId,
      messageId,
      chunksUsed = 1,
      relevanceScore,
      queryContext
    } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Call the database function to record usage
    try {
      await pool.query(
        'SELECT record_document_usage($1, $2, $3, $4, $5, $6, $7)',
        [workspaceId, documentId, threadId || null, messageId || null, chunksUsed, relevanceScore || null, queryContext || null]
      );

      return NextResponse.json({ success: true, message: 'Usage recorded' });
    } catch (usageError) {
      console.error('Failed to record document usage:', usageError);
      return NextResponse.json({ error: 'Failed to record usage' }, { status: 500 });
    }
  } catch (error) {
    console.error('Knowledge base usage tracking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
