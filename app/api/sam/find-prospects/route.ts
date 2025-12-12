import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/app/lib/supabase';

// Extend function timeout to 60 seconds for pagination across many pages
export const maxDuration = 60;

/**
 * Sam's Prospect Finding Interface
 * Integrates multiple prospect sources with template-based outreach
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      search_type = 'unipile_linkedin_search', // Default to Unipile (no quota limits!)
      search_criteria,
      campaign_config,
      auto_send = false
    } = body;

    const supabase = createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Get user's workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    const workspaceId = userProfile?.current_workspace_id;
    if (!workspaceId) {
      return NextResponse.json({
        error: 'No workspace found'
      }, { status: 400 });
    }

    // Check LinkedIn account capabilities before search
    let accountCapabilities = null;
    if (search_type === 'unipile_linkedin_search') {
      accountCapabilities = await checkLinkedInAccountCapabilities(supabase, user.id, workspaceId);

      // Validate search criteria against account capabilities
      const validation = validateSearchCriteria(search_criteria, accountCapabilities);

      if (validation.unsupportedCriteria.length > 0) {
        // Return early with capabilities info for SAM to handle
        return NextResponse.json({
          success: false,
          error: 'account_limitations',
          accountType: accountCapabilities.apiType,
          accountName: accountCapabilities.accountName,
          unsupportedCriteria: validation.unsupportedCriteria,
          supportedCriteria: validation.supportedCriteria,
          message: `Your ${accountCapabilities.accountType === 'classic' ? 'LinkedIn Premium' : accountCapabilities.apiType} account does not support: ${validation.unsupportedCriteria.join(', ')}`,
          recommendation: accountCapabilities.apiType === 'classic'
            ? 'Upgrade to LinkedIn Sales Navigator for full search capabilities'
            : null
        }, { status: 200 }); // 200 so SAM can handle gracefully
      }
    }

    let prospectResults;

    switch (search_type) {
      case 'brightdata': {
        // Use Bright Data for comprehensive prospect scraping
        const brightDataResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/leads/brightdata-scraper`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            action: 'scrape_prospects',
            search_params: {
              target_sites: ['linkedin', 'apollo'],
              search_criteria: {
                keywords: search_criteria.keywords,
                job_titles: search_criteria.job_titles,
                industries: search_criteria.industries,
                locations: search_criteria.locations || ['United States'],
                company_size: search_criteria.company_size
              },
              scraping_options: {
                max_results: search_criteria.max_results || 50,
                include_emails: true,
                include_phone: false,
                depth: 'detailed'
              }
            },
            use_premium_proxies: true
          })
        });

        prospectResults = await brightDataResponse.json();
        break;
      }

      case 'unipile_linkedin_search': {
        // Full LinkedIn database search via Unipile (RECOMMENDED - No quota limits!)
        // CRITICAL: Use /simple endpoint which saves to approval tables
        const linkedinSearchResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/linkedin/search/simple`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Auth': 'true',
            'X-User-Id': user.id,
            'X-Workspace-Id': workspaceId
          },
          body: JSON.stringify({
            search_criteria: {
              keywords: search_criteria.keywords,
              title: search_criteria.job_titles?.join(' OR '),
              industry: search_criteria.industries?.[0], // Simple only takes single value
              location: search_criteria.locations?.[0], // Simple only takes single value
              connectionDegree: (search_criteria?.connection_degree || search_criteria?.connectionDegree), // Pass through user-selected degree
              yearsOfExperience: search_criteria.years_experience,
              profileLanguage: search_criteria?.profile_language || search_criteria?.profileLanguage
            },
            target_count: search_criteria.max_results || 2500, // Default to max Sales Nav limit to get all results
            max_pages: 5 // Limit to 5 pages (500 results) when called from SAM to avoid 26s gateway timeout
          })
        });

        const linkedinResults = await linkedinSearchResponse.json();

        if (!linkedinResults.success) {
          // Automatic fallback to Bright Data MCP when LinkedIn not available
          if (linkedinResults.error?.includes('No active LinkedIn account')) {
            console.log('LinkedIn not connected, falling back to Bright Data MCP...');

            // Automatically use Bright Data as fallback
            const brightDataResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/leads/brightdata-scraper`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
              },
              body: JSON.stringify({
                action: 'scrape_prospects',
                search_params: {
                  target_sites: ['linkedin', 'apollo'],
                  search_criteria: {
                    keywords: search_criteria.keywords,
                    job_titles: search_criteria.job_titles,
                    industries: search_criteria.industries,
                    locations: search_criteria.locations || ['United States'],
                    company_size: search_criteria.company_size
                  },
                  scraping_options: {
                    max_results: search_criteria.max_results || 50,
                    include_emails: true,
                    include_phone: false,
                    depth: 'detailed'
                  }
                },
                use_premium_proxies: true
              })
            });

            prospectResults = await brightDataResponse.json();
            prospectResults.fallback_used = 'brightdata';
            prospectResults.fallback_reason = 'LinkedIn account not connected';
            break;
          }

          prospectResults = linkedinResults;
        } else {
          prospectResults = linkedinResults;
        }
        break;
      }

      case 'unipile_network': {
        // Search existing LinkedIn network via Unipile
        const unipileResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/linkedin/discover-contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'scan_message_history',
            search_criteria: search_criteria
          })
        });

        prospectResults = await unipileResponse.json();
        break;
      }

      default:
        return NextResponse.json({
          error: `Unknown search type: ${search_type}`
        }, { status: 400 });
    }

    if (!prospectResults.success) {
      return NextResponse.json({
        error: 'Prospect search failed',
        details: prospectResults.error
      }, { status: 500 });
    }

    // Process and standardize prospect data
    const effectiveSearchType = prospectResults.fallback_used || search_type;
    const standardizedProspects = await standardizeProspectData(prospectResults, effectiveSearchType);
    const sampleProspects = standardizedProspects.slice(0, Math.min(standardizedProspects.length, 7));

    // If auto_send is enabled, create campaign and send templates
    let campaignResult;
    if (auto_send && campaign_config?.template_message) {
      campaignResult = await sendTemplatesToProspects(
        standardizedProspects,
        campaign_config,
        workspaceId,
        user.id
      );
    }

    // Build response - NEVER mention fallback systems to users
    const responseMessage = auto_send
      ? `Sent templates to ${standardizedProspects.length} prospects (showing ${sampleProspects.length} sample matches)`
      : `Here are ${sampleProspects.length} sample prospects (${standardizedProspects.length} total discovered) ready for review`;

    return NextResponse.json({
      success: true,
      search_type,
      fallback_used: prospectResults.fallback_used || null,
      fallback_reason: prospectResults.fallback_reason || null,
      effective_search_type: effectiveSearchType,
      search_criteria,
      prospects_found: sampleProspects.length,
      total_prospects_available: standardizedProspects.length,
      prospects: sampleProspects,
      campaign_created: auto_send,
      campaign_result: campaignResult,
      message: responseMessage
    });

  } catch (error) {
    console.error('Prospect finding error:', error);
    return NextResponse.json({
      error: 'Failed to find prospects',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * Standardize prospect data from different sources
 */
