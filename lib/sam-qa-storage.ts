/**
 * SAM Q&A Storage and RAG Integration
 *
 * Stores all question-answer pairs from SAM conversations for:
 * 1. Reference when asking clarifying questions
 * 2. Context retrieval when setting up campaigns
 * 3. Building comprehensive knowledge base per user/workspace
 */

import { pool } from '@/lib/auth';

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
    const embeddingVector = `[${embedding.join(',')}]`;

    // Try insert first
    try {
      const { rows } = await pool.query(
        `INSERT INTO sam_icp_knowledge_entries (
          workspace_id, user_id, discovery_session_id, question_id,
          question_text, answer_text, answer_structured, stage, category,
          confidence_score, is_shallow, needs_clarification, clarification_notes,
          source_attachment_id, embedding, indexed_for_rag
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true)
        RETURNING *`,
        [
          workspaceId, userId, discoverySessionId, qa.questionId,
          qa.questionText, qa.answerText, JSON.stringify(qa.answerStructured || {}),
          qa.stage, qa.category, qa.confidenceScore ?? 1.0,
          qa.isShallow ?? false, qa.needsClarification ?? false, qa.clarificationNotes,
          qa.sourceAttachmentId || null, embeddingVector
        ]
      );
      return { success: true, data: rows[0] as StoredQA };
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        return updateQuestionAnswer(workspaceId, userId, discoverySessionId, qa);
      }
      throw error;
    }
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
    const embeddingVector = `[${embedding.join(',')}]`;

    const { rows } = await pool.query(
      `UPDATE sam_icp_knowledge_entries
       SET answer_text = $1,
           answer_structured = $2,
           confidence_score = $3,
           is_shallow = $4,
           needs_clarification = $5,
           clarification_notes = $6,
           embedding = $7,
           updated_at = NOW()
       WHERE workspace_id = $8 AND user_id = $9 AND question_id = $10
       RETURNING *`,
      [
        qa.answerText, JSON.stringify(qa.answerStructured || {}),
        qa.confidenceScore ?? 1.0, qa.isShallow ?? false,
        qa.needsClarification ?? false, qa.clarificationNotes,
        embeddingVector, workspaceId, userId, qa.questionId
      ]
    );

    return { success: true, data: rows[0] as StoredQA };
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
 * Replaces search_icp_knowledge RPC
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
    const queryEmbedding = await generateEmbedding(query);
    const embeddingVector = `[${queryEmbedding.join(',')}]`;
    const limit = options?.limit || 5;

    let sql = `
      SELECT 
        question_id, question_text, answer_text, answer_structured,
        stage, category, confidence_score,
        1 - (embedding <=> $2) as similarity
      FROM sam_icp_knowledge_entries
      WHERE workspace_id = $1
    `;

    const params: any[] = [workspaceId, embeddingVector];
    let paramIndex = 3;

    if (options?.stage) {
      sql += ` AND stage = $${paramIndex}`;
      params.push(options.stage);
      paramIndex++;
    }

    if (options?.category) {
      sql += ` AND category = $${paramIndex}`;
      params.push(options.category);
      paramIndex++;
    }

    sql += ` ORDER BY embedding <=> $2 LIMIT $${paramIndex}`;
    params.push(limit);

    const { rows } = await pool.query(sql, params);

    return { success: true, results: rows as RAGSearchResult[] };
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
): Promise<{
  success: boolean; history?: Array<{
    question_id: string;
    question_text: string;
    answer_text: string;
    stage: string;
    category: string;
    created_at: string;
  }>; error?: string
}> {
  try {
    const { rows } = await pool.query(
      `SELECT question_id, question_text, answer_text, stage, category, created_at
       FROM sam_icp_knowledge_entries
       WHERE discovery_session_id = $1
       ORDER BY created_at ASC`,
      [discoverySessionId]
    );
    return { success: true, history: rows };
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
): Promise<{
  success: boolean; criteria?: Array<{
    question_id: string;
    answer_text: string;
    answer_structured: Record<string, any>;
  }>; error?: string
}> {
  try {
    // Replaces get_prospecting_criteria RPC
    // Assuming it fetches items with category 'prospecting_criteria' or similar
    const { rows } = await pool.query(
      `SELECT question_id, answer_text, answer_structured
       FROM sam_icp_knowledge_entries
       WHERE workspace_id = $1 AND user_id = $2
         AND category IN ('prospecting', 'prospecting_criteria')`,
      [workspaceId, userId]
    );
    return { success: true, criteria: rows };
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
    const { rows } = await pool.query(
      `SELECT * FROM sam_icp_knowledge_entries
       WHERE workspace_id = $1 AND category = $2
       ORDER BY created_at ASC`,
      [workspaceId, category]
    );
    return { success: true, results: rows as StoredQA[] };
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
    const { rows } = await pool.query(
      `SELECT * FROM sam_icp_knowledge_entries
       WHERE workspace_id = $1 AND user_id = $2 AND needs_clarification = true
       ORDER BY created_at ASC`,
      [workspaceId, userId]
    );
    return { success: true, results: rows as StoredQA[] };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ================================================================
// EMBEDDING GENERATION
// ================================================================

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const truncatedText = text.slice(0, 10000);
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
      // Fallback or rethrow
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const embedding = data.embedding?.values || [];

    if (embedding.length === 0) throw new Error('Gemini returned empty embedding');

    // Pad/Truncate to 1536
    if (embedding.length < 1536) {
      return [...embedding, ...Array(1536 - embedding.length).fill(0)];
    } else if (embedding.length > 1536) {
      return embedding.slice(0, 1536);
    }
    return embedding;
  } catch (error) {
    console.error('❌ Embedding generation failed:', error);
    return new Array(1536).fill(0);
  }
}

// ================================================================
// CONTEXT BUILDING FOR SAM
// ================================================================

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
    const { rows } = await pool.query(
      `SELECT stage, category, is_shallow, needs_clarification
       FROM sam_icp_knowledge_entries
       WHERE workspace_id = $1`,
      [workspaceId]
    );

    const byStage: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let needingClarification = 0;
    let shallow = 0;

    rows.forEach((item: any) => {
      byStage[item.stage] = (byStage[item.stage] || 0) + 1;
      byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      if (item.needs_clarification) needingClarification++;
      if (item.is_shallow) shallow++;
    });

    return {
      totalQuestions: rows.length,
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
