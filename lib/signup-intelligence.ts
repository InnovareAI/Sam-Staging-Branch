/**
 * Signup Intelligence System
 * 
 * Automatically gathers intelligence about new users at signup:
 * 1. Loads industry-specific knowledge
 * 2. Scrapes company website
 * 3. AI analysis to extract business insights
 * 4. Auto-populates workspace KB
 */

import { pool } from '@/lib/db';

// Pool imported from lib/db
// Industry taxonomy (should match knowledge_base categories)
export const SUPPORTED_INDUSTRIES = {
  'saas': 'SaaS & Software',
  'fintech': 'Financial Technology',
  'healthcare': 'Healthcare & Medical',
  'ecommerce': 'E-commerce & Retail',
  'manufacturing': 'Manufacturing & Industrial',
  'consulting': 'Professional Services & Consulting',
  'agency': 'Marketing & Creative Agencies',
  'education': 'Education & EdTech',
  'real_estate': 'Real Estate & PropTech',
  'legal': 'Legal Services',
  'recruiting': 'Recruiting & HR Tech',
  'logistics': 'Logistics & Supply Chain',
  'other': 'Other'
} as const;

export type Industry = keyof typeof SUPPORTED_INDUSTRIES;

interface WebsiteIntelligence {
  company_overview: string;
  value_proposition: string;
  products_services: string[];
  target_market: string;
  competitive_positioning: string;
  strengths: string[];
  weaknesses: string[];
  messaging_tone: string;
  key_pages_found: string[];
  confidence_score: number;
}

interface IndustryKnowledge {
  playbooks: any[];
  pain_points: string[];
  buyer_personas: any[];
  objection_handling: any[];
  messaging_frameworks: any[];
}

/**
 * Main signup intelligence orchestrator
 */
export async function runSignupIntelligence(params: {
  userId: string;
  workspaceId: string;
  companyName: string;
  websiteUrl?: string;
  industry: Industry;
  companySize?: string;
}): Promise<{ success: boolean; kb_completeness: number; intelligence_summary: string }> {
  
  console.log(`🧠 Starting signup intelligence for ${params.companyName}...`);

  try {
    // Step 1: Load industry knowledge
    const industryKnowledge = await loadIndustryKnowledge(params.industry, params.workspaceId);
    console.log(`✅ Loaded industry knowledge for ${params.industry}`);

    // Step 2: Scrape and analyze website (if provided)
    let websiteIntel: WebsiteIntelligence | null = null;
    if (params.websiteUrl) {
      websiteIntel = await analyzeCompanyWebsite(params.websiteUrl, params.industry);
      console.log(`✅ Analyzed website: ${params.websiteUrl}`);
    }

    // Step 3: Auto-populate workspace KB
    const kbPopulated = await populateWorkspaceKB({
      workspaceId: params.workspaceId,
      userId: params.userId,
      companyName: params.companyName,
      industry: params.industry,
      industryKnowledge,
      websiteIntel,
      companySize: params.companySize
    });

    console.log(`✅ Populated ${kbPopulated.entries_created} KB entries`);

    // Step 4: Calculate initial KB completeness
    const { supabaseKnowledge } = await import('./supabase-knowledge');
    const completeness = await supabaseKnowledge.checkKBCompleteness(params.workspaceId);

    const summary = `
Signup Intelligence Complete:
- Industry: ${SUPPORTED_INDUSTRIES[params.industry]}
- Website analyzed: ${params.websiteUrl ? 'Yes' : 'No'}
- KB entries created: ${kbPopulated.entries_created}
- Initial KB completeness: ${completeness.overallCompleteness}%
- Ready for conversation: ${completeness.overallCompleteness >= 40 ? 'Yes' : 'Needs basic info'}
    `.trim();

    console.log(`🎉 Signup intelligence complete:\n${summary}`);

    return {
      success: true,
      kb_completeness: completeness.overallCompleteness,
      intelligence_summary: summary
    };

  } catch (error) {
    console.error('❌ Signup intelligence failed:', error);
    return {
      success: false,
      kb_completeness: 0,
      intelligence_summary: `Failed to gather intelligence: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Load industry-specific knowledge from global KB
 */
async function loadIndustryKnowledge(industry: Industry, workspaceId: string): Promise<IndustryKnowledge> {
  try {
    const { data: industryData, error } = await pool
      .from('knowledge_base')
      .select('*')
      .or(`category.eq.verticals,category.ilike.%${industry}%,tags.cs.{${industry}}`)
      .eq('is_active', true)
      .is('workspace_id', null); // Global knowledge only

    if (error) throw error;

    // Parse and categorize industry knowledge
    const playbooks = industryData?.filter(k => k.subcategory?.includes('playbook')) || [];
    const painPoints = industryData?.filter(k => k.subcategory?.includes('pain-points'))
      .flatMap(k => k.content.split('\n').filter(Boolean)) || [];
    const personas = industryData?.filter(k => k.subcategory?.includes('personas')) || [];
    const objections = industryData?.filter(k => k.subcategory?.includes('objections')) || [];
    const messaging = industryData?.filter(k => k.subcategory?.includes('messaging')) || [];

    return {
      playbooks,
      pain_points: painPoints,
      buyer_personas: personas,
      objection_handling: objections,
      messaging_frameworks: messaging
    };

  } catch (error) {
    console.error('Failed to load industry knowledge:', error);
    return {
      playbooks: [],
      pain_points: [],
      buyer_personas: [],
      objection_handling: [],
      messaging_frameworks: []
    };
  }
}

/**
 * Scrape and analyze company website using AI
 */
async function analyzeCompanyWebsite(websiteUrl: string, industry: Industry): Promise<WebsiteIntelligence> {
  
  // Normalize URL
  if (!websiteUrl.startsWith('http')) {
    websiteUrl = `https://${websiteUrl}`;
  }

  try {
    // Step 1: Scrape website content
    const scrapedContent = await scrapeWebsite(websiteUrl);
    
    if (!scrapedContent.success) {
      throw new Error(scrapedContent.error || 'Failed to scrape website');
    }

    // Step 2: Send to Claude for analysis
    const analysis = await analyzeWebsiteWithAI(scrapedContent.content!, industry, websiteUrl);

    return analysis;

  } catch (error) {
    console.error('Website analysis failed:', error);
    
    // Return minimal intelligence
    return {
      company_overview: `Company website: ${websiteUrl}`,
      value_proposition: 'To be discovered during onboarding',
      products_services: [],
      target_market: `${SUPPORTED_INDUSTRIES[industry]} sector`,
      competitive_positioning: 'To be defined',
      strengths: [],
      weaknesses: ['Limited website information available'],
      messaging_tone: 'Professional',
      key_pages_found: [],
      confidence_score: 0.2
    };
  }
}

/**
 * Scrape website content (homepage + key pages)
 */
async function scrapeWebsite(url: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    // Use a lightweight scraping approach (fetch + parse)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SamAI/1.0; +https://app.meet-sam.com)'
      },
      signal: AbortSignal.timeout(10000) // 10s timeout
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    
    // Extract text content (simple approach - remove scripts, styles, extract body text)
    const textContent = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 8000); // Limit to 8k chars for AI analysis

    return { success: true, content: textContent };

  } catch (error) {
    console.error('Website scrape error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown scraping error' 
    };
  }
}

