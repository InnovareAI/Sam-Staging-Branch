import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

/**
 * Direct LinkedIn Search - No Background Jobs
 *
 * Executes LinkedIn search synchronously and returns results immediately.
 * Limited to 100 prospects to fit within Netlify 10s timeout.
 * Perfect for 90% of use cases - fast and reliable.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId, userEmail } = await verifyAuth(request);

    const body = await request.json();
    const {
      search_criteria,
      target_count = 100,
      save_to_approval = true // Save to prospect approval by default
    } = body;

    // Hard limit to 100 for speed (fits in 10s Netlify timeout)
    const limitedTarget = Math.min(target_count, 100);

    console.log(`🔍 Direct search for ${userEmail}: ${limitedTarget} prospects`);

    console.log('✅ Using workspace:', workspaceId);

    // Get LinkedIn account from workspace_accounts table
    // Get any workspace member's LinkedIn account (can be shared across team)
    const { rows: linkedinAccounts } = await pool.query(`
      SELECT unipile_account_id, account_name, account_identifier
      FROM workspace_accounts
      WHERE workspace_id = $1
      AND account_type = 'linkedin'
      AND connection_status = ANY($2)
    `, [workspaceId, VALID_CONNECTION_STATUSES]);

    console.log('🔵 LinkedIn accounts found:', linkedinAccounts?.length || 0);

    if (!linkedinAccounts || linkedinAccounts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active LinkedIn account found. Please connect a LinkedIn account to your workspace first.',
        action: 'connect_linkedin'
      }, { status: 400 });
    }

    // Use the first available LinkedIn account
    const linkedinAccount = linkedinAccounts[0];
    console.log('✅ Using LinkedIn account:', linkedinAccount.account_name || linkedinAccount.account_identifier);

    // Auto-detect LinkedIn capabilities
    let api = 'classic';
    try {
      // UNIPILE_DSN format: "api6.unipile.com:13670" - already includes domain and port
      const accountInfoUrl = `https://${process.env.UNIPILE_DSN}/api/v1/accounts/${linkedinAccount.unipile_account_id}`;
      const accountInfoResponse = await fetch(accountInfoUrl, {
        headers: {
          'X-API-KEY': process.env.UNIPILE_API_KEY!,
          'Accept': 'application/json'
        }
      });

      if (accountInfoResponse.ok) {
        const accountInfo = await accountInfoResponse.json();
        const premiumFeatures = accountInfo.connection_params?.im?.premiumFeatures || [];

        if (premiumFeatures.includes('recruiter')) {
          api = 'recruiter';
        } else if (premiumFeatures.includes('sales_navigator')) {
          api = 'sales_navigator';
        }
      }
    } catch (error) {
      console.warn('Could not detect LinkedIn capabilities, using classic');
    }

    console.log(`📊 Using LinkedIn API: ${api}`);

    // Validate Unipile configuration
    if (!process.env.UNIPILE_DSN || !process.env.UNIPILE_API_KEY) {
      console.error('❌ Missing Unipile credentials:', {
        hasDSN: !!process.env.UNIPILE_DSN,
        hasAPIKey: !!process.env.UNIPILE_API_KEY
      });
      return NextResponse.json({
        success: false,
        error: 'LinkedIn integration not configured. Please contact support.',
        debug: {
          missingUnipileDSN: !process.env.UNIPILE_DSN,
          missingUnipileAPIKey: !process.env.UNIPILE_API_KEY
        }
      }, { status: 500 });
    }

    // Call Unipile directly
    let searchUrl;
    try {
      // UNIPILE_DSN format: "api6.unipile.com:13670" - already includes domain and port
      const unipileBaseUrl = `https://${process.env.UNIPILE_DSN}/api/v1/linkedin/search`;
      searchUrl = new URL(unipileBaseUrl);
      searchUrl.searchParams.append('account_id', linkedinAccount.unipile_account_id);
      searchUrl.searchParams.append('limit', limitedTarget.toString());
      console.log(`🔗 Unipile URL: ${searchUrl.toString().substring(0, 80)}...`);
    } catch (urlError) {
      console.error('❌ Failed to construct Unipile URL:', urlError);
      return NextResponse.json({
        success: false,
        error: 'Invalid URL configuration',
        debug: {
          error: urlError instanceof Error ? urlError.message : String(urlError),
          unipileDSN: process.env.UNIPILE_DSN?.substring(0, 10) + '...',
          accountId: linkedinAccount.unipile_account_id?.substring(0, 10) + '...'
        }
      }, { status: 500 });
    }

    const searchPayload = {
      ...search_criteria,
      api
    };

    console.log(`🚀 Calling Unipile with payload:`, JSON.stringify(searchPayload).substring(0, 200));

    const unipileResponse = await fetch(searchUrl.toString(), {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY!,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(searchPayload)
    });

    if (!unipileResponse.ok) {
      const errorData = await unipileResponse.json().catch(() => ({}));
      console.error('❌ Unipile API error:', errorData);
      return NextResponse.json({
        success: false,
        error: `LinkedIn search failed: ${unipileResponse.status} - ${JSON.stringify(errorData)}`,
        debug: {
          status: unipileResponse.status,
          api: api,
          search_criteria: search_criteria
        }
      }, { status: 500 });
    }

    const data = await unipileResponse.json();
    const items = data.items || [];

    console.log(`✅ Found ${items.length} prospects from Unipile`);

    // Helper function to clean LinkedIn URLs
    const cleanLinkedInUrl = (url: string): string => {
      if (!url) return '';
      try {
        const urlObj = new URL(url);
        // Remove all query parameters (miniProfileUrn, etc.)
        urlObj.search = '';
        // Remove trailing slash
        let cleanUrl = urlObj.toString().replace(/\/$/, '');
        // Extract just the profile identifier
        if (cleanUrl.includes('linkedin.com/in/')) {
          const match = cleanUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
          if (match) {
            return `https://www.linkedin.com/in/${match[1]}`;
          }
        }
        return cleanUrl;
      } catch (error) {
        console.error('Error cleaning LinkedIn URL:', url, error);
        return url;
      }
    };

    // Transform prospects to our format
    const prospects = items.map((item: any) => ({
      // Basic info
      name: item.name || `${item.first_name || ''} ${item.last_name || ''}`.trim(),
      firstName: item.first_name,
      lastName: item.last_name,
      headline: item.headline,

      // Professional info
      title: item.title || item.headline,
      company: item.company_name || item.current_company,
      industry: item.industry,

      // LinkedIn specific - CRITICAL FIX
      // Store provider_id (authoritative LinkedIn user ID that doesn't change)
      // and cleaned LinkedIn URL (remove query parameters)
      providerId: item.provider_id,
      linkedinUrl: cleanLinkedInUrl(item.profile_url),
      publicIdentifier: item.public_identifier,

      // Location
      location: item.location,
      country: item.country,

      // Connection info
      connectionDegree: item.network_distance || item.connection_degree,

      // Metadata
      source: 'linkedin_search',
      searchApi: api,
      searchedAt: new Date().toISOString()
    }));

    // If requested, save to prospect approval system
    let sessionId = null;
    if (save_to_approval && prospects.length > 0) {
      console.log(`💾 Saving ${prospects.length} prospects to approval system...`);

      // Generate campaign name and tag
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const campaignName = `${today}-LinkedIn-Search`;
      const campaignTag = search_criteria.keywords || search_criteria.title || 'LinkedIn Search';

      try {
        // Step 1: Create approval session
        const { rows: sessionRows } = await pool.query(`
          INSERT INTO prospect_approval_sessions (
            user_id, workspace_id, campaign_name, campaign_tag,
            status, total_prospects, pending_count, approved_count,
            rejected_count, source, icp_criteria, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *
        `, [
          userId,
          workspaceId,
          campaignName,
          campaignTag,
          'active',
          prospects.length,
          prospects.length,
          0,
          0,
          'linkedin_direct_search',
          JSON.stringify(search_criteria),
          new Date().toISOString()
        ]);

        if (!sessionRows || sessionRows.length === 0) {
          throw new Error('Failed to create approval session');
        }

        sessionId = sessionRows[0].id;
        console.log(`✅ Created approval session: ${sessionId.substring(0, 8)}`);

        // Step 2: Insert prospects into approval_data
        for (let i = 0; i < prospects.length; i++) {
          const p = prospects[i];
          await pool.query(`
            INSERT INTO prospect_approval_data (
              session_id, prospect_id, name, title, company, location,
              profile_image, contact, recent_activity, connection_degree,
              enrichment_score, source, enriched_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          `, [
            sessionId,
            `linkedin_${p.publicIdentifier || i}_${Date.now()}`,
            p.name,
            p.title,
            p.company,
            p.location,
            null, // LinkedIn doesn't provide images via search API
            JSON.stringify({
              linkedin: p.linkedinUrl,
              linkedin_provider_id: p.providerId,
              public_identifier: p.publicIdentifier,
              email: null
            }),
            p.headline,
            p.connectionDegree || 'Unknown',
            50, // Default score
            'linkedin_direct_search',
            new Date().toISOString(),
            new Date().toISOString()
          ]);
        }

        console.log(`✅ Saved ${prospects.length} prospects to approval system (session: ${sessionId.substring(0, 8)})`);

      } catch (saveError) {
        console.error('❌ Error saving to approval system:', saveError);
        // Clean up session on failure
        if (sessionId) {
          await pool.query('DELETE FROM prospect_approval_sessions WHERE id = $1', [sessionId]);
        }
        // Don't fail the request - we still have the data
      }
    }

    return NextResponse.json({
      success: true,
      prospects: prospects,
      count: prospects.length,
      api: api,
      saved_to_approval: save_to_approval,
      session_id: sessionId,
      message: `Found ${prospects.length} prospects${save_to_approval ? ' and saved to Data Approval' : ''}`
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('❌ Direct search error:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search LinkedIn',
      debug: {
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        error_stack: error instanceof Error ? error.stack?.split('\n')[0] : 'No stack',
        user_authenticated: true // We got past auth to reach here
      }
    }, { status: 500 });
  }
}
