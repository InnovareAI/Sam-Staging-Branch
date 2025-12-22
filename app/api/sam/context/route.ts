import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { supabaseKnowledge } from '@/lib/supabase-knowledge';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const threadId = searchParams.get('threadId');
        const workspaceIdParam = searchParams.get('workspaceId');

        const supabase = await createSupabaseRouteClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Get Thread and Workspace - prioritize explicit workspaceId param
        let workspaceId = workspaceIdParam;
        let thread = null;

        if (threadId) {
            const { data: threadData } = await supabase
                .from('sam_conversation_threads')
                .select('*')
                .eq('id', threadId)
                .eq('user_id', user.id)
                .single();

            thread = threadData;
            if (!workspaceId) {
                workspaceId = threadData?.workspace_id;
            }
        }

        if (!workspaceId) {
            // Fallback to user's current workspace
            const { data: profile } = await supabase
                .from('users')
                .select('current_workspace_id')
                .eq('id', user.id)
                .single();
            workspaceId = profile?.current_workspace_id;
        }

        if (!workspaceId) {
            // Last fallback: get first workspace user is a member of
            const { data: membership } = await supabase
                .from('workspace_members')
                .select('workspace_id')
                .eq('user_id', user.id)
                .limit(1)
                .single();
            workspaceId = membership?.workspace_id;
        }

        if (!workspaceId) {
            return NextResponse.json({
                success: true,
                message: 'No workspace context found',
                knowledge: null,
                strategy: null,
                stats: null
            });
        }

        // 2. Fetch Knowledge Context
        const [
            kbCompleteness,
            icps,
            products,
            competitors,
            documents
        ] = await Promise.all([
            supabaseKnowledge.checkKBCompleteness(workspaceId),
            supabaseKnowledge.getICPs({ workspaceId }),
            supabaseKnowledge.getProducts({ workspaceId }),
            supabaseKnowledge.getCompetitors({ workspaceId }),
            supabaseKnowledge.getDocuments({ workspaceId, limit: 5 })
        ]);

        // 4. Fetch Real Campaign Stats
        const { data: campaigns } = await supabase
            .from('campaigns')
            .select('id, name, status')
            .eq('workspace_id', workspaceId);

        const activeCampaigns = campaigns?.filter(c => c.status === 'active' || c.status === 'running') || [];
        const campaignIds = campaigns?.map(c => c.id) || [];

        // Get prospect counts
        let totalSent = 0;
        let replied = 0;
        let meetings = 0;

        if (campaignIds.length > 0) {
            const { data: prospects } = await supabase
                .from('campaign_prospects')
                .select('status, conversation_stage')
                .in('campaign_id', campaignIds);

            if (prospects) {
                totalSent = prospects.filter(p => p.status === 'sent' || p.status === 'replied' || p.status === 'meeting_booked').length;
                replied = prospects.filter(p => p.status === 'replied' || p.conversation_stage === 'replied').length;
                meetings = prospects.filter(p => p.status === 'meeting_booked' || p.conversation_stage === 'meeting_scheduled').length;
            }
        }

        const responseRate = totalSent > 0 ? `${((replied / totalSent) * 100).toFixed(1)}%` : '0%';

        const stats = {
            messageCount: thread?.message_count || 0,
            threadType: thread?.thread_type || 'general',
            campaign: {
                active: activeCampaigns.length,
                total: campaigns?.length || 0,
                totalSent,
                replied,
                meetings,
                responseRate,
                trend: 'Real-time data'
            }
        };

        return NextResponse.json({
            success: true,
            knowledge: {
                completeness: kbCompleteness?.overallCompleteness || 0,
                sections: kbCompleteness?.sections || {},
                missingCritical: kbCompleteness?.missingCritical || [],
                // Real Data
                products: products.map(p => ({
                    id: p.id,
                    name: p.name,
                    description: p.description
                })),
                competitors: competitors.map(c => ({
                    id: c.id,
                    name: c.name,
                    strengths: c.strengths
                })),
                documents: documents.map(d => ({
                    id: d.id,
                    name: d.filename,
                    date: d.created_at
                }))
            },
            strategy: {
                activeICPs: icps.length,
                primaryICP: icps[0] || null,
                icpCount: icps.length,
                allICPs: icps.map(i => ({ id: i.id, name: i.name }))
            },
            stats
        });

    } catch (error) {
        console.error('❌ Context API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
