/**
 * AI Search Agent - Website Analysis API
 *
 * POST: Start a new website analysis
 * GET: Get analysis results
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { analyzeWebsite } from '@/lib/services/ai-search-agent';
import { apiSuccess, apiError } from '@/lib/api-error-handler';

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, website_url, depth = 'standard', include_learnings = true } = body;

    if (!workspace_id) {
      return apiError('workspace_id is required', 400);
    }

    if (!website_url) {
      return apiError('website_url is required', 400);
    }

    console.log(`🔍 Starting analysis for ${website_url}`, { workspace_id, depth });

    // Run analysis (this may take 30-60 seconds)
    const result = await analyzeWebsite(workspace_id, website_url, {
      depth,
      includeLearn: include_learnings
    });

    console.log(`✅ Analysis complete. Score: ${result.overall_score}/100`);

    return apiSuccess(result);
  } catch (error) {
    console.error('Analysis error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Analysis failed',
      500
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const analysisId = searchParams.get('id');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!workspaceId) {
      return apiError('workspace_id is required', 400);
    }

    const supabase = getSupabase();

    // If specific analysis ID requested
    if (analysisId) {
      const { data, error } = await supabase
        .from('website_analysis_results')
        .select('*')
        .eq('id', analysisId)
        .eq('workspace_id', workspaceId)
        .single();

      if (error) {
        return apiError('Analysis not found', 404);
      }

      return apiSuccess(data);
    }

    // Otherwise, get latest analyses for workspace
    const { data, error } = await supabase
      .from('website_analysis_results')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('analyzed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to get analyses:', error);
      return apiError('Failed to get analysis results', 500);
    }

    return apiSuccess({
      analyses: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    console.error('Get analysis error:', error);
    return apiError('Internal server error', 500);
  }
}
