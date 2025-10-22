/**
 * Subscription Guard - Restricts access when payment is past due
 * Used across API routes to prevent campaign actions when subscription is inactive
 */

import { apiError } from '@/lib/api-error-handler'

export interface SubscriptionStatus {
  isActive: boolean
  status: string
  message?: string
}

/**
 * Check if workspace has an active subscription
 * Returns error if subscription is past_due, canceled, or unpaid
 */
export async function checkSubscriptionAccess(
  supabase: any,
  workspaceId: string
): Promise<SubscriptionStatus> {
  // Get workspace subscription status
  const { data: workspace, error } = await supabase
    .from('workspaces')
    .select('subscription_status, name')
    .eq('id', workspaceId)
    .single()

  if (error || !workspace) {
    throw apiError.notFound('Workspace')
  }

  const status = workspace.subscription_status

  // Check if subscription is active
  if (!status || status === 'active' || status === 'trialing') {
    return {
      isActive: true,
      status: status || 'active'
    }
  }

  // Subscription is not active - block campaign actions
  const restrictedStatuses: Record<string, string> = {
    past_due: 'Payment failed. Please update your payment method to resume campaigns.',
    canceled: 'Subscription canceled. Please reactivate your subscription to use campaigns.',
    unpaid: 'Payment required. Please update your payment method to continue.',
    incomplete: 'Subscription setup incomplete. Please complete your subscription setup.'
  }

  const message = restrictedStatuses[status] || 'Subscription inactive. Please contact support.'

  return {
    isActive: false,
    status,
    message
  }
}

/**
 * Require active subscription for campaign actions
 * Throws error if subscription is not active
 */
export async function requireActiveSubscription(
  supabase: any,
  workspaceId: string
): Promise<void> {
  const subscriptionStatus = await checkSubscriptionAccess(supabase, workspaceId)

  if (!subscriptionStatus.isActive) {
    throw apiError.forbidden(
      subscriptionStatus.message || 'Subscription required',
      { subscription_status: subscriptionStatus.status }
    )
  }
}

/**
 * Get subscription status for UI display
 * Returns status without throwing error
 */
export async function getSubscriptionStatus(
  supabase: any,
  workspaceId: string
): Promise<SubscriptionStatus> {
  try {
    return await checkSubscriptionAccess(supabase, workspaceId)
  } catch (error) {
    // Return inactive status if check fails
    return {
      isActive: false,
      status: 'unknown',
      message: 'Unable to verify subscription status'
    }
  }
}
