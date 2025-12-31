import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Async Prospect Enrichment API
 *
 * Creates a background job for enrichment instead of processing synchronously.
 * Avoids Netlify timeout issues (BrightData takes 35-40s per prospect).
 *
 * Flow:
 * 1. User clicks "Enrich" -> This endpoint creates job -> Returns immediately
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
    const { userId, workspaceId: authWorkspaceId } = await verifyAuth(request);

    const body: EnrichmentJobRequest = await request.json();
    const { sessionId, prospectIds, workspaceId: providedWorkspaceId } = body;

    // Get workspace ID
    let workspaceId = providedWorkspaceId || authWorkspaceId;

    if (!workspaceId) {
      // Try to get from user's membership
      const membershipResult = await pool.query(
        'SELECT workspace_id FROM workspace_members WHERE user_id = $1 LIMIT 1',
        [userId]
      );

      workspaceId = membershipResult.rows[0]?.workspace_id;
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
      const sessionProspectsResult = await pool.query(
        'SELECT prospect_id FROM prospect_approval_data WHERE session_id = $1',
        [sessionId]
      );

      finalProspectIds = sessionProspectsResult.rows.map(p => p.prospect_id);
    }

    if (finalProspectIds.length === 0) {
      return NextResponse.json({
        error: 'No prospects found to enrich'
      }, { status: 400 });
    }

    console.log(`Creating enrichment job for ${finalProspectIds.length} prospects`);

    // Create enrichment job
    const jobResult = await pool.query(
      `INSERT INTO enrichment_jobs (
        workspace_id, user_id, session_id, prospect_ids, total_prospects, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [workspaceId, userId, sessionId || null, JSON.stringify(finalProspectIds), finalProspectIds.length, 'pending']
    );

    if (jobResult.rows.length === 0) {
      console.error('Failed to create enrichment job');
      return NextResponse.json({
        success: false,
        error: 'Failed to create enrichment job',
        details: 'Insert returned no rows'
      }, { status: 500 });
    }

    const job = jobResult.rows[0];
    console.log(`Created enrichment job: ${job.id}`);

    // Trigger N8N enrichment workflow via MCP
    try {
      console.log(`Triggering N8N enrichment workflow via MCP for job ${job.id}`);

      // Import N8N MCP client
      const { N8NMCPServer } = await import('@/lib/mcp/n8n-mcp');

      const n8nMCP = new N8NMCPServer({
        baseUrl: process.env.N8N_API_URL || 'https://innovareai.app.n8n.cloud',
        apiKey: process.env.N8N_API_KEY || '',
        organizationId: process.env.N8N_ORGANIZATION_ID || '',
        userId: userId
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
        console.warn('N8N MCP execution failed:', result.content[0].text);
      } else {
        const executionData = JSON.parse(result.content[0].text!);
        console.log(`N8N workflow triggered via MCP: ${executionData.execution_id}`);
      }
    } catch (e) {
      console.warn('Could not trigger N8N workflow via MCP:', e);

      // Fallback to direct webhook call if MCP fails
      const n8nWebhookUrl = process.env.N8N_ENRICHMENT_WEBHOOK_URL ||
        'https://innovareai.app.n8n.cloud/webhook/prospect-enrichment';

      console.log(`Calling N8N webhook: ${n8nWebhookUrl}`);

      try {
        const webhookResponse = await fetch(n8nWebhookUrl, {
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
        });

        if (webhookResponse.ok) {
          console.log('N8N webhook triggered successfully');
        } else {
          console.error('N8N webhook failed:', webhookResponse.status, await webhookResponse.text());
        }
      } catch (err) {
        console.error('Fallback webhook also failed:', err);
      }
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
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Error creating enrichment job:', error);
    return NextResponse.json({
      error: 'Failed to create enrichment job',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
