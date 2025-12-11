/**
 * AI Search Agent Service
 *
 * Analyzes websites for SEO and GEO (Generative Engine Optimization),
 * learns from outreach/commenting performance, and helps users create
 * content that ranks in AI search engines (ChatGPT, Perplexity, Claude, etc.)
 *
 * Key Features:
 * - Website SEO/GEO analysis
 * - Learning from campaign & commenting performance
 * - AI-readable content recommendations
 * - Content strategy generation
 *
 * Created: December 11, 2025
 */

import { claudeClient, CLAUDE_MODELS } from '@/lib/llm/claude-client';
import { createClient } from '@supabase/supabase-js';

// ============================================
// TYPES
// ============================================

export type AnalysisDepth = 'quick' | 'standard' | 'comprehensive';

export type GEOReadinessLevel = 'poor' | 'needs_work' | 'moderate' | 'good' | 'excellent';

export interface AISearchAgentConfig {
  id?: string;
  workspace_id: string;
  enabled: boolean;
  website_url: string; // LOCKED once set - user cannot change
  website_locked: boolean;
  auto_analyze_prospects: boolean;
  analysis_depth: AnalysisDepth;

  // SEO Settings
  check_meta_tags: boolean;
  check_structured_data: boolean;
  check_robots_txt: boolean;
  check_sitemap: boolean;

  // GEO (Generative Engine Optimization) Settings
  check_llm_readability: boolean;
  check_entity_clarity: boolean;
  check_fact_density: boolean;
  check_citation_readiness: boolean;

  // Learning Settings
  learn_from_outreach: boolean;
  learn_from_comments: boolean;

  created_at?: string;
  updated_at?: string;
}

export interface SEOAnalysisResult {
  score: number; // 0-100
  meta_tags: {
    title: string | null;
    description: string | null;
    og_image: string | null;
    issues: string[];
    score: number;
  };
  structured_data: {
    types_found: string[];
    issues: string[];
    score: number;
  };
  robots_txt: {
    exists: boolean;
    allows_crawling: boolean;
    issues: string[];
    score: number;
  };
  sitemap: {
    exists: boolean;
    url: string | null;
    issues: string[];
    score: number;
  };
  technical_issues: string[];
}

export interface GEOAnalysisResult {
  score: number; // 0-100
  readiness_level: GEOReadinessLevel;

  // LLM Readability - Can AI easily understand your content?
  llm_readability: {
    score: number;
    is_ai_parseable: boolean;
    issues: string[];
    suggestions: string[];
  };

  // Entity Clarity - Are your key concepts clearly defined?
  entity_clarity: {
    score: number;
    entities_found: string[];
    issues: string[];
    suggestions: string[];
  };

  // Fact Density - Does your content contain citable facts?
  fact_density: {
    score: number;
    facts_found: number;
    avg_facts_per_section: number;
    issues: string[];
    suggestions: string[];
  };

  // Citation Readiness - Can AI cite your content as a source?
  citation_readiness: {
    score: number;
    is_authoritative: boolean;
    has_unique_data: boolean;
    issues: string[];
    suggestions: string[];
  };

  // AI Summary of GEO status
  ai_summary: string;
}

export interface ContentLearnings {
  // From outreach campaigns
  outreach: {
    total_messages_sent: number;
    response_rate: number;
    top_performing_messages: Array<{
      message_snippet: string;
      response_rate: number;
    }>;
    themes_that_work: string[];
    themes_to_avoid: string[];
  };

  // From commenting agent
  commenting: {
    total_comments_posted: number;
    avg_engagement_rate: number;
    top_performing_comments: Array<{
      comment_snippet: string;
      post_topic: string;
      engagement: number;
    }>;
    topics_that_resonate: string[];
  };

  // Combined insights
  combined_insights: {
    key_themes: string[];
    voice_characteristics: string[];
    content_recommendations: string[];
  };
}

export interface ContentRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'seo' | 'geo' | 'content' | 'technical';
  title: string;
  description: string;
  implementation_steps: string[];
  impact_estimate: string;
}

export interface WebsiteAnalysisResult {
  id: string;
  workspace_id: string;
  website_url: string;
  domain: string;
  analyzed_at: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';

  // Scores
  seo_score: number;
  geo_score: number;
  overall_score: number;

  // Detailed results
  seo_results: SEOAnalysisResult;
  geo_results: GEOAnalysisResult;

  // AI-generated recommendations
  recommendations: ContentRecommendation[];

  // Executive summary
  executive_summary: string;

  // Content learnings from other agents
  content_learnings?: ContentLearnings;
}

// ============================================
// DATABASE CLIENT
// ============================================

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// WEBSITE FETCHING & PARSING
// ============================================

