
import { pool } from '../../../lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/route-auth';

export async function GET(request: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    // Get auth header for admin verification
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    // Use shared Supabase admin client
    const supabase = pool;

    // Get organizations
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug, created_at')
      .order('name', { ascending: true });

    if (orgError) {
      console.error('Error fetching organizations:', orgError);
      return NextResponse.json(
        { error: 'Failed to fetch organizations' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      organizations: organizations || []
    });

  } catch (error) {
    console.error('Server error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
