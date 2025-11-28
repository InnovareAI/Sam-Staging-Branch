/**
 * LLM Router - Routes chat completion requests to appropriate LLM provider
 * Supports: Platform OpenRouter, Customer BYOK OpenRouter, Custom Enterprise endpoints
 */

import { createClient } from '@supabase/supabase-js';
import { getDefaultModel, getModelById } from './approved-models';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

interface CustomerLLMPreferences {
  selected_model: string | null;
  use_own_openrouter_key: boolean;
  openrouter_api_key_encrypted: string | null;
  use_custom_endpoint: boolean;
  custom_endpoint_config: any;
  temperature: number;
  max_tokens: number;
  plan_tier: string;
}

class LLMRouter {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  /**
   * Main chat method - routes to appropriate LLM based on customer preferences
   */
  async chat(
    userId: string,
    messages: ChatMessage[],
    systemPrompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<ChatResponse> {
    // Get customer preferences
    const prefs = await this.getCustomerPreferences(userId);

    // Determine routing
    if (prefs.use_custom_endpoint && prefs.custom_endpoint_config) {
      // Enterprise: Custom endpoint (Azure, AWS, self-hosted)
      return await this.callCustomEndpoint(prefs, messages, systemPrompt, options);
    } else if (prefs.use_own_openrouter_key && prefs.openrouter_api_key_encrypted) {
      // Enterprise: BYOK OpenRouter
      const customerKey = await this.decryptApiKey(prefs.openrouter_api_key_encrypted);
      const model = prefs.selected_model || getDefaultModel().id;
      return await this.callOpenRouter(customerKey, model, messages, systemPrompt, options, prefs);
    } else {
      // Standard/Premium: Platform OpenRouter
      const platformKey = process.env.OPENROUTER_API_KEY!;
      const model = prefs.selected_model || getDefaultModel().id;
      return await this.callOpenRouter(platformKey, model, messages, systemPrompt, options, prefs);
    }
  }

  /**
   * Generate embeddings for knowledge base using Google Gemini text-embedding-004
   */
  async generateEmbedding(userId: string, text: string): Promise<number[]> {
    try {
      const truncatedText = text.substring(0, 10000);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: {
              parts: [{
                text: truncatedText
              }]
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const embedding = data.embedding?.values || [];

      if (embedding.length === 0) {
        throw new Error('Gemini returned empty embedding');
      }

      // Pad to 1536 dimensions to match vector column size (Gemini returns 768)
      if (embedding.length < 1536) {
        return [...embedding, ...Array(1536 - embedding.length).fill(0)];
      } else if (embedding.length > 1536) {
        return embedding.slice(0, 1536);
      }

      return embedding;
    } catch (error) {
      console.error('Embedding generation failed:', error);
      return [];
    }
  }

  /**
   * Get customer's LLM preferences from database
   */
  private async getCustomerPreferences(userId: string): Promise<CustomerLLMPreferences> {
    const { data, error } = await this.supabase
      .from('customer_llm_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true)
      .single();

    if (error || !data) {
      // Return defaults
      return {
        selected_model: null, // Will use platform default
        use_own_openrouter_key: false,
        openrouter_api_key_encrypted: null,
        use_custom_endpoint: false,
        custom_endpoint_config: null,
        temperature: 0.7,
        max_tokens: 1000,
        plan_tier: 'standard'
      };
    }

    return data as CustomerLLMPreferences;
  }

  /**
   * Call OpenRouter API (works for both platform and BYOK)
   */
  private async callOpenRouter(
    apiKey: string,
    modelId: string,
    messages: ChatMessage[],
    systemPrompt: string,
    options: any,
    prefs: CustomerLLMPreferences
  ): Promise<ChatResponse> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://innovareai.com',
        'X-Title': 'Sam AI Sales Consultant'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: options?.temperature || prefs.temperature || 0.7,
        max_tokens: options?.maxTokens || prefs.max_tokens || 1000,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: data.model
    };
  }

  /**
   * Call custom enterprise endpoint (Azure OpenAI, AWS Bedrock, self-hosted)
   */
  private async callCustomEndpoint(
    prefs: CustomerLLMPreferences,
    messages: ChatMessage[],
    systemPrompt: string,
    options: any
  ): Promise<ChatResponse> {
    const config = prefs.custom_endpoint_config;
    const apiKey = await this.decryptApiKey(config.api_key_encrypted);

    if (config.provider === 'azure-openai') {
      return await this.callAzureOpenAI(config, apiKey, messages, systemPrompt, options, prefs);
    } else if (config.provider === 'aws-bedrock') {
      return await this.callAWSBedrock(config, messages, systemPrompt, options, prefs);
    } else {
      // Generic OpenAI-compatible endpoint
      return await this.callGenericOpenAI(config, apiKey, messages, systemPrompt, options, prefs);
    }
  }

  /**
   * Call Azure OpenAI
   */
  private async callAzureOpenAI(
    config: any,
    apiKey: string,
    messages: ChatMessage[],
    systemPrompt: string,
    options: any,
    prefs: CustomerLLMPreferences
  ): Promise<ChatResponse> {
    const url = `${config.endpoint}/openai/deployments/${config.deployment_name}/chat/completions?api-version=${config.api_version}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: options?.temperature || prefs.temperature || 0.7,
        max_tokens: options?.maxTokens || prefs.max_tokens || 1000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure OpenAI error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: config.model || 'azure-openai'
    };
  }

  /**
   * Call AWS Bedrock (placeholder - would need AWS SDK)
   */
  private async callAWSBedrock(
    config: any,
    messages: ChatMessage[],
    systemPrompt: string,
    options: any,
    prefs: CustomerLLMPreferences
  ): Promise<ChatResponse> {
    // Would require AWS SDK integration
    throw new Error('AWS Bedrock integration not yet implemented');
  }

  /**
   * Call generic OpenAI-compatible endpoint (Ollama, vLLM, etc.)
   */
  private async callGenericOpenAI(
    config: any,
    apiKey: string,
    messages: ChatMessage[],
    systemPrompt: string,
    options: any,
    prefs: CustomerLLMPreferences
  ): Promise<ChatResponse> {
    const response = await fetch(`${config.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: options?.temperature || prefs.temperature || 0.7,
        max_tokens: options?.maxTokens || prefs.max_tokens || 1000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Custom endpoint error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: config.model
    };
  }

  /**
   * Decrypt API key (placeholder - implement based on your encryption method)
   */
  private async decryptApiKey(encryptedKey: string): Promise<string> {
    // TODO: Implement proper decryption
    // For now, return as-is (in production, use proper encryption)
    return encryptedKey;
  }
}

// Export singleton instance
export const llmRouter = new LLMRouter();

// Export for testing
export { LLMRouter };
