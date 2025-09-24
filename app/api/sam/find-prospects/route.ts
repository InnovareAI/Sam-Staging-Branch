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
      search_type = 'brightdata',
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
              maxResults: search_criteria.max_results || 20
            }
          })
        });

        prospectResults = await googleResponse.json();
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
      prospects_found: standardizedProspects.length,
      prospects: standardizedProspects,
      campaign_created: auto_send,
      campaign_result: campaignResult,
      message: auto_send 
        ? `Found ${standardizedProspects.length} prospects and sent template messages`
        : `Found ${standardizedProspects.length} prospects ready for outreach`
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
      if (prospectResults.result?.prospects) {
        for (const prospect of prospectResults.result.prospects) {
          prospects.push({
            first_name: prospect.name?.split(' ')[0],
            last_name: prospect.name?.split(' ').slice(1).join(' '),
            company_name: prospect.company,
            job_title: prospect.title,
            linkedin_url: prospect.linkedin_url,
            location: prospect.location,
            source: 'google_search'
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