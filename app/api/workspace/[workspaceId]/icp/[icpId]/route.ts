import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Individual ICP API
 *
 * GET /api/workspace/[workspaceId]/icp/[icpId] - Get single ICP
 * PUT /api/workspace/[workspaceId]/icp/[icpId] - Update ICP
 * DELETE /api/workspace/[workspaceId]/icp/[icpId] - Delete ICP
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Get single ICP
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; icpId: string }> }
) {
  try {
    const { workspaceId, icpId } = await params;

    const { data: icp, error } = await supabase
      .from('workspace_icp')
      .select('*')
      .eq('id', icpId)
      .eq('workspace_id', workspaceId)
      .single();

    if (error || !icp) {
      return NextResponse.json({ success: false, error: 'ICP not found' }, { status: 404 });
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

// PUT - Update ICP
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; icpId: string }> }
) {
  try {
    const { workspaceId, icpId } = await params;
    const body = await request.json();

    // If setting as default, unset any existing default
    if (body.is_default) {
      await supabase
        .from('workspace_icp')
        .update({ is_default: false })
        .eq('workspace_id', workspaceId)
        .eq('is_default', true)
        .neq('id', icpId);
    }

    const { data: icp, error } = await supabase
      .from('workspace_icp')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', icpId)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) {
      console.error('Error updating ICP:', error);
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

// DELETE - Delete ICP
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; icpId: string }> }
) {
  try {
    const { workspaceId, icpId } = await params;

    const { error } = await supabase
      .from('workspace_icp')
      .delete()
      .eq('id', icpId)
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('Error deleting ICP:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'ICP deleted'
    });

  } catch (error) {
    console.error('ICP API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
