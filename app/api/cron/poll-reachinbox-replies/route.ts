import { NextRequest, NextResponse } from 'next/server';
import { reachInboxSyncService } from '@/lib/services/reachinbox-sync';

export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
    try {
        // Security check
        const authHeader = request.headers.get('x-cron-secret');
        if (authHeader !== process.env.CRON_SECRET) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        console.log('📧 Starting ReachInbox poll cron...');
        await reachInboxSyncService.syncAllWorkspaces();

        return NextResponse.json({ success: true, message: 'ReachInbox sync completed' });
    } catch (error) {
        console.error('❌ ReachInbox poll cron failed:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
