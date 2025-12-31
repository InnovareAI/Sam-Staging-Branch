import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';

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
        const supabase = await createSupabaseRouteClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { workspace_id, companies } = body as {
            workspace_id: string;
            companies: CompanyInput[];
        };

        if (!workspace_id) {
            return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
        }

        if (!companies || !Array.isArray(companies) || companies.length === 0) {
            return NextResponse.json({ error: 'companies array is required' }, { status: 400 });
        }

        // Verify user has access to workspace
        const { data: membership } = await supabase
            .from('workspace_members')
            .select('id')
            .eq('workspace_id', workspace_id)
            .eq('user_id', user.id)
            .single();

        if (!membership) {
            return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 403 });
        }

        // Prepare companies for insert
        const companiesToInsert = companies.map((company) => ({
            workspace_id,
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
        const { data: existingCompanies } = await supabase
            .from('workspace_companies')
            .select('name')
            .eq('workspace_id', workspace_id)
            .in('name', companyNames);

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
        const { data: insertedCompanies, error } = await supabase
            .from('workspace_companies')
            .insert(newCompanies)
            .select();

        if (error) {
            console.error('Error inserting companies:', error);
            return NextResponse.json({ error: 'Failed to import companies', details: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            imported: insertedCompanies?.length || 0,
            duplicates: duplicateCount,
            companies: insertedCompanies,
        });
    } catch (error) {
        console.error('Error in bulk company import:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
