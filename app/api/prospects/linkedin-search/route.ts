import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

// Unipile API for LinkedIn search
// API Docs: https://developer.unipile.com/docs/linkedin-search
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN;
// UNIPILE_DSN format: "api6.unipile.com:13670" - already includes domain and port
const UNIPILE_BASE_URL = `https://${UNIPILE_DSN}`;

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Get authenticated user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      searchQuery, 
      searchType = 'people', // 'people', 'companies', 'posts', 'jobs'
      navigator = 'classic', // 'classic', 'sales_navigator', 'recruiter'
      filters = {},
      limit = 50,
      cursor = null, // For pagination
      accountId // LinkedIn account ID to search from
    } = body;
    
    if (!searchQuery && !filters.url) {
      return NextResponse.json({
        success: false,
        error: 'Search query or URL is required'
      }, { status: 400 });
    }

    // Check if Unipile is configured
    if (!UNIPILE_API_KEY || !UNIPILE_DSN) {
      console.error('Unipile not configured - LinkedIn search unavailable');
      return NextResponse.json({
        success: false,
        error: 'LinkedIn search is not configured. Please contact support to enable Unipile integration.',
        details: {
          missingConfig: [
            !UNIPILE_API_KEY ? 'UNIPILE_API_KEY' : null,
            !UNIPILE_DSN ? 'UNIPILE_DSN' : null
          ].filter(Boolean)
        }
      }, { status: 503 });
    }

    // Get user's LinkedIn account from database
    let linkedinAccountId = accountId;
    if (!linkedinAccountId) {
      const { data: linkedinAccount } = await supabase
        .from('linkedin_accounts')
        .select('unipile_account_id')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .single();
      
      if (!linkedinAccount?.unipile_account_id) {
        return NextResponse.json({
          success: false,
          error: 'No active LinkedIn account found. Please connect your LinkedIn account first.'
        }, { status: 400 });
      }
      
      linkedinAccountId = linkedinAccount.unipile_account_id;
    }

    // Build Apify actor input
    const actorInput = {
      searchUrls: [buildLinkedInSearchUrl(searchQuery, filters)],
      maxResults: maxResults,
      proxyConfiguration: useProxy ? {
        useApifyProxy: false, // Use Bright Data instead
        proxyUrls: [getBrightDataProxyUrl()]
      } : undefined,
      // LinkedIn scraper options
      scrapeCompanyInfo: true,
      scrapeEducation: true,
      scrapeExperience: true,
      scrapeSkills: true
    };

    // Start Apify actor run
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${LINKEDIN_SCRAPER_ACTOR_ID}/runs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APIFY_API_TOKEN}`
        },
        body: JSON.stringify(actorInput)
      }
    );

    if (!runResponse.ok) {
      throw new Error(`Apify API error: ${runResponse.statusText}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;

    // Poll for results (with timeout)
    const results = await pollApifyRun(runId, 60000); // 60 second timeout

    // Transform Apify results to our prospect format
    const prospects = results.map(transformApifyResult);

    // Save to database for future reference
    await saveProspectSearch(supabase, {
      user_id: session.user.id,
      search_query: searchQuery,
      filters,
      results_count: prospects.length,
      prospects: prospects,
      source: 'apify_linkedin'
    });

    return NextResponse.json({
      success: true,
      prospects,
      metadata: {
        source: 'apify',
        query: searchQuery,
        total_found: prospects.length,
        run_id: runId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('LinkedIn search error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'LinkedIn search failed'
    }, { status: 500 });
  }
}

// Build LinkedIn search URL from query and filters
function buildLinkedInSearchUrl(query: string, filters: any) {
  const baseUrl = 'https://www.linkedin.com/search/results/people/';
  const params = new URLSearchParams();
  
  params.append('keywords', query);
  
  if (filters.location) {
    params.append('geoUrn', filters.location);
  }
  
  if (filters.company) {
    params.append('currentCompany', filters.company);
  }
  
  if (filters.industry) {
    params.append('industry', filters.industry);
  }
  
  if (filters.title) {
    params.append('title', filters.title);
  }
  
  return `${baseUrl}?${params.toString()}`;
}

// Get Bright Data proxy URL with authentication
function getBrightDataProxyUrl() {
  const username = process.env.BRIGHT_DATA_USERNAME;
  const password = process.env.BRIGHT_DATA_PASSWORD;
  const endpoint = process.env.BRIGHT_DATA_ENDPOINT || 'brd.superproxy.io';
  const port = process.env.BRIGHT_DATA_PORT || '22225';
  
  if (!username || !password) {
    throw new Error('Bright Data credentials not configured');
  }
  
  return `http://${username}:${password}@${endpoint}:${port}`;
}

