/**
 * Real-Time KB Updates
 * Updates KB immediately as SAM asks questions and user answers
 */

import { createClient } from '@supabase/supabase-js';
import { storeQAInKnowledgeBase, type QuestionAnswer } from './sam-kb-integration';
import { calculateConfidenceScore, getInitialValidationStatus } from './kb-confidence-calculator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Extract Q&A from conversation message
 */
export function extractQAFromConversation(
  assistantQuestion: string,
  userAnswer: string,
  conversationContext?: {
    stage?: string;
    category?: string;
  }
): QuestionAnswer | null {
  // Skip if answer is too short or generic
  if (userAnswer.length < 10) return null;
  if (['ok', 'yes', 'no', 'sure', 'great'].includes(userAnswer.toLowerCase().trim())) {
    return null;
  }

  // Detect question category from assistant message
  const category = detectQuestionCategory(assistantQuestion);
  if (!category) return null;

  // Extract structured data if possible
  const structured = extractStructuredAnswer(userAnswer, category);

  return {
    questionId: generateQuestionId(assistantQuestion),
    questionText: assistantQuestion,
    answerText: userAnswer,
    answerStructured: structured,
    category,
    stage: conversationContext?.stage || 'discovery',
    confidenceScore: 0.95, // High confidence for direct user input
    sourceAttachmentId: null
  };
}

/**
 * Detect question category from assistant's question
 */
function detectQuestionCategory(question: string): string | null {
  const q = question.toLowerCase();

  // ICP-related
  if (q.includes('ideal customer') || q.includes('target') || q.includes('who should')) {
    return 'icp_definition';
  }
  if (q.includes('pain point') || q.includes('challenge') || q.includes('struggle')) {
    return 'pain_points';
  }
  if (q.includes('industry') || q.includes('sector') || q.includes('market')) {
    return 'target_industry';
  }
  if (q.includes('role') || q.includes('title') || q.includes('decision maker')) {
    return 'target_role';
  }

  // Product-related
  if (q.includes('product') || q.includes('service') || q.includes('offer')) {
    return 'products';
  }
  if (q.includes('pricing') || q.includes('cost') || q.includes('price')) {
    return 'pricing';
  }

  // Messaging-related
  if (q.includes('differentiation') || q.includes('unique') || q.includes('different')) {
    return 'messaging';
  }
  if (q.includes('value proposition') || q.includes('benefit')) {
    return 'messaging';
  }

  // Competition
  if (q.includes('competitor') || q.includes('alternative') || q.includes('compare')) {
    return 'competition';
  }

  // Objections
  if (q.includes('objection') || q.includes('pushback') || q.includes('concern')) {
    return 'objections';
  }

  return 'general';
}

/**
 * Generate question ID from question text
 */
function generateQuestionId(question: string): string {
  // Create a simple ID from first few words
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 3)
    .join('_');

  return words || 'question';
}

/**
 * Extract structured data from answer
 */
function extractStructuredAnswer(answer: string, category: string): any | null {
  try {
    // Try to extract lists
    if (category === 'pain_points' || category === 'objections') {
      // Look for numbered lists or bullet points
      const lines = answer.split('\n').filter(l => l.trim());
      const items = lines
        .filter(l => /^[\d\-\*\•]/.test(l.trim()))
        .map(l => l.replace(/^[\d\-\*\•\.\)]\s*/, '').trim());

      if (items.length > 0) {
        return category === 'pain_points'
          ? { pain_points: items.map(i => ({ description: i })) }
          : { objections: items };
      }
    }

    // Extract comma-separated lists
    if (category === 'target_industry' || category === 'target_role') {
      const items = answer
        .split(/[,;]/)
        .map(i => i.trim())
        .filter(i => i.length > 0);

      if (items.length > 1) {
        return category === 'target_industry'
          ? { industries: items }
          : { job_titles: items };
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting structured answer:', error);
    return null;
  }
}

/**
 * Update KB in real-time as conversation progresses
 */
export async function updateKBRealtime(
  workspaceId: string,
  userId: string,
  assistantMessage: string,
  userMessage: string,
  discoverySessionId?: string
): Promise<{ success: boolean; updated: boolean; error?: string }> {
  try {
    // Extract Q&A from messages
    const qa = extractQAFromConversation(assistantMessage, userMessage);

    if (!qa) {
      return { success: true, updated: false }; // Not a Q&A exchange
    }

    // Store in KB immediately
    const result = await storeQAInKnowledgeBase(
      workspaceId,
      userId,
      discoverySessionId,
      qa
    );

    if (result.success) {
      console.log(`✅ Real-time KB update: ${qa.questionId} → ${qa.category}`);

      // Update ICP completion percentage if relevant
      if (isICPRelatedCategory(qa.category)) {
        await updateICPCompletionPercentage(workspaceId);
      }

      return { success: true, updated: true };
    }

    return { success: false, updated: false, error: result.error };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Real-time KB update failed:', message);
    return { success: false, updated: false, error: message };
  }
}

/**
 * Check if category is ICP-related
 */
function isICPRelatedCategory(category: string): boolean {
  const icpCategories = [
    'icp_definition',
    'pain_points',
    'target_industry',
    'target_role',
    'objectives',
    'focus_areas'
  ];
  return icpCategories.includes(category);
}

/**
 * Update ICP completion percentage
 */
async function updateICPCompletionPercentage(workspaceId: string): Promise<void> {
  try {
    // Get current ICP
    const { data: icp } = await supabase
      .from('knowledge_base_icps')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!icp) return;

    // Calculate completion based on filled fields
    const requiredFields = [
      'industries',
      'job_titles',
      'pain_points',
      'company_size_min',
      'company_size_max',
      'locations',
      'qualification_criteria'
    ];

    const filledFields = requiredFields.filter(field => {
      const value = icp[field];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object') return Object.keys(value || {}).length > 0;
      return value != null && value !== '';
    });

    const completionPercentage = Math.round((filledFields.length / requiredFields.length) * 100);

    // Update ICP
    await supabase
      .from('knowledge_base_icps')
      .update({
        completion_percentage: completionPercentage,
        updated_at: new Date().toISOString()
      })
      .eq('id', icp.id);

    console.log(`📊 ICP completion updated: ${completionPercentage}%`);
  } catch (error) {
    console.error('Failed to update ICP completion:', error);
  }
}

/**
 * Get KB update progress message for SAM
 */
export async function getKBProgressMessage(workspaceId: string): Promise<string | null> {
  try {
    const { data: icp } = await supabase
      .from('knowledge_base_icps')
      .select('completion_percentage')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!icp) return null;

    const percentage = icp.completion_percentage || 0;

    if (percentage < 30) {
      return `(Your ICP is ${percentage}% complete - we're just getting started!)`;
    } else if (percentage < 70) {
      return `(Great! Your ICP is now ${percentage}% complete.)`;
    } else if (percentage < 100) {
      return `(Nice! Your ICP is ${percentage}% complete - almost there!)`;
    } else {
      return `(Perfect! Your ICP is 100% complete. ✅)`;
    }
  } catch (error) {
    return null;
  }
}
