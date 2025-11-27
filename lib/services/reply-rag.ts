/**
 * Reply RAG Service - Store and retrieve reply conversations for learning
 * Uses embeddings to find similar past conversations and successful replies
 */

import { createClient } from '@supabase/supabase-js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface ProspectResearchData {
  personal?: {
    headline?: string;
    summary?: string;
    currentRole?: string;
    experience?: string[];
    skills?: string[];
    interests?: string[];
    connectionPoints?: string[];
    communicationStyle?: string;
  };
  company?: {
    description?: string;
    industry?: string;
    size?: string;
    specialties?: string[];
    painPoints?: string[];
    techStack?: string[];
    growthStage?: string;
  };
  website?: {
    valueProposition?: string;
    targetAudience?: string;
    products?: string[];
    tone?: string;
  };
  icpAnalysis?: {
    fitScore: number;
    fitReason: string;
    buyingSignals: string[];
    potentialObjections: string[];
    recommendedApproach: string;
    keyTalkingPoints: string[];
  };
}

interface ReplyConversation {
  workspaceId: string;
  prospectName: string;
  prospectCompany?: string;
  prospectRole?: string;
  prospectIndustry?: string;
  linkedInUrl?: string;
  channel: 'linkedin' | 'email';
  intent: string;
  originalOutreach?: string;
  prospectReply: string;
  ourResponse: string;
  wasApproved: boolean;
  wasEdited: boolean;
  feedback?: 'positive' | 'negative';
  outcome?: string; // e.g., "booked_call", "continued_conversation", "no_response"
  research?: ProspectResearchData;
  metadata?: Record<string, any>;
}

interface SimilarConversation {
  id: string;
  prospectReply: string;
  ourResponse: string;
  intent: string;
  wasApproved: boolean;
  outcome?: string;
  similarity: number;
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not set for embeddings');
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000) // Limit input size
      })
    });

    if (!response.ok) {
      console.error('Embedding API error:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Embedding generation error:', error);
    return null;
  }
}

/**
 * Store a reply conversation in the RAG database
 */
export async function storeReplyConversation(conversation: ReplyConversation): Promise<string | null> {
  const supabase = getServiceClient();

  try {
    // Format research for storage
    const researchContent = conversation.research ? formatResearchForStorage(conversation.research) : '';

    // Create searchable content combining key elements
    const searchContent = `
Intent: ${conversation.intent}
Channel: ${conversation.channel}
Industry: ${conversation.prospectIndustry || 'Not specified'}
Role: ${conversation.prospectRole || 'Not specified'}
Company: ${conversation.prospectCompany || 'Not specified'}

Prospect's Message:
${conversation.prospectReply}

Our Response:
${conversation.ourResponse}

${conversation.originalOutreach ? `Original Outreach:\n${conversation.originalOutreach}` : ''}

${researchContent ? `--- PROSPECT RESEARCH ---\n${researchContent}` : ''}
    `.trim();

    // Generate embedding
    const embedding = await generateEmbedding(searchContent);

    // Create knowledge base entry
    const { data: kbEntry, error: kbError } = await supabase
      .from('knowledge_base')
      .insert({
        workspace_id: conversation.workspaceId,
        category: 'reply_conversations',
        subcategory: conversation.intent,
        title: `${conversation.channel} reply - ${conversation.intent} - ${conversation.prospectName}`,
        content: searchContent,
        tags: [
          `intent:${conversation.intent}`,
          `channel:${conversation.channel}`,
          conversation.wasApproved ? 'approved' : 'draft',
          conversation.wasEdited ? 'edited' : 'unedited',
          conversation.feedback ? `feedback:${conversation.feedback}` : null,
          conversation.outcome ? `outcome:${conversation.outcome}` : null,
          conversation.prospectIndustry ? `industry:${conversation.prospectIndustry.toLowerCase()}` : null,
          conversation.prospectRole ? `role:${conversation.prospectRole.toLowerCase()}` : null
        ].filter(Boolean) as string[],
        source_type: 'sam_discovery',
        source_metadata: {
          prospect_name: conversation.prospectName,
          prospect_company: conversation.prospectCompany,
          prospect_role: conversation.prospectRole,
          prospect_industry: conversation.prospectIndustry,
          linkedin_url: conversation.linkedInUrl,
          channel: conversation.channel,
          intent: conversation.intent,
          was_approved: conversation.wasApproved,
          was_edited: conversation.wasEdited,
          feedback: conversation.feedback,
          outcome: conversation.outcome,
          research: conversation.research,
          icp_fit_score: conversation.research?.icpAnalysis?.fitScore,
          stored_at: new Date().toISOString(),
          ...conversation.metadata
        }
      })
      .select()
      .single();

    if (kbError) {
      console.error('❌ Failed to store knowledge base entry:', kbError);
      return null;
    }

    // Store vector embedding if generated
    if (embedding && kbEntry) {
      const { error: vectorError } = await supabase
        .from('knowledge_base_vectors')
        .insert({
          workspace_id: conversation.workspaceId,
          document_id: kbEntry.id,
          section_id: `reply_${conversation.intent}_${Date.now()}`,
          chunk_index: 0,
          content: searchContent,
          embedding: embedding,
          metadata: {
            intent: conversation.intent,
            channel: conversation.channel,
            was_approved: conversation.wasApproved,
            outcome: conversation.outcome
          },
          tags: [
            `intent:${conversation.intent}`,
            `channel:${conversation.channel}`,
            conversation.feedback ? `feedback:${conversation.feedback}` : null
          ].filter(Boolean) as string[]
        });

      if (vectorError) {
        console.error('⚠️ Failed to store vector (non-critical):', vectorError);
      }
    }

    console.log(`✅ Reply conversation stored in RAG: ${kbEntry.id}`);
    return kbEntry.id;

  } catch (error) {
    console.error('❌ Store reply conversation error:', error);
    return null;
  }
}

