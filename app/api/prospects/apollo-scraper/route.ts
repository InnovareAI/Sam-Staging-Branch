import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

// Apollo.io Scraping Integration via Apify
// Scrapes Apollo.io search results for prospect data enrichment

interface ApolloSearchParams {
  keywords?: string;
  location?: string;
  company_size?: string;
  industry?: string;
  job_titles?: string[];
  seniority_levels?: string[];
  limit?: number;
}

interface ApolloProspect {
  first_name: string;
  last_name: string;
  email: string;
  linkedin_url: string;
  company_name: string;
  title: string;
  industry: string;
  location: string;
  phone?: string;
  company_domain?: string;
  company_linkedin?: string;
}

// Apify Apollo.io actor configuration
const APIFY_CONFIG = {
  actor_id: process.env.APIFY_APOLLO_ACTOR_ID || 'apify/apollo-io-scraper',
  api_token: process.env.APIFY_API_TOKEN,
  base_url: 'https://api.apify.com/v2'
};

// Call Apify actor to scrape Apollo.io
async function runApolloScraper(searchParams: ApolloSearchParams): Promise<ApolloProspect[]> {
  if (!APIFY_CONFIG.api_token) {
    throw new Error('Apify API token not configured');
  }

  const actorInput = {
    searchUrl: constructApolloSearchUrl(searchParams),
    maxResults: searchParams.limit || 100,
    extractEmails: true,
    extractLinkedInProfiles: true,
    extractPhoneNumbers: true,
    timeout: 300000 // 5 minutes
  };

  // Start Apify actor run
  const runResponse = await fetch(
    `${APIFY_CONFIG.base_url}/acts/${APIFY_CONFIG.actor_id}/runs?token=${APIFY_CONFIG.api_token}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(actorInput)
    }
  );

  if (!runResponse.ok) {
    throw new Error(`Apify actor start failed: ${runResponse.status}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data.id;

  // Poll for completion
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes with 5s intervals
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    const statusResponse = await fetch(
      `${APIFY_CONFIG.base_url}/actor-runs/${runId}?token=${APIFY_CONFIG.api_token}`
    );
    
    if (!statusResponse.ok) {
      throw new Error(`Failed to check run status: ${statusResponse.status}`);
    }
    
    const statusData = await statusResponse.json();
    const status = statusData.data.status;
    
    if (status === 'SUCCEEDED') {
      // Get results
      const resultsResponse = await fetch(
        `${APIFY_CONFIG.base_url}/actor-runs/${runId}/dataset/items?token=${APIFY_CONFIG.api_token}`
      );
      
      if (!resultsResponse.ok) {
        throw new Error(`Failed to fetch results: ${resultsResponse.status}`);
      }
      
      const results = await resultsResponse.json();
      return results;
    } else if (status === 'FAILED' || status === 'ABORTED') {
      throw new Error(`Apify run failed with status: ${status}`);
    }
    
    attempts++;
  }
  
  throw new Error('Apify run timed out');
}

// Construct Apollo.io search URL from parameters
function constructApolloSearchUrl(params: ApolloSearchParams): string {
  const baseUrl = 'https://app.apollo.io/#/people';
  const searchParams = new URLSearchParams();
  
  if (params.keywords) {
    searchParams.append('finderSearchId', 'search-by-keywords');
    searchParams.append('keywords', params.keywords);
  }
  
  if (params.location) {
    searchParams.append('personLocations[]', params.location);
  }
  
  if (params.company_size) {
    searchParams.append('organizationNumEmployeesRanges[]', params.company_size);
  }
  
  if (params.industry) {
    searchParams.append('organizationIndustryTagIds[]', params.industry);
  }
  
  if (params.job_titles && params.job_titles.length > 0) {
    params.job_titles.forEach(title => {
      searchParams.append('personTitles[]', title);
    });
  }
  
  if (params.seniority_levels && params.seniority_levels.length > 0) {
    params.seniority_levels.forEach(level => {
      searchParams.append('personSeniorities[]', level);
    });
  }
  
  return `${baseUrl}?${searchParams.toString()}`;
}

