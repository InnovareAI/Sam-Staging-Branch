/**
 * Inbox Agent Categories API
 *
 * GET: Get all categories (system + workspace-specific)
 * POST: Create custom category for workspace
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiSuccess, apiError } from '@/lib/api-error-handler';

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return apiError('workspace_id is required', 400);
    }

    const supabase = getSupabase();

    // Get system categories (is_system = true) AND workspace-specific categories
    const { data, error } = await supabase
      .from('inbox_message_categories')
      .select('*')
      .or(`is_system.eq.true,workspace_id.eq.${workspaceId}`)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Failed to get categories:', error);
      return apiError('Failed to get categories', 500);
    }

    return apiSuccess(data || []);
  } catch (error) {
    console.error('Categories GET error:', error);
    return apiError('Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, name, slug, description, color, icon, suggested_action } = body;

    if (!workspace_id) {
      return apiError('workspace_id is required', 400);
    }

    if (!name || !slug) {
      return apiError('name and slug are required', 400);
    }

    const supabase = getSupabase();

    // Get the highest display_order for this workspace
    const { data: existingCategories } = await supabase
      .from('inbox_message_categories')
      .select('display_order')
      .or(`is_system.eq.true,workspace_id.eq.${workspace_id}`)
      .order('display_order', { ascending: false })
      .limit(1);

    const nextOrder = (existingCategories?.[0]?.display_order || 0) + 1;

    // Create custom category
    const { data, error } = await supabase
      .from('inbox_message_categories')
      .insert({
        workspace_id,
        name,
        slug: slug.toLowerCase().replace(/\s+/g, '_'),
        description: description || null,
        color: color || '#6b7280',
        icon: icon || 'Tag',
        is_system: false,
        is_active: true,
        suggested_action: suggested_action || 'reply',
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create category:', error);
      if (error.code === '23505') {
        return apiError('A category with this slug already exists', 409);
      }
      return apiError(`Failed to create category: ${error.message}`, 500);
    }

    return apiSuccess(data, 201);
  } catch (error) {
    console.error('Categories POST error:', error);
    return apiError('Internal server error', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('id');
    const workspaceId = searchParams.get('workspace_id');

    if (!categoryId || !workspaceId) {
      return apiError('id and workspace_id are required', 400);
    }

    const supabase = getSupabase();

    // Only allow deleting custom (non-system) categories
    const { data, error } = await supabase
      .from('inbox_message_categories')
      .delete()
      .eq('id', categoryId)
      .eq('workspace_id', workspaceId)
      .eq('is_system', false)
      .select()
      .single();

    if (error) {
      console.error('Failed to delete category:', error);
      return apiError('Failed to delete category', 500);
    }

    if (!data) {
      return apiError('Category not found or cannot be deleted (system category)', 404);
    }

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error('Categories DELETE error:', error);
    return apiError('Internal server error', 500);
  }
}
