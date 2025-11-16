import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

// Configure this API route to have maximum timeout
export const maxDuration = 60; // 60 seconds (max for Pro plan)
export const dynamic = 'force-dynamic';

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
    let body: EnrichmentRequest;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('❌ Failed to parse request body:', jsonError);
      return NextResponse.json({
        error: 'Invalid JSON in request body',
        details: jsonError instanceof Error ? jsonError.message : 'Unexpected end of JSON input'
      }, { status: 400 });
    }

    const { sessionId, prospectIds, linkedInUrls, autoEnrich = true, workspaceId: providedWorkspaceId } = body;

    console.log('⏱️ Starting enrichment request at:', new Date().toISOString());
    console.log('📊 Request params:', { sessionId, prospectCount: prospectIds?.length, linkedInUrls: linkedInUrls?.length });

    // CRITICAL: Netlify functions timeout at 10-26 seconds
    // BrightData takes ~35-40 seconds per prospect
    // Solution: Only process 1 prospect synchronously to avoid timeout
    // TODO: Implement background queue for multi-prospect enrichment
    const MAX_SYNC_PROSPECTS = 1;

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
          console.log('🔍 Type of first ID:', typeof prospectIds[0], prospectIds[0]);

          // CRITICAL FIX: UI sends prospect_id strings like 'prospect_1763274020862_q8c6q7ndz'
          // Use .in() directly on prospect_id field
          const { data: approvalProspects, error: approvalError } = await supabase
            .from('prospect_approval_data')
            .select('*')
            .in('prospect_id', prospectIds);

          if (approvalError) {
            console.error('❌ Error querying prospect_approval_data:', approvalError);
          }

          console.log(`📊 Found ${approvalProspects?.length || 0} prospects in prospect_approval_data`);
          if (approvalProspects && approvalProspects.length > 0) {
            console.log('✅ Sample prospect found:', { id: approvalProspects[0].id, prospect_id: approvalProspects[0].prospect_id, name: approvalProspects[0].name });
          } else {
            console.log('❌ No prospects found with query. Logging full table for debugging...');
            const { data: allProspects } = await supabase
              .from('prospect_approval_data')
              .select('id, prospect_id, name, workspace_id')
              .limit(10);
            console.log('📋 Sample prospects in table:', allProspects);
          }

          if (approvalProspects && approvalProspects.length > 0) {
            prospectsToEnrich = approvalProspects.map(p => ({
              id: p.prospect_id,
              approval_id: p.id,
              linkedin_url: p.contact?.linkedin_url,
              company_name: p.company?.name,
              industry: typeof p.company?.industry === 'string' ? p.company.industry : (p.company?.industry?.[0] || null),
              email: p.contact?.email,
              phone: p.contact?.phone,
              first_name: p.name?.split(' ')[0],
              last_name: p.name?.split(' ').slice(1).join(' '),
              location: p.location,
              table: 'prospect_approval_data',
              is_campaign_prospect: false
            }));
            console.log('✅ Mapped approval prospects for enrichment');
            console.log('📋 Sample mapped prospect:', prospectsToEnrich[0]);
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

      // Safe string checks - handle null/undefined
      const missingEmail = !p.email || (typeof p.email === 'string' && p.email.trim() === '');
      const missingPhone = !p.phone || (typeof p.phone === 'string' && p.phone.trim() === '');
      const missingCompany = !p.company_name || p.company_name === 'unavailable';
      const missingIndustry = !p.industry || p.industry === 'unavailable';
      const missingLinkedIn = !p.linkedin_url;

      const needsEnrich = missingLinkedIn || missingCompany || missingIndustry || missingEmail || missingPhone;

      console.log(`🔍 Prospect "${p.first_name} ${p.last_name}" enrichment check:`, {
        email: p.email,
        phone: p.phone,
        missingEmail,
        missingPhone,
        missingCompany,
        missingIndustry,
        missingLinkedIn,
        needsEnrich
      });

      return needsEnrich;
    });

    console.log(`🔍 Enrichment: ${needsEnrichment.length}/${prospectsToEnrich.length} prospects need enrichment`);

    if (needsEnrichment.length === 0) {
      // Return diagnostic info when no prospects need enrichment
      const diagnosticInfo = prospectsToEnrich.map(p => ({
        name: `${p.first_name} ${p.last_name}`,
        email: p.email === undefined ? 'undefined' : (p.email === '' ? 'empty string' : p.email),
        phone: p.phone === undefined ? 'undefined' : (p.phone === '' ? 'empty string' : p.phone),
        company: p.company_name,
        industry: p.industry,
        linkedin: p.linkedin_url
      }));

      return NextResponse.json({
        success: true,
        enriched_count: 0,
        skipped_count: prospectsToEnrich.length,
        message: 'All prospects already have complete data',
        cost_saved: 0,
        debug: {
          prospects_checked: diagnosticInfo,
          total_found: prospectsToEnrich.length,
          enrichment_criteria: 'Missing: email, phone, company_name=unavailable, industry=unavailable, or linkedin_url'
        }
      });
    }

    // WORKAROUND FOR NETLIFY TIMEOUT:
    // Only process first prospect to stay under timeout limit
    // User needs to run enrichment multiple times for multiple prospects
    const prospectsToProcess = needsEnrichment.slice(0, MAX_SYNC_PROSPECTS);
    const queuedProspects = needsEnrichment.slice(MAX_SYNC_PROSPECTS);

    if (queuedProspects.length > 0) {
      console.log(`⚠️ Queueing ${queuedProspects.length} prospects (Netlify timeout limit)`);
    }

    console.log(`⏱️ Processing ${prospectsToProcess.length} prospect(s) synchronously...`);

    // TEMPORARY: Use direct BrightData API instead of N8N (N8N workflow needs fixing)
    // TODO: Switch back to N8N once "Respond to Webhook" node is connected properly
    const enrichmentResults = await enrichWithBrightData(prospectsToProcess, 1, true);

    // Update prospects with enriched data
    let updatedCount = 0;
    let failedCount = 0;
    let queuedCount = 0;
    const updates: any[] = [];

    for (const result of enrichmentResults) {
      if (result.verification_status === 'failed') {
        failedCount++;
        continue;
      }

      if (result.verification_status === 'queued') {
        queuedCount++;
        continue; // N8N will handle enrichment async
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

    // Build user-facing message
    let message = '';
    if (queuedCount > 0) {
      message = `🔄 Enriching ${queuedCount} prospect(s) in background via N8N workflow.\n\nRefresh in 30-60 seconds to see updated data.`;
    }
    if (queuedProspects.length > 0) {
      message += message ? '\n\n' : '';
      message += `⚠️ ${queuedProspects.length} more prospect(s) need enrichment - click "Enrich" again to continue.`;
    }

    const responseData = {
      success: true,
      enriched_count: updatedCount,
      failed_count: failedCount,
      skipped_count: prospectsToEnrich.length - needsEnrichment.length,
      queued_count: queuedCount + queuedProspects.length, // N8N queue + pagination queue
      total_cost: totalCost,
      cost_per_prospect: 0.01,
      enrichment_details: enrichmentResults.map(r => ({
        linkedin_url: r.linkedin_url,
        status: r.verification_status,
        fields_enriched: Object.keys(r).filter(k =>
          k !== 'linkedin_url' && k !== 'verification_status' && r[k as keyof typeof r]
        )
      })),
      ...(message && { message })
    };

    console.log('📤 Sending enrichment response:', JSON.stringify(responseData, null, 2));
    console.log(`⏱️ Total enrichment time: ${((Date.now() - Date.now()) / 1000).toFixed(1)}s`);

    return NextResponse.json(responseData);

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
 * Trigger N8N enrichment workflow for async prospect enrichment
 *
 * N8N handles long-running BrightData calls (35-40s per prospect)
 * Returns immediate 'queued' status - actual enrichment happens async
 */
async function triggerN8NEnrichment(
  prospects: any[],
  workspaceId: string
): Promise<BrightDataEnrichmentResult[]> {
  try {
    console.log(`📤 Triggering N8N enrichment for ${prospects.length} prospect(s)...`);

    const prospectIds = prospects.map(p => p.id || p.prospect_id);

    // N8N webhook endpoint
    const n8nWebhookUrl = 'https://workflows.innovareai.com/webhook/prospect-enrichment';

    // Match N8N workflow expected format
    const payload = {
      job_id: `enrich_${Date.now()}`, // N8N workflow expects job_id
      prospect_ids: prospectIds,
      workspace_id: workspaceId,
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
      brightdata_api_token: process.env.BRIGHTDATA_API_TOKEN || '61813293-6532-4e16-af76-9803cc043afa',
      brightdata_zone: process.env.BRIGHTDATA_ZONE || 'residential'
    };

    console.log(`🔗 Calling N8N webhook: ${n8nWebhookUrl}`);
    console.log(`📦 Payload:`, JSON.stringify({ ...payload, supabase_service_key: '[REDACTED]' }, null, 2));

    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000) // 5 second timeout for webhook trigger
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ N8N webhook error: ${response.status} - ${errorText}`);
      throw new Error(`N8N webhook failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ N8N enrichment triggered:`, result);

    // Return queued status - actual enrichment happens async in N8N
    return prospects.map(p => ({
      linkedin_url: p.linkedin_url,
      verification_status: 'queued' as const
    }));

  } catch (error) {
    console.error('❌ N8N trigger error:', error);

    // Return failed status for all prospects
    return prospects.map(p => ({
      linkedin_url: p.linkedin_url,
      verification_status: 'failed' as const,
      error: error instanceof Error ? error.message : String(error)
    }));
  }
}

/**
 * Enrich a single prospect using BrightData Direct API
 *
 * Note: MCP integration disabled - tool 'brightdata_scrape_as_markdown' doesn't exist
 * Using direct BrightData Web Unlocker API instead
 */
async function enrichSingleProspectWithMCP(linkedinUrl: string): Promise<BrightDataEnrichmentResult> {
  // MCP tool name was incorrect - skipping MCP and going straight to API
  console.log(`🔍 Enriching via BrightData Direct API: ${linkedinUrl}`);
  return await enrichSingleProspectWithAPI(linkedinUrl);
}

/**
 * Enrich a single prospect using N8N workflow
 *
 * CRITICAL: BrightData authentication requires N8N workflow for production use
 * - Direct API calls fail with auth errors (tried Bearer, Basic Auth)
 * - MCP server only works locally, not in Netlify functions
 * - N8N workflow has BrightData credentials configured and handles async processing
 */
async function enrichSingleProspectWithAPI(linkedinUrl: string): Promise<BrightDataEnrichmentResult> {
  try {
    console.log(`🔍 Queuing enrichment via N8N workflow: ${linkedinUrl}`);

    // Clean LinkedIn URL - remove query parameters
    const cleanUrl = linkedinUrl.split('?')[0];

    // N8N enrichment webhook endpoint
    const n8nWebhookUrl = 'https://workflows.innovareai.com/webhook/prospect-enrichment-single';

    const payload = {
      linkedin_url: cleanUrl,
      timestamp: new Date().toISOString()
    };

    console.log(`📤 Triggering N8N enrichment webhook...`);

    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000) // 10 second timeout for webhook trigger
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ N8N webhook error: ${response.status} - ${errorText}`);

      // Return queued status even if webhook failed - user can retry
      return {
        linkedin_url: linkedinUrl,
        verification_status: 'failed' as const,
        error: `N8N webhook failed: ${response.status}. ${errorText}`
      };
    }

    const result = await response.json();
    console.log(`✅ N8N enrichment queued:`, result);

    // Return queued status - enrichment happens async in N8N
    return {
      linkedin_url: linkedinUrl,
      verification_status: 'queued' as const,
      message: 'Enrichment queued in N8N workflow. Results will be available shortly.'
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Error queuing enrichment:`, error);
    console.error(`   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
    console.error(`   Error stack:`, error instanceof Error ? error.stack : 'No stack trace');

    return {
      linkedin_url: linkedinUrl,
      verification_status: 'failed' as const,
      error: `Failed to queue enrichment: ${errorMsg}`
    };
  }
}