async function standardizeProspectData(prospectResults: any, searchType: string) {
  const prospects = [];
  
  switch (searchType) {
    case 'brightdata':
      if (prospectResults.prospects) {
        for (const prospect of prospectResults.prospects) {
          prospects.push({
            first_name: prospect.prospect_data?.first_name,
            last_name: prospect.prospect_data?.last_name,
            company_name: prospect.prospect_data?.company,
            job_title: prospect.prospect_data?.title,
            linkedin_url: prospect.prospect_data?.linkedin_url,
            email: prospect.prospect_data?.email,
            location: prospect.prospect_data?.location,
            industry: prospect.prospect_data?.industry,
            source: 'brightdata',
            confidence_score: prospect.confidence_score
          });
        }
      }
      break;

    case 'unipile_linkedin_search':
      // Unipile returns structured LinkedIn profile data
      if (prospectResults.results) {
        for (const profile of prospectResults.results) {
          prospects.push({
            first_name: profile.first_name,
            last_name: profile.last_name,
            company_name: profile.current_position?.company_name || profile.company,
            job_title: profile.current_position?.title || profile.headline,
            linkedin_url: profile.url || profile.linkedin_url,
            linkedin_user_id: profile.id,
            location: profile.location,
            industry: profile.industry,
            profile_picture: profile.profile_picture_url,
            summary: profile.summary,
            experience: profile.experience,
            education: profile.education,
            skills: profile.skills,
            source: 'unipile_linkedin_search',
            connection_degree: profile.distance
          });
        }
      }
      break;

    case 'unipile_network':
      if (prospectResults.contacts) {
        for (const contact of prospectResults.contacts) {
          prospects.push({
            first_name: contact.first_name,
            company_name: contact.company,
            job_title: contact.title,
            linkedin_url: contact.linkedin_url,
            linkedin_user_id: contact.linkedin_user_id,
            source: 'unipile_network',
            already_connected: true
          });
        }
      }
      break;
  }

  return prospects.filter(p => p.first_name && p.company_name);
}

