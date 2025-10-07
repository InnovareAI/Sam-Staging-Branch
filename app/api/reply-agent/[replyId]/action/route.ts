/**
 * Reply Agent HITL Action Handler
 * Handles approve/edit/refuse actions on SAM-generated reply drafts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

interface HITLAction {
  action: 'approve' | 'edit' | 'refuse'
  editedMessage?: string  // Required for 'edit' action
  refusalReason?: string  // Optional for 'refuse' action
}

export async function POST(
  request: NextRequest,
  { params }: { params: { replyId: string } }
) {
  try {
    const supabase = await createClient()

    // 1. Authenticate user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { replyId } = params
    const actionData: HITLAction = await request.json()

    console.log('📋 HITL Action on reply draft:', {
      replyId,
      action: actionData.action,
      userId: user.id
    })

    // 2. Get reply record
    const { data: reply, error: replyError } = await supabase
      .from('campaign_replies')
      .select(`
        *,
        campaigns(id, name, workspace_id, channel),
        workspace_prospects(id, name, company, email, linkedin_url)
      `)
      .eq('id', replyId)
      .single()

    if (replyError || !reply) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 })
    }

    // 3. Verify user has access to workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', reply.campaigns.workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // 4. Handle action
    switch (actionData.action) {
      case 'approve':
        return await handleApprove(supabase, reply, user.id)

      case 'edit':
        if (!actionData.editedMessage) {
          return NextResponse.json(
            { error: 'Edited message required for edit action' },
            { status: 400 }
          )
        }
        return await handleEdit(supabase, reply, actionData.editedMessage, user.id)

      case 'refuse':
        return await handleRefuse(supabase, reply, actionData.refusalReason, user.id)

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('❌ Error processing HITL action:', error)
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    )
  }
}

/**
 * Handle APPROVE action
 * User approves SAM's draft as-is
 */
async function handleApprove(supabase: any, reply: any, userId: string) {
  console.log('✅ HITL APPROVED draft:', reply.id)

  // 1. Update reply status
  await supabase
    .from('campaign_replies')
    .update({
      status: 'approved',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      final_message: reply.ai_suggested_response,  // Use SAM's draft as-is
      requires_review: false
    })
    .eq('id', reply.id)

  // 2. Queue message for sending
  const queueResult = await queueMessageForSending({
    replyId: reply.id,
    prospectId: reply.workspace_prospects.id,
    campaignId: reply.campaigns.id,
    channel: reply.campaigns.channel || 'email',
    message: reply.ai_suggested_response,
    prospectEmail: reply.workspace_prospects.email,
    prospectLinkedIn: reply.workspace_prospects.linkedin_url
  })

  console.log('📤 Message queued for sending:', queueResult.messageId)

  return NextResponse.json({
    success: true,
    action: 'approved',
    message: 'Draft approved and queued for sending',
    messageId: queueResult.messageId,
    scheduledSendTime: queueResult.scheduledSendTime
  })
}

/**
 * Handle EDIT action
 * User modifies SAM's draft before sending
 */
async function handleEdit(supabase: any, reply: any, editedMessage: string, userId: string) {
  console.log('✏️  HITL EDITED draft:', reply.id)

  // 1. Update reply with edited message
  await supabase
    .from('campaign_replies')
    .update({
      status: 'edited',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      final_message: editedMessage,  // Use HITL's edited version
      requires_review: false,
      metadata: {
        ...reply.metadata,
        original_draft: reply.ai_suggested_response,
        edit_made_at: new Date().toISOString(),
        edit_made_by: userId
      }
    })
    .eq('id', reply.id)

  // 2. Queue edited message for sending
  const queueResult = await queueMessageForSending({
    replyId: reply.id,
    prospectId: reply.workspace_prospects.id,
    campaignId: reply.campaigns.id,
    channel: reply.campaigns.channel || 'email',
    message: editedMessage,
    prospectEmail: reply.workspace_prospects.email,
    prospectLinkedIn: reply.workspace_prospects.linkedin_url
  })

  console.log('📤 Edited message queued for sending:', queueResult.messageId)

  return NextResponse.json({
    success: true,
    action: 'edited',
    message: 'Draft edited and queued for sending',
    messageId: queueResult.messageId,
    scheduledSendTime: queueResult.scheduledSendTime
  })
}

/**
 * Handle REFUSE action
 * User rejects the draft, no message sent
 */
