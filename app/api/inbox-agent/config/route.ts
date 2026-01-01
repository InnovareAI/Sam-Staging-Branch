/**
 * Inbox Agent Configuration API
 *
 * GET: Get config for workspace
 * POST: Create/update config
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
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

    const { data, error } = await supabase
      .from('workspace_inbox_agent_config')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to get inbox agent config:', error);
      return apiError('Failed to get configuration', 500);
    }

    return apiSuccess(data || null);
  } catch (error) {
    console.error('Inbox agent config GET error:', error);
    return apiError('Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, ...configData } = body;

    if (!workspace_id) {
      return apiError('workspace_id is required', 400);
    }

    const supabase = getSupabase();

    // Upsert the config
    const { data, error } = await supabase
      .from('workspace_inbox_agent_config')
      .upsert({
        workspace_id,
        enabled: configData.enabled ?? false,
        categorization_enabled: configData.categorization_enabled ?? true,
        auto_categorize_new_messages: configData.auto_categorize_new_messages ?? true,
        response_suggestions_enabled: configData.response_suggestions_enabled ?? true,
        suggest_for_categories: configData.suggest_for_categories ?? ['interested', 'question', 'objection'],
        auto_tagging_enabled: configData.auto_tagging_enabled ?? false,
        ai_model: configData.ai_model ?? 'claude-3-5-sonnet',
        categorization_instructions: configData.categorization_instructions ?? null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'workspace_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save inbox agent config:', error);
      return apiError(`Failed to save configuration: ${error.message}`, 500);
    }

    return apiSuccess(data, 201);
  } catch (error) {
    console.error('Inbox agent config POST error:', error);
    return apiError('Internal server error', 500);
  }
}
