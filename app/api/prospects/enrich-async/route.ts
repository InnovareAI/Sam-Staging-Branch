import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

export const dynamic = 'force-dynamic';

/**
 * Async Prospect Enrichment API
 *
 * Creates a background job for enrichment instead of processing synchronously.
 * Avoids Netlify timeout issues (BrightData takes 35-40s per prospect).
 *
 * Flow:
 * 1. User clicks "Enrich" → This endpoint creates job → Returns immediately
 * 2. UI polls /api/prospects/enrich-async/[jobId] for status
 * 3. Background worker processes job
 * 4. UI shows results when complete
 */

interface EnrichmentJobRequest {
  sessionId?: string;
  prospectIds?: string[];
  workspaceId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: EnrichmentJobRequest = await request.json();
    const { sessionId, prospectIds, workspaceId: providedWorkspaceId } = body;

    const supabase = await createSupabaseRouteClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Get workspace ID
    let workspaceId = providedWorkspaceId;
    if (!workspaceId) {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      workspaceId = membership?.workspace_id;
    }

    if (!workspaceId) {
      return NextResponse.json({
        error: 'No workspace found for user'
      }, { status: 400 });
    }

    // Validate input
    if (!sessionId && (!prospectIds || prospectIds.length === 0)) {
      return NextResponse.json({
        error: 'Either sessionId or prospectIds required'
      }, { status: 400 });
    }

    // Get prospect IDs if sessionId provided
    let finalProspectIds = prospectIds || [];
    if (sessionId && !prospectIds) {
      const { data: sessionProspects } = await supabase
        .from('prospect_approval_data')
        .select('prospect_id')
        .eq('session_id', sessionId);

      finalProspectIds = sessionProspects?.map(p => p.prospect_id) || [];
    }

    if (finalProspectIds.length === 0) {
      return NextResponse.json({
        error: 'No prospects found to enrich'
      }, { status: 400 });
    }

    console.log(`📋 Creating enrichment job for ${finalProspectIds.length} prospects`);

    // Create enrichment job
    const { data: job, error: jobError } = await supabase
      .from('enrichment_jobs')
      .insert({
        workspace_id: workspaceId,
        user_id: user.id,
        session_id: sessionId,
        prospect_ids: finalProspectIds,
        total_prospects: finalProspectIds.length,
        status: 'pending'
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('Failed to create enrichment job:', jobError);
      return NextResponse.json({
        error: 'Failed to create enrichment job',
        details: jobError?.message
      }, { status: 500 });
    }

    console.log(`✅ Created enrichment job: ${job.id}`);

    // Trigger background worker (via Edge Function or separate endpoint)
    // For now, we'll have a polling worker that picks up pending jobs
    try {
      // Fire and forget - trigger worker but don't wait
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/prospects/enrich-worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id })
      }).catch(err => {
        console.warn('Worker trigger failed (will be picked up by cron):', err.message);
      });
    } catch (e) {
      // Worker will pick it up via cron if trigger fails
      console.warn('Could not trigger worker, job will be picked up by scheduled worker');
    }

    return NextResponse.json({
      success: true,
      job_id: job.id,
      status: job.status,
      total_prospects: job.total_prospects,
      message: `Enrichment job created. Processing ${job.total_prospects} prospect(s)...`,
      poll_url: `/api/prospects/enrich-async/${job.id}`
    });

  } catch (error) {
    console.error('❌ Error creating enrichment job:', error);
    return NextResponse.json({
      error: 'Failed to create enrichment job',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
