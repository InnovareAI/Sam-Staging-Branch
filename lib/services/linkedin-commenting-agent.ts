/**
 * LinkedIn Commenting Agent Service
 * Generates AI-powered comments for LinkedIn posts
 */

export interface LinkedInPost {
  id: string;
  post_linkedin_id: string;
  post_social_id: string;
  post_text: string;
  post_type: string;
  author: {
    linkedin_id: string;
    name: string;
    title?: string;
    company?: string;
    profile_url?: string;
  };
  engagement: {
    likes_count: number;
    comments_count: number;
    shares_count: number;
  };
  posted_at: Date;
  discovered_via_monitor_type?: string;
  matched_keywords?: string[];
}

export interface CommentingAgentSettings {
  tone: 'professional' | 'friendly' | 'casual' | 'passionate';
  formality: 'formal' | 'semi-formal' | 'informal';
  commentLength: 'short' | 'medium' | 'long';
  questionFrequency: 'frequently' | 'sometimes' | 'rarely' | 'never';
  useKnowledgeBase: boolean;
  personalityDocument: string;
}

export interface WorkspaceContext {
  workspace_id: string;
  company_name: string;
  expertise_areas: string[];
  products: string[];
  value_props: string[];
  tone_of_voice: string;
  knowledge_base_snippets?: string[];
  commenting_agent_settings?: CommentingAgentSettings;
}

export interface ProspectContext {
  is_prospect: boolean;
  prospect_id?: string;
  campaign_id?: string;
  relationship_stage?: string; // 'contacted', 'replied', 'engaged'
  notes?: string;
}

export interface CommentGenerationContext {
  post: LinkedInPost;
  workspace: WorkspaceContext;
  prospect?: ProspectContext;
}

export interface GeneratedComment {
  comment_text: string;
  confidence_score: number; // 0.00-1.00
  reasoning: string;
  quality_indicators: {
    adds_value: boolean;
    on_topic: boolean;
    appropriate_tone: boolean;
    avoids_sales_pitch: boolean;
    references_post_specifically: boolean;
  };
  should_auto_post: boolean; // confidence >= 0.80
  generation_metadata: {
    model: string;
    tokens_used: number;
    generation_time_ms: number;
  };
}

/**
 * Generate LinkedIn comment for a post
 */
export async function generateLinkedInComment(
  context: CommentGenerationContext
): Promise<GeneratedComment> {
  const startTime = Date.now();

  console.log('💬 Generating LinkedIn comment:', {
    post_id: context.post.id,
    author: context.post.author.name,
    is_prospect: context.prospect?.is_prospect || false
  });

  // Build AI prompt
  const systemPrompt = buildCommentSystemPrompt(context);
  const userPrompt = buildCommentUserPrompt(context.post);

  // Generate comment via Claude
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com',
      'X-Title': 'SAM AI - LinkedIn Comment Generation'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-haiku-20241022',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 300,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }

  const data = await response.json();
  const aiResponse = data.choices[0].message.content;

  // Parse AI response (expecting JSON)
  let parsedResponse: any;
  try {
    // Extract JSON from response (AI might wrap it in markdown)
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedResponse = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in AI response');
    }
  } catch (error) {
    console.error('❌ Failed to parse AI response:', aiResponse);
    throw new Error('Invalid AI response format');
  }

  const generationTime = Date.now() - startTime;

  // Calculate confidence score based on quality indicators
  const confidenceScore = calculateConfidenceScore(
    parsedResponse,
    context.post,
    context.workspace,
    context.prospect
  );

  const generatedComment: GeneratedComment = {
    comment_text: parsedResponse.comment_text || parsedResponse.comment || '',
    confidence_score: confidenceScore,
    reasoning: parsedResponse.reasoning || 'Generated with high quality',
    quality_indicators: {
      adds_value: parsedResponse.adds_value !== false,
      on_topic: parsedResponse.on_topic !== false,
      appropriate_tone: parsedResponse.appropriate_tone !== false,
      avoids_sales_pitch: parsedResponse.avoids_sales_pitch !== false,
      references_post_specifically: parsedResponse.references_post_specifically !== false
    },
    should_auto_post: confidenceScore >= 0.80,
    generation_metadata: {
      model: 'claude-3.5-sonnet',
      tokens_used: data.usage?.total_tokens || 0,
      generation_time_ms: generationTime
    }
  };

  console.log('✅ Comment generated:', {
    post_id: context.post.id,
    confidence: confidenceScore,
    auto_post: generatedComment.should_auto_post,
    length: generatedComment.comment_text.length
  });

  return generatedComment;
}

/**
 * Build system prompt for comment generation
 */
