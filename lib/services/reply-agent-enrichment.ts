/**
 * Reply Agent Enrichment Service
 * Scrapes prospect context (website + LinkedIn) before generating reply drafts
 */

export interface ProspectEnrichmentData {
  company_website_content?: {
    about: string;
    products_services: string[];
    key_initiatives: string[];
    scraped_at: string;
  };
  linkedin_profile_content?: {
    headline: string;
    summary: string;
    recent_posts?: string[];
    current_role: string;
    company_info: string;
    scraped_at: string;
  };
  enrichment_metadata: {
    sources_scraped: string[];
    scraping_duration_ms: number;
    success: boolean;
    errors?: string[];
  };
}

/**
 * Scrape company website for context
 */
async function scrapeCompanyWebsite(companyWebsite: string): Promise<{
  success: boolean;
  content?: {
    about: string;
    products_services: string[];
    key_initiatives: string[];
  };
  error?: string;
}> {
  try {
    console.log('🌐 Scraping company website:', companyWebsite);

    // Use Apify MCP to scrape website
    const response = await fetch('/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'apify__run_actor',
        params: {
          actor_id: 'apify/website-content-crawler',
          input: {
            startUrls: [{ url: companyWebsite }],
            maxCrawlDepth: 2,
            maxCrawlPages: 10,
            excludeUrlPatterns: ['*blog*', '*news*', '*press*'], // Focus on core pages
            proxyConfiguration: { useApifyProxy: true }
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Apify API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract key information from scraped content
    const scrapedPages = data.results || [];

    // Analyze content to extract relevant information
    let about = '';
    const productsServices: string[] = [];
    const keyInitiatives: string[] = [];

    for (const page of scrapedPages) {
      const text = page.text || '';
      const url = page.url || '';

      // Detect "About" page
      if (url.includes('/about') || text.toLowerCase().includes('about us')) {
        about = text.substring(0, 500); // First 500 chars
      }

      // Detect products/services
      if (url.includes('/products') || url.includes('/services') || url.includes('/solutions')) {
        const matches = text.match(/(?:product|service|solution):\s*([^.]+)/gi);
        if (matches) {
          productsServices.push(...matches.slice(0, 5));
        }
      }

      // Detect initiatives (keywords: "initiative", "program", "focus")
      const initiativeMatches = text.match(/(?:initiative|program|focus|mission):\s*([^.]+)/gi);
      if (initiativeMatches) {
        keyInitiatives.push(...initiativeMatches.slice(0, 3));
      }
    }

    return {
      success: true,
      content: {
        about: about || 'No about information found',
        products_services: productsServices,
        key_initiatives: keyInitiatives
      }
    };

  } catch (error) {
    console.error('Failed to scrape company website:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Scrape LinkedIn profile for context
 */
async function scrapeLinkedInProfile(linkedinUrl: string): Promise<{
  success: boolean;
  content?: {
    headline: string;
    summary: string;
    recent_posts: string[];
    current_role: string;
    company_info: string;
  };
  error?: string;
}> {
  try {
    console.log('👔 Scraping LinkedIn profile:', linkedinUrl);

    // Use Unipile to get LinkedIn profile data
    const response = await fetch('/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'unipile__get_profile',
        params: {
          profile_url: linkedinUrl,
          include_posts: true,
          post_limit: 5
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Unipile API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      content: {
        headline: data.headline || '',
        summary: data.summary || data.about || '',
        recent_posts: data.recent_posts?.map((p: any) => p.text).slice(0, 3) || [],
        current_role: data.current_position?.title || '',
        company_info: data.current_position?.company_name || ''
      }
    };

  } catch (error) {
    console.error('Failed to scrape LinkedIn profile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Enrich prospect context by scraping website and LinkedIn
 */
export async function enrichProspectContext(prospect: {
  linkedin_url?: string;
  company_website?: string;
  company?: string;
}): Promise<ProspectEnrichmentData> {
  const startTime = Date.now();
  const sourcesScrapped: string[] = [];
  const errors: string[] = [];

  let companyWebsiteContent;
  let linkedinProfileContent;

  // Scrape company website if available
  if (prospect.company_website) {
    const websiteResult = await scrapeCompanyWebsite(prospect.company_website);
    if (websiteResult.success && websiteResult.content) {
      companyWebsiteContent = {
        ...websiteResult.content,
        scraped_at: new Date().toISOString()
      };
      sourcesScrapped.push('company_website');
    } else if (websiteResult.error) {
      errors.push(`Website: ${websiteResult.error}`);
    }
  }

  // Scrape LinkedIn profile if available
  if (prospect.linkedin_url) {
    const linkedinResult = await scrapeLinkedInProfile(prospect.linkedin_url);
    if (linkedinResult.success && linkedinResult.content) {
      linkedinProfileContent = {
        ...linkedinResult.content,
        scraped_at: new Date().toISOString()
      };
      sourcesScrapped.push('linkedin');
    } else if (linkedinResult.error) {
      errors.push(`LinkedIn: ${linkedinResult.error}`);
    }
  }

  const duration = Date.now() - startTime;

  return {
    company_website_content: companyWebsiteContent,
    linkedin_profile_content: linkedinProfileContent,
    enrichment_metadata: {
      sources_scraped: sourcesScrapped,
      scraping_duration_ms: duration,
      success: sourcesScrapped.length > 0,
      errors: errors.length > 0 ? errors : undefined
    }
  };
}

/**
 * Match prospect question to product/service offerings
 */
export function matchQuestionToOffer(
  prospectQuestion: string,
  enrichmentData: ProspectEnrichmentData,
  campaignContext: {
    products?: string[];
    services?: string[];
    value_props?: string[];
  }
): {
  matched_offers: string[];
  relevance_score: number;
  reasoning: string;
} {
  const questionLower = prospectQuestion.toLowerCase();
  const matchedOffers: string[] = [];

  // Extract keywords from question
  const questionKeywords = extractKeywords(questionLower);

  // Check products/services from company website
  if (enrichmentData.company_website_content) {
    for (const product of enrichmentData.company_website_content.products_services) {
      const productKeywords = extractKeywords(product.toLowerCase());
      const overlap = questionKeywords.filter(k => productKeywords.includes(k));

      if (overlap.length > 0) {
        matchedOffers.push(product);
      }
    }
  }

  // Check campaign offerings
  const allOfferings = [
    ...(campaignContext.products || []),
    ...(campaignContext.services || []),
    ...(campaignContext.value_props || [])
  ];

  for (const offering of allOfferings) {
    const offeringKeywords = extractKeywords(offering.toLowerCase());
    const overlap = questionKeywords.filter(k => offeringKeywords.includes(k));

    if (overlap.length > 0 && !matchedOffers.includes(offering)) {
      matchedOffers.push(offering);
    }
  }

  // Calculate relevance score (0-1)
  const relevanceScore = matchedOffers.length > 0
    ? Math.min(matchedOffers.length / 3, 1) // Cap at 3 matches = 100%
    : 0;

  const reasoning = matchedOffers.length > 0
    ? `Prospect's question relates to: ${matchedOffers.slice(0, 2).join(', ')}`
    : 'No direct match found - respond with general value proposition';

  return {
    matched_offers: matchedOffers.slice(0, 3), // Top 3 matches
    relevance_score: relevanceScore,
    reasoning
  };
}

/**
 * Extract keywords from text (simple implementation)
 */
function extractKeywords(text: string): string[] {
  // Remove common words and extract meaningful terms
  const commonWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
                       'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
                       'can', 'could', 'may', 'might', 'must', 'to', 'of', 'in', 'for', 'on',
                       'with', 'at', 'by', 'from', 'up', 'about', 'into', 'through', 'during'];

  return text
    .split(/\W+/)
    .filter(word => word.length > 3 && !commonWords.includes(word.toLowerCase()))
    .map(word => word.toLowerCase());
}
