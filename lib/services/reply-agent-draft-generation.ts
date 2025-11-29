/**
 * Enhanced Reply Agent Draft Generation with Web Scraping
 * Integrates BrightData website scraping and LinkedIn enrichment
 * Includes calendar link detection and injection
 *
 * Updated Nov 29, 2025: Migrated to Claude Direct API for GDPR compliance
 */

import { enrichProspectContext, matchQuestionToOffer, ProspectEnrichmentData } from './reply-agent-enrichment';
import { getWorkspaceCalendarSettings, enhanceSystemPromptWithCalendar, enhanceDraftWithCalendarLink, CalendarSettings } from './calendar-link-helper';
import { claudeClient } from '@/lib/llm/claude-client';

export interface DraftGenerationContext {
  replyId: string;
  prospectReply: string;
  prospect: {
    id: string;
    name: string;
    title?: string;
    company?: string;
    company_website?: string;
    linkedin_url?: string;
    industry?: string;
    notes?: string;
  };
  campaign: {
    id: string;
    name: string;
    message_template?: string;
    products?: string[];
    services?: string[];
    value_props?: string[];
  };
  workspace_id: string;
}

export interface GeneratedDraft {
  draft_content: string;
  enrichment_data: ProspectEnrichmentData;
  matched_offers: string[];
  confidence_score: number;
  generation_metadata: {
    model: string;
    tokens_used: number;
    generation_time_ms: number;
    scraping_time_ms: number;
  };
}

/**
 * Generate enhanced reply draft with web scraping enrichment and calendar link
 */
export async function generateEnhancedReplyDraft(
  context: DraftGenerationContext,
  supabase?: any
): Promise<GeneratedDraft> {
  const startTime = Date.now();

  console.log('🤖 Generating enhanced draft with web scraping:', {
    replyId: context.replyId,
    prospect: context.prospect.name,
    company: context.prospect.company
  });

  // Step 1: Enrich prospect context with web scraping
  const enrichmentData = await enrichProspectContext({
    linkedin_url: context.prospect.linkedin_url,
    company_website: context.prospect.company_website,
    company: context.prospect.company
  });

  const scrapingTime = Date.now() - startTime;
  console.log('✅ Enrichment complete:', {
    sources_scraped: enrichmentData.enrichment_metadata.sources_scraped,
    duration_ms: scrapingTime
  });

  // Step 2: Match prospect question to offerings
  const matchResult = matchQuestionToOffer(
    context.prospectReply,
    enrichmentData,
    {
      products: context.campaign.products,
      services: context.campaign.services,
      value_props: context.campaign.value_props
    }
  );

  console.log('🎯 Question-Offer matching:', {
    matched_offers: matchResult.matched_offers,
    relevance_score: matchResult.relevance_score,
    reasoning: matchResult.reasoning
  });

  // Step 3: Get calendar settings (if supabase provided)
  let calendarSettings: CalendarSettings | null = null;
  if (supabase && context.workspace_id) {
    calendarSettings = await getWorkspaceCalendarSettings(context.workspace_id, supabase);
  }

  // Step 4: Generate AI draft with enriched context
  const aiStartTime = Date.now();

  let systemPrompt = buildEnhancedSystemPrompt(context, enrichmentData, matchResult);

  // Enhance prompt with calendar availability if configured
  if (calendarSettings?.calendar_enabled) {
    systemPrompt = enhanceSystemPromptWithCalendar(systemPrompt, calendarSettings);
    console.log('📅 Calendar link available, AI will mention if relevant');
  }

  const userPrompt = buildUserPrompt(context.prospectReply, context.prospect);

  // Use Claude Direct API for GDPR compliance
  const response = await claudeClient.chat({
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    max_tokens: 600,
    temperature: 0.7
  });

  let draftContent = response.content;

  // Step 5: Check if calendar link should be added (fallback if AI didn't include it)
  if (calendarSettings) {
    const calendarResult = enhanceDraftWithCalendarLink(
      draftContent,
      calendarSettings,
      context.prospectReply
    );

    if (calendarResult.calendar_included && !draftContent.includes(calendarSettings.calendar_link)) {
      draftContent = calendarResult.enhanced_draft;
      console.log('📅 Calendar link added:', calendarResult.reason);
    }
  }

  const aiTime = Date.now() - aiStartTime;
  const totalTime = Date.now() - startTime;

  console.log('✅ Enhanced draft generated:', {
    length: draftContent.length,
    total_time_ms: totalTime,
    scraping_time_ms: scrapingTime,
    ai_time_ms: aiTime,
    calendar_included: calendarSettings?.calendar_enabled && draftContent.includes(calendarSettings.calendar_link)
  });

  return {
    draft_content: draftContent,
    enrichment_data: enrichmentData,
    matched_offers: matchResult.matched_offers,
    confidence_score: matchResult.relevance_score,
    generation_metadata: {
      model: response.model,
      tokens_used: response.usage.totalTokens,
      generation_time_ms: totalTime,
      scraping_time_ms: scrapingTime
    }
  };
}

/**
 * Build enhanced system prompt with enriched context
 */
