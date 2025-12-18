/**
 * @deprecated OPENROUTER ROUTE REMOVED - December 18, 2025
 *
 * This file is DEPRECATED. All LLM calls should use Claude SDK directly.
 * See lib/llm/claude-client.ts for the correct implementation.
 *
 * The /api/sam/chat endpoint now calls Claude SDK directly.
 * DO NOT USE THIS ENDPOINT.
 */

import { NextRequest, NextResponse } from 'next/server';

// This endpoint is deprecated - redirect callers to use Claude SDK directly
export async function POST(request: NextRequest) {
  console.warn('⚠️ DEPRECATED: /api/sam/openrouter is deprecated. Use Claude SDK directly via lib/llm/claude-client.ts');

  return NextResponse.json({
    success: false,
    error: 'This endpoint is deprecated. Use Claude SDK directly.',
    deprecated: true,
    migration_guide: 'Import { claudeClient } from lib/llm/claude-client and call claudeClient.chat() directly'
  }, { status: 410 }); // 410 Gone
}