interface FetchedWebsite {
  html: string;
  url: string;
  status_code: number;
  content_type: string;
  fetch_time_ms: number;
}

/**
 * Fetch website HTML content
 */
async function fetchWebsite(url: string): Promise<FetchedWebsite> {
  const startTime = Date.now();

  // Normalize URL
  let normalizedUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    normalizedUrl = `https://${url}`;
  }

  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SAMBot/1.0; +https://meet-sam.com/bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      redirect: 'follow'
    });

    const html = await response.text();
    const fetchTime = Date.now() - startTime;

    return {
      html,
      url: response.url, // Final URL after redirects
      status_code: response.status,
      content_type: response.headers.get('content-type') || '',
      fetch_time_ms: fetchTime
    };
  } catch (error) {
    console.error('Failed to fetch website:', url, error);
    throw new Error(`Failed to fetch website: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace('www.', '');
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

// ============================================
// SEO ANALYSIS
// ============================================

/**
 * Analyze website SEO
 */
async function analyzeSEO(html: string, url: string): Promise<SEOAnalysisResult> {
  const issues: string[] = [];
  let totalScore = 0;
  let scoreCount = 0;

  // Meta Tags Analysis
  const metaTagsResult = analyzeMetaTags(html);
  totalScore += metaTagsResult.score;
  scoreCount++;
  issues.push(...metaTagsResult.issues);

  // Structured Data Analysis
  const structuredDataResult = analyzeStructuredData(html);
  totalScore += structuredDataResult.score;
  scoreCount++;
  issues.push(...structuredDataResult.issues);

  // Robots.txt Analysis (would need separate fetch)
  const robotsResult = await analyzeRobotsTxt(url);
  totalScore += robotsResult.score;
  scoreCount++;
  issues.push(...robotsResult.issues);

  // Sitemap Analysis
  const sitemapResult = await analyzeSitemap(url);
  totalScore += sitemapResult.score;
  scoreCount++;
  issues.push(...sitemapResult.issues);

  // Technical Issues
  const technicalIssues = analyzeTechnicalSEO(html);
  issues.push(...technicalIssues);

  const overallScore = Math.round(totalScore / scoreCount);

  return {
    score: overallScore,
    meta_tags: metaTagsResult,
    structured_data: structuredDataResult,
    robots_txt: robotsResult,
    sitemap: sitemapResult,
    technical_issues: technicalIssues
  };
}

function analyzeMetaTags(html: string): SEOAnalysisResult['meta_tags'] {
  const issues: string[] = [];
  let score = 100;

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  if (!title) {
    issues.push('Missing page title');
    score -= 30;
  } else if (title.length < 30) {
    issues.push('Title too short (should be 50-60 characters)');
    score -= 10;
  } else if (title.length > 60) {
    issues.push('Title too long (may be truncated in search results)');
    score -= 5;
  }

  // Extract meta description
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const description = descMatch ? descMatch[1].trim() : null;

  if (!description) {
    issues.push('Missing meta description');
    score -= 25;
  } else if (description.length < 120) {
    issues.push('Meta description too short (should be 150-160 characters)');
    score -= 10;
  } else if (description.length > 160) {
    issues.push('Meta description too long (may be truncated)');
    score -= 5;
  }

  // Extract Open Graph image
  const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const ogImage = ogImageMatch ? ogImageMatch[1] : null;

  if (!ogImage) {
    issues.push('Missing Open Graph image (og:image)');
    score -= 10;
  }

  return {
    title,
    description,
    og_image: ogImage,
    issues,
    score: Math.max(0, score)
  };
}

function analyzeStructuredData(html: string): SEOAnalysisResult['structured_data'] {
  const issues: string[] = [];
  let score = 100;
  const typesFound: string[] = [];

  // Look for JSON-LD structured data
  const jsonLdMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  if (!jsonLdMatches || jsonLdMatches.length === 0) {
    issues.push('No JSON-LD structured data found');
    score -= 40;
  } else {
    jsonLdMatches.forEach(match => {
      try {
        const jsonContent = match.replace(/<script[^>]+>/, '').replace(/<\/script>/, '');
        const parsed = JSON.parse(jsonContent);
        const type = parsed['@type'] || (Array.isArray(parsed['@graph']) ? parsed['@graph'].map((g: { '@type'?: string }) => g['@type']).filter(Boolean) : []);
        if (Array.isArray(type)) {
          typesFound.push(...type);
        } else if (type) {
          typesFound.push(type);
        }
      } catch {
        issues.push('Invalid JSON-LD syntax detected');
        score -= 10;
      }
    });
  }

  // Check for important schema types
  const importantTypes = ['Organization', 'WebSite', 'LocalBusiness', 'Product', 'Article', 'Person'];
  const hasImportantType = typesFound.some(t => importantTypes.includes(t));

  if (typesFound.length > 0 && !hasImportantType) {
    issues.push('Missing core schema types (Organization, WebSite, etc.)');
    score -= 15;
  }

  return {
    types_found: typesFound,
    issues,
    score: Math.max(0, score)
  };
}

async function analyzeRobotsTxt(url: string): Promise<SEOAnalysisResult['robots_txt']> {
  const issues: string[] = [];
  let score = 100;

  const domain = new URL(url.startsWith('http') ? url : `https://${url}`).origin;

  try {
    const response = await fetch(`${domain}/robots.txt`, {
      headers: { 'User-Agent': 'SAMBot/1.0' }
    });

    if (!response.ok) {
      issues.push('robots.txt not found');
      score -= 20;
      return { exists: false, allows_crawling: true, issues, score };
    }

    const content = await response.text();
    const allowsCrawling = !content.includes('Disallow: /');

    if (!allowsCrawling) {
      issues.push('robots.txt blocks some paths');
      score -= 10;
    }

    if (!content.includes('Sitemap:')) {
      issues.push('robots.txt does not reference sitemap');
      score -= 10;
    }

    return { exists: true, allows_crawling: allowsCrawling, issues, score: Math.max(0, score) };
  } catch {
    issues.push('Could not fetch robots.txt');
    return { exists: false, allows_crawling: true, issues, score: 60 };
  }
}

async function analyzeSitemap(url: string): Promise<SEOAnalysisResult['sitemap']> {
  const issues: string[] = [];
  let score = 100;

  const domain = new URL(url.startsWith('http') ? url : `https://${url}`).origin;
  const sitemapUrls = [`${domain}/sitemap.xml`, `${domain}/sitemap_index.xml`];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const response = await fetch(sitemapUrl, {
        headers: { 'User-Agent': 'SAMBot/1.0' }
      });

      if (response.ok) {
        const content = await response.text();
        if (content.includes('<urlset') || content.includes('<sitemapindex')) {
          return { exists: true, url: sitemapUrl, issues: [], score: 100 };
        }
      }
    } catch {
      // Try next URL
    }
  }

  issues.push('No sitemap.xml found');
  score -= 30;
  return { exists: false, url: null, issues, score: Math.max(0, score) };
}

