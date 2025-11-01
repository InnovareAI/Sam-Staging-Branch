import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 300; // 5 minutes (for cron job)
export const dynamic = 'force-dynamic';

/**
 * Background Enrichment Worker
 *
 * Processes pending enrichment jobs one prospect at a time.
 * Can be triggered:
 * 1. Manually when job is created
 * 2. Via cron job every minute to pick up pending jobs
 * 3. Via manual API call
 *
 * This runs with service role permissions to bypass RLS.
 */

interface BrightDataEnrichmentResult {
  linkedin_url: string;
  company_name?: string;
  company_website?: string;
  company_linkedin_url?: string;
  job_title?: string;
  location?: string;
  industry?: string;
  email?: string;
  phone?: string;
  verification_status: 'verified' | 'unverified' | 'failed';
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get job ID from request or find next pending job
    const body = await request.json().catch(() => ({}));
    let jobId = body.jobId;

    if (!jobId) {
      // Find oldest pending job
      const { data: pendingJobs } = await supabase
        .from('enrichment_jobs')
        .select('id')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1);

      if (!pendingJobs || pendingJobs.length === 0) {
        return NextResponse.json({
          message: 'No pending jobs to process'
        });
      }

      jobId = pendingJobs[0].id;
    }

    console.log(`🔄 Processing enrichment job: ${jobId}`);

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('enrichment_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      console.error('Job not found:', jobId);
      return NextResponse.json({
        error: 'Job not found'
      }, { status: 404 });
    }

    // Check if job is already processing or completed
    if (job.status !== 'pending') {
      console.log(`Job ${jobId} is already ${job.status}`);
      return NextResponse.json({
        message: `Job is already ${job.status}`
      });
    }

    // Mark job as processing
    await supabase
      .from('enrichment_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Get prospects to enrich
    const prospectIds = job.prospect_ids;

    // For each prospect, enrich one at a time
    const results: BrightDataEnrichmentResult[] = [];
    let processedCount = 0;
    let failedCount = 0;

    for (const prospectId of prospectIds) {
      try {
        // Get prospect details
        const { data: prospect } = await supabase
          .from('workspace_prospects')
          .select('linkedin_url, company_name, location, industry')
          .eq('id', prospectId)
          .single();

        if (!prospect || !prospect.linkedin_url) {
          console.warn(`Prospect ${prospectId} has no LinkedIn URL, skipping`);
          failedCount++;
          continue;
        }

        // Update current prospect
        await supabase
          .from('enrichment_jobs')
          .update({
            current_prospect_id: prospectId,
            current_prospect_url: prospect.linkedin_url
          })
          .eq('id', jobId);

        console.log(`🔍 Enriching prospect: ${prospect.linkedin_url}`);

        // Call enrichment function
        const enrichmentResult = await enrichSingleProspect(prospect.linkedin_url);

        results.push(enrichmentResult);

        if (enrichmentResult.verification_status === 'verified') {
          // Update prospect with enriched data
          await supabase
            .from('workspace_prospects')
            .update({
              company_name: enrichmentResult.company_name || prospect.company_name,
              location: enrichmentResult.location || prospect.location,
              industry: enrichmentResult.industry || prospect.industry,
              email: enrichmentResult.email,
              phone_number: enrichmentResult.phone
            })
            .eq('id', prospectId);

          processedCount++;
          console.log(`✅ Enriched: ${enrichmentResult.company_name}`);
        } else {
          failedCount++;
          console.warn(`❌ Failed to enrich: ${enrichmentResult.error}`);
        }

        // Update job progress
        await supabase
          .from('enrichment_jobs')
          .update({
            processed_count: processedCount,
            failed_count: failedCount,
            enrichment_results: results
          })
          .eq('id', jobId);

      } catch (error) {
        console.error(`Error enriching prospect ${prospectId}:`, error);
        failedCount++;
      }
    }

    // Mark job as completed
    await supabase
      .from('enrichment_jobs')
      .update({
        status: 'completed',
        processed_count: processedCount,
        failed_count: failedCount,
        enrichment_results: results,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    console.log(`✅ Job ${jobId} completed: ${processedCount} successful, ${failedCount} failed`);

    return NextResponse.json({
      success: true,
      job_id: jobId,
      processed_count: processedCount,
      failed_count: failedCount
    });

  } catch (error) {
    console.error('❌ Worker error:', error);
    return NextResponse.json({
      error: 'Worker failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * Enrich a single prospect using BrightData Direct API
 */
async function enrichSingleProspect(linkedinUrl: string): Promise<BrightDataEnrichmentResult> {
  try {
    const cleanUrl = linkedinUrl.split('?')[0];
    const brightdataApiToken = process.env.BRIGHTDATA_API_TOKEN || '61813293-6532-4e16-af76-9803cc043afa';
    const brightdataZone = process.env.BRIGHTDATA_ZONE || 'linkedin_enrichment';

    const response = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${brightdataApiToken}`
      },
      body: JSON.stringify({
        zone: brightdataZone,
        url: cleanUrl,
        format: 'raw'
      })
    });

    if (!response.ok) {
      return {
        linkedin_url: linkedinUrl,
        verification_status: 'failed',
        error: `BrightData API error: ${response.status}`
      };
    }

    const html = await response.text();

    // Simple parsing - extract from meta tags
    const companyMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
    const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);

    let company_name, job_title, location;

    if (companyMatch && companyMatch[1]) {
      const titleParts = companyMatch[1].split(' - ');
      if (titleParts[1]) {
        const jobCompany = titleParts[1].match(/(.+?)\s+at\s+(.+)/i);
        if (jobCompany) {
          job_title = jobCompany[1].trim();
          company_name = jobCompany[2].trim();
        }
      }
    }

    if (descMatch && descMatch[1]) {
      const locMatch = descMatch[1].match(/([A-Z][a-z]+(?:,\s*[A-Z]{2})?(?:,\s*[A-Z][a-z]+)?)/);
      if (locMatch) {
        location = locMatch[1];
      }
    }

    return {
      linkedin_url: linkedinUrl,
      verification_status: company_name ? 'verified' : 'failed',
      company_name,
      job_title,
      location
    };

  } catch (error) {
    return {
      linkedin_url: linkedinUrl,
      verification_status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
