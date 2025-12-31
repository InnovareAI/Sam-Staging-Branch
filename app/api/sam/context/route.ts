import { NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';
import { supabaseKnowledge } from '@/lib/supabase-knowledge';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const threadId = searchParams.get('threadId');
        const workspaceIdParam = searchParams.get('workspaceId');

        const auth = await verifyAuth(request as any);

        if (!auth.isAuthenticated || !auth.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = auth.user;

        // 1. Get Thread and Workspace - prioritize explicit workspaceId param
        let workspaceId = workspaceIdParam;
        let thread = null;

        if (threadId) {
            const threadRes = await pool.query(
                'SELECT * FROM sam_conversation_threads WHERE id = $1 AND user_id = $2',
                [threadId, user.uid]
            );

            thread = threadRes.rows[0];
            if (!workspaceId) {
                workspaceId = thread?.workspace_id;
            }
        }

        if (!workspaceId) {
            // Fallback to user's current workspace
            const userRes = await pool.query(
                'SELECT current_workspace_id FROM users WHERE id = $1',
                [user.uid]
            );
            workspaceId = userRes.rows[0]?.current_workspace_id;
        }

        if (!workspaceId) {
            // Last fallback: get first workspace user is a member of
            const membershipRes = await pool.query(
                'SELECT workspace_id FROM workspace_members WHERE user_id = $1 LIMIT 1',
                [user.uid]
            );
            workspaceId = membershipRes.rows[0]?.workspace_id;
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
            competitors
        ] = await Promise.all([
            supabaseKnowledge.checkKBCompleteness(workspaceId),
            supabaseKnowledge.getICPs({ workspaceId }),
            supabaseKnowledge.getProducts({ workspaceId }),
            supabaseKnowledge.getCompetitors({ workspaceId })
        ]);

        // Fetch documents from knowledge_base table (same source as KB page)
        const kbDocsRes = await pool.query(
            `SELECT id, category, section, title, tags, updated_at 
             FROM knowledge_base 
             WHERE workspace_id = $1 AND is_active = true 
             ORDER BY updated_at DESC`,
            [workspaceId]
        );
        const kbDocuments = kbDocsRes.rows;

        // Calculate category scores based on document counts
        const categorySections = {
            foundation: ['company', 'product', 'value_prop', 'pricing'],
            gtm: ['competitors', 'channels', 'go_to_market', 'gtm'],
            customer: ['personas', 'icp', 'pain_points', 'buyer_journey'],
            execution: ['templates', 'collateral', 'case_studies', 'brand_voice']
        };

        const getCategoryScore = (sections: string[]) => {
            const docs = kbDocuments?.filter(d =>
                sections.includes(d.section?.toLowerCase() || '') ||
                sections.includes(d.category?.toLowerCase() || '')
            ) || [];
            // Max 100%, assume 3+ docs per section = full score
            const maxDocs = sections.length * 3;
            return Math.min(100, Math.round((docs.length / maxDocs) * 100));
        };

        const categoryScores = {
            foundation: getCategoryScore(categorySections.foundation),
            gtm: getCategoryScore(categorySections.gtm),
            customer: getCategoryScore(categorySections.customer),
            execution: getCategoryScore(categorySections.execution)
        };

        const recentDocs = (kbDocuments || []).slice(0, 5);

        // 4. Fetch Real Campaign Stats
        const campaignRes = await pool.query(
            'SELECT id, name, status FROM campaigns WHERE workspace_id = $1',
            [workspaceId]
        );
        const campaigns = campaignRes.rows;

        const activeCampaigns = campaigns?.filter(c => c.status === 'active' || c.status === 'running') || [];
        const campaignIds = campaigns?.map(c => c.id) || [];

        // Get prospect counts
        let totalSent = 0;
        let replied = 0;
        let meetings = 0;

        if (campaignIds.length > 0) {
            const prospectsRes = await pool.query(
                `SELECT status, conversation_stage 
                 FROM campaign_prospects 
                 WHERE campaign_id = ANY($1)`,
                [campaignIds]
            );
            const prospects = prospectsRes.rows;

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
                categoryScores,
                // Real Data
                products: products.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    description: p.description
                })),
                competitors: competitors.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    strengths: c.strengths
                })),
                documents: recentDocs.map(d => ({
                    id: d.id,
                    name: d.title,
                    category: d.category,
                    date: d.updated_at
                }))
            },
            strategy: {
                activeICPs: icps.length,
                primaryICP: icps[0] || null,
                icpCount: icps.length,
                allICPs: icps.map((i: any) => ({ id: i.id, name: i.name }))
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
