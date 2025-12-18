import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role client for admin access
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Failed statuses that can be reset
const FAILED_STATUSES = [
  'failed',
  'error',
  'bounced'
];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id;

    // Get campaign info
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('id, campaign_name, name, workspace_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Reset failed prospects to 'pending'
    const { data: updated, error } = await supabaseAdmin
      .from('campaign_prospects')
      .update({
        status: 'pending',
        notes: null,
        updated_at: new Date().toISOString()
      })
      .eq('campaign_id', campaignId)
      .in('status', FAILED_STATUSES)
      .select('id');

    if (error) {
      console.error('Failed to reset prospects:', error);
      return NextResponse.json({ error: 'Failed to reset prospects' }, { status: 500 });
    }

    const resetCount = updated?.length || 0;

    // Also delete failed queue entries so they can be re-queued
    if (resetCount > 0) {
      const prospectIds = updated!.map(p => p.id);
      await supabaseAdmin
        .from('send_queue')
        .delete()
        .eq('campaign_id', campaignId)
        .in('prospect_id', prospectIds)
        .eq('status', 'failed');
    }

    return NextResponse.json({
      success: true,
      reset_count: resetCount,
      message: `Reset ${resetCount} failed prospects to pending status. They will be queued for sending.`
    });

  } catch (error: any) {
    console.error('Reset failed error:', error);
    return NextResponse.json({ error: 'Failed to reset prospects' }, { status: 500 });
  }
}
