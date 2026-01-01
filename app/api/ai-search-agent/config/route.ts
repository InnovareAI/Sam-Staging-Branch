/**
 * AI Search Agent Configuration API
 *
 * GET: Get config for workspace
 * POST: Create config with locked website URL
 * PATCH: Update config (website URL cannot be changed)
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
      .from('workspace_ai_search_config')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to get AI search config:', error);
      return apiError('Failed to get configuration', 500);
    }

    return apiSuccess(data || null);
  } catch (error) {
    console.error('AI Search config GET error:', error);
    return apiError('Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, website_url, ...options } = body;

    if (!workspace_id) {
      return apiError('workspace_id is required', 400);
    }

    if (!website_url) {
      return apiError('website_url is required', 400);
    }

    // Validate URL format
    try {
      new URL(website_url.startsWith('http') ? website_url : `https://${website_url}`);
    } catch {
      return apiError('Invalid website URL format', 400);
    }

    const supabase = getSupabase();

    // Check if config already exists
    const { data: existing } = await supabase
      .from('workspace_ai_search_config')
      .select('id, website_url')
      .eq('workspace_id', workspace_id)
      .single();

    if (existing) {
      return apiError(
        'AI Search Agent is already configured for this workspace. Website URL cannot be changed.',
        409
      );
    }

    // Create new config with locked website
    const config = {
      workspace_id,
      website_url: website_url.startsWith('http') ? website_url : `https://${website_url}`,
      website_locked: true,
      enabled: true,
      auto_analyze_prospects: false,
      analysis_depth: 'standard',
      check_meta_tags: true,
      check_structured_data: true,
      check_robots_txt: true,
      check_sitemap: true,
      check_llm_readability: true,
      check_entity_clarity: true,
      check_fact_density: true,
      check_citation_readiness: true,
      learn_from_outreach: true,
      learn_from_comments: true,
      ...options
    };

    const { data, error } = await supabase
      .from('workspace_ai_search_config')
      .insert(config)
      .select()
      .single();

    if (error) {
      console.error('Failed to create AI search config:', error);
      return apiError(`Failed to create configuration: ${error.message}`, 500);
    }

    return apiSuccess(data, 201);
  } catch (error) {
    console.error('AI Search config POST error:', error);
    return apiError('Internal server error', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, ...updates } = body;

    if (!workspace_id) {
      return apiError('workspace_id is required', 400);
    }

    // CRITICAL: website_url is LOCKED and cannot be updated
    if ('website_url' in updates) {
      return apiError('website_url cannot be changed after initial setup', 403);
    }

    // Remove any attempt to change protected fields
    delete updates.workspace_id;
    delete updates.website_locked;
    delete updates.id;

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('workspace_ai_search_config')
      .update(updates)
      .eq('workspace_id', workspace_id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update AI search config:', error);
      return apiError(`Failed to update configuration: ${error.message}`, 500);
    }

    return apiSuccess(data);
  } catch (error) {
    console.error('AI Search config PATCH error:', error);
    return apiError('Internal server error', 500);
  }
}
