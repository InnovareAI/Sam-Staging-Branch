import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

/**
 * Cron Job: Cleanup Corrupted Prospect Statuses
 *
 * Runs every hour to automatically fix prospects marked as "sent" without contacted_at timestamp
 * This prevents manual intervention for every corrupted campaign
 *
 * POST /api/cron/cleanup-corrupted-statuses
 * Header: x-cron-secret (for security)
 *
 * Cronjob.org setup:
 * - URL: https://app.meet-sam.com/api/cron/cleanup-corrupted-statuses
 * - Schedule: 0 * * * * (every hour)
 * - Headers: x-cron-secret: ${CRON_SECRET}
 */

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // Security check
    const cronSecret = req.headers.get('x-cron-secret');

    if (cronSecret !== process.env.CRON_SECRET) {
      console.warn('⚠️  Unauthorized cron request - secret mismatch');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🧹 Running corrupted status cleanup...');

    // Check current corruption before cleanup
    const { data: beforeStats } = await supabase
      .from('prospect_data_integrity')
      .select('*')
      .single();

    console.log('📊 Before cleanup:', beforeStats);

    // Run cleanup function
    const { data: result, error } = await supabase
      .rpc('cleanup_corrupted_prospect_statuses');

    if (error) {
      console.error('❌ Cleanup failed:', error);
      return NextResponse.json({
        error: 'Cleanup failed',
        details: error.message
      }, { status: 500 });
    }

    const cleanupResult = result[0];
    console.log(`✅ Fixed ${cleanupResult.fixed_count} corrupted prospects`);

    if (cleanupResult.campaign_ids && cleanupResult.campaign_ids.length > 0) {
      console.log(`📋 Affected campaigns:`, cleanupResult.campaign_ids);
    }

    // Check stats after cleanup
    const { data: afterStats } = await supabase
      .from('prospect_data_integrity')
      .select('*')
      .single();

    console.log('📊 After cleanup:', afterStats);

    return NextResponse.json({
      success: true,
      fixed_count: cleanupResult.fixed_count,
      affected_campaigns: cleanupResult.campaign_ids,
      before: beforeStats,
      after: afterStats,
      message: `Fixed ${cleanupResult.fixed_count} corrupted prospect statuses`
    });

  } catch (error: any) {
    console.error('❌ Cleanup error:', error);
    return NextResponse.json(
      { error: error.message || 'Cleanup job failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Cleanup Corrupted Statuses',
    description: 'Automatically fixes prospects marked as sent without contacted_at',
    endpoint: '/api/cron/cleanup-corrupted-statuses',
    method: 'POST',
    schedule: '0 * * * * (every hour via Netlify scheduled functions)',
    behavior: {
      fixes: 'Prospects with status=connection_request_sent AND contacted_at=NULL',
      action: 'Sets status back to pending',
      frequency: 'Every hour'
    }
  });
}
