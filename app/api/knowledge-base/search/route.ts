import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Authenticate with Firebase
    await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const query = searchParams.get('q');
    const sectionFilter = searchParams.get('section');

    if (!workspaceId || !query) {
      return NextResponse.json({ error: 'Workspace ID and search query are required' }, { status: 400 });
    }

    // Search using the database function
    const { rows: results } = await pool.query(
      'SELECT * FROM search_knowledge_base_sections($1, $2, $3)',
      [workspaceId, query, sectionFilter]
    );

    return NextResponse.json({ results: results || [] });
  } catch (error) {
    console.error('Unexpected error in KB search API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}