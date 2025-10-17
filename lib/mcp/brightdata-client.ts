/**
 * BrightData MCP Client
 * Connects to BrightData via Model Context Protocol for lead scraping
 */

export interface BrightDataProspect {
  linkedin_url?: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  company_name?: string;
  company_website?: string;
  location?: string;
  email?: string;
  phone?: string;
  profile_summary?: string;
  skills?: string[];
  experience?: Array<{
    company: string;
    title: string;
    duration?: string;
  }>;
  education?: Array<{
    school: string;
    degree?: string;
  }>;
  enrichment_data?: Record<string, any>;
}

export interface BrightDataSearchParams {
  search_query?: string;
  job_titles?: string[];
  industries?: string[];
  locations?: string[];
  company_sizes?: string[];
  seniority_levels?: string[];
  max_results?: number;
  include_contact_info?: boolean;
  include_company_info?: boolean;
  proxy_location?: string;
}

export interface BrightDataSearchResult {
  success: boolean;
  prospects: BrightDataProspect[];
  total_found: number;
  search_metadata: {
    query: string;
    filters_applied: BrightDataSearchParams;
    search_time_ms: number;
    source: string;
  };
  error?: string;
}

/**
 * Check if BrightData MCP tool is available
 */
export async function isBrightDataAvailable(): Promise<boolean> {
  try {
    // Check MCP health endpoint
    const response = await fetch('/api/mcp/health');
    if (!response.ok) return false;

    const data = await response.json();
    return data.brightdata_available === true;
  } catch (error) {
    console.error('Error checking BrightData availability:', error);
    return false;
  }
}

/**
 * Search for prospects using BrightData MCP
 */
export async function searchProspects(
  params: BrightDataSearchParams
): Promise<BrightDataSearchResult> {
  try {
    console.log('🔍 BrightData MCP: Searching prospects...', params);

    // Call the BrightData scraper API endpoint
    const response = await fetch('/api/leads/brightdata-scraper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'scrape_prospects',
        search_params: {
          target_sites: ['linkedin'],
          search_criteria: {
            keywords: params.search_query,
            job_titles: params.job_titles || [],
            industries: params.industries || [],
            locations: params.locations || [],
            company_sizes: params.company_sizes || [],
            seniority_levels: params.seniority_levels || []
          },
          scraping_options: {
            max_results: params.max_results || 10,
            include_emails: params.include_contact_info || false,
            include_company: params.include_company_info || true,
            geo_location: params.proxy_location || 'us'
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`BrightData API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        prospects: [],
        total_found: 0,
        search_metadata: {
          query: params.search_query || '',
          filters_applied: params,
          search_time_ms: 0,
          source: 'brightdata'
        },
        error: data.error || 'Unknown error'
      };
    }

    return {
      success: true,
      prospects: data.prospects || [],
      total_found: data.total || 0,
      search_metadata: {
        query: params.search_query || '',
        filters_applied: params,
        search_time_ms: data.search_time_ms || 0,
        source: 'brightdata'
      }
    };

  } catch (error) {
    console.error('BrightData MCP search error:', error);
    return {
      success: false,
      prospects: [],
      total_found: 0,
      search_metadata: {
        query: params.search_query || '',
        filters_applied: params,
        search_time_ms: 0,
        source: 'brightdata'
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Scrape company employees using BrightData MCP
 */
export async function scrapeCompanyEmployees(
  companyName: string,
  filters?: {
    job_titles?: string[];
    departments?: string[];
    seniority_levels?: string[];
    max_results?: number;
  }
): Promise<BrightDataSearchResult> {
  try {
    console.log('🏢 BrightData MCP: Scraping company employees...', companyName);

    const response = await fetch('/api/leads/brightdata-scraper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'scrape_company_employees',
        company_name: companyName,
        filters: {
          job_titles: filters?.job_titles || [],
          departments: filters?.departments || [],
          seniority_levels: filters?.seniority_levels || [],
          max_results: filters?.max_results || 20
        }
      })
    });

    if (!response.ok) {
      throw new Error(`BrightData API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        prospects: [],
        total_found: 0,
        search_metadata: {
          query: `employees at ${companyName}`,
          filters_applied: filters || {},
          search_time_ms: 0,
          source: 'brightdata'
        },
        error: data.error || 'Unknown error'
      };
    }

    return {
      success: true,
      prospects: data.prospects || [],
      total_found: data.total || 0,
      search_metadata: {
        query: `employees at ${companyName}`,
        filters_applied: filters || {},
        search_time_ms: data.search_time_ms || 0,
        source: 'brightdata'
      }
    };

  } catch (error) {
    console.error('BrightData company employees error:', error);
    return {
      success: false,
      prospects: [],
      total_found: 0,
      search_metadata: {
        query: `employees at ${companyName}`,
        filters_applied: filters || {},
        search_time_ms: 0,
        source: 'brightdata'
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Verify contact information using BrightData
 */
export async function verifyContactInfo(
  prospects: Array<{ email?: string; linkedin_url?: string; name: string }>
): Promise<{
  success: boolean;
  verified_prospects: Array<BrightDataProspect & { verification_status: string }>;
  error?: string;
}> {
  try {
    console.log('✅ BrightData MCP: Verifying contact info...', prospects.length);

    const response = await fetch('/api/leads/brightdata-scraper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verify_contact_info',
        prospects: prospects
      })
    });

    if (!response.ok) {
      throw new Error(`BrightData API error: ${response.status}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('BrightData verification error:', error);
    return {
      success: false,
      verified_prospects: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
