import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const poolKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, poolKey);

    // Test workspace query
    const { data: workspaces, error } = await adminSupabase
      .from('workspaces')
      .select('*')
      .limit(5);

    return NextResponse.json({
      success: !error,
      error: error?.message,
      workspaces: workspaces || [],
      count: workspaces?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}