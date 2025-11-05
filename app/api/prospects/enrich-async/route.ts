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
      console.error('❌ Failed to create enrichment job:', jobError);
      console.error('Full error:', JSON.stringify(jobError, null, 2));
      return NextResponse.json({
        success: false,
        error: 'Failed to create enrichment job',
        details: jobError?.message || 'Unknown error',
        code: jobError?.code,
        hint: jobError?.hint
      }, { status: 500 });
    }

    console.log(`✅ Created enrichment job: ${job.id}`);

    // Trigger N8N enrichment workflow via MCP
    try {
      console.log(`🔄 Triggering N8N enrichment workflow via MCP for job ${job.id}`);

      // Import N8N MCP client
      const { N8NMCPServer } = await import('@/lib/mcp/n8n-mcp');

      const n8nMCP = new N8NMCPServer({
        baseUrl: process.env.N8N_API_URL || 'https://innovareai.app.n8n.cloud',
        apiKey: process.env.N8N_API_KEY || '',
        organizationId: process.env.N8N_ORGANIZATION_ID || '',
        userId: user.id
      });

      // Find the enrichment workflow by name or ID
      const workflowId = process.env.N8N_ENRICHMENT_WORKFLOW_ID || 'prospect-enrichment';

      // Execute workflow via MCP
      const result = await n8nMCP.callTool({
        params: {
          name: 'n8n_execute_workflow',
          arguments: {
            workflow_id: workflowId,
            input_data: {
              job_id: job.id,
              workspace_id: workspaceId,
              prospect_ids: finalProspectIds,
              supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
              supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
              brightdata_api_token: process.env.BRIGHTDATA_API_TOKEN,
              brightdata_zone: process.env.BRIGHTDATA_ZONE
            }
          }
        }
      });

      if (result.isError) {
        console.warn('⚠️ N8N MCP execution failed:', result.content[0].text);
      } else {
        const executionData = JSON.parse(result.content[0].text!);
        console.log(`✅ N8N workflow triggered via MCP: ${executionData.execution_id}`);
      }
    } catch (e) {
      console.warn('⚠️ Could not trigger N8N workflow via MCP:', e);

      // Fallback to direct webhook call if MCP fails
      const n8nWebhookUrl = process.env.N8N_ENRICHMENT_WEBHOOK_URL ||
        'https://innovareai.app.n8n.cloud/webhook/prospect-enrichment';

      fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          workspace_id: workspaceId,
          prospect_ids: finalProspectIds,
          supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
          brightdata_api_token: process.env.BRIGHTDATA_API_TOKEN,
          brightdata_zone: process.env.BRIGHTDATA_ZONE
        })
      }).catch(err => {
        console.warn('⚠️ Fallback webhook also failed:', err.message);
      });
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
