import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { unipileRequest } from '@/lib/unipile';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

// GET - List companies for workspace
export async function GET(request: NextRequest) {
    try {
        const { workspaceId } = await verifyAuth(request);

        const { searchParams } = new URL(request.url);
        const queryWorkspaceId = searchParams.get('workspace_id') || workspaceId;
        const status = searchParams.get('status') || 'all';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        const offset = (page - 1) * limit;

        // Build query with optional status filter
        let query = `
            SELECT *, COUNT(*) OVER() as total_count
            FROM workspace_companies
            WHERE workspace_id = $1
        `;
        const params: any[] = [queryWorkspaceId];

        if (status !== 'all') {
            query += ` AND status = $2`;
            params.push(status);
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const { rows } = await pool.query(query, params);

        const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;
        const companies = rows.map(({ total_count, ...company }) => company);

        return NextResponse.json({
            success: true,
            companies: companies || [],
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: offset + limit < total,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        if ((error as AuthError).code) {
            const authError = error as AuthError;
            return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
        }
        console.error('Companies GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Import companies from Sales Nav URL or manual entry
export async function POST(request: NextRequest) {
    try {
        const { workspaceId } = await verifyAuth(request);

        const body = await request.json();
        const { workspace_id, linkedin_url, companies: manualCompanies } = body;

        const targetWorkspaceId = workspace_id || workspaceId;

        // If manual companies array provided, insert directly
        if (manualCompanies && Array.isArray(manualCompanies)) {
            const insertQuery = `
                INSERT INTO workspace_companies (
                    workspace_id, name, linkedin_url, linkedin_id, industry,
                    employee_count, location, description, logo_url, website, source
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `;

            const insertedCompanies = [];
            for (const c of manualCompanies) {
                const { rows } = await pool.query(insertQuery, [
                    targetWorkspaceId,
                    c.name,
                    c.linkedin_url,
                    c.linkedin_id,
                    c.industry,
                    c.employee_count,
                    c.location,
                    c.description,
                    c.logo_url,
                    c.website,
                    'manual'
                ]);
                if (rows[0]) insertedCompanies.push(rows[0]);
            }

            return NextResponse.json({
                success: true,
                count: insertedCompanies.length,
                companies: insertedCompanies
            });
        }

        // If LinkedIn URL provided, fetch from Sales Navigator
        if (linkedin_url) {
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

            // Parse the Sales Nav URL
            const urlObj = new URL(linkedin_url);
            const savedSearchId = urlObj.searchParams.get('savedSearchId');

            // Search for companies via Unipile
            const searchParams = new URLSearchParams({
                account_id: linkedinAccountId,
                limit: '100'
            });

            const searchBody = {
                api: 'sales_navigator',
                category: 'companies',
                saved_search_id: savedSearchId,
                url: linkedin_url
            };

            console.log('🏢 Searching companies via Sales Navigator...');
            const searchResults = await unipileRequest(`/api/v1/linkedin/search?${searchParams}`, {
                method: 'POST',
                body: JSON.stringify(searchBody)
            });

            const companies = searchResults.items || [];
            console.log(`✅ Found ${companies.length} companies`);

            if (companies.length === 0) {
                return NextResponse.json({
                    success: true,
                    count: 0,
                    message: 'No companies found matching the search criteria'
                });
            }

            // Transform and insert companies
            const insertQuery = `
                INSERT INTO workspace_companies (
                    workspace_id, name, linkedin_url, linkedin_id, industry,
                    employee_count, location, description, logo_url, website, source
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `;

            const insertedCompanies = [];
            for (const c of companies) {
                const { rows } = await pool.query(insertQuery, [
                    targetWorkspaceId,
                    c.name || c.company_name,
                    c.profile_url || c.linkedin_url,
                    c.entity_urn || c.id || c.public_identifier,
                    c.industry,
                    c.employee_count || c.headcount,
                    c.location || c.headquarters,
                    c.description,
                    c.logo_url,
                    c.website,
                    'sales_navigator'
                ]);
                if (rows[0]) insertedCompanies.push(rows[0]);
            }

            return NextResponse.json({
                success: true,
                count: insertedCompanies.length,
                companies: insertedCompanies
            });
        }

        return NextResponse.json({ error: 'Either linkedin_url or companies array is required' }, { status: 400 });
    } catch (error) {
        if ((error as AuthError).code) {
            const authError = error as AuthError;
            return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
        }
        console.error('Companies POST error:', error);
        return NextResponse.json({
            error: 'Failed to import companies',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// DELETE - Remove companies
export async function DELETE(request: NextRequest) {
    try {
        await verifyAuth(request);

        const { searchParams } = new URL(request.url);
        const companyIds = searchParams.get('ids')?.split(',') || [];

        if (companyIds.length === 0) {
            return NextResponse.json({ error: 'No company IDs provided' }, { status: 400 });
        }

        // Build parameterized query for deletion
        const placeholders = companyIds.map((_, i) => `$${i + 1}`).join(', ');
        const { rowCount } = await pool.query(
            `DELETE FROM workspace_companies WHERE id IN (${placeholders})`,
            companyIds
        );

        return NextResponse.json({ success: true, deleted: rowCount || 0 });
    } catch (error) {
        if ((error as AuthError).code) {
            const authError = error as AuthError;
            return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
        }
        console.error('Companies DELETE error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
