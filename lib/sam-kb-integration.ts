/**
 * SAM Knowledge Base Integration
 *
 * Ensures Q&A data is stored in BOTH:
 * 1. sam_icp_knowledge_entries (for RAG/semantic search)
 * 2. Knowledge base tables (for structured KB access in the app)
 */

import { supabaseKnowledge } from './supabase-knowledge';
import { storeQuestionAnswer, type QuestionAnswer } from './sam-qa-storage';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ================================================================
// DUAL STORAGE: Q&A Table + Knowledge Base Tables
// ================================================================

/**
 * Store Q&A in both sam_icp_knowledge_entries AND appropriate KB table
 */
export async function storeQAInKnowledgeBase(
  workspaceId: string,
  userId: string,
  discoverySessionId: string | undefined,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Store in sam_icp_knowledge_entries for RAG
    const qaResult = await storeQuestionAnswer(workspaceId, userId, discoverySessionId, qa);

    if (!qaResult.success) {
      return { success: false, error: `Q&A storage failed: ${qaResult.error}` };
    }

    // 2. Store in appropriate KB table based on category
    const kbResult = await updateKnowledgeBaseFromQA(workspaceId, userId, qa);

    if (!kbResult.success) {
      console.error('KB update failed but Q&A was stored:', kbResult.error);
      // Don't fail the whole operation - Q&A is already stored
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Update appropriate KB table based on Q&A category
 */
async function updateKnowledgeBaseFromQA(
  workspaceId: string,
  userId: string,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (qa.category) {
      case 'icp_definition':
      case 'pain_points':
      case 'objectives':
      case 'focus_areas':
        return await updateICPKnowledgeBase(workspaceId, userId, qa);

      case 'objections':
      case 'customer_language':
      case 'messaging':
        return await updateMessagingKnowledgeBase(workspaceId, userId, qa);

      case 'prospecting_criteria':
      case 'buying_process':
        return await updateProspectingKnowledgeBase(workspaceId, userId, qa);

      case 'business_model':
      case 'company_info':
        return await updateBusinessModelKnowledgeBase(workspaceId, userId, qa);

      case 'linkedin_profile':
        return await updateLinkedInKnowledgeBase(workspaceId, userId, qa);

      case 'content_strategy':
      case 'tone_of_voice':
        return await updateContentKnowledgeBase(workspaceId, userId, qa);

      case 'products':
        return await updateProductsKnowledgeBase(workspaceId, userId, qa);

      case 'pricing':
        return await updatePricingKnowledgeBase(workspaceId, userId, qa);

      case 'personas':
        return await updatePersonasKnowledgeBase(workspaceId, userId, qa);

      case 'competition':
        return await updateCompetitionKnowledgeBase(workspaceId, userId, qa);

      case 'success_stories':
      case 'metrics':
        return await updateSuccessStoriesKnowledgeBase(workspaceId, userId, qa);

      case 'fears':
      case 'frustrations':
      case 'implications':
      case 'disappointments':
      case 'failures':
        return await updateEmotionalBarriersKnowledgeBase(workspaceId, userId, qa);

      case 'compliance':
        return await updateComplianceKnowledgeBase(workspaceId, userId, qa);

      case 'inquiry_responses':
        return await updateInquiryResponsesKnowledgeBase(workspaceId, userId, qa);

      default:
        // Store in general knowledge_base table
        return await updateGeneralKnowledgeBase(workspaceId, qa);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ================================================================
// KB TABLE UPDATES
// ================================================================

/**
 * Update knowledge_base_icps table with ICP Q&A
 */
async function updateICPKnowledgeBase(
  workspaceId: string,
  userId: string,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get or create ICP record for this workspace
    const { data: existingICP } = await supabase
      .from('knowledge_base_icps')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const updates: any = {
      workspace_id: workspaceId,
      created_by: userId,
      is_active: true
    };

    // Map Q&A to ICP fields
    if (qa.questionId === 'pain_points' && qa.answerStructured?.pain_points) {
      updates.pain_points = qa.answerStructured.pain_points.map((p: any) => p.description);
    } else if (qa.questionId === 'basic_icp') {
      // Parse basic ICP (role, industry, company size)
      updates.description = qa.answerText;
    } else if (qa.questionId === 'objectives') {
      updates.qualification_criteria = {
        ...existingICP?.qualification_criteria,
        objectives: qa.answerStructured?.objectives || qa.answerText
      };
    } else if (qa.questionId === 'objective_urgency') {
      updates.qualification_criteria = {
        ...existingICP?.qualification_criteria,
        urgency: qa.answerText
      };
    } else if (qa.questionId === 'focus_areas') {
      updates.qualification_criteria = {
        ...existingICP?.qualification_criteria,
        focus_areas: qa.answerStructured?.focus_areas || qa.answerText
      };
    } else if (qa.questionId === 'focus_positioning') {
      updates.messaging_framework = {
        ...existingICP?.messaging_framework,
        positioning: qa.answerText
      };
    } else if (qa.questionId === 'long_term_desire') {
      updates.qualification_criteria = {
        ...existingICP?.qualification_criteria,
        long_term_desire: qa.answerText
      };
    } else if (qa.questionId === 'pain_cost') {
      updates.pain_points = existingICP?.pain_points?.map((p: any, index: number) =>
        index === 0 ? { ...p, cost: qa.answerText } : p
      ) || [];
    } else if (qa.questionId === 'current_solution') {
      updates.qualification_criteria = {
        ...existingICP?.qualification_criteria,
        current_solution: qa.answerText
      };
    } else if (qa.questionId === 'current_solution_gap') {
      updates.qualification_criteria = {
        ...existingICP?.qualification_criteria,
        solution_gap: qa.answerText
      };
    } else if (qa.questionId === 'solution_expectation') {
      updates.qualification_criteria = {
        ...existingICP?.qualification_criteria,
        expectation: qa.answerText
      };
    } else if (qa.questionId === 'objections') {
      updates.messaging_framework = {
        ...existingICP?.messaging_framework,
        objections: qa.answerStructured?.objections || qa.answerText
      };
    } else if (qa.questionId === 'target_industry') {
      updates.industries = Array.isArray(qa.answerStructured?.industries)
        ? qa.answerStructured.industries
        : [qa.answerText];
    } else if (qa.questionId === 'target_role') {
      updates.job_titles = Array.isArray(qa.answerStructured?.job_titles)
        ? qa.answerStructured.job_titles
        : [qa.answerText];
    }

    if (existingICP) {
      // Update existing ICP
      await supabase
        .from('knowledge_base_icps')
        .update(updates)
        .eq('id', existingICP.id);
    } else {
      // Create new ICP
      updates.name = `ICP - ${new Date().toISOString().split('T')[0]}`;
      await supabase
        .from('knowledge_base_icps')
        .insert(updates);
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Update prospecting criteria in knowledge base
 */
async function updateProspectingKnowledgeBase(
  workspaceId: string,
  userId: string,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string }> {
  try {
    // Store prospecting criteria in ICP qualification_criteria
    const { data: existingICP } = await supabase
      .from('knowledge_base_icps')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const prospectingKey = qa.questionId.replace('prospecting_', '');

    const updates = {
      qualification_criteria: {
        ...existingICP?.qualification_criteria,
        prospecting: {
          ...(existingICP?.qualification_criteria as any)?.prospecting,
          [prospectingKey]: qa.answerStructured || qa.answerText
        }
      }
    };

    if (existingICP) {
      await supabase
        .from('knowledge_base_icps')
        .update(updates)
        .eq('id', existingICP.id);
    } else {
      await supabase
        .from('knowledge_base_icps')
        .insert({
          workspace_id: workspaceId,
          created_by: userId,
          name: `ICP - ${new Date().toISOString().split('T')[0]}`,
          is_active: true,
          ...updates
        });
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Update business model in knowledge base
 */
async function updateBusinessModelKnowledgeBase(
  workspaceId: string,
  userId: string,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string }> {
  try {
    // Store in knowledge_base with category 'business-model'
    await supabaseKnowledge.addKnowledgeItem({
      workspace_id: workspaceId,
      category: 'business-model',
      subcategory: qa.questionId,
      title: qa.questionText,
      content: qa.answerText,
      tags: [qa.stage, qa.category, qa.questionId],
      version: '1.0',
      is_active: true
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Update LinkedIn profile data in knowledge base
 */
async function updateLinkedInKnowledgeBase(
  workspaceId: string,
  userId: string,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string }> {
  try {
    // Store LinkedIn profile data
    await supabaseKnowledge.addKnowledgeItem({
      workspace_id: workspaceId,
      category: 'linkedin-profile',
      subcategory: qa.questionId,
      title: qa.questionText,
      content: qa.answerText,
      tags: ['linkedin', 'profile', qa.questionId],
      version: '1.0',
      is_active: true
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Update content strategy in knowledge base
 */
async function updateContentKnowledgeBase(
  workspaceId: string,
  userId: string,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string }> {
  try {
    await supabaseKnowledge.addKnowledgeItem({
      workspace_id: workspaceId,
      category: 'content-strategy',
      subcategory: qa.questionId,
      title: qa.questionText,
      content: qa.answerText,
      tags: ['content', 'strategy', qa.questionId],
      version: '1.0',
      is_active: true
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Update general knowledge base
 */
async function updateGeneralKnowledgeBase(
  workspaceId: string,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string }> {
  try {
    await supabaseKnowledge.addKnowledgeItem({
      workspace_id: workspaceId,
      category: 'icp-discovery',
      subcategory: qa.category,
      title: qa.questionText,
      content: qa.answerText,
      tags: [qa.stage, qa.category, qa.questionId],
      version: '1.0',
      is_active: true,
      source_attachment_id: qa.sourceAttachmentId || null,
      source_type: qa.sourceAttachmentId ? 'document_upload' : 'sam_discovery',
      source_metadata: {
        question_id: qa.questionId,
        stage: qa.stage,
        category: qa.category,
        confidence_score: qa.confidenceScore
      }
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Update messaging framework in knowledge base
 */
async function updateMessagingKnowledgeBase(
  workspaceId: string,
  userId: string,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string }> {
  try {
    await supabaseKnowledge.addKnowledgeItem({
      workspace_id: workspaceId,
      category: 'messaging',
      subcategory: qa.questionId,
      title: qa.questionText,
      content: qa.answerText,
      tags: ['messaging', qa.category, qa.questionId],
      version: '1.0',
      is_active: true
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Update products in knowledge base
 */
async function updateProductsKnowledgeBase(
  workspaceId: string,
  userId: string,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string }> {
  try {
    await supabaseKnowledge.addKnowledgeItem({
      workspace_id: workspaceId,
      category: 'products',
      subcategory: qa.questionId,
      title: qa.questionText,
      content: qa.answerText,
      tags: ['products', qa.questionId],
      version: '1.0',
      is_active: true
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Update pricing in knowledge base
 */
async function updatePricingKnowledgeBase(
  workspaceId: string,
  userId: string,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string }> {
  try {
    await supabaseKnowledge.addKnowledgeItem({
      workspace_id: workspaceId,
      category: 'pricing',
      subcategory: qa.questionId,
      title: qa.questionText,
      content: qa.answerText,
      tags: ['pricing', qa.questionId],
      version: '1.0',
      is_active: true
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Update personas in knowledge base
 */
async function updatePersonasKnowledgeBase(
  workspaceId: string,
  userId: string,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string }> {
  try {
    await supabaseKnowledge.addKnowledgeItem({
      workspace_id: workspaceId,
      category: 'personas',
      subcategory: qa.questionId,
      title: qa.questionText,
      content: qa.answerText,
      tags: ['personas', qa.questionId],
      version: '1.0',
      is_active: true
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Update competition in knowledge base
 */
async function updateCompetitionKnowledgeBase(
  workspaceId: string,
  userId: string,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string }> {
  try {
    await supabaseKnowledge.addKnowledgeItem({
      workspace_id: workspaceId,
      category: 'competition',
      subcategory: qa.questionId,
      title: qa.questionText,
      content: qa.answerText,
      tags: ['competition', qa.questionId],
      version: '1.0',
      is_active: true
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Update success stories and metrics in knowledge base
 */
async function updateSuccessStoriesKnowledgeBase(
  workspaceId: string,
  userId: string,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string }> {
  try {
    await supabaseKnowledge.addKnowledgeItem({
      workspace_id: workspaceId,
      category: 'success',
      subcategory: qa.questionId,
      title: qa.questionText,
      content: qa.answerText,
      tags: ['success-stories', 'metrics', qa.questionId],
      version: '1.0',
      is_active: true
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Update emotional barriers (fears, frustrations, etc.) in knowledge base
 */
async function updateEmotionalBarriersKnowledgeBase(
  workspaceId: string,
  userId: string,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string }> {
  try {
    await supabaseKnowledge.addKnowledgeItem({
      workspace_id: workspaceId,
      category: 'emotional-barriers',
      subcategory: qa.category,
      title: qa.questionText,
      content: qa.answerText,
      tags: ['emotional-intelligence', qa.category, qa.questionId],
      version: '1.0',
      is_active: true
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Update compliance in knowledge base
 */
async function updateComplianceKnowledgeBase(
  workspaceId: string,
  userId: string,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string }> {
  try {
    await supabaseKnowledge.addKnowledgeItem({
      workspace_id: workspaceId,
      category: 'compliance',
      subcategory: qa.questionId,
      title: qa.questionText,
      content: qa.answerText,
      tags: ['compliance', 'legal', qa.questionId],
      version: '1.0',
      is_active: true
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Update inquiry responses in knowledge base
 */
async function updateInquiryResponsesKnowledgeBase(
  workspaceId: string,
  userId: string,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string }> {
  try {
    await supabaseKnowledge.addKnowledgeItem({
      workspace_id: workspaceId,
      category: 'inquiry_responses',
      subcategory: qa.questionId,
      title: qa.questionText,
      content: qa.answerText,
      tags: ['inquiry', 'faq', qa.questionId],
      version: '1.0',
      is_active: true
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ================================================================
// BATCH OPERATIONS
// ================================================================

/**
 * Batch store multiple Q&As in both systems
 */
export async function batchStoreQAInKnowledgeBase(
  workspaceId: string,
  userId: string,
  discoverySessionId: string | undefined,
  qaList: QuestionAnswer[]
): Promise<{ success: boolean; stored: number; errors: string[] }> {
  const results = await Promise.all(
    qaList.map(qa => storeQAInKnowledgeBase(workspaceId, userId, discoverySessionId, qa))
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
// RETRIEVAL FROM KB
// ================================================================

/**
 * Get comprehensive ICP data from knowledge base
 */
export async function getICPFromKnowledgeBase(
  workspaceId: string
): Promise<{
  icp: any;
  qas: Array<{ question: string; answer: string; category: string }>;
}> {
  try {
    // Get ICP from knowledge_base_icps
    const icps = await supabaseKnowledge.getICPs({ workspaceId });
    const icp = icps.length > 0 ? icps[0] : null;

    // Get all Q&As from sam_icp_knowledge_entries
    const { data: qas } = await supabase
      .from('sam_icp_knowledge_entries')
      .select('question_text, answer_text, category, stage')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    return {
      icp,
      qas: (qas || []).map(qa => ({
        question: qa.question_text,
        answer: qa.answer_text,
        category: qa.category
      }))
    };
  } catch (error) {
    console.error('Error getting ICP from KB:', error);
    return { icp: null, qas: [] };
  }
}

/**
 * Get prospecting criteria from knowledge base
 */
export async function getProspectingFromKnowledgeBase(
  workspaceId: string
): Promise<Record<string, any>> {
  try {
    const icps = await supabaseKnowledge.getICPs({ workspaceId });
    const icp = icps.length > 0 ? icps[0] : null;

    return (icp?.qualification_criteria as any)?.prospecting || {};
  } catch (error) {
    console.error('Error getting prospecting criteria from KB:', error);
    return {};
  }
}

/**
 * Get all knowledge base data for SAM context
 */
export async function getFullKnowledgeBaseContext(
  workspaceId: string
): Promise<{
  icp: any;
  products: any[];
  competitors: any[];
  personas: any[];
  businessModel: any[];
  linkedinProfile: any[];
  contentStrategy: any[];
}> {
  try {
    const [icps, products, competitors, personas, businessModel, linkedinProfile, contentStrategy] = await Promise.all([
      supabaseKnowledge.getICPs({ workspaceId }),
      supabaseKnowledge.getProducts({ workspaceId }),
      supabaseKnowledge.getCompetitors({ workspaceId }),
      supabaseKnowledge.getPersonas({ workspaceId }),
      supabaseKnowledge.getByCategory({ category: 'business-model', workspaceId }),
      supabaseKnowledge.getByCategory({ category: 'linkedin-profile', workspaceId }),
      supabaseKnowledge.getByCategory({ category: 'content-strategy', workspaceId })
    ]);

    return {
      icp: icps.length > 0 ? icps[0] : null,
      products: products || [],
      competitors: competitors || [],
      personas: personas || [],
      businessModel: businessModel || [],
      linkedinProfile: linkedinProfile || [],
      contentStrategy: contentStrategy || []
    };
  } catch (error) {
    console.error('Error getting full KB context:', error);
    return {
      icp: null,
      products: [],
      competitors: [],
      personas: [],
      businessModel: [],
      linkedinProfile: [],
      contentStrategy: []
    };
  }
}

/**
 * Build context string from KB for SAM's system prompt
 * Includes detection of auto-detected items that need validation
 */
export async function buildKBContextForSAM(
  workspaceId: string
): Promise<string> {
  const kb = await getFullKnowledgeBaseContext(workspaceId);

  const contextParts: string[] = [];

  // Check for auto-detected items that need validation
  const { data: needsValidation } = await supabase
    .from('knowledge_base')
    .select('id, category, title, content, source_metadata')
    .eq('workspace_id', workspaceId)
    .contains('tags', ['needs-validation'])
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  // If we have auto-detected items, prioritize validation
  if (needsValidation && needsValidation.length > 0) {
    contextParts.push(`\n🔍 **WEBSITE INTELLIGENCE - NEEDS VALIDATION**

I analyzed your website and made some initial assumptions. These need to be confirmed conversationally - don't just list them, validate them naturally during the interview:
`);

    needsValidation.forEach((item: any) => {
      const metadata = item.source_metadata || {};
      const validationPrompts = metadata.sam_validation_prompts || [];

      contextParts.push(`
**${item.category.toUpperCase()}:** ${item.content.substring(0, 200)}${item.content.length > 200 ? '...' : ''}

VALIDATION APPROACH (pick one conversationally):
${validationPrompts.map((prompt: string, i: number) => `${i + 1}. "${prompt}"`).join('\n')}
`);
    });

    contextParts.push(`
**CRITICAL INSTRUCTIONS FOR VALIDATION:**
- Work these validation questions into the natural flow of discovery
- DON'T say "I need to validate something" - just ask conversationally
- Start with 1-2 validation questions early in the conversation (within first 5 messages)
- If they correct anything, update your understanding immediately
- Once validated, use the confirmed information confidently
- Businesses often target new markets not reflected on websites - probe for this
`);
  }

  // Standard KB context
  if (kb.icp) {
    contextParts.push(`\n**ICP:**
- Industries: ${kb.icp.industries?.join(', ') || 'Not specified'}
- Job Titles: ${kb.icp.job_titles?.join(', ') || 'Not specified'}
- Pain Points: ${kb.icp.pain_points?.join(', ') || 'Not specified'}
- Company Size: ${kb.icp.company_size_min || '?'}-${kb.icp.company_size_max || '?'} employees`);
  }

  if (kb.products.length > 0) {
    const productNames = kb.products.map(p => p.name).join(', ');
    contextParts.push(`**Products:** ${productNames}`);
  }

  if (kb.competitors.length > 0) {
    const competitorNames = kb.competitors.map(c => c.name).join(', ');
    contextParts.push(`**Competitors:** ${competitorNames}`);
  }

  if (kb.personas.length > 0) {
    const personaNames = kb.personas.map(p => `${p.name} (${p.job_title})`).join(', ');
    contextParts.push(`**Personas:** ${personaNames}`);
  }

  if (contextParts.length === 0) {
    return '';
  }

  return `\n**KNOWLEDGE BASE CONTEXT:**\n${contextParts.join('\n')}\n`;
}
