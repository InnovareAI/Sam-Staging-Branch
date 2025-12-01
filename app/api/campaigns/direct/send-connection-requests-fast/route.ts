import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { createClient } from '@supabase/supabase-js';
import { airtableService } from '@/lib/airtable';

/**
 * FAST Queue-Based Campaign Execution
 *
 * This endpoint ONLY creates queue records - validation happens in cron processor.
 * Returns in <5 seconds even with 50+ prospects.
 *
 * POST /api/campaigns/direct/send-connection-requests-fast
 * Body: { campaignId: string }
 */

export const maxDuration = 60;

// Service role client for queue operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Public holidays (US 2025-2026)
const PUBLIC_HOLIDAYS = [
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-05-26', '2025-06-19',
  '2025-07-04', '2025-09-01', '2025-11-11', '2025-11-27', '2025-12-25',
  '2026-01-01', '2026-01-19'
];

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function isPublicHoliday(date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0];
  return PUBLIC_HOLIDAYS.includes(dateStr);
}

export async function POST(req: NextRequest) {
  try {
    // CRITICAL: Authenticate user
    const supabase = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { campaignId } = await req.json();

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
    }

    console.log(`🚀 FAST queue creation for campaign: ${campaignId} (user: ${user.email})`);

    // 1. Fetch campaign (RLS verifies user owns it)
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, campaign_name, message_templates, workspace_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('Campaign not found or access denied:', campaignError);
      return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 404 });
    }

    // 2. Fetch pending prospects (limit 50)
    const { data: prospects, error: prospectsError } = await supabaseAdmin
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .not('linkedin_url', 'is', null)
      .order('created_at', { ascending: true })
      .limit(50);

    if (prospectsError) {
      console.error('Error fetching prospects:', prospectsError);
      return NextResponse.json({ error: 'Failed to fetch prospects' }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      console.log('✅ No pending prospects');
      return NextResponse.json({ success: true, queued: 0, message: 'No pending prospects' });
    }

    // 2.5: Check which prospects are already in queue (to avoid duplicates)
    const prospectIds = prospects.map(p => p.id);
    const { data: existingQueue } = await supabaseAdmin
      .from('send_queue')
      .select('prospect_id')
      .eq('campaign_id', campaignId)
      .in('prospect_id', prospectIds);

    const existingProspectIds = new Set((existingQueue || []).map(q => q.prospect_id));
    const newProspects = prospects.filter(p => !existingProspectIds.has(p.id));
    const skippedCount = prospects.length - newProspects.length;

    if (skippedCount > 0) {
      console.log(`⚠️ Skipping ${skippedCount} prospects already in queue`);
    }

    if (newProspects.length === 0) {
      console.log('✅ All prospects already in queue');
      return NextResponse.json({
        success: true,
        queued: 0,
        skipped: skippedCount,
        message: 'All prospects already queued'
      });
    }

    console.log(`📊 Queueing ${newProspects.length} NEW prospects (${skippedCount} already queued)...`);

    // 3. Create queue records (30 min spacing, skip weekends/holidays)
    const queueRecords = [];
    const connectionMessage = campaign.message_templates?.connection_request ||
      'Hi {first_name}, I\'d like to connect!';

    let scheduledTime = new Date();

    for (let i = 0; i < newProspects.length; i++) {
      const prospect = newProspects[i];

      // Add 30 minutes for each prospect
      scheduledTime = new Date(scheduledTime.getTime() + (i * 30 * 60 * 1000));

      // Skip weekends/holidays
      while (isWeekend(scheduledTime) || isPublicHoliday(scheduledTime)) {
        scheduledTime = new Date(scheduledTime.getTime() + (24 * 60 * 60 * 1000));
      }

      // Personalize message
      const personalizedMessage = connectionMessage
        .replace(/\{first_name\}/g, prospect.first_name)
        .replace(/\{last_name\}/g, prospect.last_name)
        .replace(/\{company_name\}/g, prospect.company_name || '')
        .replace(/\{company\}/g, prospect.company_name || '');

      queueRecords.push({
        campaign_id: campaignId,
        prospect_id: prospect.id,
        linkedin_user_id: prospect.linkedin_user_id || prospect.linkedin_url,
        message: personalizedMessage,
        scheduled_for: scheduledTime.toISOString(),
        status: 'pending'
      });
    }

    // 4. Bulk insert (fast - single transaction)
    const { error: insertError } = await supabaseAdmin
      .from('send_queue')
      .insert(queueRecords);

    if (insertError) {
      console.error('Failed to create queue:', insertError);
      return NextResponse.json({ error: 'Failed to create queue' }, { status: 500 });
    }

    console.log(`✅ Queued ${queueRecords.length} prospects successfully (${skippedCount} already in queue)`);

    // Sync prospects to Airtable with "No Response" status (initial state)
    // This runs async in background - don't block the response
    syncProspectsToAirtable(newProspects, campaign.campaign_name).catch(err => {
      console.error('❌ Background Airtable sync failed:', err);
    });

    return NextResponse.json({
      success: true,
      queued: queueRecords.length,
      skipped: skippedCount,
      firstScheduled: queueRecords[0]?.scheduled_for,
      lastScheduled: queueRecords[queueRecords.length - 1]?.scheduled_for,
      message: `${queueRecords.length} prospects queued for sending${skippedCount > 0 ? ` (${skippedCount} already queued)` : ''}`
    });

  } catch (error: any) {
    console.error('❌ Queue creation error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * Sync prospects to Airtable with "No Response" status
 * Runs in background to not block the queue creation response
 */
async function syncProspectsToAirtable(prospects: any[], campaignName: string) {
  console.log(`📊 Syncing ${prospects.length} prospects to Airtable (No Response)...`);

  let successCount = 0;
  let errorCount = 0;

  for (const prospect of prospects) {
    try {
      const result = await airtableService.syncLinkedInLead({
        profileUrl: prospect.linkedin_url,
        name: `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim() || 'Unknown',
        jobTitle: prospect.title,
        companyName: prospect.company_name || prospect.company,
        linkedInAccount: campaignName,
        intent: 'no_response', // Initial status - they haven't responded yet
      });

      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        console.log(`⚠️ Airtable sync failed for ${prospect.first_name}: ${result.error}`);
      }
    } catch (err) {
      errorCount++;
      console.error(`❌ Airtable sync error for ${prospect.first_name}:`, err);
    }
  }

  console.log(`✅ Airtable sync complete: ${successCount} synced, ${errorCount} errors`);
}
