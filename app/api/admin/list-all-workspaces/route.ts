import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/security/route-auth';

export async function GET(request: NextRequest) {
  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id, name, slug, owner_id, created_at')
      .order('name');

    return NextResponse.json({
      count: workspaces?.length || 0,
      workspaces: workspaces
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
