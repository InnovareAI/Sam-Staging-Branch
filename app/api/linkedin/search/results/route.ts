import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * Fetch LinkedIn Search Results
 *
 * Returns paginated results from a completed job
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Authenticate user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const job_id = searchParams.get('job_id');
    const page = parseInt(searchParams.get('page') || '1');
    const per_page = parseInt(searchParams.get('per_page') || '50');

    if (!job_id) {
      return NextResponse.json({ error: 'job_id required' }, { status: 400 });
    }

    // Verify job belongs to user
    const { data: job, error: jobError } = await supabase
      .from('prospect_search_jobs')
      .select('id, status, total_results')
      .eq('id', job_id)
      .eq('user_id', session.user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get total count
    const { count: total } = await supabase
      .from('prospect_search_results')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', job_id);

    // Fetch paginated results
    const offset = (page - 1) * per_page;
    const { data: results, error: resultsError } = await supabase
      .from('prospect_search_results')
      .select('id, prospect_data, batch_number, created_at')
      .eq('job_id', job_id)
      .order('batch_number', { ascending: true })
      .order('created_at', { ascending: true })
      .range(offset, offset + per_page - 1);

    if (resultsError) {
      throw resultsError;
    }

    return NextResponse.json({
      success: true,
      job_id: job_id,
      job_status: job.status,
      prospects: (results || []).map(r => r.prospect_data),
      pagination: {
        page,
        per_page,
        total: total || 0,
        total_pages: Math.ceil((total || 0) / per_page),
        has_more: offset + per_page < (total || 0)
      }
    });

  } catch (error) {
    console.error('❌ Fetch results error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch results'
    }, { status: 500 });
  }
}
