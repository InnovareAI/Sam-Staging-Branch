import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * N8N Execution Logging API
 *
 * This endpoint receives execution data from N8N workflows and logs it to the database.
 * Called by N8N workflows at the end of campaign execution to track:
 * - Workflow execution details
 * - Campaign performance metrics
 * - Success/failure rates
 * - Error details
 *
 * Usage: Add HTTP Request node at the end of N8N campaign workflows
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[N8N Log] Received execution log request');

    const body = await request.json();

    // Validate required fields
    const {
      workspace_id,
      n8n_execution_id,
      n8n_workflow_id,
      execution_status,
      workspace_n8n_workflow_id,
      campaign_approval_session_id,
      campaign_name,
      campaign_type,
      total_prospects,
      processed_prospects,
      successful_outreach,
      failed_outreach,
      responses_received,
      current_step,
      progress_percentage,
      execution_config,
      campaign_results,
      performance_metrics,
      error_details,
      estimated_completion_time,
      estimated_duration_minutes
    } = body;

    if (!workspace_id || !n8n_execution_id || !n8n_workflow_id) {
      console.error('[N8N Log] Missing required fields:', { workspace_id, n8n_execution_id, n8n_workflow_id });
      return NextResponse.json({
        error: 'Missing required fields: workspace_id, n8n_execution_id, n8n_workflow_id'
      }, { status: 400 });
    }

    console.log('[N8N Log] Logging execution:', {
      workspace_id,
      n8n_execution_id,
      execution_status,
      total_prospects,
      successful_outreach,
      failed_outreach
    });

    // Check if execution already logged (prevent duplicates)
    const { data: existing, error: checkError } = await supabase
      .from('n8n_campaign_executions')
      .select('id')
      .eq('n8n_execution_id', n8n_execution_id)
      .maybeSingle();

    if (checkError) {
      console.error('[N8N Log] Error checking existing record:', checkError);
    }

    if (existing) {
      console.log('[N8N Log] Execution already logged, updating instead');

      // Update existing record
      const { data: updated, error: updateError } = await supabase
        .from('n8n_campaign_executions')
        .update({
          execution_status: execution_status || 'completed',
          processed_prospects: processed_prospects || 0,
          successful_outreach: successful_outreach || 0,
          failed_outreach: failed_outreach || 0,
          responses_received: responses_received || 0,
          current_step: current_step || 'completed',
          progress_percentage: progress_percentage || 100.0,
          campaign_results: campaign_results || {},
          performance_metrics: performance_metrics || {},
          error_details: error_details || null,
          estimated_completion_time: estimated_completion_time || null,
          estimated_duration_minutes: estimated_duration_minutes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error('[N8N Log] Error updating execution:', updateError);
        return NextResponse.json({
          error: 'Failed to update execution log',
          details: updateError.message
        }, { status: 500 });
      }

      console.log('[N8N Log] ✅ Execution updated successfully');
      return NextResponse.json({
        success: true,
        updated: true,
        execution_id: updated.id,
        message: 'N8N execution log updated successfully'
      });
    }

    // Insert new execution record
    const { data: inserted, error: insertError } = await supabase
      .from('n8n_campaign_executions')
      .insert({
        workspace_id: workspace_id,
        workspace_n8n_workflow_id: workspace_n8n_workflow_id || null,
        campaign_approval_session_id: campaign_approval_session_id || null,
        n8n_execution_id: n8n_execution_id,
        n8n_workflow_id: n8n_workflow_id,
        campaign_name: campaign_name || 'Unnamed Campaign',
        campaign_type: campaign_type || 'linkedin_only',
        execution_config: execution_config || {},
        total_prospects: total_prospects || 0,
        processed_prospects: processed_prospects || 0,
        successful_outreach: successful_outreach || 0,
        failed_outreach: failed_outreach || 0,
        responses_received: responses_received || 0,
        execution_status: execution_status || 'pending',
        current_step: current_step || 'initializing',
        progress_percentage: progress_percentage || 0.0,
        campaign_results: campaign_results || {},
        performance_metrics: performance_metrics || {},
        error_details: error_details || null,
        estimated_completion_time: estimated_completion_time || null,
        estimated_duration_minutes: estimated_duration_minutes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('[N8N Log] Error inserting execution:', insertError);
      console.error('[N8N Log] Insert error details:', JSON.stringify(insertError, null, 2));
      return NextResponse.json({
        error: 'Failed to log execution',
        details: insertError.message,
        code: insertError.code
      }, { status: 500 });
    }

    console.log('[N8N Log] ✅ Execution logged successfully, ID:', inserted.id);

    return NextResponse.json({
      success: true,
      execution_id: inserted.id,
      message: 'N8N execution logged successfully'
    });

  } catch (error) {
    console.error('[N8N Log] Unexpected error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * GET endpoint to retrieve execution logs
 * Optional query params:
 * - workspace_id: Filter by workspace
 * - status: Filter by execution status
 * - limit: Number of records to return (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    let query = supabase
      .from('n8n_campaign_executions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    if (status) {
      query = query.eq('execution_status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[N8N Log] Error fetching executions:', error);
      return NextResponse.json({
        error: 'Failed to fetch executions',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      executions: data,
      count: data.length
    });

  } catch (error) {
    console.error('[N8N Log] Error in GET:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
