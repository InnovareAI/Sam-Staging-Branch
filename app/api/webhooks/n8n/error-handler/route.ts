/**
 * N8N Error Handler Webhook
 *
 * Called by N8N workflow when errors occur during campaign execution
 * Handles rate limits, Unipile errors, and other failures
 */

import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface N8NErrorPayload {
  executionId: string;
  workflowId: string;
  nodeName: string;
  error: {
    message: string;
    description?: string;
    httpCode?: number;
    cause?: any;
  };
  prospectId?: string;
  campaignId?: string;
  unipileAccountId?: string;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const payload: N8NErrorPayload = await request.json();

    console.log('🚨 N8N Error Handler:', {
      execution: payload.executionId,
      node: payload.nodeName,
      error: payload.error.message
    });

    // Determine error type and appropriate action
    const errorType = classifyError(payload.error);

    // Handle based on error type
    switch (errorType) {
      case 'rate_limit':
        await handleRateLimit(supabase, payload);
        break;

      case 'account_not_found':
        await handleAccountNotFound(supabase, payload);
        break;

      case 'invalid_data':
        await handleInvalidData(supabase, payload);
        break;

      case 'temporary_error':
        await handleTemporaryError(supabase, payload);
        break;

      default:
        await handleUnknownError(supabase, payload);
    }

    // Log the error
    await logError(supabase, payload, errorType);

    return NextResponse.json({
      success: true,
      errorType,
      action: getActionDescription(errorType)
    });

  } catch (error) {
    console.error('Error in N8N error handler:', error);
    return NextResponse.json(
      { error: 'Failed to process error' },
      { status: 500 }
    );
  }
}

// Classify error type from error message
function classifyError(error: any): string {
  const message = error.message?.toLowerCase() || '';
  const description = error.description?.toLowerCase() || '';
  const httpCode = error.httpCode;

  // Rate limit errors
  if (
    message.includes('rate limit') ||
    message.includes('provider limit') ||
    message.includes('too many requests') ||
    httpCode === 429
  ) {
    return 'rate_limit';
  }

  // Account/authentication errors
  if (
    message.includes('account not found') ||
    message.includes('authentication failed') ||
    message.includes('invalid account') ||
    httpCode === 401 ||
    httpCode === 403 ||
    httpCode === 404
  ) {
    return 'account_not_found';
  }

  // Data validation errors
  if (
    message.includes('invalid') ||
    message.includes('malformed') ||
    message.includes('required field') ||
    httpCode === 400
  ) {
    return 'invalid_data';
  }

  // Temporary/network errors
  if (
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('network') ||
    httpCode === 502 ||
    httpCode === 503 ||
    httpCode === 504
  ) {
    return 'temporary_error';
  }

  return 'unknown';
}

// Handle rate limit error
async function handleRateLimit(supabase: any, payload: N8NErrorPayload) {
  if (!payload.prospectId) return;

  // Determine if this is a CR (connection request) or messenger rate limit
  const isConnectionRequest = payload.nodeName?.includes('Send CR') ||
                               payload.nodeName?.includes('Connection Request');

  if (isConnectionRequest) {
    // CR rate limits = 24 hour wait (resets next day)
    console.log(`⏸️ CR rate limit detected - marking prospect ${payload.prospectId} as rate_limited_cr (account: ${payload.unipileAccountId})`);

    await supabase
      .from('campaign_prospects')
      .update({
        status: 'rate_limited_cr',
        unipile_account_id: payload.unipileAccountId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', payload.prospectId);

    // The auto_retry_rate_limited_prospects() will retry after 24 hours
  } else {
    // Messenger rate limits = shorter wait (1 hour)
    console.log(`⏸️ Messenger rate limit detected - marking prospect ${payload.prospectId} as rate_limited_message (account: ${payload.unipileAccountId})`);

    await supabase
      .from('campaign_prospects')
      .update({
        status: 'rate_limited_message',
        unipile_account_id: payload.unipileAccountId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', payload.prospectId);

    // Auto-retry will happen after 1 hour for messenger
  }
}

// Handle account not found error
async function handleAccountNotFound(supabase: any, payload: N8NErrorPayload) {
  if (!payload.campaignId) return;

  console.log(`🛑 Account not found - pausing campaign ${payload.campaignId}`);

  // Pause the campaign
  await supabase
    .from('campaigns')
    .update({
      status: 'paused',
      updated_at: new Date().toISOString()
    })
    .eq('id', payload.campaignId);

  // Update prospect if provided
  if (payload.prospectId) {
    await supabase
      .from('campaign_prospects')
      .update({
        status: 'account_error',
        updated_at: new Date().toISOString()
      })
      .eq('id', payload.prospectId);
  }
}

// Handle invalid data error
async function handleInvalidData(supabase: any, payload: N8NErrorPayload) {
  if (!payload.prospectId) return;

  console.log(`❌ Invalid data - marking prospect ${payload.prospectId} as failed`);

  // Mark prospect as failed (won't retry)
  await supabase
    .from('campaign_prospects')
    .update({
      status: 'failed',
      updated_at: new Date().toISOString()
    })
    .eq('id', payload.prospectId);
}

// Handle temporary error
async function handleTemporaryError(supabase: any, payload: N8NErrorPayload) {
  if (!payload.prospectId) return;

  console.log(`🔄 Temporary error - marking prospect ${payload.prospectId} for retry`);

  // Mark for retry (will be picked up by auto_cleanup_stale_executions)
  await supabase
    .from('campaign_prospects')
    .update({
      status: 'queued_for_retry',
      updated_at: new Date().toISOString()
    })
    .eq('id', payload.prospectId);
}

// Handle unknown error
async function handleUnknownError(supabase: any, payload: N8NErrorPayload) {
  if (!payload.prospectId) return;

  console.log(`⚠️ Unknown error - marking prospect ${payload.prospectId} as error`);

  // Mark as error for manual review
  await supabase
    .from('campaign_prospects')
    .update({
      status: 'error',
      updated_at: new Date().toISOString()
    })
    .eq('id', payload.prospectId);
}

// Log error for debugging
async function logError(supabase: any, payload: N8NErrorPayload, errorType: string) {
  // You could create an error_logs table to track these
  console.log('📝 Logging N8N error:', {
    executionId: payload.executionId,
    errorType,
    nodeName: payload.nodeName,
    prospectId: payload.prospectId,
    campaignId: payload.campaignId,
    error: payload.error.message
  });
}

function getActionDescription(errorType: string): string {
  const actions: Record<string, string> = {
    rate_limit: 'Marked as rate_limited (CRs: 24hr, Messages: 1hr retry)',
    account_not_found: 'Paused campaign, marked prospect as account_error',
    invalid_data: 'Marked prospect as failed (won\'t retry)',
    temporary_error: 'Marked for retry in next cleanup cycle',
    unknown: 'Marked as error for manual review'
  };

  return actions[errorType] || 'No action taken';
}
