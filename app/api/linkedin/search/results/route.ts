import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

/**
 * Fetch LinkedIn Search Results
 *
 * Returns paginated results from a completed job
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const job_id = searchParams.get('job_id');
    const page = parseInt(searchParams.get('page') || '1');
    const per_page = parseInt(searchParams.get('per_page') || '50');

    if (!job_id) {
      return NextResponse.json({ error: 'job_id required' }, { status: 400 });
    }

    // Verify job belongs to user
    const { rows: jobRows } = await pool.query(`
      SELECT id, status, total_results
      FROM prospect_search_jobs
      WHERE id = $1 AND user_id = $2
    `, [job_id, userId]);

    if (!jobRows || jobRows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const job = jobRows[0];

    // Get total count
    const { rows: countRows } = await pool.query(`
      SELECT COUNT(*) as count FROM prospect_search_results
      WHERE job_id = $1
    `, [job_id]);

    const total = parseInt(countRows[0]?.count || '0');

    // Fetch paginated results
    const offset = (page - 1) * per_page;
    const { rows: results } = await pool.query(`
      SELECT id, prospect_data, batch_number, created_at
      FROM prospect_search_results
      WHERE job_id = $1
      ORDER BY batch_number ASC, created_at ASC
      LIMIT $2 OFFSET $3
    `, [job_id, per_page, offset]);

    return NextResponse.json({
      success: true,
      job_id: job_id,
      job_status: job.status,
      prospects: (results || []).map(r => r.prospect_data),
      pagination: {
        page,
        per_page,
        total: total,
        total_pages: Math.ceil(total / per_page),
        has_more: offset + per_page < total
      }
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('❌ Fetch results error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch results'
    }, { status: 500 });
  }
}
