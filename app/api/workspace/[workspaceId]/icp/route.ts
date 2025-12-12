import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Workspace ICP (Ideal Customer Profile) API
 *
 * GET /api/workspace/[workspaceId]/icp - List all ICPs
 * POST /api/workspace/[workspaceId]/icp - Create new ICP
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - List all ICPs for a workspace
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;

    const { data: icps, error } = await supabase
      .from('workspace_icp')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching ICPs:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: icps || []
    });

  } catch (error) {
    console.error('ICP API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Create a new ICP
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const body = await request.json();

    const {
      name,
      is_default = false,
      titles = [],
      seniority_levels = [],
      industries = [],
      company_size_min,
      company_size_max,
      locations = [],
      countries = [],
      funding_stages = [],
      keywords = [],
      exclude_keywords = [],
      target_companies = [],
      exclude_companies = [],
      description
    } = body;

    // If setting as default, unset any existing default
    if (is_default) {
      await supabase
        .from('workspace_icp')
        .update({ is_default: false })
        .eq('workspace_id', workspaceId)
        .eq('is_default', true);
    }

    const { data: icp, error } = await supabase
      .from('workspace_icp')
      .insert({
        workspace_id: workspaceId,
        name: name || 'New ICP',
        is_default,
        titles,
        seniority_levels,
        industries,
        company_size_min,
        company_size_max,
        locations,
        countries,
        funding_stages,
        keywords,
        exclude_keywords,
        target_companies,
        exclude_companies,
        description
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating ICP:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: icp
    });

  } catch (error) {
    console.error('ICP API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
