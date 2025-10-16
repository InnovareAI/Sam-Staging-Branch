/**
 * LLM Models API
 * GET: Fetch list of approved models (optionally filtered)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import {
  APPROVED_MODELS,
  getEUModels,
  getRecommendedModels,
  getModelsByProvider,
  PROVIDER_NAMES,
  PROVIDER_DESCRIPTIONS,
  ApprovedModel
} from '@/lib/llm/approved-models';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter'); // 'eu', 'recommended', 'provider:<name>'
    const tier = searchParams.get('tier'); // 'flagship', 'premium', 'standard', 'efficient', 'enterprise'

    let models: ApprovedModel[] = APPROVED_MODELS;

    // Apply filters
    if (filter === 'eu') {
      models = getEUModels();
    } else if (filter === 'recommended') {
      models = getRecommendedModels();
    } else if (filter?.startsWith('provider:')) {
      const provider = filter.replace('provider:', '');
      models = getModelsByProvider(provider);
    }

    // Apply tier filter
    if (tier) {
      models = models.filter(m => m.tier === tier);
    }

    // Group models by provider for easier UI rendering
    const modelsByProvider = models.reduce((acc, model) => {
      const provider = model.provider;
      if (!acc[provider]) {
        acc[provider] = [];
      }
      acc[provider].push(model);
      return acc;
    }, {} as Record<string, ApprovedModel[]>);

    return NextResponse.json({
      success: true,
      models: models,
      modelsByProvider,
      providers: Object.keys(modelsByProvider).map(key => ({
        id: key,
        name: PROVIDER_NAMES[key] || key,
        description: PROVIDER_DESCRIPTIONS[key] || '',
        modelCount: modelsByProvider[key].length
      })),
      totalCount: models.length
    });
  } catch (error) {
    console.error('LLM models API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
