/**
 * Claude API Client for GDPR-Compliant LLM Access
 * Direct Anthropic SDK wrapper with OpenRouter-compatible interface
 *
 * Created: Nov 29, 2025
 * Purpose: GDPR compliance - all LLM calls route through Claude Direct API
 */

import Anthropic from '@anthropic-ai/sdk';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ClaudeRequest {
  model?: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  system?: string;
}

interface ClaudeResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

// Model mapping: OpenRouter model IDs -> Claude model IDs
const MODEL_MAP: Record<string, string> = {
  'anthropic/claude-3.5-sonnet': 'claude-sonnet-4-20250514',
  'anthropic/claude-3-haiku': 'claude-sonnet-4-20250514',
  'anthropic/claude-haiku-4.5': 'claude-sonnet-4-20250514',
  'anthropic/claude-opus-4': 'claude-sonnet-4-20250514',
  'anthropic/claude-sonnet-3.5': 'claude-sonnet-4-20250514',
  'meta-llama/llama-3.1-8b-instruct': 'claude-sonnet-4-20250514',
  'mistralai/mistral-7b-instruct': 'claude-sonnet-4-20250514',
  // Default to Sonnet for any unrecognized model
};

export class ClaudeClient {
  private anthropic: Anthropic;
  private defaultModel = 'claude-sonnet-4-20250514';

  constructor(apiKey?: string) {
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY!,
    });
  }

  /**
   * Chat completion - compatible with OpenRouter interface
   */
  async chat(request: ClaudeRequest): Promise<ClaudeResponse> {
    // Extract system message if present
    let systemPrompt = request.system || '';
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content;
      } else {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        });
      }
    }

    // Ensure we have at least one user message
    if (messages.length === 0) {
      messages.push({ role: 'user', content: 'Hello' });
    }

    // Map model to Claude equivalent
    const model = this.mapModel(request.model);

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: request.max_tokens || 1000,
      system: systemPrompt || undefined,
      messages,
    });

    // Extract text content
    const textBlock = response.content.find(block => block.type === 'text');
    const content = textBlock?.type === 'text' ? textBlock.text : '';

    return {
      content,
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens
      },
      model: response.model
    };
  }

  /**
   * Simple completion for common use cases
   */
  async complete(
    prompt: string,
    options?: {
      system?: string;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<string> {
    const result = await this.chat({
      messages: [{ role: 'user', content: prompt }],
      system: options?.system,
      max_tokens: options?.maxTokens || 1000,
      temperature: options?.temperature,
    });
    return result.content;
  }

  /**
   * JSON completion - parses response as JSON
   */
  async completeJSON<T = any>(
    prompt: string,
    options?: {
      system?: string;
      maxTokens?: number;
    }
  ): Promise<T> {
    const result = await this.complete(prompt, {
      ...options,
      system: (options?.system || '') + '\n\nRespond with valid JSON only.',
    });

    // Extract JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    return JSON.parse(jsonMatch[0]);
  }

  private mapModel(model?: string): string {
    if (!model) return this.defaultModel;
    return MODEL_MAP[model] || this.defaultModel;
  }
}

// Singleton instance
let _instance: ClaudeClient | null = null;

export function getClaudeClient(): ClaudeClient {
  if (!_instance) {
    _instance = new ClaudeClient();
  }
  return _instance;
}

// Export for direct import
export const claudeClient = new ClaudeClient();
