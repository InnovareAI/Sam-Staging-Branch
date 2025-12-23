import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/app/lib/supabase';

/**
 * GET /api/prospect-approval/workspace-prospects
 * Returns paginated prospects across ALL sessions for the authenticated user's workspace.
 * This is the unified endpoint for the ProspectHub table.
 * 
 * Query params:
 * - page: number (default 1)
 * - limit: number (default 50, max 100)
 * - status: 'all' | 'pending' | 'approved' | 'rejected' (default 'all')
 * - session_id: optional filter by specific session
 * - search: optional text search across name, company, title
 * - sort_by: 'created_at' | 'name' | 'company' | 'quality_score' (default 'created_at')
 * - sort_order: 'asc' | 'desc' (default 'desc')
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Pagination & filtering params
        const page = Math.max(1, Number(searchParams.get('page')) || 1);
        const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50));
        const status = searchParams.get('status') || 'all';
        const sessionId = searchParams.get('session_id');
        const search = searchParams.get('search')?.toLowerCase();
        const sortBy = searchParams.get('sort_by') || 'created_at';
        const sortOrder = searchParams.get('sort_order') || 'desc';

        // Auth
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll(); },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options);
                        });
                    }
                }
            }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
        }

        const adminClient = supabaseAdmin();

        // Get user's workspace
        const { data: userProfile } = await adminClient
            .from('users')
            .select('current_workspace_id')
            .eq('id', user.id)
            .single();

        let workspaceId = userProfile?.current_workspace_id;

        if (!workspaceId) {
            const { data: membership } = await adminClient
                .from('workspace_members')
                .select('workspace_id')
                .eq('user_id', user.id)
                .limit(1)
                .maybeSingle();
            workspaceId = membership?.workspace_id;
        }

        if (!workspaceId) {
            return NextResponse.json({ success: false, error: 'No workspace found' }, { status: 404 });
        }

        // Get all session IDs for this workspace
        const { data: sessions } = await adminClient
            .from('prospect_approval_sessions')
            .select('id, campaign_name, campaign_tag, prospect_source, metadata, created_at')
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: false });

        if (!sessions || sessions.length === 0) {
            return NextResponse.json({
                success: true,
                prospects: [],
                sessions: [],
                pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
            });
        }

        // Filter by specific session if provided
        const targetSessions = sessionId
            ? sessions.filter(s => s.id === sessionId)
            : sessions;

        const sessionIds = targetSessions.map(s => s.id);

        // Create session lookup map
        const sessionMap = new Map(targetSessions.map(s => [s.id, {
            campaignName: s.campaign_name || `Session-${s.id.slice(0, 8)}`,
            campaignTag: s.campaign_tag || s.campaign_name || s.prospect_source || 'linkedin',
            isNewArchitecture: (s.metadata as any)?.new_architecture === true,
            batchId: (s.metadata as any)?.batch_id
        }]));

        // Determine which architecture each session uses and build combined results
        let allProspects: any[] = [];

        // Check for new architecture sessions (workspace_prospects table)
        const newArchSessions = targetSessions.filter(s => (s.metadata as any)?.new_architecture && (s.metadata as any)?.batch_id);
        const legacySessions = targetSessions.filter(s => !(s.metadata as any)?.new_architecture);

        // Query new architecture prospects
        if (newArchSessions.length > 0) {
            const batchIds = newArchSessions.map(s => (s.metadata as any).batch_id).filter(Boolean);

            let query = adminClient
                .from('workspace_prospects')
                .select('*')
                .eq('workspace_id', workspaceId)
                .in('batch_id', batchIds);

            if (status !== 'all') {
                query = query.eq('approval_status', status);
            }

            const { data: newProspects } = await query;

            if (newProspects) {
                allProspects.push(...newProspects.map((p: any) => {
                    const session = newArchSessions.find(s => (s.metadata as any)?.batch_id === p.batch_id);
                    const sessionInfo = session ? sessionMap.get(session.id) : null;
                    return {
                        id: p.id,
                        name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown',
                        title: p.title || '',
                        company: p.company || '',
                        email: p.email || '',
                        linkedinUrl: p.linkedin_url || '',
                        phone: p.phone || '',
                        location: p.location || '',
                        connectionDegree: p.connection_degree ? `${p.connection_degree}${p.connection_degree === 1 ? 'st' : p.connection_degree === 2 ? 'nd' : 'rd'}` : null,
                        approvalStatus: p.approval_status || 'pending',
                        qualityScore: p.enrichment_data?.enrichment_score || 70,
                        source: p.source || 'csv_upload',
                        sessionId: session?.id,
                        campaignTag: sessionInfo?.campaignTag || 'Unknown',
                        campaignName: sessionInfo?.campaignName || 'Unknown',
                        createdAt: p.created_at,
                        linkedinUserId: p.linkedin_user_id
                    };
                }));
            }
        }

        // Query legacy prospects
        if (legacySessions.length > 0) {
            const legacySessionIds = legacySessions.map(s => s.id);

            // Get decisions for all legacy sessions
            const { data: decisions } = await adminClient
                .from('prospect_approval_decisions')
                .select('prospect_id, decision, session_id')
                .in('session_id', legacySessionIds);

            const decisionMap = new Map((decisions || []).map(d => [`${d.session_id}_${d.prospect_id}`, d.decision]));

            // Get prospects from legacy table
            let query = adminClient
                .from('prospect_approval_data')
                .select('*')
                .in('session_id', legacySessionIds);

            const { data: legacyProspects } = await query;

            if (legacyProspects) {
                const mappedLegacy = legacyProspects.map((p: any) => {
                    const sessionInfo = sessionMap.get(p.session_id);
                    const approvalStatus = decisionMap.get(`${p.session_id}_${p.prospect_id}`) || 'pending';
                    return {
                        id: p.prospect_id,
                        name: p.name || 'Unknown',
                        title: p.title || '',
                        company: p.company?.name || '',
                        email: p.contact?.email || '',
                        linkedinUrl: p.contact?.linkedin_url || '',
                        phone: p.contact?.phone || '',
                        location: p.location || '',
                        connectionDegree: p.connection_degree ? `${p.connection_degree}${p.connection_degree === 1 ? 'st' : p.connection_degree === 2 ? 'nd' : 'rd'}` : null,
                        approvalStatus,
                        qualityScore: p.enrichment_score || 70,
                        source: p.source || 'linkedin',
                        sessionId: p.session_id,
                        campaignTag: sessionInfo?.campaignTag || 'Unknown',
                        campaignName: sessionInfo?.campaignName || 'Unknown',
                        createdAt: p.created_at,
                        linkedinUserId: p.contact?.linkedin_user_id || p.linkedin_user_id
                    };
                });

                // Filter by status for legacy
                if (status !== 'all') {
                    allProspects.push(...mappedLegacy.filter(p => p.approvalStatus === status));
                } else {
                    allProspects.push(...mappedLegacy);
                }
            }
        }

        // Filter out transferred prospects
        allProspects = allProspects.filter(p => p.approvalStatus !== 'transferred_to_campaign');

        // Apply text search
        if (search) {
            allProspects = allProspects.filter(p =>
                p.name?.toLowerCase().includes(search) ||
                p.company?.toLowerCase().includes(search) ||
                p.title?.toLowerCase().includes(search) ||
                p.email?.toLowerCase().includes(search)
            );
        }

        // Sort
        allProspects.sort((a, b) => {
            let aVal: any, bVal: any;
            switch (sortBy) {
                case 'name': aVal = a.name; bVal = b.name; break;
                case 'company': aVal = a.company; bVal = b.company; break;
                case 'quality_score': aVal = a.qualityScore; bVal = b.qualityScore; break;
                default: aVal = new Date(a.createdAt).getTime(); bVal = new Date(b.createdAt).getTime();
            }
            if (typeof aVal === 'string') {
                return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });

        // Paginate
        const total = allProspects.length;
        const totalPages = Math.ceil(total / limit);
        const offset = (page - 1) * limit;
        const paginatedProspects = allProspects.slice(offset, offset + limit);

        // Summary for sessions dropdown
        const sessionSummary = targetSessions.map(s => ({
            id: s.id,
            name: s.campaign_name || s.campaign_tag || `Session-${s.id.slice(0, 8)}`,
            count: allProspects.filter(p => p.sessionId === s.id).length
        })).filter(s => s.count > 0);

        return NextResponse.json({
            success: true,
            prospects: paginatedProspects,
            sessions: sessionSummary,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Workspace prospects error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