async function handleRefuse(supabase: any, reply: any, refusalReason: string | undefined, userId: string) {
  console.log('❌ HITL REFUSED draft:', reply.id)

  // 1. Update reply status
  await supabase
    .from('campaign_replies')
    .update({
      status: 'refused',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      requires_review: false,
      metadata: {
        ...reply.metadata,
        refusal_reason: refusalReason || 'No reason provided',
        refused_at: new Date().toISOString(),
        refused_by: userId
      }
    })
    .eq('id', reply.id)

  console.log('🗑️  Draft refused, no message sent')

  return NextResponse.json({
    success: true,
    action: 'refused',
    message: 'Draft refused, no message will be sent'
  })
}

/**
 * Queue message for sending via appropriate channel
 * Creates outbox record and schedules via N8N or Unipile
 */
async function queueMessageForSending(params: {
  replyId: string
  prospectId: string
  campaignId: string
  channel: 'email' | 'linkedin' | 'both'
  message: string
  prospectEmail?: string
  prospectLinkedIn?: string
}) {
  const supabase = await createClient()

  // 1. Create outbox record
  const { data: outboxMessage, error: outboxError } = await supabase
    .from('message_outbox')
    .insert({
      campaign_id: params.campaignId,
      prospect_id: params.prospectId,
      reply_id: params.replyId,
      channel: params.channel,
      message_content: params.message,
      status: 'queued',
      scheduled_send_time: new Date(Date.now() + 60000).toISOString(), // Send in 1 minute
      metadata: {
        created_via: 'reply_agent_hitl',
        created_at: new Date().toISOString()
      }
    })
    .select()
    .single()

  if (outboxError) {
    console.error('Failed to create outbox record:', outboxError)
    throw new Error('Failed to queue message')
  }

  console.log('📦 Outbox record created:', outboxMessage.id)

  // 2. Trigger sending via appropriate service
  if (params.channel === 'email' || params.channel === 'both') {
    await scheduleEmailSend({
      messageId: outboxMessage.id,
      to: params.prospectEmail!,
      body: params.message,
      prospectId: params.prospectId,
      campaignId: params.campaignId
    })
  }

  if (params.channel === 'linkedin' || params.channel === 'both') {
    await scheduleLinkedInSend({
      messageId: outboxMessage.id,
      prospectLinkedInUrl: params.prospectLinkedIn!,
      message: params.message,
      prospectId: params.prospectId,
      campaignId: params.campaignId
    })
  }

  return {
    messageId: outboxMessage.id,
    scheduledSendTime: outboxMessage.scheduled_send_time
  }
}

/**
 * Schedule email send via Unipile or direct SMTP
 */
async function scheduleEmailSend(params: {
  messageId: string
  to: string
  body: string
  prospectId: string
  campaignId: string
}) {
  console.log('📧 Scheduling email send:', params.messageId)

  // Option 1: Use N8N workflow for sending
  const n8nResponse = await fetch(process.env.N8N_INSTANCE_URL + '/webhook/send-email-reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.N8N_API_KEY}`
    },
    body: JSON.stringify({
      messageId: params.messageId,
      to: params.to,
      body: params.body,
      prospectId: params.prospectId,
      campaignId: params.campaignId
    })
  })

  if (!n8nResponse.ok) {
    throw new Error(`N8N workflow failed: ${n8nResponse.statusText}`)
  }

  console.log('✅ Email scheduled via N8N')
}

/**
 * Schedule LinkedIn message send via Unipile
 */
async function scheduleLinkedInSend(params: {
  messageId: string
  prospectLinkedInUrl: string
  message: string
  prospectId: string
  campaignId: string
}) {
  console.log('💼 Scheduling LinkedIn send:', params.messageId)

  // Use Unipile MCP tool or direct API
  const n8nResponse = await fetch(process.env.N8N_INSTANCE_URL + '/webhook/send-linkedin-message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.N8N_API_KEY}`
    },
    body: JSON.stringify({
      messageId: params.messageId,
      prospectLinkedInUrl: params.prospectLinkedInUrl,
      message: params.message,
      prospectId: params.prospectId,
      campaignId: params.campaignId
    })
  })

  if (!n8nResponse.ok) {
    throw new Error(`N8N workflow failed: ${n8nResponse.statusText}`)
  }

  console.log('✅ LinkedIn message scheduled via N8N')
}
