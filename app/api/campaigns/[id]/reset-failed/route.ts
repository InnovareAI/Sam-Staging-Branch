import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// Service role client for admin access
// Pool imported from lib/db
// Failed statuses that can be reset
const FAILED_STATUSES = [
  'failed',
  'error',
  'bounced'
];

// Handle both GET (from Google Chat link) and POST
async function handleReset(campaignId: string) {
  // Get campaign info
  const { data: campaign, error: campaignError } = await pool
    .from('campaigns')
    .select('id, campaign_name, name, workspace_id')
    .eq('id', campaignId)
    .single();

  if (campaignError || !campaign) {
    return { error: 'Campaign not found', status: 404 };
  }

  // Reset failed prospects to 'pending'
  const { data: updated, error } = await pool
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
    return { error: 'Failed to reset prospects', status: 500 };
  }

  const resetCount = updated?.length || 0;

  // Also delete failed queue entries so they can be re-queued
  if (resetCount > 0) {
    const prospectIds = updated!.map(p => p.id);
    await pool
      .from('send_queue')
      .delete()
      .eq('campaign_id', campaignId)
      .in('prospect_id', prospectIds)
      .eq('status', 'failed');
  }

  const campaignName = campaign.campaign_name || campaign.name || campaignId;
  return {
    success: true,
    resetCount,
    campaignName,
    message: `Reset ${resetCount} failed prospects to pending status. They will be queued for sending.`
  };
}

// GET handler - returns HTML page with result (for Google Chat links)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await handleReset(params.id);

    if (result.error) {
      return new NextResponse(`
        <!DOCTYPE html>
        <html>
        <head><title>Reset Failed</title></head>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>❌ Error</h1>
          <p>${result.error}</p>
          <a href="https://app.meet-sam.com">← Back to SAM</a>
        </body>
        </html>
      `, { status: result.status, headers: { 'Content-Type': 'text/html' } });
    }

    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head><title>Reset Complete</title></head>
      <body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1>✅ Reset Complete</h1>
        <p><strong>${result.resetCount}</strong> failed prospects in <strong>${result.campaignName}</strong> have been reset to pending.</p>
        <p>They will be automatically queued for sending.</p>
        <br/>
        <a href="https://app.meet-sam.com" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">← Back to SAM</a>
      </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });

  } catch (error: any) {
    console.error('Reset failed error:', error);
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head><title>Reset Failed</title></head>
      <body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1>❌ Error</h1>
        <p>Failed to reset prospects: ${error.message}</p>
        <a href="https://app.meet-sam.com">← Back to SAM</a>
      </body>
      </html>
    `, { status: 500, headers: { 'Content-Type': 'text/html' } });
  }
}

// POST handler - returns JSON (for API calls)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await handleReset(params.id);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      reset_count: result.resetCount,
      message: result.message
    });

  } catch (error: any) {
    console.error('Reset failed error:', error);
    return NextResponse.json({ error: 'Failed to reset prospects' }, { status: 500 });
  }
}
