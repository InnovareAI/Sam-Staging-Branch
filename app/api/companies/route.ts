import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { unipileRequest } from '@/lib/unipile';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

// GET - List companies for workspace
export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const workspaceId = searchParams.get('workspace_id');
        const status = searchParams.get('status') || 'all';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        if (!workspaceId) {
            return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
        }

        let query = supabase
            .from('workspace_companies')
            .select('*', { count: 'exact' })
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: false });

        if (status !== 'all') {
            query = query.eq('status', status);
        }

        const offset = (page - 1) * limit;
        query = query.range(offset, offset + limit - 1);

        const { data: companies, count, error } = await query;

        if (error) {
            console.error('Error fetching companies:', error);
            return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            companies: companies || [],
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit),
                hasNext: offset + limit < (count || 0),
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Companies GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Import companies from Sales Nav URL or manual entry
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const body = await request.json();
        const { workspace_id, linkedin_url, companies: manualCompanies } = body;

        if (!workspace_id) {
            return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
        }

        // If manual companies array provided, insert directly
        if (manualCompanies && Array.isArray(manualCompanies)) {
            const companiesToInsert = manualCompanies.map((c: any) => ({
                workspace_id,
                name: c.name,
                linkedin_url: c.linkedin_url,
                linkedin_id: c.linkedin_id,
                industry: c.industry,
                employee_count: c.employee_count,
                location: c.location,
                description: c.description,
                logo_url: c.logo_url,
                website: c.website,
                source: 'manual'
            }));

            const { data, error } = await supabase
                .from('workspace_companies')
                .insert(companiesToInsert)
                .select();

            if (error) {
                console.error('Error inserting companies:', error);
                return NextResponse.json({ error: 'Failed to insert companies' }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                count: data?.length || 0,
                companies: data
            });
        }

        // If LinkedIn URL provided, fetch from Sales Navigator
        if (linkedin_url) {
            // Get LinkedIn account
            const { data: accounts } = await supabase
                .from('workspace_accounts')
                .select('unipile_account_id')
                .eq('workspace_id', workspace_id)
                .eq('account_type', 'linkedin')
                .in('connection_status', VALID_CONNECTION_STATUSES)
                .limit(1);

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
            const companiesToInsert = companies.map((c: any) => ({
                workspace_id,
                name: c.name || c.company_name,
                linkedin_url: c.profile_url || c.linkedin_url,
                linkedin_id: c.entity_urn || c.id || c.public_identifier,
                industry: c.industry,
                employee_count: c.employee_count || c.headcount,
                location: c.location || c.headquarters,
                description: c.description,
                logo_url: c.logo_url,
                website: c.website,
                source: 'sales_navigator'
            }));

            const { data, error } = await supabase
                .from('workspace_companies')
                .insert(companiesToInsert)
                .select();

            if (error) {
                console.error('Error inserting companies:', error);
                return NextResponse.json({ error: 'Failed to save companies' }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                count: data?.length || 0,
                companies: data
            });
        }

        return NextResponse.json({ error: 'Either linkedin_url or companies array is required' }, { status: 400 });
    } catch (error) {
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
        const cookieStore = await cookies();
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const companyIds = searchParams.get('ids')?.split(',') || [];

        if (companyIds.length === 0) {
            return NextResponse.json({ error: 'No company IDs provided' }, { status: 400 });
        }

        const { error } = await supabase
            .from('workspace_companies')
            .delete()
            .in('id', companyIds);

        if (error) {
            console.error('Error deleting companies:', error);
            return NextResponse.json({ error: 'Failed to delete companies' }, { status: 500 });
        }

        return NextResponse.json({ success: true, deleted: companyIds.length });
    } catch (error) {
        console.error('Companies DELETE error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
