import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { supabaseKnowledge } from '@/lib/supabase-knowledge';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const threadId = searchParams.get('threadId');

        const supabase = await createSupabaseRouteClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Get Thread and Workspace
        let workspaceId = null;
        let thread = null;

        if (threadId) {
            const { data: threadData } = await supabase
                .from('sam_conversation_threads')
                .select('*')
                .eq('id', threadId)
                .eq('user_id', user.id)
                .single();

            thread = threadData;
            workspaceId = threadData?.workspace_id;
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
            return NextResponse.json({
                success: true,
                message: 'No workspace context found',
                knowledge: null,
                strategy: null,
                stats: null
            });
        }

        // 2. Fetch Knowledge Context
        const kbCompleteness = await supabaseKnowledge.checkKBCompleteness(workspaceId);

        // 3. Fetch Strategy Context (ICPs)
        const icps = await supabaseKnowledge.getICPs({ workspaceId });

        // 4. Fetch Stats (Thread activity + Mock campaign stats)
        // In a real scenario, this would pull from active_campaigns or similar tables
        const stats = {
            messageCount: thread?.message_count || 0,
            threadType: thread?.thread_type || 'general',
            campaign: {
                active: 2,
                totalSent: 124,
                replied: 12,
                meetings: 3,
                responseRate: '9.7%',
                trend: '+12% from last week'
            }
        };

        return NextResponse.json({
            success: true,
            knowledge: {
                completeness: kbCompleteness?.overallCompleteness || 0,
                sections: kbCompleteness?.sections || {},
                missingCritical: kbCompleteness?.missingCritical || []
            },
            strategy: {
                activeICPs: icps.length,
                primaryICP: icps[0] || null,
                icpCount: icps.length
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