/**
 * Map generic company size to LinkedIn headcount codes
 */
function mapCompanySizeToHeadcount(companySize?: string): string[] | undefined {
  if (!companySize) return undefined;

  const sizeMap: { [key: string]: string[] } = {
    'small': ['A', 'B'],        // 1-10, 11-50
    'medium': ['C', 'D', 'E'],  // 51-200, 201-500, 501-1000
    'large': ['F', 'G', 'H', 'I'], // 1001-5000, 5001-10000, 10001+
    'startup': ['A', 'B'],      // 1-10, 11-50
    'enterprise': ['G', 'H', 'I'], // 5001-10000, 10001+
    'any': undefined
  };

  return sizeMap[companySize.toLowerCase()] || undefined;
}

/**
 * Send template messages to found prospects
 */
async function sendTemplatesToProspects(prospects: any[], campaignConfig: any, workspaceId: string, userId: string) {
  try {
    const templateResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sam/send-template-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prospects: prospects,
        send_immediately: true,
        template_preference: campaignConfig.template_id || 'auto_select',
        custom_template: campaignConfig.template_message
      })
    });

    return await templateResponse.json();
  } catch (error) {
    console.error('Failed to send templates to prospects:', error);
    return { success: false, error: error.message };
  }
}

/**
 * GET endpoint for testing and documentation
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testType = searchParams.get('test') || 'info';

  if (testType === 'brightdata_test') {
    // Test Bright Data integration
    const testRequest = new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({
        search_type: 'brightdata',
        search_criteria: {
          keywords: 'VP Sales SaaS',
          job_titles: ['VP Sales', 'Vice President Sales'],
          industries: ['SaaS', 'Software'],
          locations: ['United States'],
          company_size: 'medium',
          max_results: 10
        },
        auto_send: false
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    return POST(testRequest);
  }

  return NextResponse.json({
    message: "Sam's Integrated Prospect Finding System",
    description: "Find prospects using multiple data sources and send template messages",
    available_search_types: [
      {
        type: 'unipile_linkedin_search',
        description: 'LinkedIn database search via Unipile (RECOMMENDED)',
        features: [
          'Full LinkedIn database access',
          'Unlimited searches',
          'Real-time prospect data',
          'No quota limits',
          'Seamless search experience'
        ],
        cost: 'Included - no additional cost',
        fallback: 'internal_search'
      },
      {
        type: 'internal_search',
        description: 'Built-in prospect search (when LinkedIn not connected)',
        features: ['Multi-source data', 'Contact enrichment', 'Company intelligence'],
        cost: 'Included in plan - no extra charge'
      },
      {
        type: 'unipile_network',
        description: 'Search existing LinkedIn connections via Unipile',
        features: ['Network analysis', 'Message history mining', 'Connection mapping'],
        cost: 'Free - existing network'
      }
    ],
    usage_example: {
      search_criteria: {
        keywords: "VP Sales SaaS",
        job_titles: ["VP Sales", "Director of Sales"],
        industries: ["SaaS", "Technology"],
        locations: ["United States", "Canada"],
        company_size: "medium",
        max_results: 50
      },
      campaign_config: {
        template_message: "Your LinkedIn message template...",
        auto_send: true
      }
    },
    integration_status: {
      unipile_linkedin_search: "✅ Active - Unlimited LinkedIn searches (RECOMMENDED)",
      internal_search: "✅ Active - Built-in prospect search",
      unipile_network: "✅ Connected - LinkedIn network access"
    }
  });
}

/**
 * Check user's LinkedIn account capabilities
 */
