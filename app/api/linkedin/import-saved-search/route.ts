import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

/**
 * Import prospects from a LinkedIn Sales Navigator saved search
 * POST /api/linkedin/import-saved-search
 */
export async function POST(request: NextRequest) {
  console.log('🔍 SAVED SEARCH IMPORT START');

  try {
    // Check for internal auth headers (when called from SAM)
    const internalAuth = request.headers.get('X-Internal-Auth');
    const internalUserId = request.headers.get('X-User-Id');
    const internalWorkspaceId = request.headers.get('X-Workspace-Id');

    let user: any = null;
    let workspaceId: string | null = null;

    if (internalAuth === 'true' && internalUserId) {
      // Internal call from SAM - use service role to verify user exists
      console.log('🔐 Internal auth detected from SAM');
      const userResult = await pool.query(
        'SELECT id, email, current_workspace_id FROM users WHERE id = $1',
        [internalUserId]
      );
      const userData = userResult.rows[0];

      if (userData) {
        user = userData;
        workspaceId = internalWorkspaceId || userData.current_workspace_id;
        console.log(`✅ Internal auth successful: ${user.email}, workspace: ${workspaceId}`);
      }
    }

    // Fall back to cookie-based auth if internal auth not used
    if (!user) {
      try {
        const authContext = await verifyAuth(request);
        user = {
          id: authContext.userId,
          email: authContext.userEmail
        };
      } catch (authError) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
    }

    const { saved_search_url, campaign_name, target_count } = await request.json();

    if (!saved_search_url) {
      return NextResponse.json({
        success: false,
        error: 'saved_search_url is required'
      }, { status: 400 });
    }

    // Default target: 500 prospects, max 2500 (LinkedIn Sales Navigator limit)
    const targetProspects = Math.min(Math.max(target_count || 500, 25), 2500);
    console.log(`🎯 Target: ${targetProspects} prospects`);

    // Detect if user provided a saved search reference URL (won't work with Unipile)
    const isSavedSearchReference = saved_search_url.match(/savedSearchId=(\d+)(?!.*[?&]query=|.*[?&]filters=)/)
    if (isSavedSearchReference) {
      const searchId = isSavedSearchReference[1]
      console.log(`❌ Saved search reference URL detected (ID: ${searchId}) - Unipile requires full parameterized URL`)
      return NextResponse.json({
        success: false,
        error: `This appears to be a saved search reference URL which is not supported. Please:\n\n1. Open saved search ${searchId} in LinkedIn Sales Navigator\n2. Wait for all results to load\n3. Copy the FULL URL from the address bar (should contain "query=" and "filters=" parameters)\n4. Use that complete URL instead`
      }, { status: 400 });
    }

    console.log(`🔍 Importing from saved search URL: ${saved_search_url}`);

    // Get workspace if not already set
    if (!workspaceId) {
      const userProfileResult = await pool.query(
        'SELECT current_workspace_id FROM users WHERE id = $1',
        [user.id]
      );
      workspaceId = userProfileResult.rows[0]?.current_workspace_id || null;
    }

    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'No workspace found'
      }, { status: 400 });
    }

    // Get ONLY the user's own LinkedIn accounts (never use other people's accounts)
    const accountsResult = await pool.query(
      `SELECT unipile_account_id, account_name, user_id 
       FROM workspace_accounts 
       WHERE workspace_id = $1 
         AND account_type = 'linkedin' 
         AND connection_status = ANY($2::text[]) 
         AND user_id = $3`,
      [workspaceId, VALID_CONNECTION_STATUSES, user.id]
    );
    const linkedInAccounts = accountsResult.rows;

    if (!linkedInAccounts || linkedInAccounts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No LinkedIn account connected. Please connect your LinkedIn account first.'
      }, { status: 400 });
    }

    console.log(`📊 Found ${linkedInAccounts.length} LinkedIn account(s) for user ${user.email}`);

    // Call Unipile API to get account details and find which has Sales Navigator
    const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6';
    const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

    if (!UNIPILE_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Unipile API not configured'
      }, { status: 500 });
    }

    // Fetch all Unipile accounts to check their features
    // UNIPILE_DSN format: "api6.unipile.com:13670" - already includes domain and port
    const unipileAccountsUrl = `https://${UNIPILE_DSN}/api/v1/accounts`;

    const unipileResponse = await fetch(unipileAccountsUrl, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!unipileResponse.ok) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch account details from Unipile'
      }, { status: 500 });
    }

    const allUnipileAccounts = await unipileResponse.json();
    const unipileAccounts = Array.isArray(allUnipileAccounts) ? allUnipileAccounts : (allUnipileAccounts.items || []);

    // Find which of the user's accounts has Sales Navigator
    let salesNavAccount = null;

    for (const dbAccount of linkedInAccounts) {
      const unipileAccount = unipileAccounts.find((a: any) => a.id === dbAccount.unipile_account_id && a.type === 'LINKEDIN');

      if (!unipileAccount) {
        console.log(`⚠️ Account ${dbAccount.account_name} not found in Unipile`);
        continue;
      }

      const features = unipileAccount.connection_params?.im?.premiumFeatures || [];
      // CRITICAL: Features are lowercase in Unipile API ('sales_navigator', not 'SALES_NAVIGATOR')
      const hasSalesNav = features.some((f: string) =>
        f.toLowerCase() === 'sales_navigator' || f.toLowerCase() === 'recruiter'
      );

      console.log(`🔍 Account: ${dbAccount.account_name}`);
      console.log(`   Features: ${features.join(', ') || 'none'}`);
      console.log(`   Has Sales Nav: ${hasSalesNav}`);

      if (hasSalesNav) {
        salesNavAccount = dbAccount;
        console.log(`✅ SELECTED - This account has Sales Navigator`);
        break;
      }
    }

    // If no Sales Nav account found, use the first available account and let Unipile handle it
    const linkedInAccount = salesNavAccount || linkedInAccounts[0];

    if (!salesNavAccount) {
      console.log(`⚠️ No Sales Navigator account detected. Using ${linkedInAccount.account_name} - Unipile will attempt the search anyway.`);
    } else {
      console.log(`✅ Using Sales Navigator account: ${linkedInAccount.account_name}`);
    }

    // UNIPILE_DSN format: "api6.unipile.com:13670" - already includes domain and port
    const searchUrl = `https://${UNIPILE_DSN}/api/v1/linkedin/search`;

    // Fetch in batches until target reached (50 per batch for faster import)
    const batchSize = 50;
    const maxBatches = Math.ceil(targetProspects / batchSize);
    let prospects: any[] = [];
    let cursor: string | null = null;
    let batchCount = 0;

    console.log(`🔄 Starting automatic batch import (target: ${targetProspects}, batch size: ${batchSize})`);

    while (prospects.length < targetProspects && batchCount < maxBatches) {
      batchCount++;
      console.log(`📦 Fetching batch ${batchCount}/${maxBatches} (${prospects.length}/${targetProspects} collected)`);

      const params = new URLSearchParams({
        account_id: linkedInAccount.unipile_account_id,
        limit: batchSize.toString()
      });

      // Add cursor for pagination if we have one
      if (cursor) {
        params.append('cursor', cursor);
      }

      const searchPayload = {
        url: saved_search_url
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 seconds for better reliability

      try {
        const searchResponse = await fetch(`${searchUrl}?${params}`, {
          method: 'POST',
          headers: {
            'X-API-KEY': UNIPILE_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(searchPayload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          console.error(`❌ Batch ${batchCount} failed:`, errorText);

          // If we have some prospects already, return partial success
          if (prospects.length > 0) {
            console.log(`⚠️ Partial import: ${prospects.length} prospects collected before error`);
            break;
          }

          return NextResponse.json({
            success: false,
            error: `Unipile API error: ${searchResponse.status} ${searchResponse.statusText}. ${errorText.substring(0, 200)}`
          }, { status: 500 });
        }

        const searchData = await searchResponse.json();
        const batchProspects = searchData.items || [];

        prospects.push(...batchProspects);
        cursor = searchData.cursor || null;

        console.log(`✅ Batch ${batchCount}: +${batchProspects.length} prospects (total: ${prospects.length})`);

        // Stop if no more results
        if (!cursor || batchProspects.length === 0) {
          console.log(`🏁 No more results available (reached end of search)`);
          break;
        }

        // Small delay between batches to avoid rate limits
        if (prospects.length < targetProspects && cursor) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          console.error(`❌ Batch ${batchCount} timed out after 45 seconds`);

          // If we have some prospects, return partial success
          if (prospects.length > 0) {
            console.log(`⚠️ Partial import: ${prospects.length} prospects collected before timeout`);
            break;
          }

          return NextResponse.json({
            success: false,
            error: 'LinkedIn search timed out. Try narrowing your search criteria.'
          }, { status: 504 });
        }

        console.error(`❌ Batch ${batchCount} error:`, error);

        // If we have some prospects, continue with what we have
        if (prospects.length > 0) {
          console.log(`⚠️ Partial import: ${prospects.length} prospects collected before error`);
          break;
        }

        return NextResponse.json({
          success: false,
          error: `Failed to fetch LinkedIn search: ${error.message}`
        }, { status: 500 });
      }
    }

    console.log(`✅ Import complete: ${prospects.length} prospects (${batchCount} batches)`);

    // Extract savedSearchId from URL early for use in messages
    const searchIdMatch = saved_search_url.match(/savedSearchId=(\d+)/);
    const savedSearchId = searchIdMatch ? searchIdMatch[1] : Date.now().toString().slice(-6);

    if (prospects.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        campaign_name: campaign_name || `Saved Search ${savedSearchId}`,
        message: 'No prospects found in this saved search'
      });
    }

    // Create prospect approval session
    const sessionId = uuidv4();
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');

    // Get workspace for company code
    const workspaceResult = await pool.query(
      'SELECT name FROM workspaces WHERE id = $1',
      [workspaceId]
    );
    const workspace = workspaceResult.rows[0];

    const companyCode = workspace?.name?.substring(0, 3).toUpperCase() || 'IAI';

    const finalCampaignName = campaign_name || `${today}-${companyCode}-SavedSearch-${savedSearchId}`;

    // Get next batch number
    const sessionsResult = await pool.query(
      'SELECT batch_number FROM prospect_approval_sessions WHERE user_id = $1 AND workspace_id = $2 ORDER BY batch_number DESC LIMIT 1',
      [user.id, workspaceId]
    );
    const nextBatchNumber = (sessionsResult.rows[0]?.batch_number || 0) + 1;

    // Create session
    await pool.query(
      `INSERT INTO prospect_approval_sessions 
       (id, batch_number, user_id, workspace_id, campaign_name, campaign_tag, 
        total_prospects, approved_count, rejected_count, pending_count, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        sessionId,
        nextBatchNumber,
        user.id,
        workspaceId,
        finalCampaignName,
        `saved_search_${savedSearchId}`,
        prospects.length,
        0,
        0,
        prospects.length,
        'active',
        new Date().toISOString()
      ]
    );

    // Insert prospects into prospect_approval_data
    const approvalProspects = prospects.map((item: any) => {
      const linkedinUrl = item.profile_url || item.public_profile_url || '';
      const prospectId = linkedinUrl.split('/').filter(Boolean).pop() || uuidv4();

      return {
        id: uuidv4(),
        session_id: sessionId,
        prospect_id: prospectId,
        name: item.name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Unknown',
        title: item.headline || item.current_positions?.[0]?.role || 'Unknown',
        location: item.location || item.geo_region,
        profile_image: item.profile_picture_url,
        recent_activity: item.summary || null,
        company: {
          name: item.current_positions?.[0]?.company || 'Unknown',
          industry: null,
          size: null
        },
        contact: {
          linkedin_url: linkedinUrl,
          email: item.email || null,
          phone: item.phone || null
        },
        connection_degree: item.connection_degree || 0,
        enrichment_score: 0,
        source: 'unipile_linkedin_search',
        created_at: new Date().toISOString()
      };
    });

    // Bulk insert approval prospects
    if (approvalProspects.length > 0) {
      const pKeys = Object.keys(approvalProspects[0]);
      const pColumns = pKeys.join(', ');
      const pValues: any[] = [];
      const pPlaceholders: string[] = [];

      approvalProspects.forEach((item: any) => {
        const rowP: string[] = [];
        pKeys.forEach((key) => {
          if (key === 'company' || key === 'contact') {
            pValues.push(JSON.stringify(item[key]));
          } else {
            pValues.push(item[key]);
          }
          rowP.push(`$${pValues.length}`);
        });
        pPlaceholders.push(`(${rowP.join(', ')})`);
      });

      const pQuery = `INSERT INTO prospect_approval_data (${pColumns}) VALUES ${pPlaceholders.join(', ')}`;
      await pool.query(pQuery, pValues);
    }

    console.log(`✅ Imported ${prospects.length} prospects successfully`);

    // Determine if we hit the target or ran out of results
    const hitTarget = prospects.length >= targetProspects;
    const hasMore = cursor !== null;

    let message: string;
    if (prospects.length < targetProspects && !hasMore) {
      message = `Imported ${prospects.length} prospects (all available results from this search).`;
    } else if (hitTarget && hasMore) {
      message = `Imported ${prospects.length} prospects (target reached in ${batchCount} batches). More results available - increase target_count to import more.`;
    } else if (hitTarget && !hasMore) {
      message = `Imported ${prospects.length} prospects (target reached, no more results available).`;
    } else {
      message = `Imported ${prospects.length} prospects across ${batchCount} batches.`;
    }

    return NextResponse.json({
      success: true,
      count: prospects.length,
      campaign_name: finalCampaignName,
      session_id: sessionId,
      batches: batchCount,
      has_more: hasMore,
      message
    });

  } catch (error) {
    console.error('❌ Import saved search error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
