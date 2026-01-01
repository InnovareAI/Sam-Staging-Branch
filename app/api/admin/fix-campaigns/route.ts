import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST() {
  try {
    // 1. Unpause Sebastian campaign
    const { data: sebastianCampaigns, error: sebastianError } = await supabase
      .from('campaigns')
      .update({ status: 'active' })
      .ilike('name', '%Sebastian%')
      .select('id, name, status');

    if (sebastianError) throw sebastianError;

    // 2. Get ASP campaign
    const { data: aspCampaigns, error: aspError } = await supabase
      .from('campaigns')
      .select('id')
      .ilike('name', '%ASP%Company%Follow%')
      .limit(1);

    if (aspError) throw aspError;
    if (!aspCampaigns?.length) {
      return NextResponse.json({ error: 'ASP campaign not found' }, { status: 404 });
    }

    const aspCampaignId = aspCampaigns[0].id;

    // 3. Get pending prospects
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('id, prospect_id, campaign_id')
      .eq('campaign_id', aspCampaignId)
      .eq('status', 'pending');

    if (prospectsError) throw prospectsError;

    // 4. Insert into send_queue
    const queueItems = (prospects || []).map(p => ({
      campaign_id: p.campaign_id,
      prospect_id: p.prospect_id,
      campaign_prospect_id: p.id,
      scheduled_for: new Date().toISOString(),
      status: 'pending',
      message_type: 'connection_request'
    }));

    let insertedCount = 0;
    if (queueItems.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('send_queue')
        .insert(queueItems)
        .select('id');

      if (insertError) throw insertError;
      insertedCount = inserted?.length || 0;
    }

    return NextResponse.json({
      success: true,
      sebastianCampaigns,
      aspCampaignId,
      pendingProspects: prospects?.length || 0,
      queueItemsInserted: insertedCount
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
