/**
 * KB Validation API
 * Handles validation, correction, and rejection of KB items
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/kb/validate
 * Get items needing validation
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const threshold = parseFloat(searchParams.get('threshold') || '0.8');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
    }

    // Get low-confidence items needing validation
    const { data: items, error } = await supabase.rpc('get_validation_needed_items', {
      p_workspace_id: workspaceId,
      p_threshold: threshold
    });

    if (error) {
      console.error('Failed to get validation items:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      items: items || [],
      count: items?.length || 0
    });
  } catch (error) {
    console.error('Validation GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/kb/validate
 * Validate, correct, or reject a KB item
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      kb_item_id,
      action, // 'validate' | 'correct' | 'reject'
      corrected_value,
      reason,
      user_id,
      workspace_id
    } = body;

    if (!kb_item_id || !action || !workspace_id) {
      return NextResponse.json(
        { error: 'kb_item_id, action, and workspace_id required' },
        { status: 400 }
      );
    }

    // Verify item belongs to workspace
    const { data: kbItem } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('id', kb_item_id)
      .eq('workspace_id', workspace_id)
      .single();

    if (!kbItem) {
      return NextResponse.json({ error: 'KB item not found' }, { status: 404 });
    }

    let result;

    switch (action) {
      case 'validate':
        result = await validateItem(kb_item_id, user_id);
        break;

      case 'correct':
        if (!corrected_value) {
          return NextResponse.json({ error: 'corrected_value required' }, { status: 400 });
        }
        result = await correctItem(kb_item_id, corrected_value, reason, user_id);
        break;

      case 'reject':
        result = await rejectItem(kb_item_id, reason, user_id);
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action,
      kb_item_id,
      message: result.message
    });
  } catch (error) {
    console.error('Validation POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Validate a KB item (mark as confirmed)
 */
async function validateItem(
  kbItemId: string,
  userId?: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    // Update confidence score
    const { error: scoreError } = await supabase
      .from('knowledge_base_confidence_scores')
      .update({
        validation_status: 'validated',
        validated_at: new Date().toISOString(),
        validated_by: userId,
        confidence_score: 1.0 // Validated = 100% confidence
      })
      .eq('kb_item_id', kbItemId);

    if (scoreError) throw scoreError;

    // Remove 'needs-validation' tag
    const { data: kbItem } = await supabase
      .from('knowledge_base')
      .select('tags')
      .eq('id', kbItemId)
      .single();

    if (kbItem?.tags) {
      const updatedTags = kbItem.tags.filter((t: string) => t !== 'needs-validation');

      await supabase
        .from('knowledge_base')
        .update({ tags: updatedTags })
        .eq('id', kbItemId);
    }

    return {
      success: true,
      message: 'Item validated successfully'
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Correct a KB item (update with corrected value)
 */
async function correctItem(
  kbItemId: string,
  correctedValue: any,
  reason?: string,
  userId?: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    // Get current item
    const { data: kbItem } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('id', kbItemId)
      .single();

    if (!kbItem) {
      return { success: false, error: 'KB item not found' };
    }

    // Update KB item with corrected value
    const updates: any = {
      content: correctedValue.content || kbItem.content,
      title: correctedValue.title || kbItem.title,
      updated_at: new Date().toISOString()
    };

    // Remove 'needs-validation' tag
    if (kbItem.tags) {
      updates.tags = kbItem.tags.filter((t: string) => t !== 'needs-validation');
    }

    const { error: updateError } = await supabase
      .from('knowledge_base')
      .update(updates)
      .eq('id', kbItemId);

    if (updateError) throw updateError;

    // Update confidence score with correction feedback
    const { error: scoreError } = await supabase
      .from('knowledge_base_confidence_scores')
      .update({
        validation_status: 'corrected',
        validated_at: new Date().toISOString(),
        validated_by: userId,
        confidence_score: 1.0, // Corrected = 100% confidence now
        validation_feedback: {
          original_value: kbItem.content,
          corrected_value: correctedValue,
          reason
        }
      })
      .eq('kb_item_id', kbItemId);

    if (scoreError) throw scoreError;

    return {
      success: true,
      message: 'Item corrected successfully'
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Reject a KB item (mark as invalid, deactivate)
 */
async function rejectItem(
  kbItemId: string,
  reason?: string,
  userId?: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    // Deactivate KB item
    const { error: updateError } = await supabase
      .from('knowledge_base')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', kbItemId);

    if (updateError) throw updateError;

    // Update confidence score
    const { error: scoreError } = await supabase
      .from('knowledge_base_confidence_scores')
      .update({
        validation_status: 'rejected',
        validated_at: new Date().toISOString(),
        validated_by: userId,
        confidence_score: 0.0, // Rejected = 0% confidence
        validation_feedback: { reason }
      })
      .eq('kb_item_id', kbItemId);

    if (scoreError) throw scoreError;

    return {
      success: true,
      message: 'Item rejected and deactivated'
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}
