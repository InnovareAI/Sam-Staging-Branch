import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

/**
 * N8N Callback Endpoint - Updates prospects after sending LinkedIn connection requests
 * Called by N8N workflow after successfully sending each message
 */
export async function POST(request: NextRequest) {
  try {
    // Verify internal trigger from N8N
    const trigger = request.headers.get('x-internal-trigger');
    if (trigger !== 'n8n-callback') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { prospect_id, unipile_message_id } = body;

    if (!prospect_id) {
      return NextResponse.json({ error: 'prospect_id required' }, { status: 400 });
    }

    // Use service role key to update database
    // Update prospect with contacted timestamp and status
    const { data, error } = await supabase
      .from('campaign_prospects')
      .update({
        contacted_at: new Date().toISOString(),
        status: 'contacted',
        personalization_data: {
          unipile_message_id: unipile_message_id || null,
          contacted_via: 'n8n_workflow',
          contacted_method: 'linkedin_connection_request'
        }
      })
      .eq('id', prospect_id)
      .select()
      .single();

    if (error) {
      console.error(`❌ Error updating prospect ${prospect_id}:`, error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`✅ Updated prospect ${prospect_id} - contacted at ${data.contacted_at}`);

    return NextResponse.json({
      success: true,
      prospect_id: data.id,
      contacted_at: data.contacted_at,
      status: data.status
    });

  } catch (error: any) {
    console.error('❌ Error in update-contacted:', error);
    return NextResponse.json({
      error: error.message,
      success: false
    }, { status: 500 });
  }
}