/**
 * Find similar past conversations for context
 */
export async function findSimilarConversations(
  workspaceId: string,
  prospectReply: string,
  options: {
    intent?: string;
    channel?: 'linkedin' | 'email';
    industry?: string;
    limit?: number;
    onlyApproved?: boolean;
    onlyPositiveFeedback?: boolean;
  } = {}
): Promise<SimilarConversation[]> {
  const supabase = getServiceClient();
  const { limit = 5, onlyApproved = true, onlyPositiveFeedback = false } = options;

  try {
    // Generate embedding for the prospect's reply
    const embedding = await generateEmbedding(prospectReply);

    if (!embedding) {
      // Fallback to tag-based search
      return findByTags(supabase, workspaceId, options, limit);
    }

    // Build tag filters
    const tagFilters: string[] = [];
    if (options.intent) tagFilters.push(`intent:${options.intent}`);
    if (options.channel) tagFilters.push(`channel:${options.channel}`);
    if (onlyApproved) tagFilters.push('approved');
    if (onlyPositiveFeedback) tagFilters.push('feedback:positive');

    // Vector similarity search
    const { data: results, error } = await supabase.rpc('match_reply_conversations', {
      query_embedding: embedding,
      match_workspace_id: workspaceId,
      match_threshold: 0.7,
      match_count: limit,
      filter_tags: tagFilters.length > 0 ? tagFilters : null
    });

    if (error) {
      console.error('Vector search error:', error);
      return findByTags(supabase, workspaceId, options, limit);
    }

    // Parse results
    return (results || []).map((r: any) => ({
      id: r.id,
      prospectReply: extractSection(r.content, "Prospect's Message:"),
      ourResponse: extractSection(r.content, "Our Response:"),
      intent: r.metadata?.intent || 'unknown',
      wasApproved: r.metadata?.was_approved || false,
      outcome: r.metadata?.outcome,
      similarity: r.similarity
    }));

  } catch (error) {
    console.error('Find similar conversations error:', error);
    return [];
  }
}

/**
 * Fallback tag-based search when embeddings unavailable
 */
async function findByTags(
  supabase: any,
  workspaceId: string,
  options: any,
  limit: number
): Promise<SimilarConversation[]> {
  let query = supabase
    .from('knowledge_base')
    .select('id, content, tags, source_metadata')
    .eq('workspace_id', workspaceId)
    .eq('category', 'reply_conversations')
    .eq('is_active', true);

  if (options.intent) {
    query = query.contains('tags', [`intent:${options.intent}`]);
  }
  if (options.channel) {
    query = query.contains('tags', [`channel:${options.channel}`]);
  }
  if (options.onlyApproved) {
    query = query.contains('tags', ['approved']);
  }

  query = query.order('created_at', { ascending: false }).limit(limit);

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map((r: any) => ({
    id: r.id,
    prospectReply: extractSection(r.content, "Prospect's Message:"),
    ourResponse: extractSection(r.content, "Our Response:"),
    intent: r.source_metadata?.intent || 'unknown',
    wasApproved: r.source_metadata?.was_approved || false,
    outcome: r.source_metadata?.outcome,
    similarity: 0.5 // Unknown similarity for tag-based
  }));
}

