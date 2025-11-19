import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyN8NWebhook, getRequestBody } from '@/lib/security/webhook-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Webhook handler for N8N prospect status updates
// Called after each individual LinkedIn connection request or email sent
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const body = await getRequestBody(request);
    const { valid, error } = await verifyN8NWebhook(request, body);

    if (!valid && error) {
      console.error('❌ Invalid N8N webhook signature');
      return error;
    }

    const payload = JSON.parse(body);

    // Handle both prospect_id (string) and prospect.id (object) structures
    const prospectId = payload.prospect_id || payload.prospect?.id;
    const campaignId = payload.campaign_id || payload.campaignId;

    console.log('📡 N8N Prospect Status Webhook received:', {
      prospect_id: prospectId,
      campaign_id: campaignId,
      status: payload.status,
      timestamp: new Date().toISOString(),
      raw_payload: payload
    });

    // Validate required fields
    if (!prospectId || !payload.status) {
      console.error('❌ Missing required fields:', {
        prospect_id: prospectId,
        status: payload.status,
        payload
      });
      return NextResponse.json(
        { error: 'Missing required fields: prospect_id or status' },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: any = {
      status: payload.status,
      updated_at: new Date().toISOString()
    };

    // Set contacted_at timestamp when connection is requested
    if (payload.status === 'connection_requested') {
      updateData.contacted_at = new Date().toISOString();

      // Store LinkedIn invitation_id for later withdrawal if needed
      if (payload.invitation_id) {
        const currentData = await supabase
          .from('campaign_prospects')
          .select('personalization_data')
          .eq('id', prospectId)
          .single();

        const personalizationData = currentData.data?.personalization_data || {};
        personalizationData.linkedin_invitation_id = payload.invitation_id;
        updateData.personalization_data = personalizationData;
      }
    }

    // Add error details if present
    if (payload.error_message) {
      updateData.error_message = payload.error_message;
    }

    // Add Unipile message ID if present
    if (payload.unipile_message_id) {
      const currentData = await supabase
        .from('campaign_prospects')
        .select('personalization_data')
        .eq('id', prospectId)
        .single();

      const personalizationData = currentData.data?.personalization_data || {};
      personalizationData.unipile_message_id = payload.unipile_message_id;
      updateData.personalization_data = personalizationData;
    }

    // Update prospect status in campaign_prospects table
    const { data: updateResult, error: updateError } = await supabase
      .from('campaign_prospects')
      .update(updateData)
      .eq('id', prospectId)
      .select();

    if (updateError) {
      console.error('❌ Failed to update prospect status:', updateError);
      return NextResponse.json(
        {
          error: 'Failed to update prospect status',
          details: updateError.message
        },
        { status: 500 }
      );
    }

    if (!updateResult || updateResult.length === 0) {
      console.error('⚠️  Prospect not found:', prospectId);
      return NextResponse.json(
        { error: 'Prospect not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Prospect ${prospectId} status updated to: ${payload.status}`);

    // Handle different status types for additional actions
    switch (payload.status) {
      case 'connection_requested':
        await handleConnectionRequested({ ...payload, prospect_id: prospectId, campaign_id: campaignId });
        break;
      case 'email_sent':
        await handleEmailSent({ ...payload, prospect_id: prospectId, campaign_id: campaignId });
        break;
      case 'failed':
        await handleProspectFailed({ ...payload, prospect_id: prospectId, campaign_id: campaignId });
        break;
      case 'replied':
        await handleProspectReplied({ ...payload, prospect_id: prospectId, campaign_id: campaignId });
        break;
      default:
        console.log(`📊 Prospect status updated: ${payload.status}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Prospect status updated',
      prospect_id: prospectId,
      status: payload.status,
      updated: updateResult[0]
    });

  } catch (error) {
    console.error('❌ N8N Prospect Status Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleConnectionRequested(payload: any) {
  console.log('🔗 LinkedIn connection request sent:', {
    prospect_id: payload.prospect_id,
    campaign_id: payload.campaign_id,
    unipile_message_id: payload.unipile_message_id
  });

  // Log to campaign activity
  if (payload.campaign_id) {
    await supabase
      .from('campaign_activity_log')
      .insert({
        campaign_id: payload.campaign_id,
        prospect_id: payload.prospect_id,
        activity_type: 'connection_requested',
        message: 'LinkedIn connection request sent',
        metadata: {
          unipile_message_id: payload.unipile_message_id,
          timestamp: new Date().toISOString()
        }
      });
  }
}

async function handleEmailSent(payload: any) {
  console.log('📧 Email sent to prospect:', {
    prospect_id: payload.prospect_id,
    campaign_id: payload.campaign_id,
    email_provider: payload.email_provider
  });

  // Log to campaign activity
  if (payload.campaign_id) {
    await supabase
      .from('campaign_activity_log')
      .insert({
        campaign_id: payload.campaign_id,
        prospect_id: payload.prospect_id,
        activity_type: 'email_sent',
        message: 'Email sent successfully',
        metadata: {
          email_provider: payload.email_provider,
          timestamp: new Date().toISOString()
        }
      });
  }
}

async function handleProspectFailed(payload: any) {
  console.error('❌ Prospect outreach failed:', {
    prospect_id: payload.prospect_id,
    error: payload.error_message
  });

  // Log failure to campaign activity
  if (payload.campaign_id) {
    await supabase
      .from('campaign_activity_log')
      .insert({
        campaign_id: payload.campaign_id,
        prospect_id: payload.prospect_id,
        activity_type: 'failed',
        message: `Outreach failed: ${payload.error_message}`,
        metadata: {
          error: payload.error_message,
          timestamp: new Date().toISOString()
        }
      });
  }
}

async function handleProspectReplied(payload: any) {
  console.log('💬 Prospect replied:', {
    prospect_id: payload.prospect_id,
    campaign_id: payload.campaign_id,
    reply_snippet: payload.reply_snippet
  });

  // Update prospect to trigger reply agent
  await supabase
    .from('campaign_prospects')
    .update({
      requires_reply_agent: true,
      last_reply_at: new Date().toISOString()
    })
    .eq('id', payload.prospect_id);

  // Log to campaign activity
  if (payload.campaign_id) {
    await supabase
      .from('campaign_activity_log')
      .insert({
        campaign_id: payload.campaign_id,
        prospect_id: payload.prospect_id,
        activity_type: 'replied',
        message: 'Prospect replied to outreach',
        metadata: {
          reply_snippet: payload.reply_snippet,
          timestamp: new Date().toISOString()
        }
      });
  }
}
