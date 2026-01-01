/**
 * Cleanup Expired Posts Cron Job
 * POST /api/cron/cleanup-expired-posts
 * 
 * Removes discovered posts that have expired (older than 24h and still pending)
 * Runs once per hour or as scheduled
 */

import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get('authorization');
        const cronSecret = request.headers.get('x-cron-secret');
        if (cronSecret !== process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = pool;
        const now = new Date().toISOString();

        console.log('🧹 Starting cleanup of expired posts...');

        // Delete posts where expires_at <= now AND status = 'pending'
        // Also cleanup posts where expires_at is null but discovered_at is > 24h ago
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: deleted, error, count } = await supabase
            .from('linkedin_posts_discovered')
            .delete({ count: 'exact' })
            .or(`expires_at.lte.${now},and(expires_at.is.null,discovered_at.lte.${oneDayAgo})`)
            .eq('status', 'pending');

        if (error) {
            console.error('❌ Error during cleanup:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log(`✅ Cleanup complete. Removed ${count || 0} expired posts.`);

        return NextResponse.json({
            success: true,
            removed_count: count || 0,
            timestamp: now
        });

    } catch (error) {
        console.error('❌ Unexpected error in cleanup cron:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

// GET for manual trigger/status
export async function GET() {
    return NextResponse.json({
        service: 'Cleanup Expired Posts',
        status: 'ready'
    });
}