/**
 * Extract a section from structured content
 */
function extractSection(content: string, header: string): string {
  const lines = content.split('\n');
  let capturing = false;
  let result: string[] = [];

  for (const line of lines) {
    if (line.includes(header)) {
      capturing = true;
      continue;
    }
    if (capturing) {
      if (line.startsWith('Intent:') || line.startsWith('Channel:') ||
          line.startsWith('Industry:') || line.startsWith('Role:') ||
          line.startsWith('Original Outreach:') || line.startsWith("Prospect's Message:") ||
          line.startsWith('Our Response:')) {
        break;
      }
      result.push(line);
    }
  }

  return result.join('\n').trim();
}

/**
 * Format similar conversations for inclusion in the draft prompt
 */
export function formatSimilarConversationsForPrompt(conversations: SimilarConversation[]): string {
  if (conversations.length === 0) return '';

  const examples = conversations
    .filter(c => c.prospectReply && c.ourResponse)
    .slice(0, 3)
    .map((c, i) => `
**Example ${i + 1}** (${c.intent}, ${c.wasApproved ? 'approved' : 'draft'}${c.outcome ? `, ${c.outcome}` : ''}):
Prospect: "${c.prospectReply.slice(0, 200)}${c.prospectReply.length > 200 ? '...' : ''}"
Our reply: "${c.ourResponse.slice(0, 300)}${c.ourResponse.length > 300 ? '...' : ''}"
`).join('\n');

  return `## SIMILAR PAST CONVERSATIONS (for reference)

These are similar conversations we've had before. Use them as reference for tone and approach, but don't copy them directly.

${examples}`;
}

/**
 * Update conversation outcome (for learning)
 */
