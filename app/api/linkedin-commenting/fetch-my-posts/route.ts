/**
 * Fetch the user's own LinkedIn posts via Unipile
 * GET /api/linkedin-commenting/fetch-my-posts
 */

import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

export async function GET(request: NextRequest) {
    try {
        // Authenticate user using Firebase auth
        const { workspaceId } = await verifyAuth(request);

        // Get LinkedIn account for this workspace
        const accountResult = await pool.query(
            `SELECT unipile_account_id FROM workspace_accounts
             WHERE workspace_id = $1
             AND account_type = 'linkedin'
             AND connection_status = ANY($2)
             LIMIT 1`,
            [workspaceId, VALID_CONNECTION_STATUSES]
        );

        if (accountResult.rows.length === 0) {
            return NextResponse.json({ error: 'No connected LinkedIn account' }, { status: 400 });
        }

        const linkedinAccount = accountResult.rows[0];

        console.log(`📬 Fetching own posts for workspace ${workspaceId} using Unipile account ${linkedinAccount.unipile_account_id}`);

        // Fetch posts from Unipile
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
        // Handle auth errors
        if (error && typeof error === 'object' && 'code' in error) {
            const authError = error as AuthError;
            return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
        }

        console.error('❌ Error in fetch-my-posts:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
