import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

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

    const supabase = createClient();

    // Update prospect status
    const { data, error } = await supabase
      .from('campaign_prospects')
      .update({
        status: body.status || 'connection_requested',
        contacted_at: body.contacted_at || new Date().toISOString(),
        personalization_data: {
          ...(body.personalization_data || {}),
          updated_via: 'n8n-polling',
          updated_at: new Date().toISOString()
        }
      })
      .eq('id', prospectId)
      .select()
      .single();

    if (error) {
      console.error(`❌ Error updating prospect ${prospectId}:`, error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`✅ Updated prospect ${prospectId} to status: ${body.status}`);

    return NextResponse.json({
      success: true,
      prospect: data
    });

  } catch (error: any) {
    console.error('❌ Error in update-prospect-status:', error);
    return NextResponse.json({
      error: error.message,
      success: false
    }, { status: 500 });
  }
}
