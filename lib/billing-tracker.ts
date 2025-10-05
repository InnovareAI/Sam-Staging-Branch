/**
 * Billing Usage Tracker Utility
 *
 * Simplifies usage tracking for billing across the application
 */

type UsageType = 'message' | 'campaign' | 'prospect' | 'ai_credits'

interface TrackUsageParams {
  workspaceId: string
  usageType: UsageType
  quantity?: number
  metadata?: Record<string, any>
}

/**
 * Track usage for billing purposes
 *
 * @param params - Usage tracking parameters
 * @returns Promise<boolean> - true if tracked, false if in trial period
 */
export async function trackUsage(params: TrackUsageParams): Promise<boolean> {
  try {
    const response = await fetch('/api/billing/track-usage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: params.workspaceId,
        usageType: params.usageType,
        quantity: params.quantity || 1,
        metadata: params.metadata || null
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Failed to track usage:', data.error)
      return false
    }

    return data.tracked || false
  } catch (error) {
    console.error('Usage tracking error:', error)
    return false
  }
}

/**
 * Track message sent
 */
export async function trackMessage(workspaceId: string, metadata?: Record<string, any>) {
  return trackUsage({
    workspaceId,
    usageType: 'message',
    quantity: 1,
    metadata
  })
}

/**
 * Track campaign created
 */
export async function trackCampaign(workspaceId: string, metadata?: Record<string, any>) {
  return trackUsage({
    workspaceId,
    usageType: 'campaign',
    quantity: 1,
    metadata
  })
}

/**
 * Track prospect added
 */
export async function trackProspect(workspaceId: string, quantity: number = 1, metadata?: Record<string, any>) {
  return trackUsage({
    workspaceId,
    usageType: 'prospect',
    quantity,
    metadata
  })
}

/**
 * Track AI credits consumed
 */
export async function trackAICredits(workspaceId: string, credits: number, metadata?: Record<string, any>) {
  return trackUsage({
    workspaceId,
    usageType: 'ai_credits',
    quantity: credits,
    metadata
  })
}

/**
 * Get usage summary for a workspace
 */
export async function getUsageSummary(
  workspaceId: string,
  startDate?: string,
  endDate?: string
): Promise<any> {
  try {
    const params = new URLSearchParams({ workspaceId })
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)

    const response = await fetch(`/api/billing/track-usage?${params}`)

    if (!response.ok) {
      console.error('Failed to get usage summary')
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Usage summary error:', error)
    return null
  }
}