function buildCommentSystemPrompt(context: CommentGenerationContext): string {
  const { workspace, prospect, post } = context;
  const settings = workspace.commenting_agent_settings;

  // Determine tone description based on settings
  const toneDescriptions: Record<string, string> = {
    professional: 'professional and business-like',
    friendly: 'warm, friendly, and approachable',
    casual: 'casual, relaxed, and conversational',
    passionate: 'enthusiastic and passionate'
  };

  const formalityDescriptions: Record<string, string> = {
    formal: 'Use formal language and proper grammar. Avoid contractions and slang.',
    'semi-formal': 'Use professional but conversational language. Contractions are fine.',
    informal: 'Use casual, everyday language. Be relaxed and natural.'
  };

  const lengthGuidelines: Record<string, string> = {
    short: '1-2 sentences (under 100 characters)',
    medium: '2-3 sentences (100-200 characters)',
    long: '3-4 sentences (200-300 characters)'
  };

  const questionGuidelines: Record<string, string> = {
    frequently: 'Try to end most comments with a thoughtful question to encourage dialogue.',
    sometimes: 'Include a question in about half of your comments when it feels natural.',
    rarely: 'Only ask a question if it adds significant value to the conversation.',
    never: 'Do not ask questions. Make statements and share insights instead.'
  };

  const tone = settings?.tone || 'professional';
  const formality = settings?.formality || 'semi-formal';
  const commentLength = settings?.commentLength || 'medium';
  const questionFreq = settings?.questionFrequency || 'sometimes';
  const useKnowledge = settings?.useKnowledgeBase ?? true;
  const personalityDoc = settings?.personalityDocument || '';

  let prompt = `You are a B2B engagement specialist helping ${workspace.company_name} build relationships on LinkedIn through thoughtful commenting.

## Company Context
- Company: ${workspace.company_name}
- Expertise: ${workspace.expertise_areas.join(', ') || 'B2B Sales'}
- Products/Services: ${workspace.products.join(', ') || 'Not specified'}
- Value Propositions: ${workspace.value_props.join(', ') || 'Not specified'}`;

  // Add personality document if provided (this is the key addition!)
  if (personalityDoc && personalityDoc.trim().length > 0) {
    prompt += `\n\n## Brand Voice & Personality Guidelines (FOLLOW CAREFULLY)
${personalityDoc}`;
  }

  // Add knowledge base snippets if enabled and available
  if (useKnowledge && workspace.knowledge_base_snippets && workspace.knowledge_base_snippets.length > 0) {
    prompt += `\n\n## Company Knowledge (Use for context)
${workspace.knowledge_base_snippets.slice(0, 3).join('\n')}`;
  }

  prompt += `\n\n## Communication Style Settings
- **Tone**: ${toneDescriptions[tone]}
- **Formality**: ${formalityDescriptions[formality]}
- **Length**: ${lengthGuidelines[commentLength]}
- **Questions**: ${questionGuidelines[questionFreq]}`;

  prompt += `\n\n## Post Context
Author: ${post.author.name}${post.author.title ? `, ${post.author.title}` : ''}${post.author.company ? ` at ${post.author.company}` : ''}
Posted: ${getRelativeTime(post.posted_at)}
Engagement: ${post.engagement.likes_count} likes, ${post.engagement.comments_count} comments`;

  if (prospect?.is_prospect) {
    prompt += `\n\n## ⚠️ IMPORTANT: This is a PROSPECT
- Prospect Stage: ${prospect.relationship_stage || 'New'}
- Campaign: ${prospect.campaign_id ? 'Active campaign' : 'No active campaign'}
${prospect.notes ? `- Notes: ${prospect.notes}` : ''}

**Extra care required**: This comment is building a relationship with a potential customer. Be especially thoughtful, personalized, and value-focused.`;
  }

  prompt += `\n\n## Comment Guidelines (CRITICAL)

**Your goal**: Generate a LinkedIn comment that adds genuine value and builds relationship

**MUST DO**:
1. Reference a SPECIFIC point from the post (not generic "great post!")
2. Add genuine insight, experience, or helpful perspective
3. Match the ${toneDescriptions[tone]} tone
4. Follow the length guideline: ${lengthGuidelines[commentLength]}
5. Be authentic - sound like a real person, not a bot
${personalityDoc ? '6. Follow the Brand Voice & Personality Guidelines above' : ''}

**MUST NOT DO**:
1. ❌ Don't pitch products or services
2. ❌ Don't use generic praise ("Great insights!", "Thanks for sharing!")
3. ❌ Don't use corporate jargon or buzzwords
4. ❌ Don't make it about you/your company
5. ❌ Don't use emojis excessively (max 1-2 if appropriate)

**Quality Standards**:
- If you can't add genuine value, return: { "skip": true, "reason": "Cannot add authentic value" }
- Only generate comments you'd be proud to post yourself
- Prioritize quality over quantity

## Output Format (JSON ONLY)

Return ONLY a JSON object with this structure:
{
  "comment_text": "Your comment here...",
  "reasoning": "Why this comment adds value and fits the context",
  "adds_value": true,
  "on_topic": true,
  "appropriate_tone": true,
  "avoids_sales_pitch": true,
  "references_post_specifically": true,
  "skip": false
}

OR if the post isn't worth commenting on:
{
  "skip": true,
  "reason": "Explanation why we shouldn't comment"
}`;

  return prompt;
}

/**
 * Build user prompt with post content
 */