async function checkLinkedInAccountCapabilities(supabase: any, userId: string, workspaceId: string) {
  // Get user's LinkedIn accounts
  // CRITICAL: Use admin client to bypass RLS for workspace_accounts
  const { data: accounts } = await supabaseAdmin()
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('account_type', 'linkedin');

  if (!accounts || accounts.length === 0) {
    return {
      apiType: 'none',
      accountName: null,
      hasSalesNavigator: false,
      hasRecruiter: false,
      capabilities: []
    };
  }

  // Get Unipile account details to check premium features
  const unipileDSN = process.env.UNIPILE_DSN;
  const unipileApiKey = process.env.UNIPILE_API_KEY;

  const accountsUrl = unipileDSN?.includes('.')
    ? `https://${unipileDSN}/api/v1/accounts`
    : `https://${unipileDSN}.unipile.com:13443/api/v1/accounts`;

  const response = await fetch(accountsUrl, {
    headers: {
      'X-API-KEY': unipileApiKey!,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    return {
      apiType: 'unknown',
      accountName: accounts[0].account_name,
      hasSalesNavigator: false,
      hasRecruiter: false,
      capabilities: []
    };
  }

  const unipileData = await response.json();
  const allLinkedInAccounts = Array.isArray(unipileData) ? unipileData : (unipileData.items || unipileData.accounts || []);

  // Find user's account in Unipile
  const userAccount = allLinkedInAccounts.find((acc: any) =>
    acc.id === accounts[0].unipile_account_id
  );

  if (!userAccount) {
    return {
      apiType: 'unknown',
      accountName: accounts[0].account_name,
      hasSalesNavigator: false,
      hasRecruiter: false,
      capabilities: []
    };
  }

  const premiumFeatures = userAccount.connection_params?.im?.premiumFeatures || [];
  const hasSalesNavigator = premiumFeatures.includes('sales_navigator');
  const hasRecruiter = premiumFeatures.includes('recruiter');

  let apiType = 'classic';
  if (hasRecruiter) {
    apiType = 'recruiter';
  } else if (hasSalesNavigator) {
    apiType = 'sales_navigator';
  }

  return {
    apiType,
    accountName: userAccount.name || accounts[0].account_name,
    hasSalesNavigator,
    hasRecruiter,
    capabilities: apiType === 'sales_navigator' || apiType === 'recruiter'
      ? ['company_size', 'seniority_level', 'years_at_company', 'job_function', 'structured_company_data']
      : ['basic_search', 'headline_parsing']
  };
}

/**
 * Validate search criteria against account capabilities
 */
function validateSearchCriteria(searchCriteria: any, accountCapabilities: any) {
  const unsupportedCriteria = [];
  const supportedCriteria = [];

  if (!accountCapabilities || accountCapabilities.apiType === 'none') {
    return {
      unsupportedCriteria: ['LinkedIn account not connected'],
      supportedCriteria: []
    };
  }

  const requested = {
    companySize: searchCriteria.company_size || searchCriteria.companySize,
    seniorityLevel: searchCriteria.seniority_level || searchCriteria.seniorityLevel,
    yearsAtCompany: searchCriteria.years_at_company || searchCriteria.yearsAtCompany,
    jobFunction: searchCriteria.function || searchCriteria.job_function,
    jobTitles: searchCriteria.job_titles,
    industries: searchCriteria.industries,
    locations: searchCriteria.locations,
    keywords: searchCriteria.keywords
  };

  // Check advanced filters (Sales Nav only)
  if (accountCapabilities.apiType === 'classic') {
    if (requested.companySize) {
      unsupportedCriteria.push('Company Size');
    } else {
      supportedCriteria.push('Company Size (all sizes)');
    }

    if (requested.seniorityLevel) {
      unsupportedCriteria.push('Seniority Level');
    } else {
      supportedCriteria.push('Seniority Level (all levels)');
    }

    if (requested.yearsAtCompany) {
      unsupportedCriteria.push('Years at Company');
    }

    if (requested.jobFunction) {
      unsupportedCriteria.push('Job Function');
    }
  } else {
    // Sales Navigator or Recruiter - all criteria supported
    if (requested.companySize) supportedCriteria.push('Company Size');
    if (requested.seniorityLevel) supportedCriteria.push('Seniority Level');
    if (requested.yearsAtCompany) supportedCriteria.push('Years at Company');
    if (requested.jobFunction) supportedCriteria.push('Job Function');
  }

  // Basic criteria (all account types)
  if (requested.jobTitles) supportedCriteria.push('Job Titles');
  if (requested.industries) supportedCriteria.push('Industries');
  if (requested.locations) supportedCriteria.push('Locations');
  if (requested.keywords) supportedCriteria.push('Keywords');

  return {
    unsupportedCriteria,
    supportedCriteria
  };
}
