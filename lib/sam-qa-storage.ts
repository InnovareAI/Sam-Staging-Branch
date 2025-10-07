/**
 * SAM Q&A Storage and RAG Integration
 *
 * Stores all question-answer pairs from SAM conversations for:
 * 1. Reference when asking clarifying questions
 * 2. Context retrieval when setting up campaigns
 * 3. Building comprehensive knowledge base per user/workspace
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ================================================================
// TYPES
// ================================================================

export interface QuestionAnswer {
  questionId: string;
  questionText: string;
  answerText: string;
  answerStructured?: Record<string, any>;
  stage: string;
  category: string;
  confidenceScore?: number;
  isShallow?: boolean;
  needsClarification?: boolean;
  clarificationNotes?: string;
  sourceAttachmentId?: string; // Link to source document if extracted from upload
}

export interface StoredQA {
  id: string;
  workspace_id: string;
  user_id: string;
  discovery_session_id?: string;
  question_id: string;
  question_text: string;
  answer_text: string;
  answer_structured: Record<string, any>;
  stage: string;
  category: string;
  confidence_score: number;
  is_shallow: boolean;
  needs_clarification: boolean;
  clarification_notes?: string;
  indexed_for_rag: boolean;
  created_at: string;
  updated_at: string;
}

export interface RAGSearchResult {
  question_id: string;
  question_text: string;
  answer_text: string;
  answer_structured: Record<string, any>;
  stage: string;
  category: string;
  confidence_score: number;
  similarity: number;
}

// ================================================================
// Q&A STORAGE FUNCTIONS
// ================================================================

/**
 * Store a question-answer pair in the knowledge base
 */
