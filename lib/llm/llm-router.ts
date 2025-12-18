/**
 * LLM Router - Routes chat completion requests to Claude SDK
 *
 * UPDATED December 18, 2025:
 * - OpenRouter REMOVED - all calls go directly to Claude SDK
 * - Uses Anthropic SDK with proper model selection
 * - GDPR compliant EU region processing
 */

import { createClient } from '@supabase/supabase-js';
import { claudeClient, CLAUDE_MODELS } from './claude-client';

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
  use_claude_direct: boolean;
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
   * Main chat method - routes directly to Claude SDK
   * OpenRouter removed Dec 18, 2025
   */
  async chat(
    userId: string,
    messages: ChatMessage[],
    systemPrompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    }
  ): Promise<ChatResponse> {
    const prefs = await this.getCustomerPreferences(userId);

    // Determine model - Haiku for chat (fast), Sonnet/Opus for heavy processing
    const model = options?.model || CLAUDE_MODELS.HAIKU;

    // Direct Claude SDK call
    const result = await claudeClient.chat({
      model,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
      max_tokens: options?.maxTokens || prefs.max_tokens || 1000,
      temperature: options?.temperature || prefs.temperature || 0.7
    });

    return {
      content: result.content,
      usage: result.usage ? {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens
      } : undefined,
      model: result.model
    };
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
    try {
      const { data, error } = await this.supabase
        .from('customer_llm_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('enabled', true)
        .single();

      if (error || !data) {
        return this.getDefaultPreferences();
      }

      return data as CustomerLLMPreferences;
    } catch {
      return this.getDefaultPreferences();
    }
  }

  private getDefaultPreferences(): CustomerLLMPreferences {
    return {
      selected_model: null,
      use_claude_direct: true,
      temperature: 0.7,
      max_tokens: 1000,
      plan_tier: 'standard'
    };
  }
}

// Export singleton instance
export const llmRouter = new LLMRouter();

// Export for testing
export { LLMRouter };
