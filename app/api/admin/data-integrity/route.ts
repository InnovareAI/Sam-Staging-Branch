import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

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

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check prospect data integrity
    const { data: integrityStats } = await supabaseAdmin
      .from('prospect_data_integrity')
      .select('*')
      .single();

    // Check for duplicate queue records
    const { data: duplicates } = await supabaseAdmin
      .rpc('check_duplicate_queue_records');

    // Get list of campaigns with corrupted prospects
    const { data: corruptedCampaigns } = await supabaseAdmin
      .from('campaign_prospects')
      .select('campaign_id, campaigns(campaign_name, created_by)')
      .eq('status', 'connection_request_sent')
      .is('contacted_at', null);

    const uniqueCorruptedCampaigns = Array.from(
      new Set(corruptedCampaigns?.map(c => c.campaign_id) || [])
    );

    // Check queue health
    const { data: queueStats } = await supabaseAdmin
      .from('send_queue')
      .select('status')
      .then(({ data }) => {
        const stats = {
          total: data?.length || 0,
          pending: data?.filter(q => q.status === 'pending').length || 0,
          sent: data?.filter(q => q.status === 'sent').length || 0,
          failed: data?.filter(q => q.status === 'failed').length || 0
        };
        return { data: stats };
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
      duplicate_queue_records: duplicates || 0,
      recommendations: generateRecommendations(integrityStats, queueStats, uniqueCorruptedCampaigns.length)
    });

  } catch (error: any) {
    console.error('❌ Data integrity check error:', error);
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
    recommendations.push('✅ All systems healthy');
  }

  return recommendations;
}

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Run cleanup
    const { data: result, error } = await supabaseAdmin
      .rpc('cleanup_corrupted_prospect_statuses');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      fixed_count: result[0].fixed_count,
      affected_campaigns: result[0].campaign_ids,
      message: `Fixed ${result[0].fixed_count} corrupted prospects`
    });

  } catch (error: any) {
    console.error('❌ Cleanup error:', error);
    return NextResponse.json(
      { error: error.message || 'Cleanup failed' },
      { status: 500 }
    );
  }
}
