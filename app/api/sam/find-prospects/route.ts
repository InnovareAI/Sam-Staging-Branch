import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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

      case 'google_search': {
        // Use Google Custom Search for LinkedIn profiles
        const googleResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/test/google-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toolName: 'icp_prospect_discovery',
            arguments: {
              jobTitles: search_criteria.job_titles,
              industries: search_criteria.industries,
              companySize: search_criteria.company_size,
              location: search_criteria.locations?.[0],
              maxResults: search_criteria.max_results || 20
            }
          })
        });

        const rawGoogleResults = await googleResponse.json();

        if (rawGoogleResults.success) {
          const payloadText = rawGoogleResults.result?.content?.[0]?.text;
          try {
            const parsedPayload = payloadText ? JSON.parse(payloadText) : null;
            prospectResults = {
              success: !!parsedPayload,
              parsedPayload,
              raw: rawGoogleResults
            };
          } catch (parseError) {
            console.error('Failed to parse Google Search MCP payload:', parseError);
            prospectResults = {
              success: false,
              error: 'Invalid response from Google Custom Search MCP',
              raw: rawGoogleResults
            };
          }
        } else {
          prospectResults = rawGoogleResults;
        }

        break;
      }

      case 'unipile_linkedin_search': {
        // Full LinkedIn database search via Unipile (RECOMMENDED - No quota limits!)
        const linkedinSearchResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/linkedin/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'people',
            keywords: search_criteria.keywords,
            title: search_criteria.job_titles?.join(' OR '),
            industry: search_criteria.industries,
            location: search_criteria.locations,
            company_headcount: mapCompanySizeToHeadcount(search_criteria.company_size),
            seniority_level: search_criteria.seniority_levels,
            limit: search_criteria.max_results || 50,
            enrichProfiles: true
          })
        });

        const linkedinResults = await linkedinSearchResponse.json();

        if (!linkedinResults.success) {
          // Check if it's because LinkedIn not connected
          if (linkedinResults.error?.includes('No active LinkedIn account')) {
            return NextResponse.json({
              success: false,
              error: 'LinkedIn account not connected',
              action_required: 'connect_linkedin',
              message: 'Please connect your LinkedIn account to enable ICP prospect discovery.',
              connect_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations`
            }, { status: 400 });
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
    const standardizedProspects = await standardizeProspectData(prospectResults, search_type);
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

    return NextResponse.json({
      success: true,
      search_type,
      search_criteria,
      prospects_found: sampleProspects.length,
      total_prospects_available: standardizedProspects.length,
      prospects: sampleProspects,
      campaign_created: auto_send,
      campaign_result: campaignResult,
      message: auto_send 
        ? `Sent templates to ${standardizedProspects.length} prospects (showing ${sampleProspects.length} sample matches)`
        : `Here are ${sampleProspects.length} sample prospects (${standardizedProspects.length} total discovered) ready for review`
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

    case 'google_search':
      {
        const payload = prospectResults.parsedPayload || prospectResults.result || prospectResults.raw?.result;
        const prospectsFromPayload = payload?.prospects || payload?.result?.prospects;

        if (Array.isArray(prospectsFromPayload)) {
          for (const prospect of prospectsFromPayload) {
            const nameParts = (prospect.name || '').trim().split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ');

            prospects.push({
              first_name: firstName,
              last_name: lastName || undefined,
              company_name: prospect.company,
              job_title: prospect.title,
              linkedin_url: prospect.linkedin_url || prospect.profileUrl,
              location: prospect.location,
              source: 'google_search',
              relevance_score: prospect.relevanceScore
            });
          }
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
        type: 'brightdata',
        description: 'Comprehensive scraping from LinkedIn, Apollo, Crunchbase, ZoomInfo',
        features: ['Email enrichment', 'Contact verification', 'Company intelligence'],
        cost: 'Premium - high accuracy'
      },
      {
        type: 'google_search',
        description: 'Google Custom Search for LinkedIn profiles',
        features: ['LinkedIn profile discovery', 'Company research', 'ICP matching'],
        cost: 'Low cost - good coverage'
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
      brightdata: "✅ Active - Premium prospect scraping",
      google_search: "✅ Configured - Needs API keys",
      unipile: "✅ Connected - LinkedIn network access"
    }
  });
}
