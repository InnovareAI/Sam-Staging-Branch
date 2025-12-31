import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Firebase auth - workspace comes from header
    let authContext;
    try {
      authContext = await verifyAuth(request);
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }

    const { workspaceId } = authContext;

    // Get templates
    const { rows: templates } = await pool.query(
      `SELECT * FROM messaging_templates
       WHERE workspace_id = $1 AND is_active = true
       ORDER BY updated_at DESC`,
      [workspaceId]
    );

    return NextResponse.json({ templates: templates || [] });
  } catch (error: any) {
    console.error('List templates error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