export async function updateConversationOutcome(
  conversationId: string,
  outcome: string,
  feedback?: 'positive' | 'negative'
): Promise<boolean> {
  const supabase = getServiceClient();

  try {
    const updates: Record<string, any> = {
      'source_metadata': {
        outcome,
        outcome_updated_at: new Date().toISOString()
      }
    };

    // Add outcome tag
    const newTags = [`outcome:${outcome}`];
    if (feedback) {
      newTags.push(`feedback:${feedback}`);
    }

    const { error } = await supabase
      .from('knowledge_base')
      .update({
        source_metadata: supabase.raw(`source_metadata || '${JSON.stringify({ outcome, feedback })}'::jsonb`),
        tags: supabase.raw(`array_cat(tags, ARRAY[${newTags.map(t => `'${t}'`).join(',')}])`)
      })
      .eq('id', conversationId);

    if (error) {
      console.error('Update outcome error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Update conversation outcome error:', error);
    return false;
  }
}

/**
 * Format research data for storage in RAG
 */
function formatResearchForStorage(research: ProspectResearchData): string {
  const sections: string[] = [];

  // Personal insights
  if (research.personal) {
    const p = research.personal;
    const lines: string[] = ['Personal Profile:'];
    if (p.headline) lines.push(`  Headline: ${p.headline}`);
    if (p.currentRole) lines.push(`  Current Role: ${p.currentRole}`);
    if (p.communicationStyle) lines.push(`  Communication Style: ${p.communicationStyle}`);
    if (p.experience?.length) lines.push(`  Experience: ${p.experience.join(', ')}`);
    if (p.skills?.length) lines.push(`  Skills: ${p.skills.join(', ')}`);
    if (p.interests?.length) lines.push(`  Interests: ${p.interests.join(', ')}`);
    if (p.connectionPoints?.length) lines.push(`  Connection Points: ${p.connectionPoints.join(', ')}`);
    if (lines.length > 1) sections.push(lines.join('\n'));
  }

  // Company insights
  if (research.company) {
    const c = research.company;
    const lines: string[] = ['Company Profile:'];
    if (c.description) lines.push(`  Description: ${c.description}`);
    if (c.industry) lines.push(`  Industry: ${c.industry}`);
    if (c.size) lines.push(`  Size: ${c.size}`);
    if (c.growthStage) lines.push(`  Stage: ${c.growthStage}`);
    if (c.specialties?.length) lines.push(`  Specialties: ${c.specialties.join(', ')}`);
    if (c.painPoints?.length) lines.push(`  Pain Points: ${c.painPoints.join(', ')}`);
    if (c.techStack?.length) lines.push(`  Tech Stack: ${c.techStack.join(', ')}`);
    if (lines.length > 1) sections.push(lines.join('\n'));
  }

  // Website insights
  if (research.website) {
    const w = research.website;
    const lines: string[] = ['Website Analysis:'];
    if (w.valueProposition) lines.push(`  Value Prop: ${w.valueProposition}`);
    if (w.targetAudience) lines.push(`  Target Audience: ${w.targetAudience}`);
    if (w.products?.length) lines.push(`  Products: ${w.products.join(', ')}`);
    if (w.tone) lines.push(`  Tone: ${w.tone}`);
    if (lines.length > 1) sections.push(lines.join('\n'));
  }

  // ICP analysis
  if (research.icpAnalysis) {
    const icp = research.icpAnalysis;
    const lines: string[] = ['ICP Analysis:'];
    lines.push(`  Fit Score: ${icp.fitScore}/100`);
    if (icp.fitReason) lines.push(`  Fit Reason: ${icp.fitReason}`);
    if (icp.recommendedApproach) lines.push(`  Recommended Approach: ${icp.recommendedApproach}`);
    if (icp.buyingSignals?.length) lines.push(`  Buying Signals: ${icp.buyingSignals.join(', ')}`);
    if (icp.potentialObjections?.length) lines.push(`  Potential Objections: ${icp.potentialObjections.join(', ')}`);
    if (icp.keyTalkingPoints?.length) lines.push(`  Key Talking Points: ${icp.keyTalkingPoints.join('; ')}`);
    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}

/**
 * Store standalone prospect research (for future reference)
 */
export async function storeProspectResearch(
  workspaceId: string,
  prospectName: string,
  prospectCompany: string | undefined,
  linkedInUrl: string | undefined,
  research: ProspectResearchData
): Promise<string | null> {
  const supabase = getServiceClient();

  try {
    const researchContent = formatResearchForStorage(research);
    const searchContent = `
Prospect: ${prospectName}
Company: ${prospectCompany || 'Not specified'}
LinkedIn: ${linkedInUrl || 'Not available'}

${researchContent}
    `.trim();

    const embedding = await generateEmbedding(searchContent);

    const { data: kbEntry, error } = await supabase
      .from('knowledge_base')
      .insert({
        workspace_id: workspaceId,
        category: 'prospect_research',
        subcategory: research.company?.industry || 'general',
        title: `Research: ${prospectName}${prospectCompany ? ` at ${prospectCompany}` : ''}`,
        content: searchContent,
        tags: [
          'prospect_research',
          research.company?.industry ? `industry:${research.company.industry.toLowerCase()}` : null,
          research.company?.size ? `size:${research.company.size.toLowerCase()}` : null,
          research.company?.growthStage ? `stage:${research.company.growthStage}` : null,
          research.icpAnalysis ? `fit:${research.icpAnalysis.fitScore >= 70 ? 'high' : research.icpAnalysis.fitScore >= 40 ? 'medium' : 'low'}` : null
        ].filter(Boolean) as string[],
        source_type: 'sam_discovery',
        source_metadata: {
          prospect_name: prospectName,
          prospect_company: prospectCompany,
          linkedin_url: linkedInUrl,
          research,
          icp_fit_score: research.icpAnalysis?.fitScore,
          researched_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to store research:', error);
      return null;
    }

    // Store embedding
    if (embedding && kbEntry) {
      await supabase
        .from('knowledge_base_vectors')
        .insert({
          workspace_id: workspaceId,
          document_id: kbEntry.id,
          section_id: `research_${prospectName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
          chunk_index: 0,
          content: searchContent,
          embedding,
          metadata: {
            prospect_name: prospectName,
            prospect_company: prospectCompany,
            icp_fit_score: research.icpAnalysis?.fitScore
          },
          tags: ['prospect_research']
        });
    }

    console.log(`✅ Prospect research stored: ${kbEntry.id}`);
    return kbEntry.id;
  } catch (error) {
    console.error('❌ Store research error:', error);
    return null;
  }
}
