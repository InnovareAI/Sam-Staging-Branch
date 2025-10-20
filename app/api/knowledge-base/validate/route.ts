import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

/**
 * POST /api/knowledge-base/validate
 * Mark KB entry as validated by user or update with corrected data
 * 
 * Body:
 * {
 *   "entry_id": "uuid",
 *   "validated": true,
 *   "corrected_content"?: "...", // If user corrected the data
 *   "validation_note"?: "User confirmed via chat"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { entry_id, validated, corrected_content, validation_note } = body;

    if (!entry_id) {
      return NextResponse.json(
        { success: false, error: 'entry_id required' },
        { status: 400 }
      );
    }

    // Get the entry first to check workspace access
    const { data: entry, error: fetchError } = await supabase
      .from('knowledge_base')
      .select('*, workspace_id')
      .eq('id', entry_id)
      .single();

    if (fetchError || !entry) {
      return NextResponse.json(
        { success: false, error: 'Entry not found' },
        { status: 404 }
      );
    }

    // Verify user has access to workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', entry.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Build update object
    const updates: any = {
      source_metadata: {
        ...entry.source_metadata,
        validated: validated !== false, // Default to true
        validation_required: false,
        validated_by: user.id,
        validated_at: new Date().toISOString(),
        validation_note: validation_note || 'User confirmed via conversation'
      },
      updated_at: new Date().toISOString()
    };

    // If content was corrected, update it and add tags
    if (corrected_content) {
      updates.content = corrected_content;
      updates.tags = [...(entry.tags || []).filter((t: string) => t !== 'unvalidated'), 'user_corrected', 'validated'];
      updates.source_metadata.correction_applied = true;
      updates.source_metadata.original_content = entry.content; // Keep original for reference
    } else {
      // Just mark as validated (data was correct)
      updates.tags = [...(entry.tags || []).filter((t: string) => !['unvalidated', 'needs_review'].includes(t)), 'validated'];
    }

    // Update the entry
    const { data: updatedEntry, error: updateError } = await supabase
      .from('knowledge_base')
      .update(updates)
      .eq('id', entry_id)
      .select()
      .single();

    if (updateError) throw updateError;

    console.log(`✅ Validated KB entry ${entry_id} - ${corrected_content ? 'with corrections' : 'as-is'}`);

    return NextResponse.json({
      success: true,
      entry: updatedEntry,
      message: corrected_content 
        ? 'Entry validated and updated with corrections'
        : 'Entry validated as accurate',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ KB validation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to validate entry' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/knowledge-base/validate?workspace_id={uuid}
 * Get all unvalidated KB entries for a workspace
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: 'workspace_id required' },
        { status: 400 }
      );
    }

    // Verify access
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get unvalidated entries
    const { data: unvalidatedEntries, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('workspace_id', workspaceId)
      .contains('tags', ['unvalidated'])
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      unvalidated_count: unvalidatedEntries?.length || 0,
      entries: unvalidatedEntries || [],
      message: unvalidatedEntries?.length 
        ? `Found ${unvalidatedEntries.length} entries needing validation`
        : 'All entries validated'
    });

  } catch (error) {
    console.error('❌ Get unvalidated entries error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch unvalidated entries' 
      },
      { status: 500 }
    );
  }
}
