import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/auth';

/**
 * Update Prospect Status - Called by N8N after sending CR
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify internal trigger
    const trigger = request.headers.get('x-internal-trigger');
    if (trigger !== 'n8n-polling') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prospectId = params.id;
    const body = await request.json();

    // First, get existing prospect data to preserve personalization_data
    const existingResult = await pool.query(
      `SELECT personalization_data FROM campaign_prospects WHERE id = $1`,
      [prospectId]
    );

    const existingProspect = existingResult.rows[0];

    // Merge new personalization_data with existing (preserve campaign_name, etc)
    const mergedPersonalizationData = {
      ...(existingProspect?.personalization_data || {}),  // Keep existing data
      ...(body.personalization_data || {}),               // Add new data
      updated_via: 'n8n-polling',
      updated_at: new Date().toISOString()
    };

    // Update prospect status
    const updateResult = await pool.query(
      `UPDATE campaign_prospects
       SET status = $1,
           contacted_at = $2,
           personalization_data = $3
       WHERE id = $4
       RETURNING *`,
      [
        body.status || 'connection_requested',
        body.contacted_at || new Date().toISOString(),
        JSON.stringify(mergedPersonalizationData),
        prospectId
      ]
    );

    if (updateResult.rows.length === 0) {
      console.error(`Error updating prospect ${prospectId}: not found`);
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    console.log(`Updated prospect ${prospectId} to status: ${body.status}`);

    return NextResponse.json({
      success: true,
      prospect: updateResult.rows[0]
    });

  } catch (error: any) {
    console.error('Error in update-prospect-status:', error);
    return NextResponse.json({
      error: error.message,
      success: false
    }, { status: 500 });
  }
}
