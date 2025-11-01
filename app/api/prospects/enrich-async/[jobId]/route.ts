import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

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

    const supabase = await createSupabaseRouteClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Get job
    const { data: job, error: jobError } = await supabase
      .from('enrichment_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id) // RLS will enforce this anyway
      .single();

    if (jobError || !job) {
      return NextResponse.json({
        error: 'Job not found'
      }, { status: 404 });
    }

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
    console.error('❌ Error fetching job status:', error);
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

    const supabase = await createSupabaseRouteClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Update job to cancelled
    const { data: job, error: updateError } = await supabase
      .from('enrichment_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('user_id', user.id)
      .eq('status', 'pending') // Only cancel if not started yet
      .select()
      .single();

    if (updateError || !job) {
      return NextResponse.json({
        error: 'Failed to cancel job (may have already started)'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully'
    });

  } catch (error) {
    console.error('❌ Error cancelling job:', error);
    return NextResponse.json({
      error: 'Failed to cancel job',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
