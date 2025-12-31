import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

interface CompanyInput {
    name: string;
    website?: string;
    linkedin_url?: string;
    industry?: string;
    location?: string;
}

/**
 * POST /api/companies/bulk
 * Bulk import companies from CSV or list
 */
export async function POST(request: NextRequest) {
    try {
        const { workspaceId } = await verifyAuth(request);

        const body = await request.json();
        const { workspace_id, companies } = body as {
            workspace_id: string;
            companies: CompanyInput[];
        };

        const targetWorkspaceId = workspace_id || workspaceId;

        if (!companies || !Array.isArray(companies) || companies.length === 0) {
            return NextResponse.json({ error: 'companies array is required' }, { status: 400 });
        }

        // Prepare companies for insert
        const companiesToInsert = companies.map((company) => ({
            workspace_id: targetWorkspaceId,
            name: company.name.trim(),
            website: company.website?.trim() || null,
            linkedin_url: company.linkedin_url?.trim() || null,
            industry: company.industry?.trim() || null,
            location: company.location?.trim() || null,
            status: 'pending',
            source: 'csv_import',
            prospects_found: 0,
        }));

        // Check for duplicates by name within the workspace
        const companyNames = companiesToInsert.map(c => c.name.toLowerCase());
        const namePlaceholders = companyNames.map((_, i) => `$${i + 2}`).join(', ');

        const { rows: existingCompanies } = await pool.query(
            `SELECT name FROM workspace_companies WHERE workspace_id = $1 AND LOWER(name) IN (${namePlaceholders})`,
            [targetWorkspaceId, ...companyNames]
        );

        const existingNames = new Set((existingCompanies || []).map(c => c.name.toLowerCase()));
        const newCompanies = companiesToInsert.filter(c => !existingNames.has(c.name.toLowerCase()));
        const duplicateCount = companiesToInsert.length - newCompanies.length;

        if (newCompanies.length === 0) {
            return NextResponse.json({
                success: true,
                imported: 0,
                duplicates: duplicateCount,
                message: 'All companies already exist in the workspace'
            });
        }

        // Insert new companies
        const insertQuery = `
            INSERT INTO workspace_companies (
                workspace_id, name, website, linkedin_url, industry, location, status, source, prospects_found
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;

        const insertedCompanies = [];
        for (const company of newCompanies) {
            const { rows } = await pool.query(insertQuery, [
                company.workspace_id,
                company.name,
                company.website,
                company.linkedin_url,
                company.industry,
                company.location,
                company.status,
                company.source,
                company.prospects_found
            ]);
            if (rows[0]) insertedCompanies.push(rows[0]);
        }

        return NextResponse.json({
            success: true,
            imported: insertedCompanies.length,
            duplicates: duplicateCount,
            companies: insertedCompanies,
        });
    } catch (error) {
        if ((error as AuthError).code) {
            const authError = error as AuthError;
            return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
        }
        console.error('Error in bulk company import:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
