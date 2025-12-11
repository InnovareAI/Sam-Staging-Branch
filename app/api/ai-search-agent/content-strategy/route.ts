/**
 * AI Search Agent - Content Strategy API
 *
 * GET: Generate content strategy based on analysis and learnings
 */

import { NextRequest } from 'next/server';
import { generateContentStrategy } from '@/lib/services/ai-search-agent';
import { apiSuccess, apiError } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return apiError('workspace_id is required', 400);
    }

    console.log(`📝 Generating content strategy for workspace ${workspaceId}`);

    const strategy = await generateContentStrategy(workspaceId);

    return apiSuccess(strategy);
  } catch (error) {
    console.error('Content strategy error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to generate content strategy',
      500
    );
  }
}