/**
 * Analyze scraped website content with Claude
 */
async function analyzeWebsiteWithAI(
  websiteContent: string, 
  industry: Industry,
  websiteUrl: string
): Promise<WebsiteIntelligence> {
  
  const prompt = `Analyze this company website and extract business intelligence.

Website URL: ${websiteUrl}
Industry Context: ${SUPPORTED_INDUSTRIES[industry]}

Website Content:
${websiteContent}

Extract and provide:
1. Company Overview (2-3 sentences)
2. Value Proposition (main promise to customers)
3. Products/Services (list of offerings)
4. Target Market (who they sell to)
5. Competitive Positioning (how they differentiate)
6. Strengths (what they do well, based on website)
7. Weaknesses (gaps, unclear messaging, missing info)
8. Messaging Tone (professional, casual, technical, etc.)

Return as JSON:
{
  "company_overview": "...",
  "value_proposition": "...",
  "products_services": ["..."],
  "target_market": "...",
  "competitive_positioning": "...",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "messaging_tone": "...",
  "confidence_score": 0.8
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com',
        'X-Title': 'SAM AI Signup Intelligence'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '{}';
    
    // Extract JSON from response (might be wrapped in markdown code block)
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    const analysis = JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse);

    return {
      ...analysis,
      key_pages_found: [websiteUrl]
    };

  } catch (error) {
    console.error('AI analysis error:', error);
    throw error;
  }
}

/**
 * Populate workspace KB with gathered intelligence
 */
async function populateWorkspaceKB(params: {
  workspaceId: string;
  userId: string;
  companyName: string;
  industry: Industry;
  industryKnowledge: IndustryKnowledge;
  websiteIntel: WebsiteIntelligence | null;
  companySize?: string;
}): Promise<{ entries_created: number; sections_populated: string[] }> {

  const entries: any[] = [];
  const sectionsPopulated: string[] = [];

  // 1. Company Overview (from website intel)
  if (params.websiteIntel) {
    entries.push({
      workspace_id: params.workspaceId,
      category: 'business-model',
      subcategory: 'overview',
      title: `${params.companyName} - Company Overview`,
      content: params.websiteIntel.company_overview,
      tags: ['signup_intelligence', params.industry],
      source_type: 'signup_intelligence',
      source_metadata: { 
        confidence: params.websiteIntel.confidence_score,
        extracted_at: new Date().toISOString()
      },
      is_active: true,
      version: '1.0'
    });

    entries.push({
      workspace_id: params.workspaceId,
      category: 'business-model',
      subcategory: 'value-proposition',
      title: 'Value Proposition',
      content: params.websiteIntel.value_proposition,
      tags: ['signup_intelligence', 'messaging'],
      source_type: 'signup_intelligence',
      is_active: true,
      version: '1.0'
    });

    sectionsPopulated.push('overview', 'messaging');
  }

  // 2. Products (from website)
  if (params.websiteIntel?.products_services.length) {
    entries.push({
      workspace_id: params.workspaceId,
      category: 'products',
      subcategory: 'product-list',
      title: 'Products & Services',
      content: params.websiteIntel.products_services.join('\n- '),
      tags: ['signup_intelligence', params.industry],
      source_type: 'signup_intelligence',
      is_active: true,
      version: '1.0'
    });

    sectionsPopulated.push('products');
  }

  // 3. Target Market (from website + industry)
  if (params.websiteIntel) {
    entries.push({
      workspace_id: params.workspaceId,
      category: 'icp-intelligence',
      subcategory: 'target-market',
      title: 'Target Market Overview',
      content: params.websiteIntel.target_market,
      tags: ['signup_intelligence', 'icp'],
      source_type: 'signup_intelligence',
      is_active: true,
      version: '1.0'
    });

    sectionsPopulated.push('icp');
  }

  // 4. Competitive Positioning
  if (params.websiteIntel) {
    entries.push({
      workspace_id: params.workspaceId,
      category: 'competitive-intelligence',
      subcategory: 'positioning',
      title: 'Competitive Positioning',
      content: `Strengths:\n- ${params.websiteIntel.strengths.join('\n- ')}\n\nWeaknesses:\n- ${params.websiteIntel.weaknesses.join('\n- ')}\n\nPositioning:\n${params.websiteIntel.competitive_positioning}`,
      tags: ['signup_intelligence', 'positioning'],
      source_type: 'signup_intelligence',
      is_active: true,
      version: '1.0'
    });

    sectionsPopulated.push('competition');
  }

  // 5. Tone of Voice (from website)
  if (params.websiteIntel) {
    entries.push({
      workspace_id: params.workspaceId,
      category: 'tone-of-voice',
      subcategory: 'brand-voice',
      title: 'Brand Voice & Tone',
      content: params.websiteIntel.messaging_tone,
      tags: ['signup_intelligence', 'messaging'],
      source_type: 'signup_intelligence',
      is_active: true,
      version: '1.0'
    });

    sectionsPopulated.push('tone_of_voice');
  }

  // 6. Industry-specific pain points
  if (params.industryKnowledge.pain_points.length) {
    entries.push({
      workspace_id: params.workspaceId,
      category: 'industry-intelligence',
      subcategory: 'pain-points',
      title: `Common ${SUPPORTED_INDUSTRIES[params.industry]} Pain Points`,
      content: params.industryKnowledge.pain_points.join('\n- '),
      tags: ['industry_knowledge', params.industry],
      source_type: 'signup_intelligence',
      is_active: true,
      version: '1.0'
    });
  }

  // 7. Company metadata
  entries.push({
    workspace_id: params.workspaceId,
    category: 'company-info',
    subcategory: 'metadata',
    title: 'Company Information',
    content: `Company: ${params.companyName}\nIndustry: ${SUPPORTED_INDUSTRIES[params.industry]}\nSize: ${params.companySize || 'Not specified'}\nWebsite: ${params.websiteIntel?.key_pages_found[0] || 'Not provided'}`,
    tags: ['signup_intelligence', 'metadata'],
    source_type: 'signup_intelligence',
    is_active: true,
    version: '1.0'
  });

  sectionsPopulated.push('company_info');

  // Mark all entries as UNVALIDATED (requires user confirmation)
  const entriesWithValidation = entries.map(entry => ({
    ...entry,
    source_metadata: {
      ...entry.source_metadata,
      validated: false,
      validation_required: true,
      extraction_method: 'automated_signup_intelligence',
      confidence_note: 'Auto-extracted from website. Requires user validation.'
    },
    tags: [...(entry.tags || []), 'unvalidated', 'needs_review']
  }));

  // Insert all entries
  try {
    const { data, error } = await pool
      .from('knowledge_base')
      .insert(entriesWithValidation)
      .select();

    if (error) throw error;

    console.log(`✅ Created ${data?.length || 0} UNVALIDATED KB entries (require user confirmation)`);

    return {
      entries_created: data?.length || 0,
      sections_populated: Array.from(new Set(sectionsPopulated))
    };

  } catch (error) {
    console.error('Failed to populate KB:', error);
    return {
      entries_created: 0,
      sections_populated: []
    };
  }
}
