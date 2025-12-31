import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';
import { unipileRequest } from '@/lib/unipile';
import { logger } from '@/lib/logging';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Company Employees Search API
 * 
 * Takes a Sales Navigator company search URL and returns all employees
 * from those companies as prospects.
 * 
 * Flow:
 * 1. Parse company search URL to extract filters
 * 2. Search for companies matching the criteria
 * 3. For each company, discover decision-makers/employees
 * 4. Return consolidated list of prospects for approval
 */
export async function POST(request: NextRequest) {
    try {
        // Authenticate
        const { userId, workspaceId: authWorkspaceId, userEmail } = await verifyAuth(request);

        const body = await request.json();
        const {
            company_url,           // Sales Navigator company search URL
            job_titles,            // Optional: filter by job titles (comma-separated)
            max_companies = 50,    // Max companies to process
            prospects_per_company = 10, // Max prospects per company
            campaign_name = 'Company Search Discovery',
            workspace_id
        } = body;

        if (!company_url) {
            return NextResponse.json({
                error: 'Company search URL is required'
            }, { status: 400 });
        }

        const activeWorkspaceId = workspace_id || authWorkspaceId;
        if (!activeWorkspaceId) {
            return NextResponse.json({ error: 'No workspace found' }, { status: 400 });
        }

        logger.info(`[Company-Employees] Starting discovery for workspace ${activeWorkspaceId}`);
        logger.info(`[Company-Employees] URL: ${company_url}`);

        // Get LinkedIn Account
        const statusList = VALID_CONNECTION_STATUSES.map((_, i) => `$${i + 2}`).join(', ');
        const { rows: accounts } = await pool.query(
            `SELECT unipile_account_id, account_name FROM workspace_accounts
       WHERE workspace_id = $1
       AND account_type = 'linkedin'
       AND connection_status IN (${statusList})
       LIMIT 1`,
            [activeWorkspaceId, ...VALID_CONNECTION_STATUSES]
        );

        if (!accounts || accounts.length === 0) {
            return NextResponse.json({
                error: 'No active LinkedIn account. Please connect your LinkedIn in Settings.'
            }, { status: 400 });
        }

        const linkedinAccountId = accounts[0].unipile_account_id;
        logger.info(`[Company-Employees] Using LinkedIn account: ${accounts[0].account_name}`);

        // --- PHASE 1: COMPANY SEARCH ---
        // Parse the company search URL to extract any existing filters
        let companyFilters: any = {};

        try {
            const urlObj = new URL(company_url);
            const savedSearchId = urlObj.searchParams.get('savedSearchId');
            const keywords = urlObj.searchParams.get('keywords');

            if (savedSearchId) {
                companyFilters.saved_search_id = savedSearchId;
            }
            if (keywords) {
                companyFilters.keywords = keywords;
            }
        } catch (e) {
            // Not a valid URL, use as keywords
            companyFilters.keywords = company_url;
        }

        logger.info(`[Company-Employees] Searching for companies with filters:`, companyFilters);

        // Search for companies
        const companySearchBody = {
            api: 'sales_navigator',
            category: 'company',
            url: company_url, // Pass full URL for Unipile to process
            ...companyFilters
        };

        const searchParams = new URLSearchParams({
            account_id: linkedinAccountId,
            limit: Math.min(max_companies, 100).toString()
        });

        let companies: any[] = [];
        try {
            const companyResults = await unipileRequest(`/api/v1/linkedin/search?${searchParams}`, {
                method: 'POST',
                body: JSON.stringify(companySearchBody)
            });

            companies = companyResults.items || [];
            logger.info(`[Company-Employees] Found ${companies.length} companies`);
        } catch (searchError: any) {
            logger.error('[Company-Employees] Company search failed:', searchError);
            return NextResponse.json({
                success: false,
                error: 'Company search failed. Please check your URL and try again.'
            }, { status: 500 });
        }

        if (companies.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No companies found matching your search criteria',
                prospects: [],
                companies_found: 0
            });
        }

        // Extract company IDs and names
        const companyData = companies.map((c: any) => ({
            id: c.entity_urn || c.id || c.company_id,
            name: c.name || c.company_name || 'Unknown Company',
            industry: c.industry || '',
            headcount: c.headcount || c.employee_count || 0
        })).filter(c => c.id);

        logger.info(`[Company-Employees] Processing ${companyData.length} companies for employee discovery`);

        // --- PHASE 2: EMPLOYEE DISCOVERY ---
        // Parse job title filters if provided
        const jobTitleFilters = job_titles
            ? job_titles.split(',').map((t: string) => t.trim()).filter(Boolean)
            : [];

        const allProspects: any[] = [];
        const BATCH_SIZE = 5; // Process 5 companies at a time

        for (let i = 0; i < companyData.length; i += BATCH_SIZE) {
            const batch = companyData.slice(i, i + BATCH_SIZE);

            logger.info(`[Company-Employees] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(companyData.length / BATCH_SIZE)}`);

            // Build employee search for this batch
            const employeeSearchBody: any = {
                api: 'sales_navigator',
                category: 'people',
                current_company: batch.map(c => c.id),
                limit: Math.min(batch.length * prospects_per_company, 100)
            };

            // Add job title filter if provided
            if (jobTitleFilters.length > 0) {
                employeeSearchBody.title = jobTitleFilters.join(' OR ');
            }

            try {
                const employeeResults = await unipileRequest(`/api/v1/linkedin/search?account_id=${linkedinAccountId}`, {
                    method: 'POST',
                    body: JSON.stringify(employeeSearchBody)
                });

                if (employeeResults.items) {
                    // Map to prospect format with company context
                    const batchProspects = employeeResults.items.map((p: any) => {
                        // Find which company this person belongs to
                        const matchingCompany = batch.find(c =>
                            p.current_company === c.id ||
                            p.company_name?.toLowerCase() === c.name?.toLowerCase()
                        ) || batch[0];

                        return {
                            name: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
                            first_name: p.first_name || p.name?.split(' ')[0] || '',
                            last_name: p.last_name || p.name?.split(' ').slice(1).join(' ') || '',
                            title: p.title || p.headline || '',
                            company: p.company_name || matchingCompany?.name || '',
                            companyId: p.current_company || matchingCompany?.id,
                            linkedin_url: p.profile_url || p.public_profile_url || '',
                            location: p.location || p.geo_region || '',
                            industry: p.industry || matchingCompany?.industry || '',
                            providerId: p.id || p.public_identifier,
                            connectionDegree: normalizeConnectionDegree(p.network_distance || p.network),
                            source: 'company-url-search',
                            sourceCompanyUrl: company_url
                        };
                    });

                    allProspects.push(...batchProspects);
                    logger.info(`[Company-Employees] Batch found ${batchProspects.length} employees`);
                }

                // Rate limiting delay
                await delay(1000);
            } catch (err: any) {
                logger.error(`[Company-Employees] Batch employee search failed:`, err);
                // Continue with other batches
            }
        }

        logger.info(`[Company-Employees] Total prospects discovered: ${allProspects.length}`);

        // --- PHASE 3: SAVE FOR APPROVAL ---
        if (allProspects.length > 0) {
            // Call the existing upload-prospects endpoint to save for approval
            const uploadUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/prospect-approval/upload-prospects`;

            try {
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': request.headers.get('cookie') || ''
                    },
                    body: JSON.stringify({
                        campaign_name,
                        campaign_tag: 'company-search',
                        source: 'linkedin-company-employees',
                        prospects: allProspects,
                        workspace_id: activeWorkspaceId
                    })
                });

                const uploadResult = await uploadResponse.json();

                return NextResponse.json({
                    success: true,
                    session_id: uploadResult.session_id,
                    prospects_count: allProspects.length,
                    companies_searched: companyData.length,
                    companies: companyData.slice(0, 10).map(c => c.name), // Return sample company names
                    message: `Found ${allProspects.length} prospects across ${companyData.length} companies`
                });
            } catch (uploadError: any) {
                logger.error('[Company-Employees] Failed to save prospects for approval:', uploadError);
                // Still return the prospects even if save failed
                return NextResponse.json({
                    success: true,
                    warning: 'Prospects found but could not be saved for approval',
                    prospects: allProspects,
                    prospects_count: allProspects.length,
                    companies_searched: companyData.length
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: 'No employees found matching your criteria in these companies',
            prospects: [],
            companies_searched: companyData.length
        });

    } catch (error: any) {
        logger.error('[Company-Employees] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Company employee search failed'
        }, { status: 500 });
    }
}

/**
 * Normalize connection degree from various formats
 */
function normalizeConnectionDegree(degree: any): number | null {
    if (!degree) return null;

    // Already a number
    if (typeof degree === 'number') {
        return degree >= 1 && degree <= 3 ? degree : null;
    }

    // String format
    const d = String(degree).toLowerCase();

    // "DISTANCE_1", "DISTANCE_2", etc.
    const match = d.match(/distance[_\s-]?(\d+)/i);
    if (match) return parseInt(match[1]);

    // "F", "S", "O" format
    if (d === 'f' || d.includes('first') || d.includes('1st')) return 1;
    if (d === 's' || d.includes('second') || d.includes('2nd')) return 2;
    if (d === 'o' || d.includes('third') || d.includes('3rd')) return 3;

    return null;
}