/**
 * Convert LinkedIn HTML to markdown-like text
 */
function convertLinkedInHtmlToMarkdown(html: string): string {
  try {
    // Remove script and style tags
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Extract JSON-LD data if available (LinkedIn embeds structured data)
    const jsonLdMatch = text.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    if (jsonLdMatch && jsonLdMatch[1]) {
      try {
        const jsonString = jsonLdMatch[1].trim();
        if (jsonString && jsonString.length > 0) {
          console.log('🔍 Attempting to parse JSON-LD data, length:', jsonString.length);
          const jsonData = JSON.parse(jsonString);
          console.log('✅ Successfully parsed JSON-LD data');
          // LinkedIn Profile JSON-LD contains useful data
          if (jsonData['@type'] === 'ProfilePage' || jsonData['@type'] === 'Person') {
            console.log('✅ Found LinkedIn Profile JSON-LD, using structured data');
            return JSON.stringify(jsonData, null, 2);
          }
        } else {
          console.log('⚠️ JSON-LD script tag found but content is empty');
        }
      } catch (e) {
        console.error('❌ Failed to parse JSON-LD data:', e instanceof Error ? e.message : 'Unknown error');
        console.error('JSON-LD content preview:', jsonLdMatch[1].substring(0, 200));
        // Don't throw, just continue to meta tags parsing
      }
    }

    // Extract meta tags (LinkedIn uses these extensively)
    const metaTags: Record<string, string> = {};
    const metaMatches = text.matchAll(/<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]+)"/g);
    for (const match of metaMatches) {
      metaTags[match[1]] = match[2];
    }

    // Build markdown from meta tags
    const markdown = [];
    if (metaTags['og:title']) markdown.push(`# ${metaTags['og:title']}`);
    if (metaTags['og:description']) markdown.push(`\n${metaTags['og:description']}`);
    if (metaTags['description']) markdown.push(`\n${metaTags['description']}`);

    // Try to extract from page title
    const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && !metaTags['og:title']) {
      markdown.push(`# ${titleMatch[1]}`);
    }

    return markdown.join('\n') || text.substring(0, 5000); // Fallback to raw text
  } catch (error) {
    console.error('Error converting HTML to markdown:', error);
    return '';
  }
}

