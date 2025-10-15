/**
 * Knowledge Base Usage Tracking
 * Tracks when SAM uses documents in conversations
 */

interface UsageTrackingOptions {
  workspaceId: string;
  documentIds: string[];
  threadId?: string;
  messageId?: string;
  chunksUsed?: number;
  relevanceScore?: number;
  queryContext?: string;
}

export async function trackDocumentUsage(options: UsageTrackingOptions): Promise<void> {
  const {
    workspaceId,
    documentIds,
    threadId,
    messageId,
    chunksUsed = 1,
    relevanceScore,
    queryContext
  } = options;

  if (!documentIds || documentIds.length === 0) {
    return; // Nothing to track
  }

  try {
    // Track usage for each document (fire and forget - don't block conversation)
    const trackingPromises = documentIds.map(async (documentId) => {
      try {
        const response = await fetch('/api/knowledge-base/analytics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            documentId,
            threadId,
            messageId,
            chunksUsed,
            relevanceScore,
            queryContext: queryContext?.substring(0, 500) // Limit context size
          })
        });

        if (!response.ok) {
          console.warn(`Failed to track usage for document ${documentId}:`, response.statusText);
        }
      } catch (error) {
        console.warn(`Error tracking usage for document ${documentId}:`, error);
      }
    });

    // Fire and forget - don't await
    Promise.all(trackingPromises).catch((error) => {
      console.error('Usage tracking batch failed:', error);
    });
  } catch (error) {
    console.error('Usage tracking error:', error);
    // Don't throw - tracking should never break the conversation
  }
}

/**
 * Track usage from server-side (with Supabase client)
 * Use this in API routes where you have direct Supabase access
 */
export async function trackDocumentUsageServer(
  supabase: any,
  options: UsageTrackingOptions
): Promise<void> {
  const {
    workspaceId,
    documentIds,
    threadId,
    messageId,
    chunksUsed = 1,
    relevanceScore,
    queryContext
  } = options;

  if (!documentIds || documentIds.length === 0) {
    return;
  }

  try {
    // Track usage for each document
    for (const documentId of documentIds) {
      const { error } = await supabase.rpc('record_document_usage', {
        p_workspace_id: workspaceId,
        p_document_id: documentId,
        p_thread_id: threadId || null,
        p_message_id: messageId || null,
        p_chunks_used: chunksUsed,
        p_relevance_score: relevanceScore || null,
        p_query_context: queryContext?.substring(0, 500) || null
      });

      if (error) {
        console.warn(`Failed to track usage for document ${documentId}:`, error);
      }
    }
  } catch (error) {
    console.error('Server-side usage tracking error:', error);
    // Don't throw - tracking should never break the conversation
  }
}