function buildEnhancedSystemPrompt(
  context: DraftGenerationContext,
  enrichmentData: ProspectEnrichmentData,
  matchResult: ReturnType<typeof matchQuestionToOffer>
): string {
  let prompt = `You are SAM, an expert B2B sales assistant. Generate a highly personalized response to a prospect's reply.

Your response should:
- Address their specific question directly
- Reference specific details from their company and background
- Highlight relevant offerings that match their needs
- Maintain a consultative, helpful tone (not salesy)
- Be concise (2-3 short paragraphs)
- Include a clear, low-pressure call-to-action

## Campaign Context
- Campaign: ${context.campaign.name}
- Your products/services: ${context.campaign.products?.join(', ') || 'General B2B solutions'}
- Value propositions: ${context.campaign.value_props?.join(', ') || 'Not specified'}

## Prospect Context
- Name: ${context.prospect.name}
- Title: ${context.prospect.title || 'Professional'}
- Company: ${context.prospect.company}
- Industry: ${context.prospect.industry || 'Not specified'}`;

  // Add website scraping context
  if (enrichmentData.company_website_content) {
    const website = enrichmentData.company_website_content;
    prompt += `\n\n## Company Intelligence (from website scraping):
- About: ${website.about}
- Products/Services: ${website.products_services.join(', ')}
- Key Initiatives: ${website.key_initiatives.join(', ')}

Use this information to show you understand their business and tailor your response to their specific context.`;
  }

  // Add LinkedIn context
  if (enrichmentData.linkedin_profile_content) {
    const linkedin = enrichmentData.linkedin_profile_content;
    prompt += `\n\n## Prospect Background (from LinkedIn):
- Current Role: ${linkedin.current_role} at ${linkedin.company_info}
- Headline: ${linkedin.headline}
- Summary: ${linkedin.summary.substring(0, 200)}
- Recent Activity: ${linkedin.recent_posts.join(' | ')}

Reference their background to build rapport and demonstrate relevance.`;
  }

  // Add offer matching
  if (matchResult.matched_offers.length > 0) {
    prompt += `\n\n## Recommended Focus Areas:
${matchResult.reasoning}
Suggested offerings to mention: ${matchResult.matched_offers.slice(0, 2).join(', ')}

Frame your response around these specific offerings that match their question.`;
  }

  prompt += `\n\n## Response Guidelines:
1. Start by acknowledging their specific question/concern
2. Reference 1-2 specific details from their company/background
3. Explain how your solution addresses their needs (be specific)
4. Suggest a concrete next step (demo, call, resource)
5. Keep total length under 150 words

Remember: Quality over quantity. One highly relevant point beats three generic ones.`;

  return prompt;
}

/**
 * Build user prompt with prospect's reply
 */
function buildUserPrompt(prospectReply: string, prospect: { name: string; company?: string }): string {
  return `The prospect (${prospect.name} from ${prospect.company || 'their company'}) just replied with:

"${prospectReply}"

Generate a personalized response draft that:
1. Directly answers their question
2. References specific details from the enriched context above
3. Positions our solution as the right fit for their needs
4. Suggests a clear next step

Draft:`;
}

/**
 * Save enhanced draft to database with enrichment metadata
 */
export async function saveEnhancedDraft(
  replyId: string,
  generatedDraft: GeneratedDraft,
  supabase: any
): Promise<void> {
  await supabase
    .from('campaign_replies')
    .update({
      ai_suggested_response: generatedDraft.draft_content,
      draft_generated_at: new Date().toISOString(),
      metadata: {
        model: generatedDraft.generation_metadata.model,
        tokens_used: generatedDraft.generation_metadata.tokens_used,
        generation_time_ms: generatedDraft.generation_metadata.generation_time_ms,
        scraping_time_ms: generatedDraft.generation_metadata.scraping_time_ms,
        enrichment_sources: generatedDraft.enrichment_data.enrichment_metadata.sources_scraped,
        matched_offers: generatedDraft.matched_offers,
        confidence_score: generatedDraft.confidence_score,
        enrichment_data: {
          company_website: generatedDraft.enrichment_data.company_website_content ? {
            about_preview: generatedDraft.enrichment_data.company_website_content.about.substring(0, 100),
            products_count: generatedDraft.enrichment_data.company_website_content.products_services.length,
            initiatives_count: generatedDraft.enrichment_data.company_website_content.key_initiatives.length
          } : null,
          linkedin_profile: generatedDraft.enrichment_data.linkedin_profile_content ? {
            headline: generatedDraft.enrichment_data.linkedin_profile_content.headline,
            current_role: generatedDraft.enrichment_data.linkedin_profile_content.current_role,
            posts_analyzed: generatedDraft.enrichment_data.linkedin_profile_content.recent_posts.length
          } : null
        }
      }
    })
    .eq('id', replyId);

  console.log('✅ Enhanced draft saved to database:', {
    replyId,
    confidence_score: generatedDraft.confidence_score,
    enrichment_sources: generatedDraft.enrichment_data.enrichment_metadata.sources_scraped
  });
}
