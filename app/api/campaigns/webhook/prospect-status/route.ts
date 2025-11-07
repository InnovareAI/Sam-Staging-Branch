/**
 * Prospect-Level Status Update Webhook
 * Receives stage updates from N8N for individual prospects in the funnel
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Expected funnel stages
const VALID_STATUSES = [
  'pending',
  'approved',
  'ready_to_message',
  'connection_requested',
  'connection_accepted',
  'connection_rejected',
  'acceptance_message_sent',
  'fu1_sent',
  'fu2_sent',
  'fu3_sent',
  'fu4_sent',
  'gb_sent',
  'replied',
  'completed',
  'failed',
  'queued_in_n8n',
  'contacted'
] as const;

interface ProspectStatusUpdate {
  prospect_id: string;
  campaign_id: string;
  status: typeof VALID_STATUSES[number];
  message_id?: string;
  message_content?: string;
  sent_at?: string;
  error_message?: string;
  metadata?: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    console.log('📥 Prospect status update webhook called');

    // Verify webhook authentication
    const authHeader = request.headers.get('authorization');
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET_TOKEN;

    if (webhookSecret && (!authHeader || !authHeader.startsWith('Bearer '))) {
      console.warn('⚠️ Unauthorized webhook request - missing auth header');
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - missing authentication'
      }, { status: 401 });
    }

    if (webhookSecret && authHeader) {
      const token = authHeader.substring(7);
      if (token !== webhookSecret) {
        console.warn('⚠️ Unauthorized webhook request - invalid token');
        return NextResponse.json({
          success: false,
          error: 'Unauthorized - invalid token'
        }, { status: 401 });
      }
    }

    // Parse payload
    const body = await request.json() as ProspectStatusUpdate;

    console.log(`📊 Status update for prospect ${body.prospect_id}:`, {
      campaign_id: body.campaign_id,
      status: body.status,
      message_id: body.message_id
    });

    // Validate required fields
    if (!body.prospect_id || !body.campaign_id || !body.status) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: prospect_id, campaign_id, status'
      }, { status: 400 });
    }

    // Validate status value
    if (!VALID_STATUSES.includes(body.status as any)) {
      return NextResponse.json({
        success: false,
        error: `Invalid status: ${body.status}. Must be one of: ${VALID_STATUSES.join(', ')}`
      }, { status: 400 });
    }

    // Verify prospect exists
    const { data: prospect, error: fetchError } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, status, personalization_data')
      .eq('id', body.prospect_id)
      .eq('campaign_id', body.campaign_id)
      .single();

    if (fetchError || !prospect) {
      console.error('❌ Prospect not found:', body.prospect_id);
      return NextResponse.json({
        success: false,
        error: 'Prospect not found'
      }, { status: 404 });
    }

    console.log(`✅ Found prospect: ${prospect.first_name} ${prospect.last_name} (current status: ${prospect.status})`);

    // Build update object
    const updateData: any = {
      status: body.status,
      updated_at: new Date().toISOString()
    };

    // Update timestamps based on status
    switch (body.status) {
      case 'connection_requested':
        updateData.contacted_at = body.sent_at || new Date().toISOString();
        updateData.last_message_sent_at = body.sent_at || new Date().toISOString();
        break;

      case 'connection_accepted':
        // No additional timestamp needed
        break;

      case 'acceptance_message_sent':
      case 'fu1_sent':
      case 'fu2_sent':
      case 'fu3_sent':
      case 'fu4_sent':
      case 'gb_sent':
        updateData.last_message_sent_at = body.sent_at || new Date().toISOString();
        break;

      case 'replied':
        updateData.replied_at = body.sent_at || new Date().toISOString();
        break;

      case 'failed':
        updateData.error_message = body.error_message;
        break;
    }

    // Update personalization_data with message tracking
    const existingData = prospect.personalization_data || {};
    const updatedPersonalizationData = {
      ...existingData,
      funnel_tracking: {
        ...(existingData.funnel_tracking || {}),
        [body.status]: {
          timestamp: body.sent_at || new Date().toISOString(),
          message_id: body.message_id,
          message_content: body.message_content,
          metadata: body.metadata
        }
      }
    };

    updateData.personalization_data = updatedPersonalizationData;

    // Update prospect
    const { data: updated, error: updateError } = await supabase
      .from('campaign_prospects')
      .update(updateData)
      .eq('id', body.prospect_id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating prospect:', updateError);
      throw updateError;
    }

    console.log(`✅ Successfully updated prospect ${body.prospect_id} to status: ${body.status}`);

    // Return success
    return NextResponse.json({
      success: true,
      prospect: {
        id: updated.id,
        name: `${updated.first_name} ${updated.last_name}`,
        previous_status: prospect.status,
        new_status: updated.status,
        updated_at: updated.updated_at
      },
      message: `Prospect status updated to ${body.status}`
    });

  } catch (error) {
    console.error('❌ Prospect status update webhook error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET - Check webhook health
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    endpoint: '/api/campaigns/webhook/prospect-status',
    methods: ['POST'],
    description: 'Receives prospect-level status updates from N8N workflow',
    expected_payload: {
      prospect_id: 'UUID of the prospect',
      campaign_id: 'UUID of the campaign',
      status: 'One of the valid funnel statuses',
      message_id: 'Optional: ID of the message sent',
      sent_at: 'Optional: ISO timestamp',
      error_message: 'Optional: Error message if status is failed'
    },
    valid_statuses: VALID_STATUSES
  });
}