function analyzeTechnicalSEO(html: string): string[] {
  const issues: string[] = [];

  // Check for viewport meta tag
  if (!html.includes('viewport')) {
    issues.push('Missing viewport meta tag (affects mobile SEO)');
  }

  // Check for canonical URL
  if (!html.includes('rel="canonical"') && !html.includes("rel='canonical'")) {
    issues.push('Missing canonical URL');
  }

  // Check for hreflang (international sites)
  if (!html.includes('hreflang')) {
    // Not an issue for single-language sites, just a note
  }

  // Check for heading structure
  const h1Match = html.match(/<h1[^>]*>/gi);
  if (!h1Match) {
    issues.push('Missing H1 heading');
  } else if (h1Match.length > 1) {
    issues.push('Multiple H1 headings (should have only one)');
  }

  // Check for image alt tags
  const imgWithoutAlt = html.match(/<img(?![^>]*alt=)[^>]*>/gi);
  if (imgWithoutAlt && imgWithoutAlt.length > 0) {
    issues.push(`${imgWithoutAlt.length} images missing alt text`);
  }

  return issues;
}

// ============================================
// GEO (Generative Engine Optimization) ANALYSIS
// ============================================

/**
 * Analyze website for AI/LLM readability (GEO)
 * GEO = Generative Engine Optimization - making content AI-friendly
 */
async function analyzeGEO(html: string, url: string, seoResult: SEOAnalysisResult): Promise<GEOAnalysisResult> {
  // Extract text content for AI analysis
  const textContent = extractTextContent(html);

  // Use Claude to analyze GEO readiness
  const geoAnalysis = await analyzeWithAI(textContent, url, seoResult);

  return geoAnalysis;
}

/**
 * Extract readable text content from HTML
 */
function extractTextContent(html: string): string {
  // Remove scripts, styles, and HTML tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

  // Limit to first 10000 characters for analysis
  return text.substring(0, 10000);
}

/**
 * Use Claude to analyze GEO readiness
 */
