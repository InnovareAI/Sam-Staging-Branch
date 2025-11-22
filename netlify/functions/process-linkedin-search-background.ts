/**
 * Netlify Background Function - Process LinkedIn Search Jobs
 *
 * Runs up to 15 minutes (900 seconds)
 * Handles pagination for large prospect searches (up to 2500 results)
 * Updates progress in real-time via Supabase Realtime
 */

import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_BASE_URL = `https://${UNIPILE_DSN}`; // DSN already includes full domain + port

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role for background access
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export const handler: Handler = async (event, context) => {
  console.log('🚀 Background job started:', new Date().toISOString());

  // Parse job data
  const { job_id, search_criteria, account_id, user_id } = JSON.parse(event.body || '{}');

  if (!job_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'job_id required' })
    };
  }

  try {
    // Update job status to processing
    await supabase
      .from('prospect_search_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', job_id);

    console.log(`📊 Processing job ${job_id}...`);

    // Initialize pagination
    let cursor: string | null = null;
    let totalFetched = 0;
    let batchNumber = 0;
    const target = search_criteria.limit || 1000;
    const maxPerPage = 100; // Unipile's max for Sales Navigator/Recruiter

    // Process pages until we hit target
    while (totalFetched < target) {
      console.log(`📄 Fetching batch ${batchNumber + 1} (${totalFetched}/${target} so far)...`);

      try {
        // Build Unipile search URL
        const searchUrl = new URL(`${UNIPILE_BASE_URL}/api/v1/linkedin/search`);
        searchUrl.searchParams.append('account_id', account_id);
        searchUrl.searchParams.append('limit', Math.min(maxPerPage, target - totalFetched).toString());
        if (cursor) {
          searchUrl.searchParams.append('cursor', cursor);
        }

        // Call Unipile API
        const response = await fetch(searchUrl.toString(), {
          method: 'POST',
          headers: {
            'X-Api-Key': UNIPILE_API_KEY!,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(search_criteria)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Unipile API error: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const items = data.items || [];

        if (items.length === 0) {
          console.log('⚠️  No more results, stopping pagination');
          break;
        }

        // Save batch to database
        const resultsToInsert = items.map((item: any) => ({
          job_id: job_id,
          prospect_data: transformProspectData(item),
          batch_number: batchNumber
        }));

        const { error: insertError } = await supabase
          .from('prospect_search_results')
          .insert(resultsToInsert);

        if (insertError) {
          console.error('❌ Failed to insert results:', insertError);
          throw insertError;
        }

        totalFetched += items.length;
        batchNumber++;

        // Update progress (triggers Supabase Realtime to frontend)
        await supabase
          .from('prospect_search_jobs')
          .update({
            progress_current: totalFetched,
            progress_total: target,
            updated_at: new Date().toISOString()
          })
          .eq('id', job_id);

        console.log(`✅ Batch ${batchNumber} saved: ${items.length} prospects (total: ${totalFetched})`);

        // Check for next page
        cursor = data.paging?.cursor || null;
        if (!cursor) {
          console.log('✅ No more pages available');
          break;
        }

        // Rate limiting - be nice to Unipile API
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (batchError) {
        console.error(`❌ Error processing batch ${batchNumber}:`, batchError);

        // If we have some results, mark as partially completed
        if (totalFetched > 0) {
          await supabase
            .from('prospect_search_jobs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              total_results: totalFetched,
              error_message: `Partial completion: ${batchError.message}`
            })
            .eq('id', job_id);

          return {
            statusCode: 200,
            body: JSON.stringify({
              success: true,
              total: totalFetched,
              partial: true,
              error: batchError.message
            })
          };
        }

        throw batchError;
      }
    }

    // Mark job as completed
    await supabase
      .from('prospect_search_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_results: totalFetched
      })
      .eq('id', job_id);

    console.log(`🎉 Job ${job_id} completed successfully: ${totalFetched} prospects`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        total: totalFetched,
        batches: batchNumber
      })
    };

  } catch (error) {
    console.error('❌ Background job failed:', error);

    // Mark job as failed
    await supabase
      .from('prospect_search_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
        completed_at: new Date().toISOString()
      })
      .eq('id', job_id);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

// Transform Unipile prospect data to our format
function transformProspectData(item: any): any {
  return {
    // Basic info
    id: `linkedin_${item.id || item.public_identifier}`,
    name: item.name || `${item.first_name || ''} ${item.last_name || ''}`.trim(),
    firstName: item.first_name,
    lastName: item.last_name,
    headline: item.headline,

    // Professional info
    title: item.title || item.headline,
    company: item.company_name || item.current_company,
    industry: item.industry,

    // LinkedIn specific
    linkedinUrl: item.profile_url,
    publicIdentifier: item.public_identifier,
    entityUrn: item.entity_urn,

    // Location
    location: item.location,
    country: item.country,

    // Connection info
    connectionDegree: item.network_distance || item.connection_degree,
    mutualConnections: item.num_of_mutual_connections,

    // Profile details
    summary: item.summary,
    premium: item.premium_subscriber,
    openToWork: item.open_to_work,

    // Metadata
    source: 'unipile_linkedin',
    scrapedAt: new Date().toISOString(),

    // Store full Unipile response for future reference
    raw: item
  };
}
