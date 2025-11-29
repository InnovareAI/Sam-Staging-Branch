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
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    // Also provide snake_case for compatibility
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model: string;
}

interface VisionRequest {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
}

// Available Claude models (Nov 2025)
// Strategy: Haiku for chat interface, Sonnet for processing
export const CLAUDE_MODELS = {
  HAIKU: 'claude-3-5-haiku-20241022',      // For chat interface (fast, cheap)
  SONNET: 'claude-sonnet-4-20250514',      // Primary processing model
  OPUS: 'claude-sonnet-4-20250514',        // Use Sonnet (Opus may not be available)
} as const;

// Default model for different use cases
export const MODEL_FOR = {
  CHAT: CLAUDE_MODELS.HAIKU,               // Chat interface - fast responses
  PROCESSING: CLAUDE_MODELS.OPUS,          // Template gen, research, analysis
  VISION: CLAUDE_MODELS.OPUS,              // Image/PDF extraction
} as const;

// Model mapping: OpenRouter model IDs -> Claude model IDs
const MODEL_MAP: Record<string, string> = {
  // Anthropic models
  'anthropic/claude-3.5-sonnet': CLAUDE_MODELS.SONNET,
  'anthropic/claude-3-haiku': CLAUDE_MODELS.HAIKU,
  'anthropic/claude-haiku-4.5': CLAUDE_MODELS.HAIKU,
  'anthropic/claude-opus-4': CLAUDE_MODELS.OPUS,
  'anthropic/claude-sonnet-3.5': CLAUDE_MODELS.SONNET,
  // Internal aliases
  'claude-haiku-4-20250514': CLAUDE_MODELS.HAIKU,  // Fix invalid model name
  'claude-sonnet-4-20250514': CLAUDE_MODELS.SONNET,
  // Non-Claude models -> default to Haiku (fast/cheap)
  'meta-llama/llama-3.1-8b-instruct': CLAUDE_MODELS.HAIKU,
  'mistralai/mistral-7b-instruct': CLAUDE_MODELS.HAIKU,
  'google/gemini-flash-1.5': CLAUDE_MODELS.HAIKU,
  'google/gemini-2.5-flash-preview-09-2025': CLAUDE_MODELS.HAIKU,
};

export class ClaudeClient {
  private anthropic: Anthropic;
  private defaultModel = CLAUDE_MODELS.OPUS; // Default to Opus for processing tasks

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
      temperature: request.temperature,
      system: systemPrompt || undefined,
      messages,
    });

    // Extract text content
    const textBlock = response.content.find(block => block.type === 'text');
    const content = textBlock?.type === 'text' ? textBlock.text : '';

    const totalTokens = response.usage.input_tokens + response.usage.output_tokens;
    return {
      content,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens,
        // Snake_case aliases for compatibility
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: totalTokens
      },
      model: response.model
    };
  }

  /**
   * Vision analysis - for images and PDFs
   */
  async vision(request: VisionRequest): Promise<string> {
    // Map mime types to Claude's supported media types
    const mediaType = request.mimeType.includes('pdf') ? 'application/pdf' :
                      request.mimeType.includes('png') ? 'image/png' :
                      request.mimeType.includes('gif') ? 'image/gif' :
                      request.mimeType.includes('webp') ? 'image/webp' :
                      'image/jpeg';

    const model = this.mapModel(request.model) || MODEL_FOR.VISION;

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: request.maxTokens || 16000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: request.imageBase64
              }
            },
            {
              type: 'text',
              text: request.prompt
            }
          ]
        }
      ]
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text : '';
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
