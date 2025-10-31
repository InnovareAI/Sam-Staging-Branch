import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * BrightData Prospect Enrichment API
 * Enriches prospects with missing mandatory fields (company, industry, email)
 */

interface EnrichmentRequest {
  sessionId?: string;        // Enrich all prospects in approval session
  prospectIds?: string[];    // Enrich specific prospects by ID
  linkedInUrls?: string[];   // Enrich by LinkedIn URLs
  autoEnrich?: boolean;      // Automatically enrich all 'unavailable' fields
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
    const { sessionId, prospectIds, linkedInUrls, autoEnrich = true } = body;

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
      // Enrich specific prospects from workspace_prospects
      const { data: prospects } = await supabase
        .from('workspace_prospects')
        .select('*')
        .in('id', prospectIds)
        .eq('workspace_id', workspaceId);

      if (prospects) {
        prospectsToEnrich = prospects.map(p => ({
          id: p.id,
          linkedin_url: p.linkedin_profile_url,
          company_name: p.company_name,
          industry: p.industry,
          email: p.email_address,
          first_name: p.first_name,
          last_name: p.last_name
        }));
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

    if (prospectsToEnrich.length === 0) {
      return NextResponse.json({
        error: 'No prospects to enrich'
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
              website: update.data.enrichment_data.company_website || ''
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
      // Update workspace_prospects
      for (const update of updates) {
        await supabase
          .from('workspace_prospects')
          .update(update.data)
          .eq('id', update.prospectId)
          .eq('workspace_id', workspaceId);
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
    console.error('Enrichment error:', error);
    return NextResponse.json({
      error: 'Failed to enrich prospects',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * Enrich prospects using BrightData
 */
async function enrichWithBrightData(
  prospects: Array<{ linkedin_url: string; [key: string]: any }>
): Promise<BrightDataEnrichmentResult[]> {
  try {
    // Call BrightData scraper API
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/leads/brightdata-scraper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'enrich_linkedin_profiles',
        linkedin_urls: prospects.map(p => p.linkedin_url),
        include_contact_info: true,
        include_company_info: true
      })
    });

    if (!response.ok) {
      console.error('BrightData API error:', response.status);
      return prospects.map(p => ({
        linkedin_url: p.linkedin_url,
        verification_status: 'failed' as const
      }));
    }

    const data = await response.json();

    if (!data.success) {
      console.error('BrightData enrichment failed:', data.error);
      return prospects.map(p => ({
        linkedin_url: p.linkedin_url,
        verification_status: 'failed' as const
      }));
    }

    // Map BrightData response to enrichment results
    return data.enriched_profiles || prospects.map(p => ({
      linkedin_url: p.linkedin_url,
      verification_status: 'unverified' as const
    }));

  } catch (error) {
    console.error('BrightData enrichment error:', error);
    return prospects.map(p => ({
      linkedin_url: p.linkedin_url,
      verification_status: 'failed' as const
    }));
  }
}
