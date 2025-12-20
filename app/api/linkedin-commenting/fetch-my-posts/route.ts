/**
 * Fetch the user's own LinkedIn posts via Unipile
 * GET /api/linkedin-commenting/fetch-my-posts?workspace_id=...
 */

import { createClient } from '@supabase/supabase-js';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceId = searchParams.get('workspace_id');

        if (!workspaceId) {
            return NextResponse.json({ error: 'Missing workspace_id parameter' }, { status: 400 });
        }

        // Authenticate user
        const authClient = await createSupabaseRouteClient();
        const { data: { user }, error: authError } = await authClient.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Get LinkedIn account for this workspace
        const { data: linkedinAccount, error: accountError } = await supabase
            .from('workspace_accounts')
            .select('unipile_account_id')
            .eq('workspace_id', workspaceId)
            .eq('account_type', 'linkedin')
            .in('connection_status', VALID_CONNECTION_STATUSES)
            .limit(1)
            .single();

        if (accountError || !linkedinAccount) {
            return NextResponse.json({ error: 'No connected LinkedIn account' }, { status: 400 });
        }

        console.log(`📬 Fetching own posts for workspace ${workspaceId} using Unipile account ${linkedinAccount.unipile_account_id}`);

        // Fetch posts from Unipile
        // Note: This endpoint might vary based on Unipile version, but usually /api/v1/posts or /api/v1/accounts/{id}/posts
        const unipileUrl = `${UNIPILE_BASE_URL}/api/v1/posts?account_id=${linkedinAccount.unipile_account_id}&limit=20`;

        const unipileResponse = await fetch(unipileUrl, {
            method: 'GET',
            headers: {
                'X-API-KEY': UNIPILE_API_KEY,
                'Accept': 'application/json'
            }
        });

        if (!unipileResponse.ok) {
            const errorText = await unipileResponse.text();
            console.error('❌ Unipile error:', errorText);
            return NextResponse.json({
                error: 'Failed to fetch posts from LinkedIn',
                details: errorText
            }, { status: 500 });
        }

        const unipileData = await unipileResponse.json();
        const posts = (unipileData.items || unipileData || []).map((item: any) => ({
            social_id: item.id || item.social_id,
            content: item.text || item.content || '',
            posted_at: item.date || item.created_at || new Date().toISOString(),
            likes_count: item.likes_count || item.num_likes || 0,
            comments_count: item.comments_count || item.num_comments || 0,
            url: item.url || item.share_url || `https://www.linkedin.com/feed/update/${item.id}`
        }));

        return NextResponse.json({
            success: true,
            posts
        });

    } catch (error) {
        console.error('❌ Error in fetch-my-posts:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
