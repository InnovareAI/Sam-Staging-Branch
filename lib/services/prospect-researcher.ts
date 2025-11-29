/**
 * Prospect Researcher - Deep Research for Reply Agent
 * Uses Claude Direct API to research prospect's website, company LinkedIn, and personal LinkedIn
 * to understand ICP fit and generate highly relevant, engaging replies
 *
 * Updated Nov 29, 2025: Migrated to Claude Direct API for GDPR compliance
 */

import { claudeClient } from '@/lib/llm/claude-client';

export interface ProspectResearch {
  // Personal profile insights
  personal: {
    headline?: string;
    summary?: string;
    currentRole?: string;
    experience?: string[];
    skills?: string[];
    interests?: string[];
    recentActivity?: string[];
    connectionPoints?: string[];
    communicationStyle?: string;
  };
  // Company insights
  company: {
    description?: string;
    industry?: string;
    size?: string;
    specialties?: string[];
    recentNews?: string[];
    painPoints?: string[];
    competitors?: string[];
    techStack?: string[];
    growthStage?: string;
  };
  // Website insights
  website: {
    valueProposition?: string;
    targetAudience?: string;
    products?: string[];
    recentContent?: string[];
    tone?: string;
  };
  // ICP analysis
  icpAnalysis: {
    fitScore: number; // 0-100
    fitReason: string;
    buyingSignals: string[];
    potentialObjections: string[];
    recommendedApproach: string;
    keyTalkingPoints: string[];
  };
  // Raw data for transparency
  rawData: {
    linkedInProfileUrl?: string;
    companyLinkedInUrl?: string;
    websiteUrl?: string;
    fetchedAt: string;
  };
}

export interface ResearchContext {
  prospectName: string;
  prospectTitle?: string;
  prospectCompany?: string;
  linkedInUrl?: string;
  companyLinkedInUrl?: string;
  websiteUrl?: string;
  prospectReply?: string;
  originalOutreach?: string;
  // Unipile account ID for LinkedIn API access
  unipileAccountId?: string;
}

/**
 * Research a prospect using Opus 4.5 for deep analysis
 * Fetches and analyzes: personal LinkedIn, company LinkedIn, company website
 */
export async function researchProspect(context: ResearchContext): Promise<ProspectResearch> {
  const startTime = Date.now();
  console.log(`🔬 Starting prospect research for ${context.prospectName}...`);

  // Parallel fetch of all data sources
  const [linkedInData, companyLinkedInData, websiteData] = await Promise.all([
    fetchLinkedInProfile(context.linkedInUrl, context.unipileAccountId),
    fetchCompanyLinkedIn(context.companyLinkedInUrl, context.prospectCompany, context.unipileAccountId),
    fetchWebsiteContent(context.websiteUrl, context.prospectCompany)
  ]);

  // Build research prompt
  const researchPrompt = buildResearchPrompt(context, linkedInData, companyLinkedInData, websiteData);

  try {
    // Use Claude Direct API for GDPR compliance
    const response = await claudeClient.chat({
      system: RESEARCH_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: researchPrompt }
      ],
      max_tokens: 2000,
      temperature: 0.3 // Lower temperature for factual analysis
    });

    const content = response.content;

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ Could not parse research JSON');
      return getEmptyResearch(context);
    }

    const research = JSON.parse(jsonMatch[0]) as ProspectResearch;

    // Add metadata
    research.rawData = {
      linkedInProfileUrl: context.linkedInUrl,
      companyLinkedInUrl: context.companyLinkedInUrl,
      websiteUrl: context.websiteUrl,
      fetchedAt: new Date().toISOString()
    };

    const duration = Date.now() - startTime;
    console.log(`✅ Research completed in ${duration}ms - ICP Fit: ${research.icpAnalysis?.fitScore || 'N/A'}%`);

    return research;

  } catch (error) {
    console.error('❌ Research error:', error);
    return getEmptyResearch(context);
  }
}

/**
 * Fetch LinkedIn profile data via Unipile
 * Uses /api/v1/users/{vanity}?account_id={accountId} endpoint
 */
