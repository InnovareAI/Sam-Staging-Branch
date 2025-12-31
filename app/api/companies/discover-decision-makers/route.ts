import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { unipileRequest } from '@/lib/unipile';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// POST - Discover decision makers at selected companies
export async function POST(request: NextRequest) {
    try {
        const { workspaceId } = await verifyAuth(request);

        const body = await request.json();
        const {
            company_ids,
            workspace_id,
            persona_filters = {},
            prospects_per_company = 5,
            campaign_name = 'Decision Maker Discovery'
        } = body;

        const targetWorkspaceId = workspace_id || workspaceId;

        if (!company_ids || !Array.isArray(company_ids) || company_ids.length === 0) {
            return NextResponse.json({ error: 'company_ids array is required' }, { status: 400 });
        }

        // Get LinkedIn account
        const { rows: accounts } = await pool.query(`
            SELECT unipile_account_id FROM workspace_accounts
            WHERE workspace_id = $1
            AND account_type = 'linkedin'
            AND connection_status = ANY($2)
            LIMIT 1
        `, [targetWorkspaceId, VALID_CONNECTION_STATUSES]);

        if (!accounts || accounts.length === 0) {
            return NextResponse.json({ error: 'No active LinkedIn account found' }, { status: 400 });
        }

        const linkedinAccountId = accounts[0].unipile_account_id;

        // Get the selected companies
        const placeholders = company_ids.map((_, i) => `$${i + 1}`).join(', ');
        const { rows: companies } = await pool.query(
            `SELECT * FROM workspace_companies WHERE id IN (${placeholders})`,
            company_ids
        );

        if (!companies || companies.length === 0) {
            return NextResponse.json({ error: 'No valid companies found' }, { status: 400 });
        }

        console.log(`🎯 Starting decision-maker discovery for ${companies.length} companies...`);

        // Update companies to processing status
        await pool.query(
            `UPDATE workspace_companies SET status = 'processing' WHERE id IN (${placeholders})`,
            company_ids
        );

        const allProspects: any[] = [];
        const companyResults: { company_id: string; name: string; prospects_found: number }[] = [];

        // Search for prospects at each company
        for (const company of companies) {
            try {
                console.log(`🔍 Searching for decision-makers at ${company.name}...`);

                const searchBody = {
                    api: 'sales_navigator',
                    category: 'people',
                    current_company: company.linkedin_id ? [company.linkedin_id] : undefined,
                    company_name: !company.linkedin_id ? company.name : undefined,
                    ...persona_filters,
                    limit: prospects_per_company
                };

                const searchResults = await unipileRequest(
                    `/api/v1/linkedin/search?account_id=${linkedinAccountId}`,
                    {
                        method: 'POST',
                        body: JSON.stringify(searchBody)
                    }
                );

                const prospects = searchResults.items || [];
                console.log(`  ✅ Found ${prospects.length} prospects at ${company.name}`);

                // Transform prospects
                const transformedProspects = prospects.map((p: any) => ({
                    name: p.name || `${p.first_name} ${p.last_name}`,
                    first_name: p.first_name,
                    last_name: p.last_name,
                    title: p.title || p.headline,
                    company: company.name,
                    linkedin_url: p.profile_url,
                    location: p.location,
                    providerId: p.id || p.public_identifier,
                    connectionDegree: normalizeConnectionDegree(p.network_distance || p.connection_degree),
                    source: 'company-discovery',
                    source_company_id: company.id
                }));

                allProspects.push(...transformedProspects);
                companyResults.push({
                    company_id: company.id,
                    name: company.name,
                    prospects_found: prospects.length
                });

                // Update company with prospect count
                await pool.query(`
                    UPDATE workspace_companies
                    SET status = 'processed', prospects_found = $1, updated_at = NOW()
                    WHERE id = $2
                `, [prospects.length, company.id]);

                // Rate limiting delay
                await delay(1500);
            } catch (error) {
                console.error(`❌ Error searching ${company.name}:`, error);

                await pool.query(`
                    UPDATE workspace_companies SET status = 'pending' WHERE id = $1
                `, [company.id]);
            }
        }

        // Upload prospects to approval system
        if (allProspects.length > 0) {
            console.log(`📦 Uploading ${allProspects.length} prospects for approval...`);

            const uploadResponse = await fetch(
                `${process.env.NEXT_PUBLIC_SITE_URL}/api/prospect-approval/upload-prospects`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': request.headers.get('cookie') || ''
                    },
                    body: JSON.stringify({
                        campaign_name,
                        campaign_tag: 'company-discovery',
                        source: 'company-decision-makers',
                        prospects: allProspects,
                        workspace_id: targetWorkspaceId
                    })
                }
            );

            const uploadResult = await uploadResponse.json();

            return NextResponse.json({
                success: true,
                session_id: uploadResult.session_id,
                total_prospects: allProspects.length,
                companies_processed: companyResults.length,
                company_results: companyResults,
                message: `Found ${allProspects.length} decision-makers at ${companyResults.length} companies`
            });
        }

        return NextResponse.json({
            success: true,
            total_prospects: 0,
            companies_processed: companyResults.length,
            message: 'No prospects found matching the criteria'
        });
    } catch (error) {
        if ((error as AuthError).code) {
            const authError = error as AuthError;
            return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
        }
        console.error('Decision-maker discovery error:', error);
        return NextResponse.json({
            error: 'Discovery failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

function normalizeConnectionDegree(degree: any): number | null {
    if (!degree) return null;
    const d = String(degree).toLowerCase();
    if (d.includes('1') || d.includes('first')) return 1;
    if (d.includes('2') || d.includes('second')) return 2;
    if (d.includes('3') || d.includes('third')) return 3;
    return null;
}
