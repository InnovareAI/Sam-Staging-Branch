import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

/**
 * Admin API: Data Integrity Dashboard
 *
 * GET /api/admin/data-integrity
 *
 * Returns comprehensive data integrity metrics:
 * - Corrupted prospect statuses
 * - Duplicate queue records
 * - Campaigns with issues
 * - Overall system health
 */

export async function GET(req: NextRequest) {
  try {
    // Firebase auth - workspace comes from header
    let authContext;
    try {
      authContext = await verifyAuth(req);
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }

    // Check prospect data integrity
    const { rows: integrityRows } = await pool.query(
      `SELECT * FROM prospect_data_integrity LIMIT 1`
    ).catch(() => ({ rows: [{}] }));

    const integrityStats = integrityRows[0] || {};

    // Check for duplicate queue records
    const { rows: duplicateRows } = await pool.query(
      `SELECT * FROM check_duplicate_queue_records()`
    ).catch(() => ({ rows: [{ count: 0 }] }));

    const duplicates = duplicateRows[0]?.count || 0;

    // Get list of campaigns with corrupted prospects
    const { rows: corruptedCampaigns } = await pool.query(
      `SELECT cp.campaign_id, c.campaign_name, c.created_by
       FROM campaign_prospects cp
       JOIN campaigns c ON cp.campaign_id = c.id
       WHERE cp.status = 'connection_request_sent' AND cp.contacted_at IS NULL`
    );

    const uniqueCorruptedCampaigns = Array.from(
      new Set(corruptedCampaigns?.map((c: any) => c.campaign_id) || [])
    );

    // Check queue health
    const { rows: queueRows } = await pool.query(
      `SELECT status, COUNT(*) as count FROM send_queue GROUP BY status`
    );

    const queueStats = {
      total: 0,
      pending: 0,
      sent: 0,
      failed: 0
    };

    queueRows?.forEach((row: any) => {
      const count = parseInt(row.count, 10);
      queueStats.total += count;
      if (row.status === 'pending') queueStats.pending = count;
      else if (row.status === 'sent') queueStats.sent = count;
      else if (row.status === 'failed') queueStats.failed = count;
    });

    // Calculate overall health score (0-100)
    const totalProspects = integrityStats?.total_prospects || 1;
    const corruptedCount = integrityStats?.corrupted_sent || 0;
    const healthScore = Math.max(0, 100 - (corruptedCount / totalProspects * 100));

    return NextResponse.json({
      health_score: Math.round(healthScore),
      status: healthScore >= 95 ? 'healthy' : healthScore >= 80 ? 'warning' : 'critical',
      prospect_integrity: integrityStats,
      queue_stats: queueStats,
      corrupted_campaigns: {
        count: uniqueCorruptedCampaigns.length,
        campaign_ids: uniqueCorruptedCampaigns
      },
      duplicate_queue_records: duplicates,
      recommendations: generateRecommendations(integrityStats, queueStats, uniqueCorruptedCampaigns.length)
    });

  } catch (error: any) {
    console.error('Data integrity check error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check data integrity' },
      { status: 500 }
    );
  }
}

function generateRecommendations(
  integrity: any,
  queueStats: any,
  corruptedCampaignCount: number
): string[] {
  const recommendations: string[] = [];

  if ((integrity?.corrupted_sent || 0) > 0) {
    recommendations.push(`Run cleanup function to fix ${integrity.corrupted_sent} corrupted prospects`);
  }

  if (corruptedCampaignCount > 0) {
    recommendations.push(`${corruptedCampaignCount} campaigns have data integrity issues`);
  }

  if ((queueStats?.failed || 0) > 10) {
    recommendations.push(`${queueStats.failed} failed queue records - investigate Unipile connectivity`);
  }

  if (recommendations.length === 0) {
    recommendations.push('All systems healthy');
  }

  return recommendations;
}

export async function POST(req: NextRequest) {
  try {
    // Firebase auth - workspace comes from header
    let authContext;
    try {
      authContext = await verifyAuth(req);
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }

    // Run cleanup
    const { rows: result } = await pool.query(
      `SELECT * FROM cleanup_corrupted_prospect_statuses()`
    );

    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'Cleanup function returned no results' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      fixed_count: result[0].fixed_count,
      affected_campaigns: result[0].campaign_ids,
      message: `Fixed ${result[0].fixed_count} corrupted prospects`
    });

  } catch (error: any) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: error.message || 'Cleanup failed' },
      { status: 500 }
    );
  }
}