async function analyzeWithAI(textContent: string, url: string, seoResult: SEOAnalysisResult): Promise<GEOAnalysisResult> {
  const systemPrompt = `You are an expert in Generative Engine Optimization (GEO) - the practice of making website content optimized for AI search engines like ChatGPT, Perplexity, Claude, and Google's AI Overviews.

## Your Task
Analyze the provided website content and evaluate how well it would perform when AI systems try to:
1. Understand and summarize the content
2. Extract facts and data points
3. Cite this source in AI-generated responses
4. Answer user questions using this content

## GEO Criteria

### 1. LLM Readability (0-100)
- Is the content clearly structured?
- Are concepts explained in plain language?
- Is there a logical flow that AI can follow?
- Are there clear definitions of key terms?

### 2. Entity Clarity (0-100)
- Are key entities (people, companies, products, concepts) clearly defined?
- Can AI extract WHO, WHAT, WHEN, WHERE, WHY easily?
- Are relationships between entities clear?

### 3. Fact Density (0-100)
- Does the content contain specific, citable facts?
- Are there statistics, data points, or unique insights?
- Is there original research or proprietary information?

### 4. Citation Readiness (0-100)
- Is this source authoritative on its topic?
- Would an AI confidently cite this source?
- Is the content unique and valuable?
- Does it have credibility signals (author info, dates, sources)?

## Output Format
Return ONLY a JSON object with this exact structure. No markdown, no explanation, just JSON:
{
  "llm_readability": {
    "score": 75,
    "is_ai_parseable": true,
    "issues": ["Issue 1", "Issue 2"],
    "suggestions": ["Suggestion 1", "Suggestion 2"]
  },
  "entity_clarity": {
    "score": 65,
    "entities_found": ["Entity1", "Entity2"],
    "issues": ["Issue 1"],
    "suggestions": ["Suggestion 1"]
  },
  "fact_density": {
    "score": 60,
    "facts_found": 5,
    "avg_facts_per_section": 2,
    "issues": ["Issue 1"],
    "suggestions": ["Suggestion 1"]
  },
  "citation_readiness": {
    "score": 70,
    "is_authoritative": true,
    "has_unique_data": false,
    "issues": ["Issue 1"],
    "suggestions": ["Suggestion 1"]
  },
  "ai_summary": "Brief 2-3 sentence summary of the website's GEO readiness"
}`;

  const userPrompt = `Analyze this website content for GEO (Generative Engine Optimization):

URL: ${url}
Title: ${seoResult.meta_tags.title || 'Unknown'}
Description: ${seoResult.meta_tags.description || 'None'}

CONTENT:
${textContent}

Evaluate the GEO readiness and return the JSON analysis.`;

  try {
    const response = await claudeClient.chat({
      model: CLAUDE_MODELS.SONNET,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 1500,
      temperature: 0.3
    });

    // Parse AI response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in AI response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Calculate overall GEO score
    const scores = [
      analysis.llm_readability?.score || 0,
      analysis.entity_clarity?.score || 0,
      analysis.fact_density?.score || 0,
      analysis.citation_readiness?.score || 0
    ];
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    // Determine readiness level
    let readinessLevel: GEOReadinessLevel;
    if (avgScore >= 80) readinessLevel = 'excellent';
    else if (avgScore >= 65) readinessLevel = 'good';
    else if (avgScore >= 50) readinessLevel = 'moderate';
    else if (avgScore >= 35) readinessLevel = 'needs_work';
    else readinessLevel = 'poor';

    return {
      score: avgScore,
      readiness_level: readinessLevel,
      llm_readability: analysis.llm_readability,
      entity_clarity: analysis.entity_clarity,
      fact_density: analysis.fact_density,
      citation_readiness: analysis.citation_readiness,
      ai_summary: analysis.ai_summary || 'Analysis complete.'
    };
  } catch (error) {
    console.error('GEO AI analysis failed:', error);

    // Return default values on error
    return {
      score: 50,
      readiness_level: 'moderate',
      llm_readability: {
        score: 50,
        is_ai_parseable: true,
        issues: ['Unable to complete full analysis'],
        suggestions: ['Re-run analysis']
      },
      entity_clarity: {
        score: 50,
        entities_found: [],
        issues: ['Unable to complete full analysis'],
        suggestions: []
      },
      fact_density: {
        score: 50,
        facts_found: 0,
        avg_facts_per_section: 0,
        issues: ['Unable to complete full analysis'],
        suggestions: []
      },
      citation_readiness: {
        score: 50,
        is_authoritative: false,
        has_unique_data: false,
        issues: ['Unable to complete full analysis'],
        suggestions: []
      },
      ai_summary: 'Analysis could not be completed. Please try again.'
    };
  }
}

// ============================================
// CONTENT LEARNINGS FROM OTHER AGENTS
// ============================================

/**
 * Gather content learnings from outreach and commenting agents
 */