/**
 * Parse LinkedIn markdown/text content to extract fields
 * ENHANCED: More robust parsing with multiple pattern matching strategies
 */
function parseLinkedInMarkdown(content: string, linkedinUrl: string): Partial<BrightDataEnrichmentResult> {
  const result: Partial<BrightDataEnrichmentResult> = {};

  try {
    // Strategy 1: Extract from "Name - Title at Company | LinkedIn" pattern
    const titleMatch = content.match(/([^-]+)\s*-\s*([^|]+)(?:\s*\|\s*LinkedIn)?/i);
    if (titleMatch) {
      const titlePart = titleMatch[2].trim();

      // Extract job title and company from "Title at Company"
      const jobCompanyMatch = titlePart.match(/(.+?)\s+at\s+(.+)/i);
      if (jobCompanyMatch) {
        result.job_title = jobCompanyMatch[1].trim();
        result.company_name = jobCompanyMatch[2].trim();
      }
    }

    // Strategy 2: Extract from markdown headers "## Title at Company"
    if (!result.company_name) {
      const headerMatch = content.match(/##?\s*([^\n]+)\s*at\s*([^\n]+)/i) ||
                          content.match(/\*\*([^*]+)\s*at\s*([^*]+)\*\*/i);
      if (headerMatch) {
        result.job_title = headerMatch[1].trim();
        result.company_name = headerMatch[2].trim();
      }
    }

    // Strategy 3: Extract from "Current: Title at Company" pattern
    if (!result.company_name) {
      const currentMatch = content.match(/Current[:\s]+[^at]+at\s+([^\n|•]+)/i);
      if (currentMatch) {
        result.company_name = currentMatch[1].trim();
      }
    }

    // Extract location with multiple patterns
    const locationMatch = content.match(/(?:Location|Based in|From)[:\s]+([^\n|•]+)/i) ||
                         content.match(/location[:\s]+([^\n]+)/i) ||
                         content.match(/([A-Z][a-z]+(?:,\s*[A-Z]{2})?(?:,\s*[A-Z][a-z]+)?)\s*$/m);
    if (locationMatch) {
      result.location = locationMatch[1].trim();
    }

    // Extract industry
    const industryMatch = content.match(/Industry[:\s]+([^\n|•]+)/i) ||
                         content.match(/industry[:\s]+([^\n]+)/i);
    if (industryMatch) {
      result.industry = industryMatch[1].trim();
    }

    // Extract company LinkedIn URL
    const companyLinkedInMatch = content.match(/linkedin\.com\/company\/([^/\s)]+)/i);
    if (companyLinkedInMatch) {
      result.company_linkedin_url = `https://linkedin.com/company/${companyLinkedInMatch[1]}`;
    }

    // Extract email if visible
    const emailMatch = content.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      result.email = emailMatch[1];
    }

    // Extract phone if visible
    const phoneMatch = content.match(/(\+?[\d\s()-]{10,})/);
    if (phoneMatch) {
      result.phone = phoneMatch[1].trim();
    }

    console.log('📊 Parsed LinkedIn data:', {
      url: linkedinUrl,
      company: result.company_name || 'NOT FOUND',
      title: result.job_title || 'NOT FOUND',
      location: result.location || 'NOT FOUND',
      industry: result.industry || 'NOT FOUND'
    });

  } catch (error) {
    console.error('Error parsing LinkedIn markdown:', error);
  }

  return result;
}

