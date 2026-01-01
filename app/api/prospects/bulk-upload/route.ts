import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

// Prevent 504 timeout on large bulk uploads
export const maxDuration = 60; // 60 seconds

export async function POST(req: NextRequest) {
  try {
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      workspace_id,
      filename,
      prospects, // Array of prospect objects
      validate_only = false
    } = await req.json();

    if (!workspace_id || !prospects || !Array.isArray(prospects)) {
      return NextResponse.json({ 
        error: 'Workspace ID and prospects array are required' 
      }, { status: 400 });
    }

    // Validate prospects first
    const { data: validationResults, error: validationError } = await supabase
      .rpc('validate_bulk_prospects', {
        p_prospects: prospects
      });

    if (validationError) {
      console.error('Failed to validate prospects:', validationError);
      return NextResponse.json({ 
        error: 'Failed to validate prospects',
        details: validationError.message 
      }, { status: 500 });
    }

    // Count validation results
    const validationSummary = validationResults?.reduce((acc: any, result: any) => {
      acc[result.validation_status] = (acc[result.validation_status] || 0) + 1;
      return acc;
    }, {});

    const hasErrors = validationResults?.some((r: any) => r.validation_status === 'invalid');

    if (validate_only) {
      return NextResponse.json({
        validation_results: validationResults,
        validation_summary: validationSummary,
        has_errors: hasErrors,
        can_proceed: !hasErrors
      });
    }

    if (hasErrors) {
      return NextResponse.json({
        error: 'Validation failed - cannot proceed with upload',
        validation_results: validationResults,
        validation_summary: validationSummary
      }, { status: 400 });
    }

    // Create upload session
    const { data: sessionId, error: sessionError } = await supabase
      .rpc('create_bulk_upload_session', {
        p_workspace_id: workspace_id,
        p_filename: filename || 'api_upload.json',
        p_total_rows: prospects.length
      });

    if (sessionError) {
      console.error('Failed to create upload session:', sessionError);
      return NextResponse.json({ 
        error: 'Failed to create upload session' 
      }, { status: 500 });
    }

    // Process bulk upload
    const { data: uploadResults, error: uploadError } = await supabase
      .rpc('bulk_upload_prospects', {
        p_workspace_id: workspace_id,
        p_prospects: prospects,
        p_data_source: 'bulk_upload_api'
      });

    if (uploadError) {
      console.error('Failed to bulk upload prospects:', uploadError);
      
      // Update session with failure
      await supabase.rpc('update_bulk_upload_session', {
        p_session_id: sessionId,
        p_upload_status: 'failed',
        p_validation_errors: [{ error: uploadError.message }]
      });

      return NextResponse.json({ 
        error: 'Failed to upload prospects',
        details: uploadError.message,
        session_id: sessionId
      }, { status: 500 });
    }

    // Summarize results
    const uploadSummary = uploadResults?.reduce((acc: any, result: any) => {
      acc[result.action_taken] = (acc[result.action_taken] || 0) + 1;
      return acc;
    }, {});

    // Update session with success
    await supabase.rpc('update_bulk_upload_session', {
      p_session_id: sessionId,
      p_processed_rows: prospects.length,
      p_successful_rows: uploadSummary?.created + uploadSummary?.updated || 0,
      p_skipped_rows: uploadSummary?.skipped || 0,
      p_new_prospects: uploadSummary?.created || 0,
      p_updated_prospects: uploadSummary?.updated || 0,
      p_duplicate_prospects: uploadSummary?.skipped || 0,
      p_upload_status: 'completed'
    });

    return NextResponse.json({ 
      message: 'Bulk upload completed successfully',
      session_id: sessionId,
      validation_summary: validationSummary,
      upload_summary: {
        total_processed: uploadResults?.length || 0,
        created: uploadSummary?.created || 0,
        updated: uploadSummary?.updated || 0,
        skipped: uploadSummary?.skipped || 0
      },
      validation_results: validationResults,
      upload_results: uploadResults
    }, { status: 201 });

  } catch (error: any) {
    console.error('Bulk upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process bulk upload', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id') || user.user_metadata.workspace_id;
    const sessionId = searchParams.get('session_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    if (sessionId) {
      // Get specific session details
      const { data: session, error } = await supabase
        .from('bulk_upload_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('workspace_id', workspaceId)
        .single();

      if (error) {
        return NextResponse.json({ error: 'Upload session not found' }, { status: 404 });
      }

      return NextResponse.json({ session });
    }

    // Get recent upload sessions for workspace
    const { data: sessions, error } = await supabase
      .from('bulk_upload_sessions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('started_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Failed to fetch upload sessions:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch upload sessions' 
      }, { status: 500 });
    }

    return NextResponse.json({ sessions: sessions || [] });

  } catch (error: any) {
    console.error('Upload sessions fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upload sessions', details: error.message },
      { status: 500 }
    );
  }
}