async function gatherContentLearnings(workspaceId: string): Promise<ContentLearnings> {
  const supabase = getSupabase();

  // Get outreach performance data
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select(`
      id,
      name,
      campaign_type,
      message_templates,
      campaign_prospects (
        status,
        connection_request_sent,
        connection_accepted_at,
        message_sent_at,
        replied_at
      )
    `)
    .eq('workspace_id', workspaceId)
    .in('campaign_type', ['connector', 'messenger'])
    .limit(20);

  // Calculate outreach metrics
  let totalSent = 0;
  let totalResponded = 0;
  const successfulMessages: Array<{ message_snippet: string; response_rate: number }> = [];

  if (campaigns) {
    for (const campaign of campaigns) {
      const prospects = campaign.campaign_prospects || [];
      const sent = prospects.filter((p: { connection_request_sent?: string; message_sent_at?: string }) =>
        p.connection_request_sent || p.message_sent_at
      ).length;
      const responded = prospects.filter((p: { replied_at?: string }) => p.replied_at).length;

      totalSent += sent;
      totalResponded += responded;

      if (sent > 0 && campaign.message_templates) {
        const crMessage = (campaign.message_templates as { connection_request?: string })?.connection_request;
        if (crMessage && responded > 0) {
          successfulMessages.push({
            message_snippet: crMessage.substring(0, 100) + '...',
            response_rate: Math.round((responded / sent) * 100)
          });
        }
      }
    }
  }

  // Get commenting performance data
  const { data: comments } = await supabase
    .from('linkedin_post_comments')
    .select(`
      id,
      comment_text,
      status,
      posted_at,
      linkedin_posts_discovered (
        post_content,
        author_name
      )
    `)
    .eq('workspace_id', workspaceId)
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(50);

  const topComments: Array<{ comment_snippet: string; post_topic: string; engagement: number }> = [];
  const topics: string[] = [];

  if (comments) {
    for (const comment of comments) {
      const post = comment.linkedin_posts_discovered as { post_content?: string } | null;
      if (post?.post_content) {
        topComments.push({
          comment_snippet: comment.comment_text?.substring(0, 100) + '...',
          post_topic: post.post_content.substring(0, 50) + '...',
          engagement: 1 // Would need actual engagement tracking
        });

        // Extract topics from post content
        const topicMatch = post.post_content.match(/#\w+/g);
        if (topicMatch) {
          topics.push(...topicMatch.slice(0, 3));
        }
      }
    }
  }

  // Analyze themes with AI
  const themes = await analyzeThemes(successfulMessages, topComments);

  return {
    outreach: {
      total_messages_sent: totalSent,
      response_rate: totalSent > 0 ? Math.round((totalResponded / totalSent) * 100) : 0,
      top_performing_messages: successfulMessages
        .sort((a, b) => b.response_rate - a.response_rate)
        .slice(0, 3),
      themes_that_work: themes.outreach_themes_work,
      themes_to_avoid: themes.outreach_themes_avoid
    },
    commenting: {
      total_comments_posted: comments?.length || 0,
      avg_engagement_rate: 0, // Would need engagement tracking
      top_performing_comments: topComments.slice(0, 3),
      topics_that_resonate: [...new Set(topics)].slice(0, 5)
    },
    combined_insights: {
      key_themes: themes.key_themes,
      voice_characteristics: themes.voice_characteristics,
      content_recommendations: themes.content_recommendations
    }
  };
}

/**
 * Analyze themes from performance data using AI
 */
async function analyzeThemes(
  messages: Array<{ message_snippet: string; response_rate: number }>,
  comments: Array<{ comment_snippet: string; post_topic: string; engagement: number }>
): Promise<{
  outreach_themes_work: string[];
  outreach_themes_avoid: string[];
  key_themes: string[];
  voice_characteristics: string[];
  content_recommendations: string[];
}> {
  if (messages.length === 0 && comments.length === 0) {
    return {
      outreach_themes_work: [],
      outreach_themes_avoid: [],
      key_themes: [],
      voice_characteristics: [],
      content_recommendations: ['Generate more content to enable learning insights']
    };
  }

  const prompt = `Analyze this outreach and commenting performance data to extract themes:

OUTREACH MESSAGES (with response rates):
${messages.map(m => `- ${m.message_snippet} (${m.response_rate}% response rate)`).join('\n')}

LINKEDIN COMMENTS:
${comments.map(c => `- "${c.comment_snippet}" on topic: ${c.post_topic}`).join('\n')}

Return JSON with:
{
  "outreach_themes_work": ["Theme that got good responses"],
  "outreach_themes_avoid": ["Theme that didn't work"],
  "key_themes": ["Main themes across all content"],
  "voice_characteristics": ["Characteristics of the voice/tone used"],
  "content_recommendations": ["Recommendations for future content"]
}`;

  try {
    const response = await claudeClient.chat({
      model: CLAUDE_MODELS.HAIKU,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.3
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Theme analysis failed:', error);
  }

  return {
    outreach_themes_work: [],
    outreach_themes_avoid: [],
    key_themes: [],
    voice_characteristics: [],
    content_recommendations: []
  };
}

// ============================================
// RECOMMENDATIONS GENERATION
// ============================================

/**
 * Generate content recommendations based on analysis
 */
async function generateRecommendations(
  seoResult: SEOAnalysisResult,
  geoResult: GEOAnalysisResult,
  learnings: ContentLearnings
): Promise<ContentRecommendation[]> {
  const recommendations: ContentRecommendation[] = [];

  // SEO Recommendations
  for (const issue of seoResult.meta_tags.issues) {
    recommendations.push({
      priority: issue.includes('Missing') ? 'high' : 'medium',
      category: 'seo',
      title: `Fix: ${issue}`,
      description: `This affects how search engines display your site.`,
      implementation_steps: getStepsForIssue(issue, 'seo'),
      impact_estimate: 'Improves search visibility'
    });
  }

  for (const issue of seoResult.structured_data.issues) {
    recommendations.push({
      priority: 'medium',
      category: 'seo',
      title: `Structured Data: ${issue}`,
      description: 'Structured data helps search engines understand your content.',
      implementation_steps: getStepsForIssue(issue, 'structured_data'),
      impact_estimate: 'Improves rich snippet eligibility'
    });
  }

  // GEO Recommendations
  for (const suggestion of geoResult.llm_readability.suggestions) {
    recommendations.push({
      priority: 'high',
      category: 'geo',
      title: `Improve AI Readability: ${suggestion}`,
      description: 'Makes your content easier for AI systems to understand and cite.',
      implementation_steps: getStepsForSuggestion(suggestion),
      impact_estimate: 'Increases AI citation likelihood'
    });
  }

  for (const suggestion of geoResult.citation_readiness.suggestions) {
    recommendations.push({
      priority: 'high',
      category: 'geo',
      title: `Citation Readiness: ${suggestion}`,
      description: 'Makes your content more likely to be cited by AI systems.',
      implementation_steps: getStepsForSuggestion(suggestion),
      impact_estimate: 'Improves AI sourcing probability'
    });
  }

  // Content Recommendations from learnings
  for (const rec of learnings.combined_insights.content_recommendations) {
    recommendations.push({
      priority: 'medium',
      category: 'content',
      title: rec,
      description: 'Based on analysis of your outreach and commenting performance.',
      implementation_steps: ['Review your existing content', 'Apply this insight to new content', 'Track performance'],
      impact_estimate: 'Improves engagement based on historical data'
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations.slice(0, 10); // Top 10 recommendations
}

function getStepsForIssue(issue: string, category: string): string[] {
  if (issue.includes('title')) {
    return [
      'Update your page title to 50-60 characters',
      'Include your main keyword near the beginning',
      'Make it compelling and unique'
    ];
  }
  if (issue.includes('description')) {
    return [
      'Write a meta description of 150-160 characters',
      'Include your main value proposition',
      'Add a call-to-action'
    ];
  }
  if (issue.includes('JSON-LD') || issue.includes('structured data')) {
    return [
      'Add Organization schema to your homepage',
      'Add WebSite schema with search action',
      'Add relevant schema for your content type (Article, Product, etc.)'
    ];
  }
  if (issue.includes('sitemap')) {
    return [
      'Generate a sitemap.xml file',
      'Include all important pages',
      'Submit to Google Search Console'
    ];
  }
  return ['Review the issue', 'Implement the fix', 'Verify with testing tools'];
}

function getStepsForSuggestion(suggestion: string): string[] {
  return [
    'Identify relevant pages/sections',
    suggestion,
    'Test with AI tools to verify improvement'
  ];
}

// ============================================
// EXECUTIVE SUMMARY GENERATION
// ============================================

async function generateExecutiveSummary(
  url: string,
  seoScore: number,
  geoScore: number,
  seoResult: SEOAnalysisResult,
  geoResult: GEOAnalysisResult,
  learnings: ContentLearnings
): Promise<string> {
  const overallScore = Math.round((seoScore + geoScore) / 2);

  const prompt = `Write a 3-4 sentence executive summary of this website analysis:

Website: ${url}
Overall Score: ${overallScore}/100
SEO Score: ${seoScore}/100
GEO Score: ${geoScore}/100
GEO Readiness: ${geoResult.readiness_level}

Key SEO Issues: ${seoResult.technical_issues.slice(0, 3).join(', ') || 'None'}
Key GEO Insight: ${geoResult.ai_summary}

Outreach Performance: ${learnings.outreach.response_rate}% response rate from ${learnings.outreach.total_messages_sent} messages
Comments Posted: ${learnings.commenting.total_comments_posted}

Write a brief, actionable summary focusing on what matters most. Start with the overall status, then mention 1-2 key priorities.`;

  try {
    const response = await claudeClient.chat({
      model: CLAUDE_MODELS.HAIKU,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.5
    });

    return response.content.trim();
  } catch {
    return `Your website scores ${overallScore}/100 overall (SEO: ${seoScore}, GEO: ${geoScore}). ${geoResult.ai_summary}`;
  }
}

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

/**
 * Run full website analysis
 */
export async function analyzeWebsite(
  workspaceId: string,
  websiteUrl: string,
  options: { depth?: AnalysisDepth; includeLearn?: boolean } = {}
): Promise<WebsiteAnalysisResult> {
  const { depth = 'standard', includeLearn = true } = options;
  const supabase = getSupabase();

  console.log(`🔍 Starting website analysis for ${websiteUrl}`, { depth, includeLearn });

  // Create initial record
  const { data: analysisRecord, error: createError } = await supabase
    .from('website_analysis_results')
    .insert({
      workspace_id: workspaceId,
      website_url: websiteUrl,
      domain: extractDomain(websiteUrl),
      status: 'analyzing',
      seo_score: 0,
      geo_score: 0,
      overall_score: 0
    })
    .select()
    .single();

  if (createError || !analysisRecord) {
    throw new Error(`Failed to create analysis record: ${createError?.message}`);
  }

  try {
    // Fetch website
    const fetchStart = Date.now();
    const fetched = await fetchWebsite(websiteUrl);
    console.log(`📥 Website fetched in ${fetched.fetch_time_ms}ms`);

    // Run SEO Analysis
    const seoResult = await analyzeSEO(fetched.html, fetched.url);
    console.log(`📊 SEO Score: ${seoResult.score}/100`);

    // Run GEO Analysis
    const geoResult = await analyzeGEO(fetched.html, fetched.url, seoResult);
    console.log(`🤖 GEO Score: ${geoResult.score}/100 (${geoResult.readiness_level})`);

    // Gather content learnings (if enabled)
    let learnings: ContentLearnings = {
      outreach: { total_messages_sent: 0, response_rate: 0, top_performing_messages: [], themes_that_work: [], themes_to_avoid: [] },
      commenting: { total_comments_posted: 0, avg_engagement_rate: 0, top_performing_comments: [], topics_that_resonate: [] },
      combined_insights: { key_themes: [], voice_characteristics: [], content_recommendations: [] }
    };

    if (includeLearn) {
      learnings = await gatherContentLearnings(workspaceId);
      console.log(`📚 Content learnings gathered`);
    }

    // Generate recommendations
    const recommendations = await generateRecommendations(seoResult, geoResult, learnings);
    console.log(`💡 Generated ${recommendations.length} recommendations`);

    // Calculate overall score
    const overallScore = Math.round((seoResult.score + geoResult.score) / 2);

    // Generate executive summary
    const executiveSummary = await generateExecutiveSummary(
      websiteUrl,
      seoResult.score,
      geoResult.score,
      seoResult,
      geoResult,
      learnings
    );

    const analysisTime = Date.now() - fetchStart;

    // Update record with results
    const { data: updatedRecord, error: updateError } = await supabase
      .from('website_analysis_results')
      .update({
        status: 'completed',
        seo_score: seoResult.score,
        geo_score: geoResult.score,
        overall_score: overallScore,
        seo_results: seoResult,
        geo_results: geoResult,
        recommendations,
        executive_summary: executiveSummary,
        fetch_duration_ms: fetched.fetch_time_ms,
        analysis_duration_ms: analysisTime,
        analyzed_at: new Date().toISOString()
      })
      .eq('id', analysisRecord.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update analysis: ${updateError.message}`);
    }

    console.log(`✅ Analysis complete. Overall score: ${overallScore}/100`);

    return {
      id: updatedRecord.id,
      workspace_id: workspaceId,
      website_url: websiteUrl,
      domain: extractDomain(websiteUrl),
      analyzed_at: updatedRecord.analyzed_at,
      status: 'completed',
      seo_score: seoResult.score,
      geo_score: geoResult.score,
      overall_score: overallScore,
      seo_results: seoResult,
      geo_results: geoResult,
      recommendations,
      executive_summary: executiveSummary,
      content_learnings: learnings
    };
  } catch (error) {
    // Update record with failure
    await supabase
      .from('website_analysis_results')
      .update({
        status: 'failed',
        executive_summary: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
      .eq('id', analysisRecord.id);

    throw error;
  }
}

// ============================================
// CONFIG MANAGEMENT
// ============================================

/**
 * Get or create AI Search Agent config for workspace
 */
export async function getAISearchConfig(workspaceId: string): Promise<AISearchAgentConfig | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('workspace_ai_search_config')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    console.error('Failed to get AI search config:', error);
  }

  return data;
}

/**
 * Create AI Search Agent config with locked website URL
 */
export async function createAISearchConfig(
  workspaceId: string,
  websiteUrl: string,
  options: Partial<AISearchAgentConfig> = {}
): Promise<AISearchAgentConfig> {
  const supabase = getSupabase();

  // Check if config already exists
  const existing = await getAISearchConfig(workspaceId);
  if (existing) {
    throw new Error('AI Search Agent is already configured for this workspace. Website URL cannot be changed.');
  }

  const config: Partial<AISearchAgentConfig> = {
    workspace_id: workspaceId,
    website_url: websiteUrl,
    website_locked: true, // LOCKED - cannot be changed
    enabled: true,
    auto_analyze_prospects: false,
    analysis_depth: 'standard',
    check_meta_tags: true,
    check_structured_data: true,
    check_robots_txt: true,
    check_sitemap: true,
    check_llm_readability: true,
    check_entity_clarity: true,
    check_fact_density: true,
    check_citation_readiness: true,
    learn_from_outreach: true,
    learn_from_comments: true,
    ...options
  };

  const { data, error } = await supabase
    .from('workspace_ai_search_config')
    .insert(config)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create AI search config: ${error.message}`);
  }

  return data;
}

/**
 * Update AI Search Agent config (website URL is LOCKED)
 */
export async function updateAISearchConfig(
  workspaceId: string,
  updates: Partial<Omit<AISearchAgentConfig, 'website_url' | 'workspace_id'>>
): Promise<AISearchAgentConfig> {
  const supabase = getSupabase();

  // website_url is explicitly excluded from updates
  const safeUpdates = { ...updates };
  delete (safeUpdates as Record<string, unknown>).website_url;
  delete (safeUpdates as Record<string, unknown>).workspace_id;

  const { data, error } = await supabase
    .from('workspace_ai_search_config')
    .update(safeUpdates)
    .eq('workspace_id', workspaceId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update AI search config: ${error.message}`);
  }

  return data;
}

// ============================================
// CONTENT STRATEGY GENERATION
// ============================================

/**
 * Generate AI-optimized content strategy based on analysis
 */
export async function generateContentStrategy(
  workspaceId: string
): Promise<{
  strategy: string;
  content_pillars: string[];
  topics_to_cover: string[];
  format_recommendations: string[];
}> {
  const supabase = getSupabase();

  // Get latest analysis
  const { data: latestAnalysis } = await supabase
    .from('website_analysis_results')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'completed')
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .single();

  if (!latestAnalysis) {
    return {
      strategy: 'Run a website analysis first to generate a content strategy.',
      content_pillars: [],
      topics_to_cover: [],
      format_recommendations: []
    };
  }

  // Get learnings
  const learnings = await gatherContentLearnings(workspaceId);

  const prompt = `Based on this website analysis and content performance data, create a content strategy for ranking in AI search engines:

WEBSITE: ${latestAnalysis.website_url}
GEO SCORE: ${latestAnalysis.geo_score}/100
GEO READINESS: ${latestAnalysis.geo_results?.readiness_level}

TOP PERFORMING THEMES: ${learnings.combined_insights.key_themes.join(', ') || 'Not enough data'}
VOICE CHARACTERISTICS: ${learnings.combined_insights.voice_characteristics.join(', ') || 'Not enough data'}
TOPICS THAT RESONATE: ${learnings.commenting.topics_that_resonate.join(', ') || 'Not enough data'}

KEY ISSUES:
${latestAnalysis.geo_results?.llm_readability?.issues?.join('\n') || 'None'}

Return JSON:
{
  "strategy": "2-3 paragraph content strategy summary",
  "content_pillars": ["Main theme 1", "Main theme 2", "Main theme 3"],
  "topics_to_cover": ["Specific topic 1", "Specific topic 2", "Specific topic 3", "Specific topic 4", "Specific topic 5"],
  "format_recommendations": ["Format recommendation 1", "Format recommendation 2", "Format recommendation 3"]
}`;

  try {
    const response = await claudeClient.chat({
      model: CLAUDE_MODELS.SONNET,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.5
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Content strategy generation failed:', error);
  }

  return {
    strategy: 'Unable to generate strategy. Please try again.',
    content_pillars: [],
    topics_to_cover: [],
    format_recommendations: []
  };
}
