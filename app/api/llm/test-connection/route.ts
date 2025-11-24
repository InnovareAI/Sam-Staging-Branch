/**
 * LLM Test Connection API
 * POST: Test connection to OpenRouter or custom endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { getModelById } from '@/lib/llm/approved-models';

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
      connection_type, // 'openrouter' | 'custom'
      model_id,
      api_key,
      custom_endpoint_config
    } = body;

    if (!connection_type) {
      return NextResponse.json(
        { success: false, error: 'connection_type is required' },
        { status: 400 }
      );
    }

    // Test OpenRouter connection
    if (connection_type === 'openrouter') {
      if (!api_key) {
        return NextResponse.json(
          { success: false, error: 'API key is required' },
          { status: 400 }
        );
      }

      if (!model_id) {
        return NextResponse.json(
          { success: false, error: 'Model ID is required' },
          { status: 400 }
        );
      }

      // Validate model exists
      const model = getModelById(model_id);
      if (!model) {
        return NextResponse.json(
          { success: false, error: 'Invalid model ID' },
          { status: 400 }
        );
      }

      // Test OpenRouter API
      try {
        const testResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${api_key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://innovareai.com',
            'X-Title': 'SAM LLM Connection Test'
          },
          body: JSON.stringify({
            model: model_id,
            messages: [
              { role: 'user', content: 'Respond with "OK" if you can read this.' }
            ],
            max_tokens: 10
          })
        });

        if (!testResponse.ok) {
          const errorText = await testResponse.text();
          return NextResponse.json({
            success: false,
            error: 'Connection test failed',
            details: errorText,
            statusCode: testResponse.status
          });
        }

        const data = await testResponse.json();
        const responseContent = data.choices?.[0]?.message?.content || '';

        return NextResponse.json({
          success: true,
          message: 'Connection successful',
          model: model.name,
          provider: model.provider,
          testResponse: responseContent,
          usage: data.usage
        });
      } catch (error) {
        console.error('OpenRouter test error:', error);
        return NextResponse.json({
          success: false,
          error: 'Connection test failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Test custom endpoint
    if (connection_type === 'custom') {
      if (!custom_endpoint_config) {
        return NextResponse.json(
          { success: false, error: 'Custom endpoint config is required' },
          { status: 400 }
        );
      }

      const { provider, endpoint, model, api_key: customApiKey } = custom_endpoint_config;

      if (!endpoint || !model) {
        return NextResponse.json(
          { success: false, error: 'Endpoint and model are required' },
          { status: 400 }
        );
      }

      try {
        let testUrl = '';
        let testHeaders: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        let testBody: any = {};

        // Configure based on provider
        if (provider === 'azure-openai') {
          const { deployment_name, api_version } = custom_endpoint_config;
          if (!deployment_name || !api_version) {
            return NextResponse.json(
              { success: false, error: 'Azure requires deployment_name and api_version' },
              { status: 400 }
            );
          }
          testUrl = `${endpoint}/openai/deployments/${deployment_name}/chat/completions?api-version=${api_version}`;
          testHeaders['api-key'] = customApiKey;
          testBody = {
            messages: [{ role: 'user', content: 'Respond with "OK" if you can read this.' }],
            max_tokens: 10
          };
        } else if (provider === 'aws-bedrock') {
          return NextResponse.json({
            success: false,
            error: 'AWS Bedrock testing not yet implemented'
          });
        } else {
          // Generic OpenAI-compatible
          testUrl = `${endpoint}/v1/chat/completions`;
          testHeaders['Authorization'] = `Bearer ${customApiKey}`;
          testBody = {
            model: model,
            messages: [{ role: 'user', content: 'Respond with "OK" if you can read this.' }],
            max_tokens: 10
          };
        }

        const testResponse = await fetch(testUrl, {
          method: 'POST',
          headers: testHeaders,
          body: JSON.stringify(testBody)
        });

        if (!testResponse.ok) {
          const errorText = await testResponse.text();
          return NextResponse.json({
            success: false,
            error: 'Connection test failed',
            details: errorText,
            statusCode: testResponse.status
          });
        }

        const data = await testResponse.json();
        const responseContent = data.choices?.[0]?.message?.content || '';

        return NextResponse.json({
          success: true,
          message: 'Custom endpoint connection successful',
          endpoint: endpoint,
          model: model,
          provider: provider,
          testResponse: responseContent,
          usage: data.usage
        });
      } catch (error) {
        console.error('Custom endpoint test error:', error);
        return NextResponse.json({
          success: false,
          error: 'Connection test failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json(
      { success: false, error: 'Invalid connection_type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Test connection API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
