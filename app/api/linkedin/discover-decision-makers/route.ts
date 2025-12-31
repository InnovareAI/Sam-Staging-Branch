import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';
import { unipileRequest } from '@/lib/unipile';
import { logger } from '@/lib/logging';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  try {
    // Authenticate with Firebase auth
    const { userId, workspaceId: authWorkspaceId, userEmail } = await verifyAuth(request);

    const body = await request.json();
    const {
      company_filters = {}, // Keywords, Industry, Headcount, etc.
      persona_filters = {}, // Job titles, Seniority, etc.
      workspace_id,
      campaign_name = 'Nested Prospecting Discovery',
      max_companies = 50,
      prospects_per_company = 3,
      accountId
    } = body;

    // Resolve workspace - prefer provided, fall back to auth context
    let activeWorkspaceId = workspace_id || authWorkspaceId;
    if (!activeWorkspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 });
    }

    // Get LinkedIn Account
    let linkedinAccountId = accountId;
    if (!linkedinAccountId) {
      const statusList = VALID_CONNECTION_STATUSES.map((_, i) => `$${i + 2}`).join(', ');
      const { rows: accounts } = await pool.query(
        `SELECT unipile_account_id FROM workspace_accounts
         WHERE workspace_id = $1
         AND account_type = 'linkedin'
         AND connection_status IN (${statusList})
         LIMIT 1`,
        [activeWorkspaceId, ...VALID_CONNECTION_STATUSES]
      );

      if (!accounts || accounts.length === 0) {
        return NextResponse.json({ error: 'No active LinkedIn account' }, { status: 400 });
      }
      linkedinAccountId = accounts[0].unipile_account_id;
    }

    // --- PHASE 1: COMPANY DISCOVERY ---
    logger.info(`[Discovery] Starting Company Search for ${activeWorkspaceId}`);

    // We default to sales_navigator for "complete" searches if available
    const searchParams = new URLSearchParams({
      account_id: linkedinAccountId,
      limit: Math.min(max_companies, 100).toString()
    });

    const companySearchBody = {
      api: 'sales_navigator',
      category: 'companies',
      ...company_filters
    };

    const companyResults = await unipileRequest(`/api/v1/linkedin/search?${searchParams}`, {
      method: 'POST',
      body: JSON.stringify(companySearchBody)
    });

    const companies = companyResults.items || [];
    if (companies.length === 0) {
      return NextResponse.json({ success: true, message: 'No companies found with those filters', prospects: [] });
    }

    const companyIds = companies.map((c: any) => c.entity_urn || c.id).filter(Boolean);
    logger.info(`[Discovery] Found ${companyIds.length} companies. Proceeding to Persona Discovery.`);

    // --- PHASE 2: PERSONA DISCOVERY (Decision-Makers) ---
    // Batch companies to minimize API calls (Sales Nav allows multiple company IDs)
    const BATCH_SIZE = 10;
    const allFoundProspects: any[] = [];

    for (let i = 0; i < companyIds.length; i += BATCH_SIZE) {
      const batch = companyIds.slice(i, i + BATCH_SIZE);

      const personSearchBody = {
        api: 'sales_navigator',
        category: 'people',
        current_company: batch,
        ...persona_filters,
        limit: Math.min(batch.length * prospects_per_company, 100)
      };

      try {
        logger.info(`[Discovery] Searching batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} companies)`);
        const personResults = await unipileRequest(`/api/v1/linkedin/search?account_id=${linkedinAccountId}`, {
          method: 'POST',
          body: JSON.stringify(personSearchBody)
        });

        if (personResults.items) {
          allFoundProspects.push(...personResults.items);
        }

        // Safety delay to stay under rate limits
        await delay(1500);
      } catch (err: any) {
        logger.error(`[Discovery] Batch search failed`, err);
        // Continue with other batches
      }
    }

    // --- PHASE 3: STORE FOR APPROVAL ---
    if (allFoundProspects.length > 0) {
      logger.info(`[Discovery] Total prospects found: ${allFoundProspects.length}. Initializing approval session.`);

      // Helper to normalize connection degree
      const normalizeDegree = (degree: any): number | null => {
        if (!degree) return null;
        const d = String(degree).toLowerCase();
        if (d.includes('1') || d.includes('first')) return 1;
        if (d.includes('2') || d.includes('second')) return 2;
        if (d.includes('3') || d.includes('third')) return 3;
        return null;
      };

      // Transform to match approval format
      const prospectsForApproval = allFoundProspects.map(p => ({
        name: p.name || `${p.first_name} ${p.last_name}`,
        first_name: p.first_name,
        last_name: p.last_name,
        title: p.title || p.headline,
        company: p.company_name || p.current_company,
        linkedin_url: p.profile_url,
        location: p.location,
        providerId: p.id || p.public_identifier,
        connectionDegree: normalizeDegree(p.network_distance || p.connection_degree),
        source: 'company-nested-discovery'
      }));

      // Trigger the existing upload-prospects logic via internal API call or direct function
      // For simplicity and consistency, let's call the endpoint directly (Next.js internal fetch)
      const uploadUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/prospect-approval/upload-prospects`;
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('cookie') || '' // Forward auth session
        },
        body: JSON.stringify({
          campaign_name,
          campaign_tag: 'discovery',
          source: 'linkedin-nested-search',
          prospects: prospectsForApproval,
          workspace_id: activeWorkspaceId
        })
      });

      const uploadResult = await uploadResponse.json();

      return NextResponse.json({
        success: true,
        session_id: uploadResult.session_id,
        prospect_count: allFoundProspects.length,
        companies_analyzed: companyIds.length,
        message: `Discovery complete. Found ${allFoundProspects.length} prospects across ${companyIds.length} companies.`
      });
    }

    return NextResponse.json({
      success: true,
      message: 'No prospects found within these companies matching the persona filters.',
      prospects: []
    });

  } catch (error) {
    logger.error('[Discovery] Error in discover-decision-makers', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Discovery failed'
    }, { status: 500 });
  }
}