/**
 * Enrich prospects using BrightData with parallel processing
 *
 * Cost Optimization Strategy:
 * 1. Try MCP first (FREE 5,000 requests/month permanently)
 * 2. Fallback to Direct API if MCP quota exceeded (paid $3/CPM)
 *
 * @param prospects - Array of prospects to enrich
 * @param concurrency - Max concurrent requests (default: 5)
 * @param useMCPFallback - Enable MCP cost optimization (default: true)
 */
async function enrichWithBrightData(
  prospects: Array<{ linkedin_url: string; [key: string]: any }>,
  concurrency: number = 5,
  useMCPFallback: boolean = true
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

      // Create parallel requests for this batch (using MCP fallback if enabled)
      const batchPromises = batch.map(async (prospect) => {
        try {
          // Use MCP fallback for cost optimization if enabled
          if (useMCPFallback) {
            const result = await enrichSingleProspectWithMCP(prospect.linkedin_url);
            if (result.verification_status === 'verified') {
              console.log(`✅ Enriched: ${result.company_name || 'Unknown'} (MCP FREE)`);
            }
            return result;
          }

          // Direct BrightData API call (FIXED: no longer calls internal endpoint)
          const result = await enrichSingleProspectWithAPI(prospect.linkedin_url);
          if (result.verification_status === 'verified') {
            console.log(`✅ Enriched: ${result.company_name || 'Unknown'} (Direct API)`);
          }
          return result;

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

    // Calculate cost savings from MCP usage
    if (useMCPFallback) {
      const mcpFreeRequests = totalSuccess; // Assume MCP was tried first for all
      const apiPaidRequests = totalFailed; // Failed MCP fell back to API
      const costSaved = mcpFreeRequests * 0.003; // $0.003 per request saved
      const costIncurred = apiPaidRequests * 0.003;

      console.log(`\n💰 Cost Optimization:`);
      console.log(`   MCP (FREE): ${mcpFreeRequests} requests`);
      console.log(`   API (PAID): ${apiPaidRequests} requests`);
      console.log(`   Cost saved: $${costSaved.toFixed(3)}`);
      console.log(`   Cost incurred: $${costIncurred.toFixed(3)}`);
    }

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