async function fetchLinkedInProfile(linkedInUrl?: string, unipileAccountId?: string): Promise<string | null> {
  if (!linkedInUrl) return null;

  try {
    const UNIPILE_DSN = process.env.UNIPILE_DSN;
    const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

    if (!UNIPILE_DSN || !UNIPILE_API_KEY) {
      console.log('⚠️ Unipile credentials not set');
      return null;
    }

    // Extract vanity from URL
    const vanityMatch = linkedInUrl.match(/linkedin\.com\/in\/([^\/\?#]+)/);
    if (!vanityMatch) {
      console.log('⚠️ Could not extract vanity from LinkedIn URL');
      return null;
    }

    const vanity = vanityMatch[1];
    console.log(`📥 Fetching LinkedIn profile: ${vanity}`);

    // Use account_id if available (more reliable), otherwise try without
    let profileUrl = `https://${UNIPILE_DSN}/api/v1/users/${encodeURIComponent(vanity)}`;
    if (unipileAccountId) {
      profileUrl += `?account_id=${unipileAccountId}`;
    }

    const response = await fetch(profileUrl, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`⚠️ LinkedIn profile fetch failed: ${response.status} - ${errorText.substring(0, 100)}`);
      return null;
    }

    const profile = await response.json();
    console.log(`✅ LinkedIn profile fetched for: ${profile.first_name || profile.name || vanity}`);

    // Format profile data for research
    return formatLinkedInProfile(profile);

  } catch (error) {
    console.error('LinkedIn profile fetch error:', error);
    return null;
  }
}

/**
 * Format LinkedIn profile data for analysis
 */
function formatLinkedInProfile(profile: any): string {
  if (!profile) return '';

  const sections = [];

  if (profile.first_name || profile.last_name) {
    sections.push(`Name: ${profile.first_name || ''} ${profile.last_name || ''}`);
  }
  if (profile.headline) {
    sections.push(`Headline: ${profile.headline}`);
  }
  if (profile.summary) {
    sections.push(`Summary: ${profile.summary}`);
  }
  if (profile.current_position) {
    sections.push(`Current Role: ${profile.current_position.title} at ${profile.current_position.company_name}`);
  }
  if (profile.positions && profile.positions.length > 0) {
    const roles = profile.positions.slice(0, 3).map((p: any) =>
      `- ${p.title} at ${p.company_name} (${p.start_date || 'N/A'})`
    );
    sections.push(`Experience:\n${roles.join('\n')}`);
  }
  if (profile.skills && profile.skills.length > 0) {
    sections.push(`Skills: ${profile.skills.slice(0, 10).join(', ')}`);
  }
  if (profile.industry) {
    sections.push(`Industry: ${profile.industry}`);
  }
  if (profile.location) {
    sections.push(`Location: ${profile.location}`);
  }

  return sections.join('\n\n');
}

/**
 * Fetch company LinkedIn data
 */
async function fetchCompanyLinkedIn(companyUrl?: string, companyName?: string, unipileAccountId?: string): Promise<string | null> {
  if (!companyUrl && !companyName) return null;

  try {
    const UNIPILE_DSN = process.env.UNIPILE_DSN;
    const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

    if (!UNIPILE_DSN || !UNIPILE_API_KEY) {
      return null;
    }

    // Extract company ID from URL if provided
    let companyId: string | null = null;
    if (companyUrl) {
      const match = companyUrl.match(/linkedin\.com\/company\/([^\/\?#]+)/);
      if (match) companyId = match[1];
    }

    if (!companyId && companyName && unipileAccountId) {
      // Search for company by name (requires account_id)
      console.log(`📥 Searching company LinkedIn: ${companyName}`);
      const searchUrl = `https://${UNIPILE_DSN}/api/v1/linkedin/search?type=company&query=${encodeURIComponent(companyName)}&account_id=${unipileAccountId}`;
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (searchResponse.ok) {
        const results = await searchResponse.json();
        if (results.items && results.items.length > 0) {
          companyId = results.items[0].id;
          console.log(`✅ Found company: ${results.items[0].name || companyId}`);
        }
      }
    }

    if (!companyId) {
      console.log(`⚠️ Could not find company LinkedIn page`);
      return null;
    }

    // Fetch company profile
    let profileUrl = `https://${UNIPILE_DSN}/api/v1/companies/${companyId}`;
    if (unipileAccountId) {
      profileUrl += `?account_id=${unipileAccountId}`;
    }
    const response = await fetch(profileUrl, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) return null;

    const company = await response.json();
    return formatCompanyProfile(company);

  } catch (error) {
    console.error('Company LinkedIn fetch error:', error);
    return null;
  }
}

/**
 * Format company profile data
 */
function formatCompanyProfile(company: any): string {
  if (!company) return '';

  const sections = [];

  if (company.name) sections.push(`Company: ${company.name}`);
  if (company.description) sections.push(`Description: ${company.description}`);
  if (company.industry) sections.push(`Industry: ${company.industry}`);
  if (company.company_size) sections.push(`Size: ${company.company_size}`);
  if (company.specialties) sections.push(`Specialties: ${company.specialties.join(', ')}`);
  if (company.website) sections.push(`Website: ${company.website}`);
  if (company.headquarters) sections.push(`HQ: ${company.headquarters}`);
  if (company.founded) sections.push(`Founded: ${company.founded}`);

  return sections.join('\n');
}

/**
 * Fetch website content via web scraping
 */
async function fetchWebsiteContent(websiteUrl?: string, companyName?: string): Promise<string | null> {
  if (!websiteUrl && !companyName) return null;

  try {
    // If no URL but have company name, try common patterns
    if (!websiteUrl && companyName) {
      const cleanName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      websiteUrl = `https://${cleanName}.com`;
    }

    if (!websiteUrl) return null;

    // Use a simple fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SAM-AI/1.0; +https://app.meet-sam.com)'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();

    // Extract useful content from HTML
    return extractWebsiteContent(html, websiteUrl);

  } catch (error) {
    console.error('Website fetch error:', error);
    return null;
  }
}

/**
 * Extract useful content from HTML
 */
function extractWebsiteContent(html: string, url: string): string {
  const sections = [`URL: ${url}`];

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    sections.push(`Title: ${titleMatch[1].trim()}`);
  }

  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (descMatch) {
    sections.push(`Description: ${descMatch[1].trim()}`);
  }

  // Extract headings (h1, h2)
  const h1Matches = html.match(/<h1[^>]*>([^<]+)<\/h1>/gi) || [];
  const h2Matches = html.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || [];

  const headings = [...h1Matches, ...h2Matches.slice(0, 5)]
    .map(h => h.replace(/<[^>]+>/g, '').trim())
    .filter(h => h.length > 0 && h.length < 100);

  if (headings.length > 0) {
    sections.push(`Key Headings:\n${headings.map(h => `- ${h}`).join('\n')}`);
  }

  // Extract any visible text (simplified)
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);

  if (textContent) {
    sections.push(`Content Preview: ${textContent}`);
  }

  return sections.join('\n\n');
}

/**
 * Build the research prompt for Opus 4.5
 */
function buildResearchPrompt(
  context: ResearchContext,
  linkedInData: string | null,
  companyLinkedInData: string | null,
  websiteData: string | null
): string {
  return `Analyze this prospect to help craft a highly relevant reply to their message.

## PROSPECT INFO
Name: ${context.prospectName}
Title: ${context.prospectTitle || 'Unknown'}
Company: ${context.prospectCompany || 'Unknown'}

## PROSPECT'S MESSAGE
${context.prospectReply ? `"${context.prospectReply}"` : 'No message yet'}

## OUR ORIGINAL OUTREACH
${context.originalOutreach ? `"${context.originalOutreach}"` : 'Not available'}

## LINKEDIN PROFILE DATA
${linkedInData || 'Not available'}

## COMPANY LINKEDIN DATA
${companyLinkedInData || 'Not available'}

## COMPANY WEBSITE DATA
${websiteData || 'Not available'}

---

Based on all available information, provide a deep analysis in the following JSON format:

{
  "personal": {
    "headline": "Their LinkedIn headline",
    "summary": "Key points from their summary",
    "currentRole": "Current job title and responsibilities",
    "experience": ["Notable past roles/achievements"],
    "skills": ["Key skills relevant to our product"],
    "interests": ["Professional interests"],
    "recentActivity": ["Any recent posts/engagement patterns"],
    "connectionPoints": ["Things we have in common or can reference"],
    "communicationStyle": "Inferred communication style (formal/casual/direct/etc)"
  },
  "company": {
    "description": "What the company does",
    "industry": "Primary industry",
    "size": "Company size estimate",
    "specialties": ["Key areas of focus"],
    "recentNews": ["Any notable recent developments"],
    "painPoints": ["Likely challenges they face that SAM could solve"],
    "competitors": ["Key competitors if relevant"],
    "techStack": ["Likely tools/technologies they use"],
    "growthStage": "startup/growth/enterprise/etc"
  },
  "website": {
    "valueProposition": "Their core value prop",
    "targetAudience": "Who they sell to",
    "products": ["Main products/services"],
    "recentContent": ["Notable blog posts or updates"],
    "tone": "Website communication tone"
  },
  "icpAnalysis": {
    "fitScore": 0-100,
    "fitReason": "Why they are/aren't a good fit for SAM",
    "buyingSignals": ["Signals they might be ready to buy"],
    "potentialObjections": ["Likely concerns they might have"],
    "recommendedApproach": "How to approach this specific prospect",
    "keyTalkingPoints": ["Specific points to mention in the reply"]
  }
}

Be thorough but concise. Focus on actionable insights that will help craft a highly relevant, personalized reply. If data is not available, make reasonable inferences based on what is known, but indicate when you're inferring.`;
}

/**
 * System prompt for the research agent
 */
const RESEARCH_SYSTEM_PROMPT = `You are an expert B2B sales research analyst. Your job is to analyze prospect data and provide actionable insights that help sales reps craft highly relevant, personalized messages.

Your analysis should:
1. Be factual and based on available data
2. Make reasonable inferences when data is limited
3. Focus on insights that help personalize communication
4. Identify pain points that align with SAM's value proposition
5. Surface any buying signals or red flags
6. Recommend specific talking points for the reply

SAM is a B2B sales automation platform that helps teams:
- Automate LinkedIn and email outreach
- Generate AI-powered personalized messages
- Manage human-in-the-loop approval workflows
- Track campaign performance and replies

Good ICP indicators for SAM:
- B2B companies with outbound sales teams
- Startups and SMBs scaling their sales efforts
- Companies frustrated with manual prospecting
- Teams using LinkedIn for lead generation
- Companies valuing personalization in outreach

Always respond with valid JSON.`;

/**
 * Return empty research structure when data unavailable
 */
function getEmptyResearch(context: ResearchContext): ProspectResearch {
  return {
    personal: {
      connectionPoints: [],
      communicationStyle: 'professional'
    },
    company: {
      painPoints: [],
      specialties: []
    },
    website: {},
    icpAnalysis: {
      fitScore: 50,
      fitReason: 'Insufficient data for accurate assessment',
      buyingSignals: [],
      potentialObjections: [],
      recommendedApproach: 'Standard professional approach - gather more context',
      keyTalkingPoints: []
    },
    rawData: {
      linkedInProfileUrl: context.linkedInUrl,
      companyLinkedInUrl: context.companyLinkedInUrl,
      websiteUrl: context.websiteUrl,
      fetchedAt: new Date().toISOString()
    }
  };
}

/**
 * Generate a research summary for inclusion in the reply draft prompt
 */
export function formatResearchForPrompt(research: ProspectResearch): string {
  const sections: string[] = [];

  // Personal insights
  if (research.personal) {
    const p = research.personal;
    const personalParts: string[] = [];
    if (p.headline) personalParts.push(`Headline: ${p.headline}`);
    if (p.currentRole) personalParts.push(`Role: ${p.currentRole}`);
    if (p.communicationStyle) personalParts.push(`Style: ${p.communicationStyle}`);
    if (p.connectionPoints && p.connectionPoints.length > 0) {
      personalParts.push(`Connection points: ${p.connectionPoints.join(', ')}`);
    }
    if (personalParts.length > 0) {
      sections.push(`**Personal Insights:**\n${personalParts.join('\n')}`);
    }
  }

  // Company insights
  if (research.company) {
    const c = research.company;
    const companyParts: string[] = [];
    if (c.description) companyParts.push(`About: ${c.description}`);
    if (c.industry) companyParts.push(`Industry: ${c.industry}`);
    if (c.size) companyParts.push(`Size: ${c.size}`);
    if (c.growthStage) companyParts.push(`Stage: ${c.growthStage}`);
    if (c.painPoints && c.painPoints.length > 0) {
      companyParts.push(`Likely pain points: ${c.painPoints.join(', ')}`);
    }
    if (companyParts.length > 0) {
      sections.push(`**Company Insights:**\n${companyParts.join('\n')}`);
    }
  }

  // ICP analysis
  if (research.icpAnalysis) {
    const icp = research.icpAnalysis;
    const icpParts: string[] = [];
    icpParts.push(`Fit score: ${icp.fitScore}/100`);
    if (icp.fitReason) icpParts.push(`Reason: ${icp.fitReason}`);
    if (icp.recommendedApproach) icpParts.push(`Approach: ${icp.recommendedApproach}`);
    if (icp.buyingSignals && icp.buyingSignals.length > 0) {
      icpParts.push(`Buying signals: ${icp.buyingSignals.join(', ')}`);
    }
    if (icp.potentialObjections && icp.potentialObjections.length > 0) {
      icpParts.push(`Watch for: ${icp.potentialObjections.join(', ')}`);
    }
    if (icp.keyTalkingPoints && icp.keyTalkingPoints.length > 0) {
      icpParts.push(`Key talking points:\n${icp.keyTalkingPoints.map(p => `- ${p}`).join('\n')}`);
    }
    sections.push(`**ICP Analysis:**\n${icpParts.join('\n')}`);
  }

  return sections.join('\n\n');
}
