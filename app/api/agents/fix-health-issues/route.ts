/**
 * Fix Health Issues
 * Automatically resolves common health check issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = pool;
  const fixes: any[] = [];

  try {
    // Fix 1: Clear stuck queue items (>1 hour overdue)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: stuckItems, error: stuckError } = await supabase
      .from('send_queue')
      .select('id, scheduled_for')
      .eq('status', 'pending')
      .lt('scheduled_for', oneHourAgo);

    if (!stuckError && stuckItems && stuckItems.length > 0) {
      // Mark as failed with explanation
      const { error: updateError } = await supabase
        .from('send_queue')
        .update({
          status: 'failed',
          error_message: 'Auto-failed by health check: stuck >1 hour',
          updated_at: new Date().toISOString()
        })
        .in('id', stuckItems.map((i: any) => i.id));

      fixes.push({
        issue: 'Stuck Queue Items',
        fixed: !updateError,
        count: stuckItems.length,
        error: updateError?.message
      });
    }

    // Fix 2: Update stale prospects (>3 days pending)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: staleProspects, error: staleError } = await supabase
      .from('campaign_prospects')
      .select('id')
      .eq('status', 'pending')
      .lt('updated_at', threeDaysAgo);

    if (staleError) {
      fixes.push({
        issue: 'Stale Prospects',
        fixed: false,
        count: 0,
        error: staleError.message
      });
    } else if (staleProspects && staleProspects.length > 0) {
      // Mark as failed
      const { error: updateError } = await supabase
        .from('campaign_prospects')
        .update({
          status: 'failed',
          notes: 'Auto-failed by health check: stale >3 days',
          updated_at: new Date().toISOString()
        })
        .in('id', staleProspects.map((p: any) => p.id));

      fixes.push({
        issue: 'Stale Prospects',
        fixed: !updateError,
        count: staleProspects.length,
        error: updateError?.message
      });
    } else {
      fixes.push({
        issue: 'Stale Prospects',
        fixed: true,
        count: 0,
        error: null
      });
    }

    // Note: LinkedIn accounts are managed via Unipile API, not local database

    return NextResponse.json({
      success: true,
      fixes_applied: fixes,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fix health issues failed:', error);
    return NextResponse.json({
      error: 'Failed to fix health issues',
      details: error instanceof Error ? error.message : 'Unknown error',
      fixes_applied: fixes
    }, { status: 500 });
  }
}
