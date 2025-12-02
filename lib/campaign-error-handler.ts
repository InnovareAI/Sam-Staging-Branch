/**
 * Campaign Error Handler - Unified error classification and handling
 *
 * This module provides consistent error handling across all campaign-related operations.
 * It classifies errors, determines if they're retryable, and provides user-friendly messages.
 */

export type CampaignErrorType =
  | 'NOT_CONNECTED'        // Prospect not 1st degree connection
  | 'ALREADY_INVITED'      // Pending invitation already exists
  | 'INVITATION_DECLINED'  // Prospect declined or withdrew invitation
  | 'RATE_LIMITED'         // LinkedIn API rate limit hit
  | 'PROFILE_NOT_FOUND'    // LinkedIn profile doesn't exist or is private
  | 'ACCOUNT_ERROR'        // LinkedIn account issue (disconnected, blocked)
  | 'NETWORK_ERROR'        // Temporary network/API error
  | 'INVALID_DATA'         // Missing required data (no LinkedIn URL, etc.)
  | 'UNKNOWN';             // Unclassified error

export interface ClassifiedError {
  type: CampaignErrorType;
  retryable: boolean;
  retryAfterMinutes: number | null;
  userMessage: string;
  technicalMessage: string;
  prospectStatus: string;  // What status to set on campaign_prospects
}

/**
 * Classify an error from Unipile or campaign processing
 */
export function classifyError(error: Error | string): ClassifiedError {
  const message = typeof error === 'string' ? error : error.message;
  const lowerMessage = message.toLowerCase();

  // Rate limiting - RETRYABLE
  if (lowerMessage.includes('rate') || lowerMessage.includes('limit') || lowerMessage.includes('throttle') || lowerMessage.includes('429')) {
    return {
      type: 'RATE_LIMITED',
      retryable: true,
      retryAfterMinutes: 240, // 4 hours
      userMessage: 'LinkedIn rate limit reached. Will retry automatically in 4 hours.',
      technicalMessage: message,
      prospectStatus: 'rate_limited'
    };
  }

  // Already invited - NOT RETRYABLE
  if (lowerMessage.includes('already') || lowerMessage.includes('pending') || lowerMessage.includes('should delay') || lowerMessage.includes('invitation')) {
    return {
      type: 'ALREADY_INVITED',
      retryable: false,
      retryAfterMinutes: null,
      userMessage: 'A pending invitation already exists for this prospect.',
      technicalMessage: message,
      prospectStatus: 'already_invited'
    };
  }

  // Invitation declined/withdrawn - NOT RETRYABLE
  if (lowerMessage.includes('declined') || lowerMessage.includes('withdrawn') || lowerMessage.includes('reject')) {
    return {
      type: 'INVITATION_DECLINED',
      retryable: false,
      retryAfterMinutes: null,
      userMessage: 'This prospect has previously declined or withdrawn a connection request.',
      technicalMessage: message,
      prospectStatus: 'invitation_declined'
    };
  }

  // Not connected (for messenger campaigns) - NOT RETRYABLE without action
  if (lowerMessage.includes('not connected') || lowerMessage.includes('first_degree') || lowerMessage.includes('out_of_network') || lowerMessage.includes('2nd') || lowerMessage.includes('3rd')) {
    return {
      type: 'NOT_CONNECTED',
      retryable: false,
      retryAfterMinutes: null,
      userMessage: 'This prospect is not a 1st degree connection. Use a Connector campaign to send a connection request first.',
      technicalMessage: message,
      prospectStatus: 'failed'
    };
  }

  // Profile not found - NOT RETRYABLE
  if (lowerMessage.includes('not found') || lowerMessage.includes('404') || lowerMessage.includes('profile') && lowerMessage.includes('error')) {
    return {
      type: 'PROFILE_NOT_FOUND',
      retryable: false,
      retryAfterMinutes: null,
      userMessage: 'LinkedIn profile not found. The profile may be private or no longer exists.',
      technicalMessage: message,
      prospectStatus: 'failed'
    };
  }

  // Account issues - NOT RETRYABLE without action
  if (lowerMessage.includes('account') || lowerMessage.includes('unauthorized') || lowerMessage.includes('401') || lowerMessage.includes('credentials')) {
    return {
      type: 'ACCOUNT_ERROR',
      retryable: false,
      retryAfterMinutes: null,
      userMessage: 'LinkedIn account issue. Please reconnect your LinkedIn account.',
      technicalMessage: message,
      prospectStatus: 'failed'
    };
  }

  // Network/temporary errors - RETRYABLE
  if (lowerMessage.includes('timeout') || lowerMessage.includes('network') || lowerMessage.includes('500') || lowerMessage.includes('502') || lowerMessage.includes('503') || lowerMessage.includes('temporary')) {
    return {
      type: 'NETWORK_ERROR',
      retryable: true,
      retryAfterMinutes: 30,
      userMessage: 'Temporary network error. Will retry automatically in 30 minutes.',
      technicalMessage: message,
      prospectStatus: 'pending'  // Keep pending for retry
    };
  }

  // Invalid data - NOT RETRYABLE
  if (lowerMessage.includes('missing') || lowerMessage.includes('invalid') || lowerMessage.includes('required')) {
    return {
      type: 'INVALID_DATA',
      retryable: false,
      retryAfterMinutes: null,
      userMessage: 'Missing required data for this prospect.',
      technicalMessage: message,
      prospectStatus: 'failed'
    };
  }

  // Unknown error - default to retryable with longer delay
  return {
    type: 'UNKNOWN',
    retryable: true,
    retryAfterMinutes: 60,
    userMessage: 'An unexpected error occurred. Will retry automatically.',
    technicalMessage: message,
    prospectStatus: 'pending'
  };
}

/**
 * Format error for logging
 */
export function formatErrorLog(error: ClassifiedError, context: { prospectId?: string; campaignId?: string }): string {
  return `[${error.type}] ${error.technicalMessage} | Retryable: ${error.retryable} | Prospect: ${context.prospectId || 'N/A'} | Campaign: ${context.campaignId || 'N/A'}`;
}

/**
 * Get retry timestamp based on error classification
 */
export function getRetryTime(error: ClassifiedError): Date | null {
  if (!error.retryable || !error.retryAfterMinutes) {
    return null;
  }
  return new Date(Date.now() + error.retryAfterMinutes * 60 * 1000);
}

/**
 * Determine if an error should stop the entire batch or just skip this prospect
 */
export function shouldStopBatch(error: ClassifiedError): boolean {
  // Rate limiting and account errors should stop the batch
  return error.type === 'RATE_LIMITED' || error.type === 'ACCOUNT_ERROR';
}

/**
 * Standard prospect statuses for campaign_prospects table
 */
export const PROSPECT_STATUSES = {
  // Initial states
  PENDING: 'pending',
  QUEUED: 'queued',

  // Connection request flow
  CR_SENT: 'connection_request_sent',
  CONNECTED: 'connected',

  // Messaging flow
  MESSAGING: 'messaging',
  REPLIED: 'replied',

  // End states
  COMPLETED: 'completed',
  FAILED: 'failed',

  // Error states (retryable)
  RATE_LIMITED: 'rate_limited',

  // Error states (permanent)
  ALREADY_INVITED: 'already_invited',
  INVITATION_DECLINED: 'invitation_declined'
} as const;

export type ProspectStatus = typeof PROSPECT_STATUSES[keyof typeof PROSPECT_STATUSES];