function buildCommentUserPrompt(post: LinkedInPost): string {
  return `Generate a thoughtful LinkedIn comment for this post:

"${post.post_text}"

Remember:
- Reference a SPECIFIC point from the post
- Add genuine value through insight or experience
- 2-3 sentences maximum
- Be conversational and natural
- No sales pitch

Return JSON only.`;
}

/**
 * Calculate confidence score based on quality indicators
 */
function calculateConfidenceScore(
  aiResponse: any,
  post: LinkedInPost,
  workspace: WorkspaceContext,
  prospect?: ProspectContext
): number {
  let score = 0.5; // Base score

  // If AI marked as skip, return 0
  if (aiResponse.skip === true) {
    return 0.0;
  }

  // Quality indicators (0.5 points total)
  const indicators = [
    aiResponse.adds_value,
    aiResponse.on_topic,
    aiResponse.appropriate_tone,
    aiResponse.avoids_sales_pitch,
    aiResponse.references_post_specifically
  ];
  const qualityScore = indicators.filter(Boolean).length / indicators.length;
  score += qualityScore * 0.3;

  // Comment length (0.1 points) - prefer 50-200 characters
  const commentLength = (aiResponse.comment_text || '').length;
  if (commentLength >= 50 && commentLength <= 200) {
    score += 0.1;
  } else if (commentLength > 200 && commentLength <= 300) {
    score += 0.05;
  }

  // Post engagement (0.1 points) - higher engagement = better opportunity
  const engagementScore = Math.min(
    post.engagement.likes_count / 100,
    1.0
  );
  score += engagementScore * 0.1;

  // Prospect bonus (0.1 points) - be extra careful with prospects
  if (prospect?.is_prospect) {
    // For prospects, we want higher confidence
    score = Math.min(score, 0.85); // Cap at 0.85 for prospects (always review)
  }

  // Post recency (0.05 points) - recent posts better for engagement
  const postAge = Date.now() - new Date(post.posted_at).getTime();
  const ageInHours = postAge / (1000 * 60 * 60);
  if (ageInHours <= 24) {
    score += 0.05;
  } else if (ageInHours <= 72) {
    score += 0.02;
  }

  return Math.max(0.0, Math.min(1.0, score));
}

/**
 * Get relative time string
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
}

/**
 * Batch generate comments for multiple posts
 */
export async function batchGenerateComments(
  contexts: CommentGenerationContext[]
): Promise<Array<{
  post_id: string;
  result?: GeneratedComment;
  error?: string;
}>> {
  const results = [];

  for (const context of contexts) {
    try {
      const result = await generateLinkedInComment(context);
      results.push({
        post_id: context.post.id,
        result,
        error: undefined
      });
    } catch (error) {
      results.push({
        post_id: context.post.id,
        result: undefined,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Rate limiting: Wait 2 seconds between generations
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return results;
}

/**
 * Validate comment meets quality standards
 */
export function validateCommentQuality(comment: GeneratedComment): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check comment length
  if (comment.comment_text.length < 20) {
    issues.push('Comment too short (< 20 characters)');
  }
  if (comment.comment_text.length > 500) {
    issues.push('Comment too long (> 500 characters)');
  }

  // Check quality indicators
  const qualityChecks = [
    { key: 'adds_value', message: 'Does not add value' },
    { key: 'on_topic', message: 'Off-topic' },
    { key: 'appropriate_tone', message: 'Inappropriate tone' },
    { key: 'avoids_sales_pitch', message: 'Sounds like a sales pitch' },
    { key: 'references_post_specifically', message: 'Does not reference post specifically' }
  ];

  for (const check of qualityChecks) {
    if (!comment.quality_indicators[check.key as keyof typeof comment.quality_indicators]) {
      issues.push(check.message);
    }
  }

  // Check for banned phrases
  const bannedPhrases = [
    'great post',
    'thanks for sharing',
    'nice insights',
    'check out our',
    'we can help',
    'contact us',
    'book a demo'
  ];

  const commentLower = comment.comment_text.toLowerCase();
  for (const phrase of bannedPhrases) {
    if (commentLower.includes(phrase)) {
      issues.push(`Contains banned phrase: "${phrase}"`);
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Check if we should skip commenting on this post
 */
export function shouldSkipPost(post: LinkedInPost, workspace: WorkspaceContext): {
  should_skip: boolean;
  reason?: string;
} {
  // Skip if post is too old (> 7 days)
  const postAge = Date.now() - new Date(post.posted_at).getTime();
  const ageInDays = postAge / (1000 * 60 * 60 * 24);
  if (ageInDays > 7) {
    return { should_skip: true, reason: 'Post too old (> 7 days)' };
  }

  // Skip if very low engagement (< 3 likes and no comments)
  if (post.engagement.likes_count < 3 && post.engagement.comments_count === 0) {
    return { should_skip: true, reason: 'Very low engagement' };
  }

  // Skip if post is too short (< 50 characters)
  if (post.post_text.length < 50) {
    return { should_skip: true, reason: 'Post too short to add value' };
  }

  return { should_skip: false };
}
