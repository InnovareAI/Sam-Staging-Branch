/**
 * LLM Preferences API
 * GET: Fetch user's current LLM preferences
 * POST: Update user's LLM preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getModelById } from '@/lib/llm/approved-models';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch user's preferences
    const { data: prefs, error } = await supabase
      .from('customer_llm_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (which is fine)
      console.error('Failed to fetch preferences:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch preferences' },
        { status: 500 }
      );
    }

    // If no preferences exist, return defaults
    if (!prefs) {
      return NextResponse.json({
        success: true,
        preferences: {
          selected_model: 'anthropic/claude-sonnet-4.5', // Platform default
          use_own_openrouter_key: false,
          use_custom_endpoint: false,
          temperature: 0.7,
          max_tokens: 1000,
          eu_data_residency: false,
          plan_tier: 'standard',
          enabled: true
        },
        isDefault: true
      });
    }

    // Validate selected model exists
    const selectedModel = prefs.selected_model ? getModelById(prefs.selected_model) : null;

    return NextResponse.json({
      success: true,
      preferences: {
        ...prefs,
        // Don't expose encrypted keys to client
        openrouter_api_key_encrypted: prefs.openrouter_api_key_encrypted ? '***ENCRYPTED***' : null,
        custom_endpoint_config: prefs.custom_endpoint_config
          ? {
              ...prefs.custom_endpoint_config,
              api_key_encrypted: '***ENCRYPTED***'
            }
          : null
      },
      modelInfo: selectedModel
        ? {
            id: selectedModel.id,
            name: selectedModel.name,
            provider: selectedModel.provider,
            tier: selectedModel.tier
          }
        : null,
      isDefault: false
    });
  } catch (error) {
    console.error('LLM preferences GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      selected_model,
      use_own_openrouter_key,
      openrouter_api_key,
      use_custom_endpoint,
      custom_endpoint_config,
      temperature,
      max_tokens,
      eu_data_residency,
      enabled
    } = body;

    // Validate selected model
    if (selected_model && selected_model !== 'anthropic/claude-sonnet-4.5') {
      const model = getModelById(selected_model);
      if (!model) {
        return NextResponse.json(
          { success: false, error: 'Invalid model selection' },
          { status: 400 }
        );
      }

      // Check EU compliance if required
      if (eu_data_residency && !model.euHosted) {
        return NextResponse.json(
          {
            success: false,
            error: 'Selected model is not EU-hosted. Please select a Mistral or Cohere model for EU data residency.'
          },
          { status: 400 }
        );
      }
    }

    // Validate temperature and max_tokens
    if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
      return NextResponse.json(
        { success: false, error: 'Temperature must be between 0 and 2' },
        { status: 400 }
      );
    }

    if (max_tokens !== undefined && (max_tokens < 100 || max_tokens > 128000)) {
      return NextResponse.json(
        { success: false, error: 'Max tokens must be between 100 and 128000' },
        { status: 400 }
      );
    }

    // Prepare upsert data
    const upsertData: any = {
      user_id: user.id,
      updated_at: new Date().toISOString()
    };

    if (selected_model !== undefined) upsertData.selected_model = selected_model;
    if (use_own_openrouter_key !== undefined) upsertData.use_own_openrouter_key = use_own_openrouter_key;
    if (use_custom_endpoint !== undefined) upsertData.use_custom_endpoint = use_custom_endpoint;
    if (temperature !== undefined) upsertData.temperature = temperature;
    if (max_tokens !== undefined) upsertData.max_tokens = max_tokens;
    if (eu_data_residency !== undefined) upsertData.eu_data_residency = eu_data_residency;
    if (enabled !== undefined) upsertData.enabled = enabled;

    // Handle API key encryption (if provided)
    if (openrouter_api_key) {
      // TODO: Implement proper encryption
      // For now, store as-is (in production, encrypt before storing)
      upsertData.openrouter_api_key_encrypted = openrouter_api_key;
    }

    // Handle custom endpoint config
    if (custom_endpoint_config) {
      // TODO: Encrypt API keys in config
      upsertData.custom_endpoint_config = custom_endpoint_config;
    }

    // Upsert preferences
    const { data: savedPrefs, error } = await supabase
      .from('customer_llm_preferences')
      .upsert(upsertData, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save preferences:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save preferences' },
        { status: 500 }
      );
    }

    // Track usage event
    await supabase.from('customer_llm_usage').insert({
      user_id: user.id,
      event_type: 'preferences_updated',
      model_used: selected_model || savedPrefs.selected_model,
      metadata: {
        use_own_key: use_own_openrouter_key,
        use_custom_endpoint: use_custom_endpoint,
        eu_residency: eu_data_residency
      }
    });

    return NextResponse.json({
      success: true,
      preferences: {
        ...savedPrefs,
        // Don't expose encrypted keys
        openrouter_api_key_encrypted: savedPrefs.openrouter_api_key_encrypted ? '***ENCRYPTED***' : null,
        custom_endpoint_config: savedPrefs.custom_endpoint_config
          ? {
              ...savedPrefs.custom_endpoint_config,
              api_key_encrypted: '***ENCRYPTED***'
            }
          : null
      }
    });
  } catch (error) {
    console.error('LLM preferences POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
