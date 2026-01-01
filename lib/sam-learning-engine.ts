/**
 * SAM AI Learning Engine
 *
 * Continuous learning system that improves Sam's accuracy and recommendations:
 * 1. Extracts validated insights from client conversations
 * 2. Identifies patterns across workspaces (industry-specific)
 * 3. Builds global knowledge base from successful strategies
 * 4. Applies learned insights to new clients
 *
 * Privacy: Only validated, non-sensitive insights are shared across workspaces
 *
 * Updated Nov 29, 2025: Migrated to Claude Direct API for GDPR compliance
 */

import { pool } from '@/lib/db';
import { Industry } from './signup-intelligence';
import { claudeClient } from '@/lib/llm/claude-client';

// Pool imported from lib/db
export interface LearningInsight {
  id?: string;
  insight_type: 'value_prop' | 'objection' | 'messaging' | 'icp_criteria' | 'campaign_strategy' | 'pain_point' | 'competitive_positioning';
  industry: Industry;
  cross_industry_applicable?: boolean;
  insight_content: string;
  confidence_score: number; // 0-1, based on validation count
  validation_count: number;
  source_workspaces_count: number; // How many workspaces validated this
  first_observed: string;
  last_validated: string;
  related_industries?: Industry[];
  tags: string[];
}

interface ConversationExtraction {
  workspace_id: string;
  industry: Industry;
  extracted_insights: LearningInsight[];
  conversation_summary: string;
}

/**
 * Extract learning insights from a validated conversation thread
 */
export async function extractLearningFromConversation(params: {
  threadId: string;
  workspaceId: string;
  userId: string;
  industry: Industry;
}): Promise<{ success: boolean; insights_extracted: number; insights: LearningInsight[] }> {
  
  console.log(`🧠 Extracting learning insights from thread ${params.threadId}...`);

  try {
    // Get conversation messages
    const { data: messages } = await pool
      .from('sam_conversation_messages')
      .select('*')
      .eq('thread_id', params.threadId)
      .order('message_order', { ascending: true });

    if (!messages || messages.length < 4) {
      return { success: false, insights_extracted: 0, insights: [] };
    }

    // Get validated KB entries from this workspace
    const { data: validatedEntries } = await pool
      .from('knowledge_base')
      .select('*')
      .eq('workspace_id', params.workspaceId)
      .contains('tags', ['validated'])
      .eq('is_active', true);

    // Build conversation context
    const conversationText = messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');

    // Use AI to extract shareable insights
    const insights = await extractInsightsWithAI(
      conversationText,
      params.industry,
      validatedEntries || []
    );

    if (insights.length === 0) {
      return { success: true, insights_extracted: 0, insights: [] };
    }

    // Save insights to global learning database
    await saveInsightsToGlobalKB(insights, params);

    console.log(`✅ Extracted ${insights.length} learning insights`);

    return {
      success: true,
      insights_extracted: insights.length,
      insights
    };

  } catch (error) {
    console.error('Learning extraction failed:', error);
    return { success: false, insights_extracted: 0, insights: [] };
  }
}

/**
 * Extract insights using AI (Claude)
 */
async function extractInsightsWithAI(
  conversationText: string,
  industry: Industry,
  validatedKB: any[]
): Promise<LearningInsight[]> {

  const prompt = `Analyze this validated sales conversation and extract **shareable, generalizable insights** that could help other companies in the ${industry} industry (and potentially cross-industry).

IMPORTANT: Only extract insights that are:
1. Validated by the user (not assumptions)
2. Generalizable (not company-specific secrets)
3. Actionable for similar businesses
4. Non-sensitive (public-facing messaging, common objections, standard practices)

Conversation:
${conversationText.substring(0, 6000)}

Validated Knowledge Base Entries:
${validatedKB.slice(0, 5).map(k => `- ${k.title}: ${k.content.substring(0, 200)}`).join('\n')}

Extract insights in these categories:
1. **Value Propositions**: Effective ways to communicate value in ${industry}
2. **Objection Handling**: Common objections and proven responses
3. **Messaging Patterns**: Language/tone that resonates with buyers
4. **ICP Criteria**: Important targeting criteria for ${industry}
5. **Campaign Strategies**: Effective outreach approaches
6. **Pain Points**: Validated customer pain points
7. **Competitive Positioning**: How to differentiate in ${industry}

Return as JSON array:
[
  {
    "insight_type": "value_prop",
    "insight_content": "SaaS buyers respond well to ROI-focused messaging with 60-day payback timelines",
    "confidence_score": 0.85,
    "cross_industry_applicable": true,
    "related_industries": ["fintech", "ecommerce"],
    "tags": ["messaging", "roi", "b2b"]
  }
]

Only return insights that are truly valuable and reusable. Minimum 0.7 confidence.`;

  try {
    // Use Claude Direct API for GDPR compliance
    const response = await claudeClient.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    });

    const aiResponse = response.content || '[]';
    
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    const insights = JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse);

    // Enrich with metadata
    return insights.map((insight: any) => ({
      ...insight,
      industry,
      validation_count: 1,
      source_workspaces_count: 1,
      first_observed: new Date().toISOString(),
      last_validated: new Date().toISOString()
    }));

  } catch (error) {
    console.error('AI insight extraction failed:', error);
    return [];
  }
}

