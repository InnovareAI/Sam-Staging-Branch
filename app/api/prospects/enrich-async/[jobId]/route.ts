import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Get Enrichment Job Status
 *
 * Returns current status of an enrichment job for polling
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    const { userId } = await verifyAuth(request);

    // Get job
    const jobResult = await pool.query(
      'SELECT * FROM enrichment_jobs WHERE id = $1 AND user_id = $2',
      [jobId, userId]
    );

    if (jobResult.rows.length === 0) {
      return NextResponse.json({
        error: 'Job not found'
      }, { status: 404 });
    }

    const job = jobResult.rows[0];

    // Calculate progress
    const progress = job.total_prospects > 0
      ? Math.round((job.processed_count / job.total_prospects) * 100)
      : 0;

    return NextResponse.json({
      job_id: job.id,
      status: job.status,
      total_prospects: job.total_prospects,
      processed_count: job.processed_count,
      failed_count: job.failed_count,
      progress_percent: progress,
      current_prospect_url: job.current_prospect_url,
      error_message: job.error_message,
      enrichment_results: job.enrichment_results,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      updated_at: job.updated_at
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Error fetching job status:', error);
    return NextResponse.json({
      error: 'Failed to fetch job status',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * Cancel Enrichment Job
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    const { userId } = await verifyAuth(request);

    // Update job to cancelled
    const updateResult = await pool.query(
      `UPDATE enrichment_jobs
       SET status = 'cancelled', completed_at = $1
       WHERE id = $2 AND user_id = $3 AND status = 'pending'
       RETURNING *`,
      [new Date().toISOString(), jobId, userId]
    );

    if (updateResult.rows.length === 0) {
      return NextResponse.json({
        error: 'Failed to cancel job (may have already started)'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully'
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Error cancelling job:', error);
    return NextResponse.json({
      error: 'Failed to cancel job',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
