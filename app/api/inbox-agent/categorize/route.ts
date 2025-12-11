/**
 * Inbox Agent Message Categorization API
 *
 * POST: Categorize a message using AI
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-error-handler';
import { processIncomingMessage } from '@/lib/services/inbox-agent';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, message } = body;

    if (!workspace_id) {
      return apiError('workspace_id is required', 400);
    }

    if (!message || !message.id || !message.content || !message.source) {
      return apiError('message with id, content, and source is required', 400);
    }

    // Validate message source
    const validSources = ['linkedin', 'email', 'gmail', 'outlook'];
    if (!validSources.includes(message.source)) {
      return apiError(`Invalid message source. Must be one of: ${validSources.join(', ')}`, 400);
    }

    // Process the message with AI categorization
    const result = await processIncomingMessage(workspace_id, message);

    if (!result) {
      return apiError('Inbox Agent is not enabled or not configured for this workspace', 400);
    }

    return apiSuccess({
      message_id: message.id,
      categorization: result,
    });
  } catch (error) {
    console.error('Message categorization error:', error);
    return apiError('Failed to categorize message', 500);
  }
}