/**
 * Save insights to global knowledge base (workspace_id = null for global sharing)
 */
async function saveInsightsToGlobalKB(
  insights: LearningInsight[],
  context: { workspaceId: string; industry: Industry }
): Promise<void> {

  const entries = insights.map(insight => ({
    workspace_id: null, // Global knowledge
    category: 'sam-learned-intelligence',
    subcategory: insight.insight_type,
    title: `${insight.industry} - ${insight.insight_type.replace('_', ' ')}`,
    content: insight.insight_content,
    tags: [...insight.tags, insight.industry, 'sam_learned', 'cross_workspace'],
    source_type: 'sam_learning',
    source_metadata: {
      confidence_score: insight.confidence_score,
      validation_count: insight.validation_count,
      source_workspaces_count: insight.source_workspaces_count,
      first_observed: insight.first_observed,
      last_validated: insight.last_validated,
      cross_industry_applicable: insight.cross_industry_applicable,
      related_industries: insight.related_industries,
      learning_source: 'conversation_extraction',
      originating_workspace: context.workspaceId // Track origin, but keep content global
    },
    is_active: true,
    version: '1.0'
  }));

  try {
    // Check if similar insight already exists
    for (const entry of entries) {
      const { data: existing } = await pool
        .from('knowledge_base')
        .select('id, source_metadata')
        .eq('category', 'sam-learned-intelligence')
        .eq('subcategory', entry.subcategory)
        .ilike('content', `%${entry.content.substring(0, 50)}%`)
        .is('workspace_id', null)
        .single();

      if (existing) {
        // Update validation count instead of creating duplicate
        await pool
          .from('knowledge_base')
          .update({
            source_metadata: {
              ...existing.source_metadata,
              validation_count: (existing.source_metadata.validation_count || 0) + 1,
              source_workspaces_count: (existing.source_metadata.source_workspaces_count || 0) + 1,
              last_validated: new Date().toISOString(),
              confidence_score: Math.min(
                1.0,
                (existing.source_metadata.confidence_score || 0.5) + 0.05
              )
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        console.log(`🔄 Updated existing insight (validation count +1)`);
      } else {
        // Create new insight
        await pool
          .from('knowledge_base')
          .insert([entry]);

        console.log(`✨ Created new learned insight: ${entry.title}`);
      }
    }

  } catch (error) {
    console.error('Failed to save learned insights:', error);
  }
}

/**
 * Retrieve learned insights for a workspace based on industry
 */
export async function getLearnedInsightsForWorkspace(params: {
  workspaceId: string;
  industry: Industry;
  includeRelatedIndustries?: boolean;
}): Promise<LearningInsight[]> {

  try {
    let query = pool
      .from('knowledge_base')
      .select('*')
      .eq('category', 'sam-learned-intelligence')
      .is('workspace_id', null) // Global insights only
      .eq('is_active', true);

    if (params.includeRelatedIndustries) {
      // Include cross-industry insights
      query = query.or(`tags.cs.{${params.industry}},source_metadata->cross_industry_applicable.eq.true`);
    } else {
      // Industry-specific only
      query = query.contains('tags', [params.industry]);
    }

    const { data, error } = await query
      .order('source_metadata->confidence_score', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Transform to LearningInsight format
    return (data || []).map(entry => ({
      id: entry.id,
      insight_type: entry.subcategory as any,
      industry: params.industry,
      insight_content: entry.content,
      confidence_score: entry.source_metadata?.confidence_score || 0.5,
      validation_count: entry.source_metadata?.validation_count || 1,
      source_workspaces_count: entry.source_metadata?.source_workspaces_count || 1,
      first_observed: entry.source_metadata?.first_observed || entry.created_at,
      last_validated: entry.source_metadata?.last_validated || entry.updated_at,
      cross_industry_applicable: entry.source_metadata?.cross_industry_applicable || false,
      related_industries: entry.source_metadata?.related_industries || [],
      tags: entry.tags || []
    }));

  } catch (error) {
    console.error('Failed to retrieve learned insights:', error);
    return [];
  }
}

/**
 * Apply learned insights to workspace KB (bootstrap new clients with industry knowledge)
 */
export async function applyLearnedInsightsToWorkspace(params: {
  workspaceId: string;
  industry: Industry;
  minConfidence?: number;
}): Promise<{ applied_count: number; insights_applied: string[] }> {

  const minConfidence = params.minConfidence || 0.75;

  console.log(`📚 Applying learned insights to workspace ${params.workspaceId}...`);

  try {
    // Get high-confidence insights
    const insights = await getLearnedInsightsForWorkspace({
      workspaceId: params.workspaceId,
      industry: params.industry,
      includeRelatedIndustries: true
    });

    const highConfidenceInsights = insights.filter(i => i.confidence_score >= minConfidence);

    if (highConfidenceInsights.length === 0) {
      return { applied_count: 0, insights_applied: [] };
    }

    // Create KB entries for this workspace (marked as "sam_recommended")
    const entries = highConfidenceInsights.map(insight => ({
      workspace_id: params.workspaceId,
      category: insight.insight_type.includes('icp') ? 'icp-intelligence' : 
                insight.insight_type.includes('objection') ? 'objection-handling' :
                insight.insight_type.includes('messaging') ? 'messaging' :
                insight.insight_type.includes('value') ? 'business-model' :
                'industry-intelligence',
      subcategory: insight.insight_type,
      title: `Sam's Recommendation: ${insight.insight_type.replace('_', ' ')}`,
      content: `${insight.insight_content}\n\n_Based on ${insight.validation_count} validated examples from ${insight.source_workspaces_count} ${params.industry} companies._`,
      tags: ['sam_recommended', 'learned_intelligence', params.industry],
      source_type: 'sam_learning',
      source_metadata: {
        learned_from_industry: params.industry,
        confidence_score: insight.confidence_score,
        validation_count: insight.validation_count,
        applied_at: new Date().toISOString(),
        requires_validation: true // User should still validate
      },
      is_active: true,
      version: '1.0'
    }));

    const { data, error } = await pool
      .from('knowledge_base')
      .insert(entries)
      .select();

    if (error) throw error;

    console.log(`✅ Applied ${data?.length || 0} learned insights to workspace`);

    return {
      applied_count: data?.length || 0,
      insights_applied: highConfidenceInsights.map(i => i.insight_content)
    };

  } catch (error) {
    console.error('Failed to apply learned insights:', error);
    return { applied_count: 0, insights_applied: [] };
  }
}

/**
 * Track campaign performance to improve future recommendations
 */
export async function learnFromCampaignPerformance(params: {
  campaignId: string;
  workspaceId: string;
  industry: Industry;
  metrics: {
    response_rate: number;
    meeting_booked_rate: number;
    messaging_approach: string;
    target_criteria: any;
  };
}): Promise<void> {

  console.log(`📊 Learning from campaign performance: ${params.campaignId}`);

  // If campaign performed well (>15% response rate, >5% meeting rate)
  const isHighPerforming = 
    params.metrics.response_rate >= 0.15 || 
    params.metrics.meeting_booked_rate >= 0.05;

  if (!isHighPerforming) {
    console.log('Campaign performance below learning threshold, skipping');
    return;
  }

  // Extract successful patterns
  const insight: LearningInsight = {
    insight_type: 'campaign_strategy',
    industry: params.industry,
    insight_content: `High-performing campaign approach: ${params.metrics.messaging_approach}. Achieved ${(params.metrics.response_rate * 100).toFixed(1)}% response rate and ${(params.metrics.meeting_booked_rate * 100).toFixed(1)}% meeting rate.`,
    confidence_score: 0.8,
    validation_count: 1,
    source_workspaces_count: 1,
    first_observed: new Date().toISOString(),
    last_validated: new Date().toISOString(),
    cross_industry_applicable: true,
    tags: ['campaign_success', 'proven_strategy', params.industry]
  };

  await saveInsightsToGlobalKB([insight], { 
    workspaceId: params.workspaceId, 
    industry: params.industry 
  });

  console.log('✅ Campaign performance insight saved for future learning');
}
