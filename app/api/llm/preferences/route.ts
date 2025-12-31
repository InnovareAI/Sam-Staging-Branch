/**
 * LLM Preferences API
 * GET: Fetch user's current LLM preferences
 * POST: Update user's LLM preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';
import { getModelById } from '@/lib/llm/approved-models';

export async function GET(request: NextRequest) {
  try {
    // Authenticate with Firebase
    const { userId } = await verifyAuth(request);

    // Fetch user's preferences
    const { rows } = await pool.query(
      'SELECT * FROM customer_llm_preferences WHERE user_id = $1',
      [userId]
    );
    const prefs = rows[0];

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
    // Authenticate with Firebase
    const { userId } = await verifyAuth(request);

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

    // Build dynamic upsert query
    const fields = ['user_id', 'updated_at'];
    const values: any[] = [userId, new Date().toISOString()];
    let paramIndex = 3;

    if (selected_model !== undefined) { fields.push('selected_model'); values.push(selected_model); }
    if (use_own_openrouter_key !== undefined) { fields.push('use_own_openrouter_key'); values.push(use_own_openrouter_key); }
    if (use_custom_endpoint !== undefined) { fields.push('use_custom_endpoint'); values.push(use_custom_endpoint); }
    if (temperature !== undefined) { fields.push('temperature'); values.push(temperature); }
    if (max_tokens !== undefined) { fields.push('max_tokens'); values.push(max_tokens); }
    if (eu_data_residency !== undefined) { fields.push('eu_data_residency'); values.push(eu_data_residency); }
    if (enabled !== undefined) { fields.push('enabled'); values.push(enabled); }
    if (openrouter_api_key) { fields.push('openrouter_api_key_encrypted'); values.push(openrouter_api_key); }
    if (custom_endpoint_config) { fields.push('custom_endpoint_config'); values.push(JSON.stringify(custom_endpoint_config)); }

    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
    const updateSet = fields.slice(1).map((f, i) => `${f} = $${i + 2}`).join(', ');

    const { rows } = await pool.query(
      `INSERT INTO customer_llm_preferences (${fields.join(', ')})
       VALUES (${placeholders})
       ON CONFLICT (user_id) DO UPDATE SET ${updateSet}
       RETURNING *`,
      values
    );

    const savedPrefs = rows[0];

    if (!savedPrefs) {
      console.error('Failed to save preferences');
      return NextResponse.json(
        { success: false, error: 'Failed to save preferences' },
        { status: 500 }
      );
    }

    // Track usage event
    await pool.query(
      `INSERT INTO customer_llm_usage (user_id, event_type, model_used, metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        userId,
        'preferences_updated',
        selected_model || savedPrefs.selected_model,
        JSON.stringify({
          use_own_key: use_own_openrouter_key,
          use_custom_endpoint: use_custom_endpoint,
          eu_residency: eu_data_residency
        })
      ]
    );

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