export async function storeQuestionAnswer(
  workspaceId: string,
  userId: string,
  discoverySessionId: string | undefined,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string; data?: StoredQA }> {
  try {
    // Generate embedding for RAG
    const embedding = await generateEmbedding(
      `Q: ${qa.questionText}\nA: ${qa.answerText}`
    );

    const { data, error } = await supabase
      .from('sam_icp_knowledge_entries')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        discovery_session_id: discoverySessionId,
        question_id: qa.questionId,
        question_text: qa.questionText,
        answer_text: qa.answerText,
        answer_structured: qa.answerStructured || {},
        stage: qa.stage,
        category: qa.category,
        confidence_score: qa.confidenceScore ?? 1.0,
        is_shallow: qa.isShallow ?? false,
        needs_clarification: qa.needsClarification ?? false,
        clarification_notes: qa.clarificationNotes,
        source_attachment_id: qa.sourceAttachmentId || null,
        embedding: JSON.stringify(embedding),
        indexed_for_rag: true
      })
      .select()
      .single();

    if (error) {
      // Check if it's a duplicate - update instead
      if (error.code === '23505') {
        return updateQuestionAnswer(workspaceId, userId, discoverySessionId, qa);
      }
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Update an existing question-answer pair
 */
export async function updateQuestionAnswer(
  workspaceId: string,
  userId: string,
  discoverySessionId: string | undefined,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string; data?: StoredQA }> {
  try {
    // Generate new embedding
    const embedding = await generateEmbedding(
      `Q: ${qa.questionText}\nA: ${qa.answerText}`
    );

    const { data, error } = await supabase
      .from('sam_icp_knowledge_entries')
      .update({
        answer_text: qa.answerText,
        answer_structured: qa.answerStructured || {},
        confidence_score: qa.confidenceScore ?? 1.0,
        is_shallow: qa.isShallow ?? false,
        needs_clarification: qa.needsClarification ?? false,
        clarification_notes: qa.clarificationNotes,
        embedding: JSON.stringify(embedding),
        updated_at: new Date().toISOString()
      })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('question_id', qa.questionId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Batch store multiple Q&A pairs
 */
export async function batchStoreQuestionAnswers(
  workspaceId: string,
  userId: string,
  discoverySessionId: string | undefined,
  qaList: QuestionAnswer[]
): Promise<{ success: boolean; stored: number; errors: string[] }> {
  const results = await Promise.all(
    qaList.map(qa => storeQuestionAnswer(workspaceId, userId, discoverySessionId, qa))
  );

  const stored = results.filter(r => r.success).length;
  const errors = results.filter(r => !r.success).map(r => r.error || 'Unknown error');

  return {
    success: stored > 0,
    stored,
    errors
  };
}

// ================================================================
// RAG QUERY FUNCTIONS
// ================================================================

/**
 * Search Q&A knowledge base for relevant context
 * Used when SAM needs to ask clarifying questions or reference past answers
 */
export async function searchQAKnowledge(
  workspaceId: string,
  query: string,
  options?: {
    stage?: string;
    category?: string;
    limit?: number;
  }
): Promise<{ success: boolean; results?: RAGSearchResult[]; error?: string }> {
  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Call the stored procedure
    const { data, error } = await supabase.rpc('search_icp_knowledge', {
      p_workspace_id: workspaceId,
      p_query_embedding: JSON.stringify(queryEmbedding),
      p_stage: options?.stage || null,
      p_category: options?.category || null,
      p_limit: options?.limit || 5
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, results: data || [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Get complete Q&A history for a discovery session
 */
export async function getQAHistory(
  discoverySessionId: string
): Promise<{ success: boolean; history?: Array<{
  question_id: string;
  question_text: string;
  answer_text: string;
  stage: string;
  category: string;
  created_at: string;
}>; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('get_discovery_qa_history', {
      p_discovery_session_id: discoverySessionId
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, history: data || [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Get prospecting criteria Q&A for campaign setup
 */
export async function getProspectingCriteria(
  workspaceId: string,
  userId: string
): Promise<{ success: boolean; criteria?: Array<{
  question_id: string;
  answer_text: string;
  answer_structured: Record<string, any>;
}>; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('get_prospecting_criteria', {
      p_workspace_id: workspaceId,
      p_user_id: userId
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, criteria: data || [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Get all Q&A for a specific category
 */
export async function getQAByCategory(
  workspaceId: string,
  category: string
): Promise<{ success: boolean; results?: StoredQA[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('sam_icp_knowledge_entries')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('category', category)
      .order('created_at', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, results: data || [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Get Q&A that need clarification
 */
export async function getQANeedingClarification(
  workspaceId: string,
  userId: string
): Promise<{ success: boolean; results?: StoredQA[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('sam_icp_knowledge_entries')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('needs_clarification', true)
      .order('created_at', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, results: data || [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ================================================================
// EMBEDDING GENERATION
// ================================================================

/**
 * Generate vector embedding for RAG
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com',
        'X-Title': 'SAM Q&A Knowledge Storage'
      },
      body: JSON.stringify({
        model: 'openai/text-embedding-3-small',
        input: text
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('❌ Embedding generation failed:', error);
    // Return zero vector as fallback
    return new Array(1536).fill(0);
  }
}

// ================================================================
// CONTEXT BUILDING FOR SAM
// ================================================================

/**
 * Build context string from stored Q&A for SAM to reference
 */
export async function buildContextFromQA(
  workspaceId: string,
  query: string,
  options?: {
    includeStage?: string;
    includeCategory?: string;
    limit?: number;
  }
): Promise<string> {
  const { results } = await searchQAKnowledge(workspaceId, query, {
    stage: options?.includeStage,
    category: options?.includeCategory,
    limit: options?.limit || 5
  });

  if (!results || results.length === 0) {
    return '';
  }

  const contextLines = results.map(r =>
    `Previously asked: "${r.question_text}"\nUser answered: "${r.answer_text}"`
  );

  return `\nREFERENCE FROM PAST CONVERSATION:\n${contextLines.join('\n\n')}`;
}

/**
 * Get summary of all stored knowledge for a workspace
 */
export async function getKnowledgeSummary(
  workspaceId: string
): Promise<{
  totalQuestions: number;
  byStage: Record<string, number>;
  byCategory: Record<string, number>;
  needingClarification: number;
  shallow: number;
}> {
  try {
    const { data } = await supabase
      .from('sam_icp_knowledge_entries')
      .select('stage, category, is_shallow, needs_clarification')
      .eq('workspace_id', workspaceId);

    if (!data) {
      return {
        totalQuestions: 0,
        byStage: {},
        byCategory: {},
        needingClarification: 0,
        shallow: 0
      };
    }

    const byStage: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let needingClarification = 0;
    let shallow = 0;

    data.forEach(item => {
      byStage[item.stage] = (byStage[item.stage] || 0) + 1;
      byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      if (item.needs_clarification) needingClarification++;
      if (item.is_shallow) shallow++;
    });

    return {
      totalQuestions: data.length,
      byStage,
      byCategory,
      needingClarification,
      shallow
    };
  } catch (error) {
    console.error('Error getting knowledge summary:', error);
    return {
      totalQuestions: 0,
      byStage: {},
      byCategory: {},
      needingClarification: 0,
      shallow: 0
    };
  }
}
