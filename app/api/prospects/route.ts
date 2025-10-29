import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id') || user.user_metadata.workspace_id;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    // Build query
    let query = supabase
      .from('workspace_prospects')
      .select(`
        *,
        campaign_prospects (
          campaign_id,
          status,
          invitation_sent_at,
          campaigns (
            name,
            status
          )
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('approval_status', 'pending'); // Only show pending prospects in Prospect Database

    if (status) {
      query = query.eq('prospect_status', status);
    }

    if (search) {
      query = query.or(`
        full_name.ilike.%${search}%,
        email.ilike.%${search}%,
        company_name.ilike.%${search}%,
        title.ilike.%${search}%
      `);
    }

    const { data: prospects, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Failed to fetch prospects:', error);
      return NextResponse.json({ error: 'Failed to fetch prospects' }, { status: 500 });
    }

    // Get total count
    let countQuery = supabase
      .from('workspace_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('approval_status', 'pending'); // Only count pending prospects

    if (status) {
      countQuery = countQuery.eq('prospect_status', status);
    }

    if (search) {
      countQuery = countQuery.or(`
        full_name.ilike.%${search}%,
        email.ilike.%${search}%,
        company_name.ilike.%${search}%,
        title.ilike.%${search}%
      `);
    }

    const { count, error: countError } = await countQuery;

    return NextResponse.json({ 
      prospects: prospects || [],
      total: count || 0,
      limit,
      offset
    });

  } catch (error: any) {
    console.error('Prospects fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prospects', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      workspace_id,
      prospects // Array of prospect objects
    } = await req.json();

    if (!workspace_id || !prospects || !Array.isArray(prospects)) {
      return NextResponse.json({ 
        error: 'Workspace ID and prospects array are required' 
      }, { status: 400 });
    }

    // Use bulk upload function for validation and deduplication
    const { data: results, error } = await supabase
      .rpc('bulk_upload_prospects', {
        p_workspace_id: workspace_id,
        p_prospects: prospects,
        p_data_source: 'api_upload'
      });

    if (error) {
      console.error('Failed to bulk upload prospects:', error);
      return NextResponse.json({ 
        error: 'Failed to upload prospects',
        details: error.message 
      }, { status: 500 });
    }

    // Summarize results
    const summary = results?.reduce((acc: any, result: any) => {
      acc[result.action_taken] = (acc[result.action_taken] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({ 
      message: 'Prospects uploaded successfully',
      summary: {
        total_processed: results?.length || 0,
        created: summary?.created || 0,
        updated: summary?.updated || 0,
        skipped: summary?.skipped || 0
      },
      results
    }, { status: 201 });

  } catch (error: any) {
    console.error('Prospect upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload prospects', details: error.message },
      { status: 500 }
    );
  }
}