// Poll Apify run until completion or timeout
async function pollApifyRun(runId: string, timeoutMs: number) {
  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds
  
  while (Date.now() - startTime < timeoutMs) {
    const statusResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}`,
      {
        headers: {
          'Authorization': `Bearer ${APIFY_API_TOKEN}`
        }
      }
    );
    
    const statusData = await statusResponse.json();
    const status = statusData.data.status;
    
    if (status === 'SUCCEEDED') {
      // Get dataset results
      const datasetId = statusData.data.defaultDatasetId;
      const datasetResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items`,
        {
          headers: {
            'Authorization': `Bearer ${APIFY_API_TOKEN}`
          }
        }
      );
      
      return await datasetResponse.json();
    }
    
    if (status === 'FAILED' || status === 'ABORTED') {
      throw new Error(`Apify run ${status.toLowerCase()}`);
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  throw new Error('Apify run timeout');
}

// Transform Apify result to our prospect format
function transformApifyResult(apifyData: any) {
  return {
    id: `linkedin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    source: 'apify_linkedin',
    
    // Basic info
    name: apifyData.fullName || `${apifyData.firstName} ${apifyData.lastName}`,
    firstName: apifyData.firstName,
    lastName: apifyData.lastName,
    title: apifyData.headline || apifyData.title,
    company: apifyData.company || apifyData.companyName,
    
    // Contact info
    email: apifyData.email || null,
    phone: apifyData.phone || null,
    linkedinUrl: apifyData.url || apifyData.publicIdentifier,
    profileUrl: apifyData.url || apifyData.publicIdentifier,
    
    // Location
    location: apifyData.location || apifyData.locationName,
    country: apifyData.country,
    city: apifyData.city,
    
    // Additional data
    industry: apifyData.industry,
    summary: apifyData.summary || apifyData.about,
    
    // LinkedIn metrics
    connectionDegree: apifyData.connectionDegree || 3,
    mutualConnections: apifyData.mutualConnectionsCount || 0,
    followerCount: apifyData.followersCount || 0,
    
    // Experience
    currentPosition: apifyData.positions ? apifyData.positions[0] : null,
    experience: apifyData.positions || [],
    education: apifyData.schools || [],
    skills: apifyData.skills || [],
    
    // Profile quality indicators
    profileCompleteness: calculateProfileCompleteness(apifyData),
    hasPhoto: !!apifyData.photoUrl,
    premiumAccount: apifyData.premium || false,
    
    // Metadata
    scrapedAt: new Date().toISOString(),
    confidence: calculateConfidence(apifyData),
    complianceFlags: []
  };
}

// Calculate profile completeness score
function calculateProfileCompleteness(data: any): number {
  let score = 0;
  const fields = [
    'fullName', 'headline', 'location', 'summary',
    'photoUrl', 'company', 'positions', 'schools', 'skills'
  ];
  
  fields.forEach(field => {
    if (data[field] && 
        (Array.isArray(data[field]) ? data[field].length > 0 : true)) {
      score += 1;
    }
  });
  
  return Math.round((score / fields.length) * 100);
}

// Calculate confidence score based on data quality
function calculateConfidence(data: any): number {
  let score = 0;
  
  // Has complete name
  if (data.firstName && data.lastName) score += 0.2;
  
  // Has title/headline
  if (data.headline || data.title) score += 0.2;
  
  // Has company
  if (data.company || data.companyName) score += 0.2;
  
  // Has location
  if (data.location) score += 0.1;
  
  // Has contact info
  if (data.email) score += 0.15;
  
  // Has experience data
  if (data.positions && data.positions.length > 0) score += 0.1;
  
  // Profile photo
  if (data.photoUrl) score += 0.05;
  
  return Math.min(0.95, score);
}

// Save prospect search to database
async function saveProspectSearch(supabase: any, data: any) {
  const { error } = await supabase
    .from('prospect_searches')
    .insert({
      user_id: data.user_id,
      search_query: data.search_query,
      filters: data.filters,
      results_count: data.results_count,
      prospects: data.prospects,
      source: data.source,
      searched_at: new Date().toISOString()
    });
  
  if (error) {
    console.error('Failed to save prospect search:', error);
  }
}

// DEPRECATED: Mock data generator removed - no longer returns fake prospects
// This function was causing "lookalike data" issues where fake prospects
// (Prospect 1, Prospect 2, TechCorp, InnovateLabs) were shown instead of real data
//
// function generateMockProspects(query: string, count: number) {
//   const titles = ['CEO', 'CTO', 'VP Sales', 'VP Marketing', 'Director', 'Manager'];
//   const companies = ['TechCorp', 'InnovateLabs', 'GrowthHub', 'DataPro', 'CloudSystems'];
//
//   return Array.from({ length: count }, (_, i) => ({
//     id: `mock_${i}`,
//     name: `Prospect ${i + 1}`,
//     title: titles[i % titles.length],
//     company: companies[i % companies.length],
//     email: `prospect${i + 1}@example.com`,
//     linkedinUrl: `https://linkedin.com/in/prospect-${i + 1}`,
//     confidence: 0.75,
//     source: 'mock'
//   }));
// }
