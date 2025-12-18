/**
 * @deprecated OPENROUTER REMOVED - December 18, 2025
 *
 * This file is DEPRECATED. All LLM calls should use Claude SDK directly.
 * Import { claudeClient } from '@/lib/llm/claude-client' instead.
 *
 * DO NOT USE THIS FILE.
 */

// Deprecated - will throw error if used
export class OpenRouter {
  constructor(_config: any) {
    throw new Error('OpenRouter is deprecated. Use claudeClient from lib/llm/claude-client instead.');
  }

  async chat(_request: any): Promise<any> {
    throw new Error('OpenRouter is deprecated. Use claudeClient from lib/llm/claude-client instead.');
  }

  async getModels(): Promise<any> {
    throw new Error('OpenRouter is deprecated. Use claudeClient from lib/llm/claude-client instead.');
  }
}
