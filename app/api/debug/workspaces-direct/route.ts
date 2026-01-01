import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🔍 Debug: Fetching workspaces directly from database...');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const poolKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, poolKey);

    // Direct database query using service role (bypasses RLS)
    const { data: workspaces, error } = await adminSupabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching workspaces:', error);
      return NextResponse.json({ 
        error: error.message,
        details: error
      }, { status: 500 });
    }

    console.log('📊 Found workspaces in database:', workspaces?.length || 0);
    console.log('📋 Workspace details:', workspaces?.map(w => ({ 
      id: w.id, 
      name: w.name, 
      slug: w.slug, 
      company: w.company,
      owner_id: w.owner_id,
      created_at: w.created_at
    })));

    return NextResponse.json({
      success: true,
      count: workspaces?.length || 0,
      workspaces: workspaces || []
    });

  } catch (error) {
    console.error('💥 Server error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}