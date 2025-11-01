import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

/**
 * BrightData Prospect Enrichment API
 * Enriches prospects with missing mandatory fields (company, industry, email)
 */

interface EnrichmentRequest {
  sessionId?: string;        // Enrich all prospects in approval session
  prospectIds?: string[];    // Enrich specific prospects by ID
  linkedInUrls?: string[];   // Enrich by LinkedIn URLs
  autoEnrich?: boolean;      // Automatically enrich all 'unavailable' fields
  workspaceId?: string;      // Workspace ID (optional, will be looked up if not provided)
}

interface BrightDataEnrichmentResult {
  linkedin_url: string;
  // CRITICAL FIELDS from BrightData:
  email?: string;                    // 1. Email address (70-80% success)
  company_website?: string;          // 2. Company website URL
  company_linkedin_url?: string;     // 3. Company LinkedIn page URL
  // VALIDATION FIELDS (from Sales Nav or BrightData):
  company_name?: string;
  industry?: string;
  job_title?: string;
  location?: string;
  phone?: string;
  verification_status: 'verified' | 'unverified' | 'failed';
}

export async function POST(request: NextRequest) {
  try {
    const body: EnrichmentRequest = await request.json();
    const { sessionId, prospectIds, linkedInUrls, autoEnrich = true, workspaceId: providedWorkspaceId } = body;

    const supabase = await createSupabaseRouteClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Get workspace ID - either from request or look it up
    let workspaceId = providedWorkspaceId;

    if (!workspaceId) {
      // Fallback: Try to get from user profile
      const { data: userProfile } = await supabase
        .from('users')
        .select('current_workspace_id')
        .eq('id', user.id)
        .single();

      workspaceId = userProfile?.current_workspace_id;
    }

    if (!workspaceId) {
      // Last resort: Get any workspace the user is a member of
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      workspaceId = membership?.workspace_id;
    }

    if (!workspaceId) {
      return NextResponse.json({
        error: 'No workspace found for user'
      }, { status: 400 });
    }

    // Verify user has access to this workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({
        error: 'Not a member of this workspace'
      }, { status: 403 });
    }

    // Get prospects to enrich
    let prospectsToEnrich: any[] = [];

    if (sessionId) {
      // Enrich all prospects in approval session
      const { data: sessionProspects } = await supabase
        .from('prospect_approval_data')
        .select('*')
        .eq('session_id', sessionId);

      if (sessionProspects) {
        prospectsToEnrich = sessionProspects.map(p => ({
          id: p.id,
          prospect_id: p.prospect_id,
          linkedin_url: p.contact?.linkedin_url,
          company_name: p.company?.name,
          industry: p.company?.industry,
          email: p.contact?.email,
          first_name: p.name?.split(' ')[0],
          last_name: p.name?.split(' ').slice(1).join(' ')
        }));
      }
    } else if (prospectIds) {
      // Try campaign_prospects first (for prospects in campaigns)
      const { data: campaignProspects } = await supabase
        .from('campaign_prospects')
        .select('*')
        .in('id', prospectIds)
        .eq('workspace_id', workspaceId);

      if (campaignProspects && campaignProspects.length > 0) {
        prospectsToEnrich = campaignProspects.map(p => ({
          id: p.id,
          linkedin_url: p.linkedin_url,
          company_name: p.company_name,
          industry: p.industry,
          email: p.email,
          first_name: p.first_name,
          last_name: p.last_name,
          location: p.location,
          is_campaign_prospect: true
        }));
      } else {
        // Try workspace_prospects
        const { data: prospects } = await supabase
          .from('workspace_prospects')
          .select('*')
          .in('id', prospectIds)
          .eq('workspace_id', workspaceId);

        if (prospects && prospects.length > 0) {
          prospectsToEnrich = prospects.map(p => ({
            id: p.id,
            linkedin_url: p.linkedin_profile_url,
            company_name: p.company_name,
            industry: p.industry,
            email: p.email_address,
            first_name: p.first_name,
            last_name: p.last_name,
            location: p.location,
            table: 'workspace_prospects',
            is_campaign_prospect: false
          }));
        } else {
          // Try prospect_approval_data (for prospects in approval workflow)
          console.log('🔍 Checking prospect_approval_data table for IDs:', prospectIds);

          const { data: approvalProspects, error: approvalError } = await supabase
            .from('prospect_approval_data')
            .select('*')
            .in('prospect_id', prospectIds);

          if (approvalError) {
            console.error('❌ Error querying prospect_approval_data:', approvalError);
          }

          console.log(`📊 Found ${approvalProspects?.length || 0} prospects in prospect_approval_data`);

          if (approvalProspects && approvalProspects.length > 0) {
            prospectsToEnrich = approvalProspects.map(p => ({
              id: p.prospect_id,
              approval_id: p.id,
              linkedin_url: p.contact?.linkedin_url,
              company_name: p.company?.name,
              industry: typeof p.company?.industry === 'string' ? p.company.industry : (p.company?.industry?.[0] || null),
              email: p.contact?.email,
              first_name: p.name?.split(' ')[0],
              last_name: p.name?.split(' ').slice(1).join(' '),
              location: p.location,
              table: 'prospect_approval_data',
              is_campaign_prospect: false
            }));
            console.log('✅ Mapped approval prospects for enrichment');
          } else {
            console.warn('⚠️ No prospects found in any table for IDs:', prospectIds);
          }
        }
      }
    } else if (linkedInUrls) {
      // Enrich by LinkedIn URLs directly
      prospectsToEnrich = linkedInUrls.map(url => ({
        linkedin_url: url,
        company_name: 'unavailable',
        industry: 'unavailable',
        email: null
      }));
    }

    console.log(`🔍 Enrichment request: prospectIds=${prospectIds?.length || 0}, sessionId=${sessionId}, linkedInUrls=${linkedInUrls?.length || 0}`);
    console.log(`📊 Found ${prospectsToEnrich.length} prospects to enrich`);

    if (prospectsToEnrich.length === 0) {
      console.error('❌ No prospects found to enrich. Check table queries.');
      return NextResponse.json({
        error: 'No prospects to enrich',
        debug: {
          prospectIds,
          sessionId,
          workspaceId,
          checkedTables: ['campaign_prospects', 'workspace_prospects', 'prospect_approval_data']
        }
      }, { status: 400 });
    }

    // Filter prospects that need enrichment
    const needsEnrichment = prospectsToEnrich.filter(p => {
      if (!autoEnrich) return true; // Enrich all if not auto

      return (
        !p.linkedin_url ||
        p.company_name === 'unavailable' ||
        !p.company_name ||
        p.industry === 'unavailable' ||
        !p.industry ||
        !p.email
      );
    });

    console.log(`🔍 Enrichment: ${needsEnrichment.length}/${prospectsToEnrich.length} prospects need enrichment`);

    if (needsEnrichment.length === 0) {
      return NextResponse.json({
        success: true,
        enriched_count: 0,
        skipped_count: prospectsToEnrich.length,
        message: 'All prospects already have complete data',
        cost_saved: 0
      });
    }

    // Call BrightData enrichment service
    const enrichmentResults = await enrichWithBrightData(needsEnrichment);

    // Update prospects with enriched data
    let updatedCount = 0;
    let failedCount = 0;
    const updates: any[] = [];

    for (const result of enrichmentResults) {
      if (result.verification_status === 'failed') {
        failedCount++;
        continue;
      }

      const prospect = prospectsToEnrich.find(p => p.linkedin_url === result.linkedin_url);
      if (!prospect) continue;

      const enrichedData = {
        // CRITICAL BRIGHTDATA FIELDS (3 required):
        email_address: result.email || prospect.email,                    // 1. Email
        company_domain: result.company_website || prospect.company_domain, // 2. Website (renamed to company_domain)
        company_linkedin_url: result.company_linkedin_url,                 // 3. Company LinkedIn URL
        // VALIDATION FIELDS:
        company_name: result.company_name || prospect.company_name,
        industry: result.industry || prospect.industry,
        job_title: result.job_title || prospect.job_title,
        location: result.location || prospect.location,
        phone_number: result.phone || prospect.phone_number,
        enrichment_data: {
          enriched_at: new Date().toISOString(),
          enriched_by: 'brightdata',
          verification_status: result.verification_status,
          fields_enriched: [
            result.email ? 'email' : null,
            result.company_website ? 'company_website' : null,
            result.company_linkedin_url ? 'company_linkedin_url' : null
          ].filter(Boolean)
        }
      };

      updates.push({
        prospectId: prospect.id || prospect.prospect_id,
        data: enrichedData
      });

      updatedCount++;
    }

    // Apply updates to database
    if (sessionId) {
      // Update prospect_approval_data
      for (const update of updates) {
        await supabase
          .from('prospect_approval_data')
          .update({
            company: {
              name: update.data.company_name,
              industry: update.data.industry,
              website: update.data.company_domain || ''
            },
            contact: {
              email: update.data.email_address,
              linkedin_url: prospectsToEnrich.find(p => p.id === update.prospectId)?.linkedin_url
            },
            enrichment_data: update.data.enrichment_data
          })
          .eq('prospect_id', update.prospectId);
      }
    } else {
      // Determine which table to update based on prospect type
      const tableType = prospectsToEnrich[0]?.table;

      if (tableType === 'prospect_approval_data') {
        // Update prospect_approval_data
        for (const update of updates) {
          const prospect = prospectsToEnrich.find(p => p.id === update.prospectId);
          await supabase
            .from('prospect_approval_data')
            .update({
              company: {
                name: update.data.company_name,
                industry: update.data.industry,
                website: update.data.company_domain || ''
              },
              contact: {
                email: update.data.email_address,
                linkedin_url: prospect?.linkedin_url
              },
              location: update.data.location,
              enrichment_data: update.data.enrichment_data
            })
            .eq('prospect_id', update.prospectId);
        }
      } else if (tableType === 'campaign_prospects' || prospectsToEnrich.some(p => p.is_campaign_prospect)) {
        // Update campaign_prospects
        for (const update of updates) {
          await supabase
            .from('campaign_prospects')
            .update({
              email: update.data.email_address,
              company_name: update.data.company_name,
              industry: update.data.industry,
              location: update.data.location,
              personalization_data: {
                ...prospectsToEnrich.find(p => p.id === update.prospectId)?.personalization_data,
                enrichment_data: update.data.enrichment_data,
                company_domain: update.data.company_domain,
                company_linkedin_url: update.data.company_linkedin_url
              }
            })
            .eq('id', update.prospectId)
            .eq('workspace_id', workspaceId);
        }
      } else {
        // Update workspace_prospects
        for (const update of updates) {
          await supabase
            .from('workspace_prospects')
            .update(update.data)
            .eq('id', update.prospectId)
            .eq('workspace_id', workspaceId);
        }
      }
    }

    const totalCost = needsEnrichment.length * 0.01; // $0.01 per prospect

    return NextResponse.json({
      success: true,
      enriched_count: updatedCount,
      failed_count: failedCount,
      skipped_count: prospectsToEnrich.length - needsEnrichment.length,
      total_cost: totalCost,
      cost_per_prospect: 0.01,
      enrichment_details: enrichmentResults.map(r => ({
        linkedin_url: r.linkedin_url,
        status: r.verification_status,
        fields_enriched: Object.keys(r).filter(k =>
          k !== 'linkedin_url' && k !== 'verification_status' && r[k as keyof typeof r]
        )
      }))
    });

  } catch (error) {
    console.error('❌ Enrichment error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({
      error: 'Failed to enrich prospects',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

/**
 * Enrich prospects using BrightData with parallel processing
 *
 * @param prospects - Array of prospects to enrich
 * @param concurrency - Max concurrent requests (default: 5)
 */
async function enrichWithBrightData(
  prospects: Array<{ linkedin_url: string; [key: string]: any }>,
  concurrency: number = 5
): Promise<BrightDataEnrichmentResult[]> {
  try {
    console.log('📞 Calling BrightData scraper API...');
    console.log(`📊 Enriching ${prospects.length} prospects with ${concurrency}x parallelism`);
    console.log(`🚀 Estimated time: ${Math.ceil(prospects.length / concurrency) * 35}s (vs ${prospects.length * 35}s sequential)`);

    const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/leads/brightdata-scraper`;

    // Split prospects into parallel batches
    const results: BrightDataEnrichmentResult[] = [];
    const errors: Array<{ prospect: any; error: string }> = [];

    // Process prospects in parallel batches
    for (let i = 0; i < prospects.length; i += concurrency) {
      const batch = prospects.slice(i, i + concurrency);
      const batchNumber = Math.floor(i / concurrency) + 1;
      const totalBatches = Math.ceil(prospects.length / concurrency);

      console.log(`\n🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} prospects)`);

      const startTime = Date.now();

      // Create parallel requests for this batch
      const batchPromises = batch.map(async (prospect) => {
        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'enrich_linkedin_profiles',
              linkedin_urls: [prospect.linkedin_url],
              include_contact_info: true,
              include_company_info: true
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Failed for ${prospect.linkedin_url}: ${response.status}`);
            return {
              linkedin_url: prospect.linkedin_url,
              verification_status: 'failed' as const,
              error: `API error: ${response.status}`
            };
          }

          const data = await response.json();

          if (!data.success || !data.enriched_profiles?.[0]) {
            return {
              linkedin_url: prospect.linkedin_url,
              verification_status: 'failed' as const,
              error: data.error || 'No profile data returned'
            };
          }

          console.log(`✅ Enriched: ${data.enriched_profiles[0].company_name || 'Unknown'}`);
          return data.enriched_profiles[0];

        } catch (error) {
          console.error(`❌ Error enriching ${prospect.linkedin_url}:`, error instanceof Error ? error.message : 'Unknown');
          return {
            linkedin_url: prospect.linkedin_url,
            verification_status: 'failed' as const,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      // Wait for all parallel requests in this batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const successCount = batchResults.filter(r => r.verification_status === 'verified').length;
      console.log(`⏱️  Batch completed in ${elapsed}s (${successCount}/${batch.length} successful)`);
    }

    const totalSuccess = results.filter(r => r.verification_status === 'verified').length;
    const totalFailed = results.filter(r => r.verification_status === 'failed').length;

    console.log(`\n📊 Final results: ${totalSuccess} successful, ${totalFailed} failed out of ${prospects.length} total`);

    return results;

  } catch (error) {
    console.error('❌ BrightData enrichment error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return prospects.map(p => ({
      linkedin_url: p.linkedin_url,
      verification_status: 'failed' as const,
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
  }
}