// Enrich existing prospect with Apollo data
async function enrichProspectWithApollo(
  firstName: string, 
  lastName: string, 
  companyName?: string
): Promise<ApolloProspect | null> {
  
  try {
    const searchParams: ApolloSearchParams = {
      keywords: `${firstName} ${lastName}`,
      limit: 5 // Small limit for individual enrichment
    };
    
    if (companyName) {
      // Add company filter if available
      searchParams.keywords += ` ${companyName}`;
    }
    
    const results = await runApolloScraper(searchParams);
    
    // Find best match based on name similarity
    const bestMatch = results.find(result => {
      const firstNameMatch = result.first_name.toLowerCase().includes(firstName.toLowerCase());
      const lastNameMatch = result.last_name.toLowerCase().includes(lastName.toLowerCase());
      const companyMatch = companyName ? 
        result.company_name.toLowerCase().includes(companyName.toLowerCase()) : true;
      
      return firstNameMatch && lastNameMatch && companyMatch;
    });
    
    return bestMatch || null;
    
  } catch (error) {
    console.error('Apollo enrichment error:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      action,
      search_params,
      prospect_id,
      campaign_id 
    } = await req.json();

    if (!action) {
      return NextResponse.json({ error: 'Action required' }, { status: 400 });
    }

    switch (action) {
      case 'search_prospects':
        if (!search_params) {
          return NextResponse.json({ error: 'Search parameters required' }, { status: 400 });
        }
        
        try {
          console.log('Starting Apollo.io prospect search...');
          const results = await runApolloScraper(search_params);
          
          return NextResponse.json({
            message: 'Apollo search completed',
            total_results: results.length,
            prospects: results,
            search_params
          });
          
        } catch (error: any) {
          return NextResponse.json({
            error: 'Apollo search failed',
            details: error.message
          }, { status: 500 });
        }

      case 'enrich_prospect':
        if (!prospect_id) {
          return NextResponse.json({ error: 'Prospect ID required' }, { status: 400 });
        }
        
        try {
          // Get prospect data
          const { data: prospect, error: prospectError } = await supabase
            .from('workspace_prospects')
            .select('*')
            .eq('id', prospect_id)
            .eq('workspace_id', user.user_metadata.workspace_id)
            .single();
          
          if (prospectError || !prospect) {
            return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
          }
          
          // Enrich with Apollo data
          const apolloData = await enrichProspectWithApollo(
            prospect.first_name,
            prospect.last_name,
            prospect.company_name
          );
          
          if (!apolloData) {
            return NextResponse.json({
              message: 'No enrichment data found',
              prospect_id
            });
          }
          
          // Update prospect with enriched data
          const enrichedFields = {
            email_address: apolloData.email || prospect.email_address,
            linkedin_profile_url: apolloData.linkedin_url || prospect.linkedin_profile_url,
            phone_number: apolloData.phone || prospect.phone_number,
            company_name: apolloData.company_name || prospect.company_name,
            job_title: apolloData.title || prospect.job_title,
            industry: apolloData.industry || prospect.industry,
            location: apolloData.location || prospect.location,
            enrichment_metadata: {
              source: 'apollo',
              enriched_at: new Date().toISOString(),
              original_data: apolloData
            },
            updated_at: new Date().toISOString()
          };
          
          await supabase
            .from('workspace_prospects')
            .update(enrichedFields)
            .eq('id', prospect_id);
          
          return NextResponse.json({
            message: 'Prospect enriched successfully',
            prospect_id,
            enriched_fields: Object.keys(enrichedFields).filter(key => 
              apolloData[key as keyof ApolloProspect] && !prospect[key as keyof typeof prospect]
            )
          });
          
        } catch (error: any) {
          return NextResponse.json({
            error: 'Prospect enrichment failed',
            details: error.message
          }, { status: 500 });
        }

      case 'bulk_import':
        if (!search_params) {
          return NextResponse.json({ error: 'Search parameters required' }, { status: 400 });
        }
        
        try {
          console.log('Starting bulk Apollo import...');
          const results = await runApolloScraper(search_params);
          
          const importResults = {
            total_found: results.length,
            imported: 0,
            duplicates: 0,
            errors: []
          };
          
          const importedProspectIds: string[] = [];
          
          // Import each prospect
          for (const apolloProspect of results) {
            try {
              // Check for duplicates
              const { data: existingProspect } = await supabase
                .from('workspace_prospects')
                .select('id')
                .eq('workspace_id', user.user_metadata.workspace_id)
                .or(`email_address.eq.${apolloProspect.email},linkedin_profile_url.eq.${apolloProspect.linkedin_url}`)
                .single();
              
              if (existingProspect) {
                importResults.duplicates++;
                continue;
              }
              
              // Create new prospect
              const { data: newProspect, error: insertError } = await supabase
                .from('workspace_prospects')
                .insert({
                  workspace_id: user.user_metadata.workspace_id,
                  first_name: apolloProspect.first_name,
                  last_name: apolloProspect.last_name,
                  email_address: apolloProspect.email,
                  linkedin_profile_url: apolloProspect.linkedin_url,
                  company_name: apolloProspect.company_name,
                  job_title: apolloProspect.title,
                  industry: apolloProspect.industry,
                  location: apolloProspect.location,
                  phone_number: apolloProspect.phone,
                  data_source: 'apollo',
                  import_metadata: {
                    source: 'apollo_bulk_import',
                    imported_at: new Date().toISOString(),
                    search_params
                  }
                })
                .select('id')
                .single();
              
              if (insertError) {
                importResults.errors.push({
                  prospect: apolloProspect,
                  error: insertError.message
                });
                continue;
              }
              
              importedProspectIds.push(newProspect.id);
              importResults.imported++;
              
            } catch (prospectError: any) {
              importResults.errors.push({
                prospect: apolloProspect,
                error: prospectError.message
              });
            }
          }
          
          // Add to campaign if specified
          if (campaign_id && importedProspectIds.length > 0) {
            try {
              await supabase.rpc('add_prospects_to_campaign', {
                p_campaign_id: campaign_id,
                p_prospect_ids: importedProspectIds
              });
            } catch (campaignError) {
              console.error('Error adding prospects to campaign:', campaignError);
            }
          }
          
          return NextResponse.json({
            message: 'Bulk Apollo import completed',
            results: importResults,
            campaign_id
          });
          
        } catch (error: any) {
          return NextResponse.json({
            error: 'Bulk import failed',
            details: error.message
          }, { status: 500 });
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Apollo scraper error:', error);
    return NextResponse.json(
      { error: 'Apollo scraping failed', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({
      message: 'Apollo.io Scraping Integration API',
      actions: {
        search_prospects: 'Search Apollo.io for prospects based on criteria',
        enrich_prospect: 'Enrich existing prospect with Apollo data',
        bulk_import: 'Import prospects directly from Apollo search'
      },
      search_parameters: {
        keywords: 'Search keywords (job titles, companies, etc.)',
        location: 'Geographic location filter',
        company_size: 'Company size range (1-10, 11-50, 51-200, etc.)',
        industry: 'Industry filter',
        job_titles: 'Array of specific job titles',
        seniority_levels: 'Array of seniority levels (senior, director, vp, c-level)',
        limit: 'Maximum number of results (default: 100)'
      },
      configuration: {
        apify_configured: !!APIFY_CONFIG.api_token,
        actor_id: APIFY_CONFIG.actor_id
      },
      usage_examples: {
        search: {
          action: 'search_prospects',
          search_params: {
            keywords: 'CEO startup',
            location: 'San Francisco',
            company_size: '11-50',
            limit: 50
          }
        },
        enrich: {
          action: 'enrich_prospect',
          prospect_id: 'prospect_uuid'
        },
        bulk_import: {
          action: 'bulk_import',
          search_params: {
            job_titles: ['Chief Technology Officer', 'VP Engineering'],
            industry: 'Technology',
            limit: 100
          },
          campaign_id: 'campaign_uuid'
        }
      }
    });

  } catch (error: any) {
    console.error('Apollo scraper GET error:', error);
    return NextResponse.json(
      { error: 'Request failed', details: error.message },
      { status: 500 }
    );
  }
}